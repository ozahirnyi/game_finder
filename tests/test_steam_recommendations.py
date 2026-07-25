import uuid

import pytest

import app.steam_recommendations as recommendations


def games(playtime: int = 120):
    return [
        {"appid": 20, "name": "Team Fortress Classic", "playtime_forever": playtime, "playtime_2weeks": 0},
        {"appid": 10, "name": "Counter-Strike", "playtime_forever": 30, "playtime_2weeks": 5},
    ]


def test_library_fingerprint_is_stable_for_game_order_and_changes_for_playtime():
    assert recommendations.build_steam_library_fingerprint(games()) == recommendations.build_steam_library_fingerprint(list(reversed(games())))
    assert recommendations.build_steam_library_fingerprint(games()) != recommendations.build_steam_library_fingerprint(games(121))


@pytest.mark.anyio
async def test_cached_recommendations_reuse_a_matching_user_library(monkeypatch):
    calls = {"provider": 0, "keys": []}

    async def cache_get(key):
        calls["keys"].append(key)
        return calls.get("cached")

    async def cache_set(_key, value, ttl):
        assert ttl == 21600
        calls["cached"] = value

    def provider(_prompt, excluded):
        calls["provider"] += 1
        assert excluded == [10, 20]
        return {"recommendations": [{"title": "Hades", "reason": "Fast action", "tags": ["Action"]}]}

    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "get_recommendation", provider)
    monkeypatch.setattr(recommendations, "build_steam_recommendation_prompt", lambda *_args: "prompt")

    user_id = uuid.uuid4()
    first = await recommendations.get_cached_steam_recommendations(user_id, games())
    second = await recommendations.get_cached_steam_recommendations(user_id, games())

    assert first == second
    assert calls["provider"] == 1
    assert str(user_id) in calls["keys"][0]
