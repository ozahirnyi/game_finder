import re

import pytest

from app.integrations import igdb
import app.steam_recommendations as recommendations
from app.recommendation_catalog import fetch_recommendation_catalog_games as fetch_preference_games


@pytest.mark.anyio
@pytest.mark.parametrize(("genre", "predicate"), [
    ("RPG", 'genres.name = "Role-playing (RPG)"'),
    ("Role-playing (RPG)", 'genres.name = "Role-playing (RPG)"'),
    ("Puzzle", 'genres.name = "Puzzle"'),
    ("Action", 'themes.name = "Action"'),
    ("Indie", 'genres.name = "Indie"'),
    ("Horror", 'themes.name = "Horror"'),
    ("Simulation", 'genres.name = "Simulator"'),
    ("Sports", 'genres.name = "Sport"'),
    ("Adventure", 'genres.name = "Adventure"'),
    ("Strategy", 'genres.name = "Strategy"'),
    ("Shooter", 'genres.name = "Shooter"'),
    ("Racing", 'genres.name = "Racing"'),
])
async def test_recommendation_query_preserves_existing_preference_genres(monkeypatch, genre, predicate):
    queries = []
    async def query(endpoint, body):
        queries.append((endpoint, body))
        return [{"id": 42, "name": "Verified result", "genres": [{"name": "Puzzle"}]}]
    monkeypatch.setattr(igdb, "_query", query)

    games = await fetch_preference_games({"genres": [genre], "platforms": ["PlayStation"]}, limit=12)

    assert len(queries) == 1
    assert queries[0][0] == "games"
    assert predicate in queries[0][1]
    assert "platforms = (48,167)" in queries[0][1]
    assert "limit 12;" in queries[0][1]
    assert games[0]["id"] == 42
    assert games[0]["genres"] == ["Puzzle"]


@pytest.mark.anyio
async def test_unknown_genres_never_issue_an_unfiltered_popularity_query(monkeypatch):
    async def unexpected(*_args): pytest.fail("Unknown taste must not become a broad query")
    monkeypatch.setattr(igdb, "_query", unexpected)
    assert await fetch_preference_games({"genres": ['Unknown " injected'], "platforms": []}) == []


@pytest.mark.anyio
@pytest.mark.parametrize(("platform", "ids"), [
    ("PC (Microsoft Windows)", "3,6,14"),
    ("PlayStation 5", "48,167"),
    ("Xbox Series X|S", "49,169"),
    ("Nintendo Switch", "130"),
])
async def test_recommendation_query_platform_families_and_candidate_limit(monkeypatch, platform, ids):
    async def query(_endpoint, body):
        assert f"platforms = ({ids})" in body
        assert "limit 12;" in body
        return [{"id": index, "name": f"Candidate {index}"} for index in range(20)]
    monkeypatch.setattr(igdb, "_query", query)

    assert len(await fetch_preference_games({"genres": ["Puzzle"], "platforms": [platform]}, limit=100)) == 12


@pytest.mark.anyio
async def test_four_preference_seeds_hydrate_the_shared_similarity_union_once(monkeypatch):
    queries = []
    hydrated_ids = []

    async def query(endpoint, body):
        assert endpoint == "games"
        queries.append(body)
        identity_clause = re.search(r"where id = ([^;]+);", body)
        ids = [int(value) for value in re.findall(r"\d+", identity_clause[1])] if identity_clause else []
        if "fields similar_games;" in body or "fields id,similar_games;" in body:
            return [{"id": game_id, "similar_games": list(range(100, 106))} for game_id in ids]
        if ids:
            hydrated_ids.extend(ids)
            return [{"id": game_id, "name": f"Candidate {game_id}", "genres": [{"name": "Puzzle"}]} for game_id in ids]
        return []

    monkeypatch.setattr(igdb, "_query", query)

    candidates, affinities = await recommendations._preference_candidates(
        {"puzzle": 8.0, "rpg": 6.0, "strategy": 4.0}, {}, {10: 8.0, 20: 6.0, 30: 4.0, 40: 2.0},
    )

    assert len(queries) == 5  # One seed query, one unique-detail query, three genre queries.
    assert hydrated_ids == list(range(100, 106))
    assert {game["id"] for game in candidates} == set(range(100, 106))
    assert affinities == dict.fromkeys(range(100, 106), 8.0)


@pytest.mark.anyio
async def test_batch_similarity_preserves_per_seed_affinity_and_skips_missing_details(monkeypatch):
    queries = []

    async def query(_endpoint, body):
        queries.append(body)
        if "fields id,similar_games;" in body:
            return [
                {"id": 10, "similar_games": [100, 101, 100]},
                {"id": 20, "similar_games": [{"id": 101}, 102]},
                {"id": 40, "similar_games": []},
            ]
        assert "where id = (100,101,102); limit 3;" in body
        return [{"id": game_id, "name": f"Candidate {game_id}"} for game_id in (100, 102)]

    monkeypatch.setattr(igdb, "_query", query)

    candidates, affinities = await recommendations._preference_candidates({}, {}, {10: 8.0, 20: 6.0, 30: 4.0, 40: 2.0})

    assert len(queries) == 2
    assert [game["id"] for game in candidates] == [100, 102]
    assert affinities == {100: 8.0, 102: 6.0}


@pytest.mark.anyio
@pytest.mark.parametrize("failed_stage", ["seed_links", "details"])
async def test_batch_similarity_outage_keeps_real_genre_query_results(monkeypatch, failed_stage):
    async def query(_endpoint, body):
        if "fields id,similar_games;" in body:
            if failed_stage == "seed_links":
                raise igdb.IGDBError("Similarity unavailable")
            return [{"id": 10, "similar_games": [100]}]
        if "where id = (100);" in body:
            raise igdb.IGDBError("Details unavailable")
        assert 'genres.name = "Puzzle"' in body
        return [{"id": 900, "name": "Genre fallback", "genres": [{"name": "Puzzle"}]}]

    monkeypatch.setattr(igdb, "_query", query)

    candidates, affinities = await recommendations._preference_candidates({"puzzle": 5.0}, {}, {10: 8.0})

    assert [game["id"] for game in candidates] == [900]
    assert affinities == {900: 5.0}
