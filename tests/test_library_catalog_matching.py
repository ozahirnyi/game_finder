import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.psn_catalog_matcher import PsnCatalogEvidence


def test_query_variants_clean_marks_wrappers_and_keep_edition_year_evidence():
    from app.library_catalog_matching import library_query_variants

    variants = library_query_variants(PsnCatalogEvidence("Grand Theft Auto V (PS4™)"))
    assert "Grand Theft Auto V" in variants
    assert len(variants) <= 6
    assert any("2017" in value and "Demo" in value for value in library_query_variants(
        PsnCatalogEvidence("Just Dance 2017 Demo (PS4™)")
    ))
    assert "Back 4 Blood" in library_query_variants(
        PsnCatalogEvidence("Back 4 Blood: Стандартное издание")
    )


@pytest.mark.parametrize("title,candidate,confidence", [
    ("Ведьмак 3: Дикая Охота", {"id": 1, "name": "The Witcher 3: Wild Hunt",
      "localized_names": ["Ведьмак 3: Дикая Охота"]}, "exact"),
    ("STAR WARS JEDI FALLEN ORDER", {"id": 2, "name": "Star Wars Jedi: Fallen Order"}, "exact"),
    ("Ghost of Tsushima DIRECTOR'S CUT", {"id": 3, "name": "Ghost of Tsushima"}, "likely"),
    ("LEGO® Marvel: Супергерои", {"id": 4, "name": "LEGO Marvel Super Heroes",
      "alternative_names": ["LEGO Marvel: Супергерои"]}, "exact"),
    ("Just Dance 2017 Demo", {"id": 5, "name": "Just Dance 2017"}, "likely"),
    ("GWENT Beta", {"id": 6, "name": "Gwent"}, "likely"),
    ("Indivisible Prototype", {"id": 7, "name": "Indivisible"}, "likely"),
])
def test_title_evidence_ranks_explicit_localizations_and_marks_variants_uncertain(title, candidate, confidence):
    from app.library_catalog_matching import rank_suggestions

    candidate["platforms"] = ["PlayStation 4"]
    suggestions = rank_suggestions(PsnCatalogEvidence(title), [candidate], source="psn")
    assert suggestions[0]["confidence"] == confidence


def test_years_and_editions_are_not_dropped_to_claim_exact_identity():
    from app.library_catalog_matching import rank_suggestions

    suggestions = rank_suggestions(PsnCatalogEvidence("Just Dance 2017"), [
        {"id": 2, "name": "Just Dance 2018", "platforms": ["PlayStation 4"]},
        {"id": 1, "name": "Just Dance 2017", "platforms": ["PlayStation 4"]},
    ], source="psn")
    assert suggestions[0]["id"] == 1
    assert suggestions[0]["confidence"] == "exact"
    assert all(item["confidence"] == "likely" for item in suggestions[1:])
    assert rank_suggestions(PsnCatalogEvidence("The Witcher 3: Complete Edition"), [
        {"id": 1, "name": "The Witcher 3: Deluxe Edition"},
    ], source="psn")[0]["confidence"] == "likely"


def test_manual_pc_record_is_not_subject_to_psn_platform_rejection():
    from app.library_catalog_matching import rank_suggestions

    candidate = {"id": 1, "name": "Factorio", "platforms": ["PC (Microsoft Windows)"]}
    assert rank_suggestions(PsnCatalogEvidence("Factorio"), [candidate], source="manual")[0]["confidence"] == "exact"


def test_preview_uses_localized_and_cleaned_queries_without_mutating_records():
    from app.library_catalog_matching import preview_library_catalog_matches

    game = SimpleNamespace(id="one", title="Ведьмак 3: Дикая Охота — Полное издание",
                           source="psn", link_state="raw", catalog_game_id=None,
                           psn_search_aliases=None, psn_source_platforms=None)
    queries = []

    async def batch(titles):
        queries.extend(titles)
        return {title: [] for title in titles}

    async def localized(titles):
        return {title: [{"id": 1, "name": "The Witcher 3: Wild Hunt",
                         "localized_names": ["Ведьмак 3: Дикая Охота"],
                         "platforms": ["PlayStation 4"]}] for title in titles}

    before = vars(game).copy()
    result = asyncio.run(preview_library_catalog_matches([game], batch_fetcher=batch,
        single_fetcher=AsyncMock(), localization_fetcher=localized))
    assert result[0]["status"] == "review"
    assert result[0]["suggestions"][0]["id"] == 1
    assert "Ведьмак 3: Дикая Охота" in queries
    assert vars(game) == before


