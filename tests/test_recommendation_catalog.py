import pytest

from app.integrations import igdb
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
