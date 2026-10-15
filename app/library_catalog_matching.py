"""Explicit, read-only catalog proposals and owner-scoped confirmed library links.

This deliberately does not change the automatic PSN import matching thresholds.
"""

from __future__ import annotations

from difflib import SequenceMatcher
import re

from fastapi import HTTPException
from sqlalchemy import or_

from app.alert_ownership import pause_owned_alerts
from app.database import Game
from app.integrations.igdb import IGDBError, fetch_igdb_localized_games
from app.psn_catalog_matcher import (
    PSN_CATALOG_MATCHER_VERSION, PsnCatalogEvidence, build_psn_query_variants,
    normalize_psn_catalog_identity, normalize_query_punctuation, strip_psn_platform_wrapper,
)
from app.psn_library_enrichment import _merge_game_psn_catalog_evidence, _psn_game_catalog_evidence
from app.psn_resolution import resolve_psn_catalog_titles


MAX_LIBRARY_QUERY_VARIANTS = 6
MAX_LIBRARY_SUGGESTIONS = 5
RETRIEVAL_EDITION = re.compile(
    r"\s*[-–—:]?\s*(?:(?:standard|complete|deluxe|ultimate|special|definitive|game of the year)\s+edition|"
    r"(?:стандартное|полное|расширенное)\s+издание|director['’]?s\s+cut)\s*$", re.IGNORECASE
)
VARIANT_WORDS = re.compile(r"\b(?:demo|beta|prototype|демо|бета|прототип)\b", re.IGNORECASE)
DECORATIVE_YEAR = re.compile(r"\s*[\[(](?:19|20)\d{2}[\])]\s*$")


def _clean_title(title: str) -> str:
    return strip_psn_platform_wrapper(normalize_query_punctuation(title)).strip('«»"“” ')


def library_query_variants(evidence: PsnCatalogEvidence) -> tuple[str, ...]:
    """Keep original evidence, then clean wrappers/editions only for retrieval."""
    queries = []
    for title in (evidence.title, *evidence.aliases):
        clean = _clean_title(title)
        base = RETRIEVAL_EDITION.sub("", clean).strip(" -:")
        yearless = _clean_title(DECORATIVE_YEAR.sub("", title))
        for value in (title.strip(), clean, base, yearless, *build_psn_query_variants(PsnCatalogEvidence(base))):
            if value and value.casefold() not in {query.casefold() for query in queries}:
                queries.append(value)
            if len(queries) >= MAX_LIBRARY_QUERY_VARIANTS:
                return tuple(queries)
    return tuple(queries)


def _comparison_key(title: str) -> str:
    return normalize_psn_catalog_identity(_clean_title(title))


def _retrieval_key(title: str) -> str:
    return normalize_psn_catalog_identity(VARIANT_WORDS.sub("", RETRIEVAL_EDITION.sub("", _clean_title(title))))


def rank_suggestions(evidence: PsnCatalogEvidence, candidates: list[dict], *, source: str) -> list[dict]:
    """Fuzzy similarities are review proposals, never evidence for auto-linking."""
    source_keys = {_comparison_key(value) for value in (evidence.title, *evidence.aliases)} - {""}
    source_retrieval = {_retrieval_key(value) for value in (evidence.title, *evidence.aliases)} - {""}
    primary_numbers = re.findall(r"\d+", _comparison_key(evidence.title))
    source_year = DECORATIVE_YEAR.search(evidence.title)
    year = int(re.search(r'\d{4}', source_year.group())[0]) if source_year else None
    ranked = []
    hydrated = {}
    for game in candidates:
        if not isinstance(game, dict):
            continue
        catalog_id, title = game.get("id"), game.get("name")
        if type(catalog_id) is not int or catalog_id < 1 or not isinstance(title, str) or not title.strip():
            continue
        if catalog_id not in hydrated:
            hydrated[catalog_id] = dict(game)
        else:
            for field in ("localized_names", "alternative_names", "platforms"):
                hydrated[catalog_id][field] = list(dict.fromkeys(
                    value for value in [*(hydrated[catalog_id].get(field) or []), *(game.get(field) or [])]
                    if isinstance(value, str)))
    for catalog_id, game in hydrated.items():
        title = game["name"]
        names = [title, *(value for value in game.get("alternative_names") or [] if isinstance(value, str)),
                 *(value for value in game.get("localized_names") or [] if isinstance(value, str))]
        candidate_keys = {_comparison_key(value) for value in names} - {""}
        exact = bool(source_keys & candidate_keys)
        if primary_numbers and not any(re.findall(r"\d+", key) == primary_numbers for key in candidate_keys):
            exact = False
        if _comparison_key(evidence.title) != _retrieval_key(evidence.title) and _comparison_key(evidence.title) not in candidate_keys:
            exact = False
        score = max((SequenceMatcher(None, left, right).ratio()
                     for left in source_retrieval for right in map(_retrieval_key, names)), default=0)
        if not exact and score < .55:
            continue
        platforms = [value for value in game.get("platforms") or [] if isinstance(value, str)]
        if source == "psn" and platforms:
            expected = tuple(value.casefold().replace("ps4", "playstation 4").replace("ps5", "playstation 5")
                             for value in evidence.platforms)
            if not any("playstation" in value.casefold() for value in platforms):
                exact = False
            elif expected and not any(left in right.casefold() for left in expected for right in platforms):
                exact = False
        release = str(game.get('released') or '')
        released_year = int(release[:4]) if release[:4].isdigit() else None
        year_distance = abs(released_year - year) if year and released_year else 1000 if year else 0
        platform_match = int(source == 'psn' and any('playstation' in value.casefold() for value in platforms))
        rating_count = game.get('rating_count') if type(game.get('rating_count')) is int else 0
        ranked.append((exact, platform_match, year_distance, score, rating_count, catalog_id, {
            "id": catalog_id, "title": title, "released": game.get("released"),
            "platforms": platforms, "confidence": "exact" if exact else "likely",
            "cover_url": game.get("cover_image") or game.get("background_image"),
        }))
    ranked.sort(key=lambda value: (-value[0], -value[1], value[2], -value[3], -value[4], value[5]))
    return [value[-1] for value in ranked[:MAX_LIBRARY_SUGGESTIONS]]