def test_preview_provider_failure_and_empty_results_are_distinct():
    from app.library_catalog_matching import preview_library_catalog_matches
    from app.integrations.igdb import IGDBError

    game = SimpleNamespace(id="one", title="Unknown", source="manual", link_state=None,
                           catalog_game_id=None, psn_search_aliases=None, psn_source_platforms=None)
    unavailable = AsyncMock(side_effect=IGDBError("offline", status_code=502))
    failed = asyncio.run(preview_library_catalog_matches([game], batch_fetcher=unavailable,
        single_fetcher=unavailable, localization_fetcher=unavailable))
    empty = asyncio.run(preview_library_catalog_matches([game], batch_fetcher=AsyncMock(return_value={"Unknown": []}),
        single_fetcher=AsyncMock(), localization_fetcher=AsyncMock(return_value={})))
    assert failed[0]["status"] == "unavailable"
    assert empty[0]["status"] == "no_match"


def test_localized_evidence_hydrates_existing_direct_candidate_before_deduplication():
    from app.library_catalog_matching import preview_library_catalog_matches

    game = SimpleNamespace(id="one", title="Ведьмак 3", source="psn", link_state="raw",
                           catalog_game_id=None, psn_search_aliases=None, psn_source_platforms=None)
    canonical = {"id": 1, "name": "The Witcher 3"}
    result = asyncio.run(preview_library_catalog_matches([game],
        batch_fetcher=AsyncMock(return_value={game.title: [canonical]}), single_fetcher=AsyncMock(),
        localization_fetcher=AsyncMock(return_value={game.title: [{**canonical, "localized_names": [game.title]}]})))
    assert result[0]["status"] == "matched"
    assert result[0]["suggestions"][0]["confidence"] == "exact"


def test_editionless_alias_does_not_override_full_source_edition_evidence():
    from app.library_catalog_matching import rank_suggestions

    suggestions = rank_suggestions(PsnCatalogEvidence("Ghost of Tsushima Director's Cut", aliases=("Ghost of Tsushima",)),
        [{"id": 1, "name": "Ghost of Tsushima"}], source="psn")
    assert suggestions[0]["confidence"] == "likely"


@pytest.mark.parametrize("title,alias,name,released", [
    ("Just Dance 2017", "Just Dance", "Just Dance", "2009-11-17"),
    ("FIFA 23", "FIFA", "FIFA", None),
    ("Portal 2", "Portal", "Portal", "2007-10-10"),
])
def test_primary_numbers_cannot_be_erased_by_a_shorter_alias(title, alias, name, released):
    from app.library_catalog_matching import rank_suggestions

    result = rank_suggestions(PsnCatalogEvidence(title, aliases=(alias,)),
        [{"id": 1, "name": name, "released": released}], source="manual")
    assert result[0]["confidence"] == "likely"


def test_parenthesized_year_adds_bare_retrieval_but_never_claims_yearless_exact_identity():
    from app.library_catalog_matching import library_query_variants, rank_suggestions

    evidence = PsnCatalogEvidence("DOOM (2016)")
    assert "DOOM" in library_query_variants(evidence)
    result = rank_suggestions(evidence, [
        {"id": 1, "name": "Doom", "released": "1993-12-10"},
        {"id": 2, "name": "Doom", "released": "2016-05-13"},
    ], source="manual")
    assert {item["id"] for item in result} == {1, 2}
    assert all(item["confidence"] == "likely" for item in result)
    assert "Just Dance" not in library_query_variants(PsnCatalogEvidence("Just Dance 2017"))


@pytest.mark.parametrize("partial_failure", [False, True])
def test_preview_demotes_exact_proposals_when_ambiguous_or_incomplete(partial_failure):
    from app.library_catalog_matching import preview_library_catalog_matches
    from app.integrations.igdb import IGDBError

    title = "Hades (PS4)" if partial_failure else "Hades"
    game = SimpleNamespace(id="one", title=title, source="psn", link_state="raw",
                           catalog_game_id=None, psn_search_aliases=None, psn_source_platforms=None)
    async def batch(titles):
        return {query: ([{"id": 1, "name": "Hades"}] if partial_failure else
                        [{"id": 1, "name": "Hades"}, {"id": 2, "name": "Hades"}])
                for query in titles if not (partial_failure and query == "Hades")}
    result = asyncio.run(preview_library_catalog_matches([game], batch_fetcher=batch,
        single_fetcher=AsyncMock(side_effect=IGDBError("offline", 502)), localization_fetcher=AsyncMock(return_value={})))
    assert result[0]["status"] == ("unavailable" if partial_failure else "review")
    assert result[0]["suggestions"]
    assert all(item["confidence"] == "likely" for item in result[0]["suggestions"])
