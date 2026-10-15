"""Bounded catalog retrieval for personal recommendation seeds and profile genres."""

from app.integrations import igdb


MAX_PREFERENCE_SEEDS = 4
SIMILAR_CANDIDATES_PER_SEED = 6


# Profile wording differs from the catalog taxonomy for these three genres.
_GENRE_ALIASES = {"role-playing (rpg)": "rpg", "simulator": "simulation", "sport": "sports"}
_PREFERENCE_FILTERS = {
    "action": ("themes", "Action"),
    "adventure": ("genres", "Adventure"),
    "rpg": ("genres", "Role-playing (RPG)"),
    "strategy": ("genres", "Strategy"),
    "indie": ("genres", "Indie"),
    "shooter": ("genres", "Shooter"),
    "puzzle": ("genres", "Puzzle"),
    "simulation": ("genres", "Simulator"),
    "sports": ("genres", "Sport"),
    "racing": ("genres", "Racing"),
    "horror": ("themes", "Horror"),
}


def normalize_preference_genre(value: str) -> str:
    key = value.strip().casefold()
    return _GENRE_ALIASES.get(key, key)


async def fetch_recommendation_similar_games(seed_ids: list[int], *, limit: int = 6) -> dict[int, list[dict]]:
    """Read seed links once and hydrate their unique candidate union once."""
    seeds = list(dict.fromkeys(value for value in seed_ids if isinstance(value, int) and not isinstance(value, bool) and value > 0))[:MAX_PREFERENCE_SEEDS]
    if not seeds:
        return {}
    bounded_limit = min(max(limit, 1), SIMILAR_CANDIDATES_PER_SEED)
    sources = await igdb._query(
        "games", f"fields id,similar_games; where id = ({','.join(map(str, seeds))}); limit {len(seeds)};",
    )
    similar_ids: dict[int, list[int]] = {seed_id: [] for seed_id in seeds}
    for source in sources:
        seed_id = source.get("id")
        if seed_id not in similar_ids:
            continue
        ids = [value.get("id") if isinstance(value, dict) else value for value in source.get("similar_games") or []]
        similar_ids[seed_id] = list(dict.fromkeys(value for value in ids if isinstance(value, int) and not isinstance(value, bool) and value > 0))[:bounded_limit]
    candidate_ids = list(dict.fromkeys(game_id for seed_id in seeds for game_id in similar_ids[seed_id]))
    if not candidate_ids:
        return {seed_id: [] for seed_id in seeds}
    candidates = await igdb.fetch_igdb_games_by_ids(candidate_ids)
    return {
        seed_id: [candidates[game_id] for game_id in similar_ids[seed_id] if game_id in candidates]
        for seed_id in seeds
    }


async def fetch_recommendation_catalog_games(source: dict, *, limit: int = 12) -> list[dict]:
    predicates = []
    for genre in source.get("genres") or []:
        preference = _PREFERENCE_FILTERS.get(normalize_preference_genre(str(genre)))
        if preference:
            field, name = preference
            predicates.append(f'{field}.name = "{name}"')
    if not predicates:
        return []

    platform_ids: set[int] = set()
    for platform in source.get("platforms") or []:
        name = str(platform).strip().casefold()
        if name == "pc" or "windows" in name or "linux" in name or "mac" in name:
            platform_ids.update(igdb._PLATFORM_IDS["pc"])
        elif "playstation" in name or name in {"ps4", "ps5"}:
            platform_ids.update(igdb._PLATFORM_IDS["playstation"])
        elif "xbox" in name:
            platform_ids.update(igdb._PLATFORM_IDS["xbox"])
        elif "switch" in name:
            platform_ids.update(igdb._PLATFORM_IDS["switch"])
    if platform_ids:
        predicates.append(f"platforms = ({','.join(map(str, sorted(platform_ids)))})")
    bounded_limit = min(max(limit, 1), 12)
    games = await igdb._query(
        "games",
        f"{igdb._FIELDS} where {' & '.join(predicates)}; sort total_rating_count desc; limit {bounded_limit};",
    )
    return [igdb.normalize_igdb_game(game) for game in games[:bounded_limit]]