async def preview_library_catalog_matches(games, *, batch_fetcher, single_fetcher, localization_fetcher=None,
                                        translation_fetcher=None):
    """Resolve bounded variants, including previously reviewed rows, without writes."""
    evidence = {game.id: _psn_game_catalog_evidence(game) for game in games}
    variants = {key: library_query_variants(value) for key, value in evidence.items()}
    queries = list(dict.fromkeys(query for values in variants.values() for query in values))
    resolutions = await resolve_psn_catalog_titles(queries, max_fallback_titles=10,
        batch_fetcher=batch_fetcher, single_fetcher=single_fetcher)
    localized = {}
    localization_failed = set()
    local_queries = list(dict.fromkeys(query for game in games
        if not any(item["confidence"] == "exact" for item in rank_suggestions(evidence[game.id],
            [item for query in variants[game.id] for item in resolutions[query].results], source=game.source))
        for query in variants[game.id]))
    for offset in range(0, len(local_queries), 10):
        batch = local_queries[offset:offset + 10]
        try:
            result = await (localization_fetcher or fetch_igdb_localized_games)(batch)
            if not isinstance(result, dict):
                raise ValueError("Invalid localized catalog response")
            localized.update(result)
        except (IGDBError, ValueError, TypeError):
            localization_failed.update(batch)
    translations = {}
    translated_candidates = {}
    if translation_fetcher:
        missing = [game.title for game in games
                   if any(char.isalpha() and ord(char) > 0x024f for char in _clean_title(game.title))
                   and not rank_suggestions(evidence[game.id], [item for query in variants[game.id]
                       for item in [*resolutions[query].results, *(localized.get(query) or [])]], source=game.source)]
        if missing:
            translations = await translation_fetcher(missing)
            names = list(dict.fromkeys(name for values in translations.values() if values for name in values))
            translated_candidates = await resolve_psn_catalog_titles(names, max_fallback_titles=10,
                batch_fetcher=batch_fetcher, single_fetcher=single_fetcher)
    items = []
    for game in games:
        row_queries = variants[game.id]
        candidates = [item for query in row_queries for item in [
            *resolutions[query].results, *(localized.get(query) or [])] if isinstance(item, dict)]
        suggestions = rank_suggestions(evidence[game.id], candidates, source=game.source)
        unavailable = any(resolutions[query].kind == "unavailable" or query in localization_failed for query in row_queries)
        if game.title in translations:
            names = translations[game.title]
            unavailable = unavailable or names is None
            if names:
                translated_evidence = PsnCatalogEvidence(evidence[game.id].title,
                    aliases=(*evidence[game.id].aliases, *names), platforms=evidence[game.id].platforms)
                suggestions = [{**item, 'confidence': 'likely'} for item in rank_suggestions(
                    translated_evidence, [item for name in names for item in translated_candidates[name].results], source=game.source)]
                unavailable = unavailable or any(translated_candidates[name].kind == 'unavailable' for name in names)
        exact_count = sum(item["confidence"] == "exact" for item in suggestions)
        status = "unavailable" if unavailable else "matched" if exact_count == 1 else "review" if suggestions else "no_match"
        if unavailable or exact_count > 1:
            suggestions = [{**item, "confidence": "likely"} for item in suggestions]
        items.append({"game_id": game.id, "title": game.title, "source": game.source,
                      "link_state": game.link_state or ("linked" if game.catalog_game_id else "raw"),
                      "catalog_game_id": game.catalog_game_id, "status": status,
                      "reason": {"unavailable": "Catalog is temporarily unavailable; try again.",
                                 "matched": "Exact title evidence found; confirm to link.",
                                 "review": "Check title, edition, year and platforms before linking.",
                                 "no_match": "No catalog candidates found."}[status],
                      "suggestions": suggestions})
    return items


