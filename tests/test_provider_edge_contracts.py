import uuid

import pytest
from fastapi import HTTPException


class _ItadResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self.payload


class _ItadClient:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = []

    async def get(self, url, *, params):
        self.calls.append((url, params))
        return _ItadResponse(next(self.responses))


@pytest.mark.anyio
async def test_itad_game_id_resolution_prefers_steam_app_mapping():
    from app.prices import ITAD_BASE_URL, resolve_itad_game_id

    client = _ItadClient([
        {"found": True, "game": {"id": "itad-id", "title": "Grand Theft Auto V Enhanced"}},
    ])

    assert await resolve_itad_game_id(client, "Grand Theft Auto V", 3240220) == (
        "itad-id",
        "Grand Theft Auto V Enhanced",
    )
    assert client.calls == [
        (f"{ITAD_BASE_URL}/games/lookup/v1", {"appid": 3240220}),
    ]


@pytest.mark.anyio
async def test_itad_game_id_resolution_uses_title_lookup_first_without_steam_appid():
    from app.prices import ITAD_BASE_URL, resolve_itad_game_id

    client = _ItadClient([
        {"found": True, "game": {"id": "itad-id", "title": "Grand Theft Auto V"}},
    ])

    assert await resolve_itad_game_id(client, "Grand Theft Auto V", None) == (
        "itad-id",
        "Grand Theft Auto V",
    )
    assert client.calls == [
        (f"{ITAD_BASE_URL}/games/lookup/v1", {"title": "Grand Theft Auto V"}),
    ]


@pytest.mark.anyio
async def test_itad_game_id_resolution_falls_back_to_casefold_exact_search():
    from app.prices import ITAD_BASE_URL, resolve_itad_game_id

    client = _ItadClient([
        {"found": False},
        {"found": False},
        [
            {"id": "wrong-id", "title": "Grand Theft Auto V Enhanced", "type": "game"},
            {"id": "wrong-type", "title": "Grand Theft Auto V", "type": "dlc"},
            {"id": "itad-id", "title": "Grand Theft Auto V", "type": "game"},
        ],
    ])

    assert await resolve_itad_game_id(client, "Grand Theft Auto V", 3240220) == (
        "itad-id",
        "Grand Theft Auto V",
    )
    assert client.calls == [
        (f"{ITAD_BASE_URL}/games/lookup/v1", {"appid": 3240220}),
        (f"{ITAD_BASE_URL}/games/lookup/v1", {"title": "Grand Theft Auto V"}),
        (f"{ITAD_BASE_URL}/games/search/v1", {"title": "Grand Theft Auto V"}),
    ]


@pytest.mark.anyio
async def test_itad_game_id_resolution_rejects_fuzzy_search_results():
    from app.prices import resolve_itad_game_id

    client = _ItadClient([
        {"found": False},
        {"found": False},
        [{"id": "wrong-id", "title": "Grand Theft Auto V Enhanced", "type": "game"}],
    ])

    with pytest.raises(HTTPException, match="Price data not found") as exc:
        await resolve_itad_game_id(client, "Grand Theft Auto V", 3240220)

    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_itad_price_history_preserves_provider_game_url(monkeypatch):
    from app import prices

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, _url, *, params):
            if "appid" in params:
                return _ItadResponse({
                    "found": True,
                    "game": {
                        "id": "itad-id",
                        "title": "Grand Theft Auto V Enhanced",
                        "urls": {"game": "https://itad.example/gta-v-enhanced"},
                    },
                })
            return _ItadResponse([])

        async def post(self, _url, **_kwargs):
            return _ItadResponse([{"deals": [], "historyLow": {}}])

    monkeypatch.setenv("ITAD_API_KEY", "key")
    monkeypatch.setattr(prices.httpx, "AsyncClient", lambda *_args, **_kwargs: Client())

    result = await prices.fetch_game_price_history(
        "Grand Theft Auto V", steam_appid=3240220
    )

    assert result["url"] == "https://itad.example/gta-v-enhanced"


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

    async def cache_get(_): return None
    async def cache_set(*_): raise RuntimeError("redis down")
    async def trending(*_args, **_kwargs): return {"results": [{"id": 5, "name": "Candidate", "genres": [], "platforms": []}]}
    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "fetch_igdb_trending_games", trending)

    user = type("User", (), {"id": uuid.uuid4(), "favorite_genres": [], "platforms": [], "bio": None})()
    result = await recommendations.get_personalized_recommendations(user, [], [])
    assert result["recommendations"][0]["igdb_id"] == 5

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
