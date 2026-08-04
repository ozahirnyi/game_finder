import uuid

import pytest
from fastapi import HTTPException


def test_price_helpers_keep_invalid_amounts_and_provider_errors_safe(monkeypatch):
    from app import prices

    assert prices._money({"amount": None, "currency": "USD"}) is None
    assert prices._deal(None) is None

    class InvalidJsonResponse:
        def json(self):
            raise ValueError("not json")

    assert prices._itad_error_message(InvalidJsonResponse()) == "request failed"
@pytest.mark.anyio
async def test_price_provider_refuses_missing_key(monkeypatch):
    from app.prices import fetch_game_price_history

    monkeypatch.delenv("ITAD_API_KEY", raising=False)
    monkeypatch.delenv("ISTHEREANYDEAL_API_KEY", raising=False)
    with pytest.raises(HTTPException, match="not configured"):
        await fetch_game_price_history("ignored")


def test_steam_recommendation_prompt_rejects_an_empty_library():
    from app.steam_recommendations import build_steam_recommendation_prompt

    with pytest.raises(HTTPException, match="no playable history"):
        build_steam_recommendation_prompt([])


@pytest.mark.anyio
async def test_personal_recommendation_handles_blank_candidates_and_cache_write_failure(monkeypatch):
    import app.steam_recommendations as recommendations

    assert await recommendations.enrich_steam_candidate({"name": ""}) == {"name": "", "igdb_id": None}

    async def cache_get(_): return None
    async def cache_set(*_): raise RuntimeError("redis down")
    async def candidates(): return {"candidates": [{"steam_appid": 99, "name": "Candidate"}]}
    async def igdb(*_, **__): return {"results": [{"id": 5, "name": "Candidate"}]}
    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "fetch_steam_store_deal_candidates", candidates)
    monkeypatch.setattr(recommendations, "fetch_igdb_games", igdb)

    user = type("User", (), {"id": uuid.uuid4(), "favorite_genres": [], "platforms": [], "bio": None})()
    result = await recommendations.get_personalized_recommendations(user, [], [])
    assert result["recommendations"][0]["igdb_id"] == 5

    async def unavailable(*_, **__): raise RuntimeError("igdb down")
    monkeypatch.setattr(recommendations, "fetch_igdb_games", unavailable)
    assert (await recommendations.enrich_steam_candidate({"name": "Still shown"}))["igdb_id"] is None

    async def cache_unavailable(_): raise RuntimeError("redis unavailable")
    monkeypatch.setattr(recommendations, "cache_get", cache_unavailable)
    assert (await recommendations.get_personalized_recommendations(user, [], []))["recommendations"]

    async def cached(_): return {"recommendations": ["cached"]}
    monkeypatch.setattr(recommendations, "cache_get", cached)
    assert await recommendations.get_personalized_recommendations(user, [], []) == {"recommendations": ["cached"]}


@pytest.mark.anyio
async def test_genre_deals_fills_defaults_and_tolerates_steam_genre_failure():
    from app.genre_deals import build_genre_deal_groups, select_deal_genres

    assert select_deal_genres(["A", "B", "C", "D", "E", "F"]) == ["A", "B", "C", "D", "E"]

    async def candidates(_):
        return {"candidates": [{"steam_appid": 1, "name": "One"}], "popular": []}
    async def igdb(*_):
        return {"results": [{"id": 1, "name": "One", "genres": ["Puzzle"]}]}
    async def unavailable_steam(*_):
        raise RuntimeError("steam down")

    result = await build_genre_deal_groups("US", [], candidates, igdb, unavailable_steam)
    assert [section["genre"] for section in result["sections"]] == ["Puzzle", "Action", "RPG", "Adventure", "Strategy"]

    async def igdb_without_genres(*_):
        return {"results": [{"id": 1, "name": "One", "genres": []}]}
    async def steam_genres(appids, country):
        assert appids == [1] and country == "US"
        return {1: ["Action"]}
    with_steam = await build_genre_deal_groups("US", [], candidates, igdb_without_genres, steam_genres)
    assert with_steam["sections"][0]["genre"] == "Action"

    selected = await build_genre_deal_groups("US", ["Action", "RPG", "Indie", "Adventure", "Strategy"], candidates, igdb)
    assert len(selected["sections"]) == 5

    async def outage(*_):
        from app.integrations.igdb import IGDBError
        raise IGDBError("offline")
    async def candidates_with_popular(_):
        return {"candidates": [{"steam_appid": 1, "name": "One"}], "popular": [{"steam_appid": 2, "name": "Two"}]}
    offline = await build_genre_deal_groups("US", [], candidates_with_popular, outage)
    assert offline["popular"][0]["id"] is None
