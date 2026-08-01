import uuid

import pytest

import app.steam_recommendations as recommendations


class User:
    def __init__(self, user_id, *, genres=None, platforms=None, bio=None):
        self.id = user_id
        self.favorite_genres = genres or []
        self.platforms = platforms or []
        self.bio = bio


class Saved:
    def __init__(self, title):
        self.title = title


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
    assert first["cache_expires_at"]
    assert calls["provider"] == 1
    assert str(user_id) in calls["keys"][0]
    assert calls["keys"][0].startswith("steam_recommendations:v2:")


@pytest.mark.anyio
async def test_normalize_recommendations_removes_owned_duplicates_and_adds_rawg_metadata(monkeypatch):
    async def rawg(title, page=1):
        assert title == "Hades II"
        return {"results": [{"id": 274755, "name": "Hades II", "background_image": "https://cdn.example/hades.jpg"}]}

    monkeypatch.setattr(recommendations, "fetch_rawg_games", rawg)
    items = await recommendations.normalize_recommendations(
        {"recommendations": [
            {"title": "Rainbow Six Siege", "reason": "owned", "tags": []},
            {"title": "Hades II", "reason": "good", "tags": []},
            {"title": "hades ii", "reason": "duplicate", "tags": []},
        ]},
        {"rainbow six siege"},
    )
    assert items == [{"title": "Hades II", "reason": "good", "tags": [], "rawg_id": 274755, "cover_url": "https://cdn.example/hades.jpg"}]


@pytest.mark.anyio
async def test_personal_recommendations_cache_key_changes_with_profile_library_and_playtime(monkeypatch):
    keys = []

    async def cache_get(key):
        keys.append(key)
        return None

    async def cache_set(*_args):
        return None

    async def candidates():
        return {"candidates": [{"steam_appid": 1, "name": "Owned", "background_image": None}, {"steam_appid": 2, "name": "Saved", "background_image": None}, {"steam_appid": 3, "name": "Eligible", "background_image": None}]}

    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "fetch_steam_store_deal_candidates", candidates)
    user = User(uuid.uuid4(), genres=["Action"])
    await recommendations.get_personalized_recommendations(user, [Saved("Saved")], [{"appid": 1, "name": "Owned", "playtime_forever": 1}])
    await recommendations.get_personalized_recommendations(User(user.id, genres=["Puzzle"]), [Saved("Saved")], [{"appid": 1, "name": "Owned", "playtime_forever": 2}])

    assert keys[0] != keys[1]


@pytest.mark.anyio
async def test_personal_recommendations_exclude_owned_and_saved_titles(monkeypatch):
    async def cache_get(_key): return None
    async def cache_set(*_args): return None
    async def candidates():
        return {"candidates": [{"steam_appid": 1, "name": "Owned", "background_image": None}, {"steam_appid": 2, "name": "Saved", "background_image": None}, {"steam_appid": 3, "name": "Eligible", "background_image": "cover"}]}
    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "fetch_steam_store_deal_candidates", candidates)
    result = await recommendations.get_personalized_recommendations(User(uuid.uuid4()), [Saved("Saved")], [{"appid": 1, "name": "Owned"}])
    assert [item["title"] for item in result["recommendations"]] == ["Eligible"]


@pytest.mark.anyio
async def test_personal_recommendations_fall_back_to_non_owned_rawg_trends(monkeypatch):
    async def cache_get(_key): return None
    async def cache_set(*_args): return None
    async def candidates(): return {"candidates": []}
    async def trending(page, page_size):
        assert (page, page_size) == (1, 12)
        return {"results": [
            {"id": 1, "name": "Saved", "background_image": "saved-cover"},
            {"id": 2, "name": "Top Game", "background_image": "top-cover"},
        ]}

    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "fetch_steam_store_deal_candidates", candidates)
    monkeypatch.setattr(recommendations, "fetch_rawg_trending_games", trending)

    result = await recommendations.get_personalized_recommendations(User(uuid.uuid4()), [Saved("Saved")], [])

    assert result["recommendations"] == [{
        "title": "Top Game", "reason": "Popular game selected because personalized catalog is unavailable.",
        "tags": [], "rawg_id": 2, "cover_url": "top-cover",
    }]