def _merge_text(left: str | None, right: str | None, limit: int) -> str | None:
    if not right or right == left:
        return left
    if not left:
        return right
    combined = f"{left}\n\n{right}"
    if len(combined) > limit:
        raise HTTPException(status_code=409, detail="Duplicate notes or info need manual reconciliation")
    return combined


def _reconcile_duplicate(db, target, duplicate):
    """Use shared PSN evidence merging while retaining the confirmed row ID/title."""
    target.notes = _merge_text(target.notes, duplicate.notes, 255)
    target.info = _merge_text(target.info, duplicate.info, 500)
    target.created_at = min(target.created_at, duplicate.created_at)
    target.playtime_forever = max(target.playtime_forever or 0, duplicate.playtime_forever or 0) or None
    target.playtime_2weeks = max(target.playtime_2weeks or 0, duplicate.playtime_2weeks or 0) or None
    _merge_game_psn_catalog_evidence(target, _psn_game_catalog_evidence(duplicate))
    db.delete(duplicate)


async def apply_library_catalog_matches(db, owner_id, decisions, *, detail_fetcher):
    """Validate owner scope, stale state and every provider ID before any writes."""
    by_id = {decision.game_id: decision for decision in decisions}
    games = db.query(Game).filter(Game.owner_id == owner_id, Game.source.in_(("psn", "manual")),
                                  Game.id.in_(by_id)).order_by(Game.id).with_for_update().all()
    if len(games) != len(by_id) or any(game.link_state == "quarantined" for game in games):
        raise HTTPException(status_code=404, detail="Library entry not found")
    details = {}
    for game in games:
        decision = by_id[game.id]
        target = decision.catalog_id if decision.action == "link" else None
        if game.catalog_game_id != target and game.catalog_game_id != decision.expected_catalog_game_id:
            raise HTTPException(status_code=409, detail="Library link changed; refresh the matching preview")
    for game in games:
        decision = by_id[game.id]
        if decision.action != "link" or game.catalog_game_id == decision.catalog_id:
            continue
        if decision.catalog_id not in details:
            try:
                detail = await detail_fetcher(decision.catalog_id)
            except IGDBError as exc:
                raise HTTPException(status_code=422 if exc.status_code == 404 else 502,
                                    detail="Choose a valid catalog game" if exc.status_code == 404 else "Catalog is temporarily unavailable") from exc
            if not isinstance(detail, dict) or type(detail.get("id")) is not int or detail["id"] != decision.catalog_id or not str(detail.get("name") or "").strip():
                raise HTTPException(status_code=422, detail="Choose a valid catalog game")
            details[decision.catalog_id] = detail
    retained = {}
    for game in games:
        decision = by_id[game.id]
        if decision.action != "link":
            if game.catalog_game_id is not None:
                game.img_icon_url = None
            game.catalog_game_id, game.link_state = None, "raw"
            game.catalog_lookup_state = "skipped" if decision.action == "keep_raw" else None
            continue
        group = (game.source, decision.catalog_id)
        if group in retained:
            _reconcile_duplicate(db, retained[group], game)
            continue
        retained[group] = game
        duplicates = db.query(Game).filter(Game.owner_id == owner_id, Game.source == game.source,
            Game.catalog_game_id == decision.catalog_id, Game.id.notin_(by_id),
            or_(Game.link_state.is_(None), Game.link_state != "quarantined")).with_for_update().all()
        for duplicate in duplicates:
            if duplicate not in db.deleted:
                _reconcile_duplicate(db, game, duplicate)
        game.catalog_game_id, game.link_state = decision.catalog_id, "linked"
        game.catalog_lookup_state, game.catalog_lookup_version = None, PSN_CATALOG_MATCHER_VERSION
        detail = details.get(decision.catalog_id, {})
        cover = detail.get("background_image")
        if isinstance(cover, str) and cover.startswith(("https://", "http://")):
            game.img_icon_url = cover
        elif decision.catalog_id in details:
            game.img_icon_url = None
    db.flush()
    pause_owned_alerts(db, owner_id)
    db.commit()
    return {"updated": len(decisions)}
