from fastapi.testclient import TestClient
import pytest

import app.main as main
from app.integrations import igdb


client = TestClient(main.app)


def test_catalog_similar_returns_ranked_unique_verified_catalog_games(monkeypatch):
    async def detail(igdb_id):
        assert igdb_id == 10
        return {"id": 10, "name": "Source", "genres": ["RPG", "Action"], "platforms": ["PC"]}

    async def similar(igdb_id, *, limit):
        assert (igdb_id, limit) == (10, 12)
        return [
            {"id": 10, "name": "Source", "genres": ["RPG"], "platforms": ["PC"]},
            {"id": 2, "name": "Platform match", "genres": ["Puzzle"], "platforms": ["PC"]},
            {"id": 1, "name": "Genre match", "genres": ["RPG", "Action"], "platforms": ["PC"], "background_image": "cover"},
            {"id": 1, "name": "Duplicate", "genres": ["RPG"], "platforms": ["PC"]},
            {"id": None, "name": "Unverified", "genres": ["RPG"], "platforms": ["PC"]},
        ]

    monkeypatch.setattr(main, "fetch_igdb_game_detail", detail)
    monkeypatch.setattr(main, "fetch_igdb_similar_games", similar)

    response = client.get("/catalog/games/10/similar")

    assert response.status_code == 200
    assert response.json() == {"results": [
        {"id": 1, "name": "Genre match", "background_image": "cover", "genres": ["RPG", "Action"], "platforms": ["PC"]},
        {"id": 2, "name": "Platform match", "genres": ["Puzzle"], "platforms": ["PC"]},
    ]}


def test_catalog_similar_propagates_igdb_provider_error(monkeypatch):
    async def unavailable(_igdb_id):
        raise main.IGDBError("provider unavailable", status_code=503)

    monkeypatch.setattr(main, "fetch_igdb_game_detail", unavailable)

    response = client.get("/catalog/games/10/similar")

    assert response.status_code == 503
    assert response.json() == {"detail": "provider unavailable"}


@pytest.mark.anyio
async def test_igdb_similar_games_drops_a_stale_related_id(monkeypatch):
    async def query(_endpoint, _query):
        return [{"similar_games": [11, 12]}]

    async def detail(igdb_id):
        if igdb_id == 11:
            raise igdb.IGDBError("IGDB game not found", 404)
        return {"id": 12, "name": "Still available", "genres": ["RPG"], "platforms": ["PC"]}

    monkeypatch.setattr(igdb, "_query", query)
    monkeypatch.setattr(igdb, "fetch_igdb_game_detail", detail)

    assert await igdb.fetch_igdb_similar_games(10) == [{"id": 12, "name": "Still available", "genres": ["RPG"], "platforms": ["PC"]}]
