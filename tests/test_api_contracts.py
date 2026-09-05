from datetime import datetime, timezone
from types import SimpleNamespace
import asyncio
import uuid

from fastapi.testclient import TestClient

import app.main as main


client = TestClient(main.app)


def test_social_friend_requests_expose_steam_profiles_and_require_authorization():
    alice_id, bob_id, charlie_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    users = {
        alice_id: SimpleNamespace(
            id=alice_id,
            email="steam-76561198000000001@steam.invalid",
            steam_id="76561198000000001",
            steam_persona_name="Alice on Steam",
            steam_avatar="https://cdn.example/alice.jpg",
        ),
        bob_id: SimpleNamespace(
            id=bob_id,
            email="bob@example.com",
            steam_id="76561198000000002",
            steam_persona_name="Bob on Steam",
            steam_avatar="https://cdn.example/bob.jpg",
        ),
        charlie_id: SimpleNamespace(
            id=charlie_id,
            email="charlie@example.com",
            steam_id=None,
            steam_persona_name=None,
            steam_avatar=None,
        ),
    }

    class Query:
        def __init__(self, rows):
            self.rows = rows

        def filter_by(self, **criteria):
            return Query([row for row in self.rows if all(getattr(row, key) == value for key, value in criteria.items())])

        def filter(self, *_criteria):
            return self

        def all(self):
            return list(self.rows)

        def first(self):
            return self.rows[0] if self.rows else None

    class Db:
        def __init__(self):
            self.requests = []
            self.friendships = []

        def get(self, model, identifier):
            if model.__name__ == "User":
                return users.get(identifier)
            if model.__name__ == "FriendRequest":
                return next((request for request in self.requests if request.id == identifier), None)
            return None

        def query(self, model):
            if model.__name__ == "FriendRequest":
                return Query(self.requests)
            if model.__name__ == "Friendship":
                return Query(self.friendships)
            if model.__name__ == "User":
                return Query(users.values())
            raise AssertionError(f"unexpected query model: {model}")

        def add(self, row):
            (self.requests if hasattr(row, "sender_id") else self.friendships).append(row)

        def commit(self):
            pass

        def rollback(self):
            raise AssertionError("social mutations should not roll back")

    db = Db()
    current_user = {"value": users[alice_id]}
    main.app.dependency_overrides[main.get_current_user] = lambda: current_user["value"]
    main.app.dependency_overrides[main.get_db] = lambda: db

    try:
        snapshot = client.get("/social/me")
        assert snapshot.status_code == 200
        assert snapshot.json()["me"] == {
            "id": str(alice_id),
            "display_name": "Alice on Steam",
            "avatar": "https://cdn.example/alice.jpg",
            "steam_profile_url": "https://steamcommunity.com/profiles/76561198000000001",
            "steam_add_url": "https://steamcommunity.com/profiles/76561198000000001/friends/add",
        }
        assert "steam-76561198000000001@steam.invalid" not in str(snapshot.json())
        assert snapshot.json()["friends"] == []
        assert snapshot.json()["incoming_requests"] == []
        assert snapshot.json()["outgoing_requests"] == []

        assert client.post("/social/friend-requests", json={"recipient_id": str(alice_id)}).status_code == 400

        created = client.post("/social/friend-requests", json={"recipient_id": str(bob_id)})
        assert created.status_code == 201
        request_id = created.json()["outgoing_requests"][0]["id"]
        assert created.json()["outgoing_requests"][0]["recipient"]["display_name"] == "Bob on Steam"
        assert client.post("/social/friend-requests", json={"recipient_id": str(bob_id)}).status_code == 409

        current_user["value"] = users[charlie_id]
        assert client.post(f"/social/friend-requests/{request_id}/accept").status_code == 403

        current_user["value"] = users[bob_id]
        accepted = client.post(f"/social/friend-requests/{request_id}/accept")
        assert accepted.status_code == 200
        assert accepted.json()["friends"][0]["id"] == str(alice_id)
        assert accepted.json()["incoming_requests"] == []

        current_user["value"] = users[alice_id]
        declined_request = client.post("/social/friend-requests", json={"recipient_id": str(charlie_id)})
        assert declined_request.status_code == 201
        current_user["value"] = users[charlie_id]
        declined = client.post(f"/social/friend-requests/{declined_request.json()['outgoing_requests'][0]['id']}/decline")
        assert declined.status_code == 200
        assert declined.json()["incoming_requests"] == []
    finally:
        main.app.dependency_overrides.clear()


def test_steam_suggestions_match_registered_contacts_and_exclude_relationships(monkeypatch):
    viewer_id, contact_id = uuid.uuid4(), uuid.uuid4()
    viewer = SimpleNamespace(id=viewer_id, steam_id="viewer", steam_persona_name="Viewer", steam_avatar=None)
    contact = SimpleNamespace(id=contact_id, steam_id="registered", steam_persona_name="Registered", steam_avatar=None)

    class Query:
        def __init__(self, rows):
            self.rows = rows

        def filter_by(self, **criteria):
            return Query([row for row in self.rows if all(getattr(row, key) == value for key, value in criteria.items())])

        def filter(self, *_criteria):
            return self

        def all(self):
            return list(self.rows)

    class Db:
        def __init__(self):
            self.friendships = []
            self.requests = []

        def query(self, model):
            if model.__name__ == "Friendship":
                return Query(self.friendships)
            if model.__name__ == "FriendRequest":
                return Query(self.requests)
            if model.__name__ == "User":
                return Query([contact])
            raise AssertionError(model)

    async def fake_steam_friends(_steam_id, limit):
        assert limit == 50
        return [{"steam_id": "registered"}, {"steam_id": "unregistered"}]

    monkeypatch.setattr(main, "fetch_steam_friends", fake_steam_friends)
    db = Db()
    suggestions, error = asyncio.run(main.steam_suggestions_response(db, viewer))
    assert error is None
    assert [user.id for user in suggestions] == [contact_id]

    db.requests = [SimpleNamespace(sender_id=viewer_id, recipient_id=contact_id, status="pending")]
    suggestions, _ = asyncio.run(main.steam_suggestions_response(db, viewer))
    assert suggestions == []

    db.requests = []
    low_id, high_id = main.friendship_pair(viewer_id, contact_id)
    db.friendships = [SimpleNamespace(user_low_id=low_id, user_high_id=high_id)]
    suggestions, _ = asyncio.run(main.steam_suggestions_response(db, viewer))
    assert suggestions == []


def test_search_uses_steam_results_when_rawg_times_out(monkeypatch):
    async def fake_cache(_key, _ttl, fetch):
        return await fetch()

    async def fake_fetch_rawg_games(_query: str, page: int):
        raise main.RAWGError("RAWG request timeout", status_code=504)

    async def fake_fetch_steam_store_search(query: str, page_size: int):
        assert query == "hades"
        assert page_size == 20
        return [{
            "steam_appid": 1145360,
            "name": "Hades",
            "background_image": "https://cdn.example/hades.jpg",
            "url": "https://store.steampowered.com/app/1145360/",
        }]

    monkeypatch.setattr(main, "get_json_cached", fake_cache)
    monkeypatch.setattr(main, "fetch_rawg_games", fake_fetch_rawg_games)
    monkeypatch.setattr(main, "fetch_steam_store_search", fake_fetch_steam_store_search, raising=False)

    response = client.get("/search/games?q=Hades")

    assert response.status_code == 200
    assert response.json() == {"results": [{
        "id": None,
        "name": "Hades",
        "released": None,
        "background_image": "https://cdn.example/hades.jpg",
        "source": "steam",
        "steam_appid": 1145360,
        "url": "https://store.steampowered.com/app/1145360/",
    }]}


def test_catalog_game_detail_returns_normalized_rawg_data(monkeypatch):
    async def fake_cache(_key, _ttl, fetch):
        return await fetch()

    async def fake_fetch_rawg_game_detail(rawg_id: int):
        return {
            "id": rawg_id,
            "name": "Hades",
            "released": "2020-09-17",
            "background_image": "https://example.com/hades.jpg",
            "description_raw": "A roguelike dungeon crawler.",
            "rating": 4.42,
            "genres": ["Action", "RPG"],
            "platforms": ["PC", "Nintendo Switch"],
        }

    monkeypatch.setattr(main, "get_json_cached", fake_cache)
    monkeypatch.setattr(main, "fetch_rawg_game_detail", fake_fetch_rawg_game_detail)

    response = client.get("/catalog/games/274755")

    assert response.status_code == 200
    assert response.json() == {
        "id": 274755,
        "name": "Hades",
        "released": "2020-09-17",
        "background_image": "https://example.com/hades.jpg",
        "description_raw": "A roguelike dungeon crawler.",
        "rating": 4.42,
        "genres": ["Action", "RPG"],
        "platforms": ["PC", "Nintendo Switch"],
    }


def test_upcoming_games_returns_rawg_results(monkeypatch):
    async def fake_cache(_key, _ttl, fetch):
        return await fetch()

    async def fake_fetch_rawg_upcoming_games(page: int, page_size: int):
        assert page == 1
        assert page_size == 4
        return {
            "results": [
                {
                    "id": 123,
                    "name": "Future Game",
                    "released": "2026-11-20",
                    "background_image": "https://example.com/future.jpg",
                }
            ]
        }

    monkeypatch.setattr(main, "get_json_cached", fake_cache)
    monkeypatch.setattr(main, "fetch_rawg_upcoming_games", fake_fetch_rawg_upcoming_games)

    response = client.get("/catalog/upcoming-games?page_size=4")

    assert response.status_code == 200
    assert response.json() == {
        "results": [
            {
                "id": 123,
                "name": "Future Game",
                "released": "2026-11-20",
                "background_image": "https://example.com/future.jpg",
            }
        ]
    }


def test_trending_games_returns_rawg_results(monkeypatch):
    async def fake_cache(_key, _ttl, fetch):
        return await fetch()

    async def fake_fetch_rawg_trending_games(page: int, page_size: int):
        assert page == 1
        assert page_size == 4
        return {
            "results": [
                {
                    "id": 456,
                    "name": "Trending Game",
                    "released": "2026-07-01",
                    "background_image": "https://example.com/trending.jpg",
                }
            ]
        }

    monkeypatch.setattr(main, "get_json_cached", fake_cache)
    monkeypatch.setattr(main, "fetch_rawg_trending_games", fake_fetch_rawg_trending_games)

    response = client.get("/catalog/trending-games?page_size=4")

    assert response.status_code == 200
    assert response.json()["results"][0]["name"] == "Trending Game"


def test_game_price_history_returns_normalized_prices(monkeypatch):
    async def fake_cache(_key, _ttl, fetch):
        return await fetch()

    async def fake_fetch_rawg_game_detail(rawg_id: int):
        return {
            "id": rawg_id,
            "name": "Hades",
            "released": "2020-09-17",
            "background_image": None,
            "description_raw": None,
            "rating": None,
            "genres": [],
            "platforms": [],
        }

    async def fake_fetch_game_price_history(title: str, country: str):
        assert title == "Hades"
        assert country == "US"
        return {
            "itad_id": "018d937f-0000-7000-8000-000000000000",
            "title": title,
            "url": "https://isthereanydeal.com/game/hades/",
            "current": {
                "shop": "Steam",
                "price": {"amount": 9.99, "currency": "USD"},
                "regular": {"amount": 24.99, "currency": "USD"},
                "cut": 60,
                "url": "https://itad.link/example",
                "timestamp": "2026-01-01T00:00:00+00:00",
            },
            "history_low_all": {"amount": 8.99, "currency": "USD"},
            "history_low_1y": {"amount": 9.99, "currency": "USD"},
            "history_low_3m": {"amount": 12.49, "currency": "USD"},
            "deals": [],
        }

    monkeypatch.setattr(main, "get_json_cached", fake_cache)
    monkeypatch.setattr(main, "fetch_rawg_game_detail", fake_fetch_rawg_game_detail)
    monkeypatch.setattr(main, "fetch_game_price_history", fake_fetch_game_price_history)

    response = client.get("/prices/games/274755")

    assert response.status_code == 200
    assert response.json()["current"]["price"] == {"amount": 9.99, "currency": "USD"}
    assert response.json()["history_low_all"] == {"amount": 8.99, "currency": "USD"}


def test_homepage_deals_returns_steam_store_deals(monkeypatch):
    async def fake_cache(_key, _ttl, fetch):
        return await fetch()

    async def fake_fetch_steam_store_deals(country: str, page_size: int):
        assert country == "US"
        assert page_size == 1
        return [
            {
                "steam_appid": 1623730,
                "name": "Palworld",
                "background_image": "https://shared.akamai.steamstatic.com/example.jpg",
                "url": "https://store.steampowered.com/app/1623730/",
                "current": {
                    "shop": "Steam",
                    "price": {"amount": 20.99, "currency": "USD"},
                    "regular": {"amount": 29.99, "currency": "USD"},
                    "cut": 30,
                    "url": "https://store.steampowered.com/app/1623730/",
                    "timestamp": None,
                },
                "history_low_all": None,
            }
        ]

    async def fake_fetch_rawg_games(query: str, page: int):
        assert query == "Palworld"
        assert page == 1
        return {
            "results": [
                {
                    "id": 960575,
                    "name": "Palworld",
                    "released": "2024-01-19",
                    "background_image": "https://example.com/palworld.jpg",
                }
            ]
        }

    monkeypatch.setattr(main, "get_json_cached", fake_cache)
    monkeypatch.setattr(main, "fetch_steam_store_deals", fake_fetch_steam_store_deals)
    monkeypatch.setattr(main, "fetch_rawg_games", fake_fetch_rawg_games)

    response = client.get("/prices/deals?page_size=1")

    assert response.status_code == 200
    payload = response.json()
    assert payload["results"][0]["id"] == 960575
    assert payload["results"][0]["name"] == "Palworld"
    assert payload["results"][0]["current"]["cut"] == 30
    assert payload["results"][0]["background_image"].startswith("https://shared.akamai.steamstatic.com/")


def test_cors_allows_localhost_origin():
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_create_game_accepts_info(monkeypatch):
    owner_id = uuid.uuid4()
    game_id = uuid.uuid4()
    created_at = datetime.now(timezone.utc)

    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=owner_id)
    main.app.dependency_overrides[main.get_db] = lambda: object()

    def fake_create_game(_db, data, current_user):
        assert current_user == owner_id
        assert data == {
            "title": "Hades",
            "notes": "",
            "info": "Released: 2020-09-17",
        }
        return SimpleNamespace(
            id=game_id,
            title=data["title"],
            notes=data["notes"],
            info=data["info"],
            created_at=created_at,
        )

    monkeypatch.setattr(main, "create_game", fake_create_game)

    try:
        response = client.post(
            "/games",
            json={"title": "Hades", "notes": "", "info": "Released: 2020-09-17"},
        )
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["info"] == "Released: 2020-09-17"


def test_patch_game_still_supports_title_updates(monkeypatch):
    owner_id = uuid.uuid4()
    game_id = uuid.uuid4()
    created_at = datetime.now(timezone.utc)

    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=owner_id)
    main.app.dependency_overrides[main.get_db] = lambda: object()

    def fake_update_game(_db, id_, data, current_user):
        assert id_ == game_id
        assert current_user == owner_id
        assert data == {"title": "New title", "notes": "New note"}
        return SimpleNamespace(
            id=game_id,
            title=data["title"],
            notes=data["notes"],
            info="Released: 2020-09-17",
            created_at=created_at,
        )

    monkeypatch.setattr(main, "update_game", fake_update_game)

    try:
        response = client.patch(
            f"/games/{game_id}",
            json={"title": "New title", "notes": "New note"},
        )
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["title"] == "New title"
    assert response.json()["notes"] == "New note"


def test_steam_me_returns_unlinked_account(monkeypatch):
    owner_id = uuid.uuid4()
    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(
        id=owner_id,
        steam_id=None,
        steam_persona_name=None,
        steam_avatar=None,
        steam_country_code=None,
        steam_linked_at=None,
    )

    try:
        response = client.get("/steam/me")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "linked": False,
        "steam_id": None,
        "persona_name": None,
        "avatar": None,
        "country_code": None,
        "linked_at": None,
    }


def test_telegram_me_returns_unlinked_status(monkeypatch):
    owner_id = uuid.uuid4()
    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(
        id=owner_id,
        telegram_chat_id=None,
        telegram_username=None,
        telegram_linked_at=None,
    )
    monkeypatch.setattr(main, "telegram_configured", lambda: True)

    try:
        response = client.get("/telegram/me")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "linked": False,
        "configured": True,
        "username": None,
        "linked_at": None,
    }


def test_telegram_link_url_creates_deep_link(monkeypatch):
    owner_id = uuid.uuid4()
    user = SimpleNamespace(
        id=owner_id,
        telegram_chat_id=None,
        telegram_username=None,
        telegram_link_token=None,
        telegram_linked_at=None,
    )
    db = SimpleNamespace(commit=lambda: None, refresh=lambda _user: None)

    main.app.dependency_overrides[main.get_current_user] = lambda: user
    main.app.dependency_overrides[main.get_db] = lambda: db
    monkeypatch.setattr(main, "telegram_configured", lambda: True)
    monkeypatch.setattr(main, "create_telegram_link_token", lambda: "link-token")
    monkeypatch.setattr(main, "build_telegram_link_url", lambda token: f"https://t.me/gamefinder_bot?start={token}")

    try:
        response = client.post("/telegram/link-url")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "configured": True,
        "url": "https://t.me/gamefinder_bot?start=link-token",
        "message": None,
    }
    assert user.telegram_link_token == "link-token"


def test_steam_library_requires_linked_account():
    owner_id = uuid.uuid4()
    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(
        id=owner_id,
        steam_id=None,
        steam_persona_name=None,
        steam_avatar=None,
        steam_country_code=None,
        steam_linked_at=None,
    )

    try:
        response = client.get("/steam/library")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 409
    assert response.json()["detail"] == "Connect Steam first"


def test_steam_library_returns_sorted_games(monkeypatch):
    owner_id = uuid.uuid4()
    linked_at = datetime.now(timezone.utc)
    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(
        id=owner_id,
        steam_id="76561198000000000",
        steam_persona_name="Steam Player",
        steam_avatar="https://example.com/avatar.jpg",
        steam_country_code="UA",
        steam_linked_at=linked_at,
    )

    async def fake_fetch_owned_games(_steam_id):
        return [
            {
                "appid": 20,
                "name": "Half-Life 2",
                "playtime_forever": 1200,
                "playtime_2weeks": 30,
                "img_icon_url": None,
            },
            {
                "appid": 10,
                "name": "Portal",
                "playtime_forever": 600,
                "playtime_2weeks": 0,
                "img_icon_url": None,
            },
        ]

    monkeypatch.setattr(main, "fetch_owned_games", fake_fetch_owned_games)

    try:
        response = client.get("/steam/library")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["steam"]["linked"] is True
    assert payload["steam"]["country_code"] == "UA"
    assert payload["games"][0]["name"] == "Half-Life 2"


def test_steam_social_builds_friend_overlap():
    linked_at = datetime.now(timezone.utc)
    user = SimpleNamespace(
        steam_id="76561198000000000",
        steam_persona_name="Steam Player",
        steam_avatar=None,
        steam_country_code="UA",
        steam_linked_at=linked_at,
    )
    own_games = [
        {"appid": 1, "name": "Portal", "playtime_forever": 600, "playtime_2weeks": 0, "img_icon_url": None},
        {"appid": 2, "name": "Hades", "playtime_forever": 300, "playtime_2weeks": 0, "img_icon_url": None},
    ]
    friends = [
        {"steam_id": "friend-1", "persona_name": "Alex", "avatar": None, "friend_since": 100},
        {"steam_id": "friend-2", "persona_name": "Private", "avatar": None, "friend_since": 50},
    ]
    friend_libraries = [
        [
            {"appid": 1, "name": "Portal", "playtime_forever": 900, "playtime_2weeks": 0, "img_icon_url": None},
            {"appid": 3, "name": "Prey", "playtime_forever": 200, "playtime_2weeks": 0, "img_icon_url": None},
        ],
        None,
    ]

    response = main.build_steam_social_response(user, own_games, friends, friend_libraries)
    payload = response.model_dump()

    assert payload["public_libraries"] == 1
    assert payload["private_libraries"] == 1
    assert payload["friends"][0]["persona_name"] == "Alex"
    assert payload["friends"][0]["taste_match_percent"] == 50
    assert payload["friends"][0]["common_games"][0]["name"] == "Portal"
    assert payload["friends"][1]["library_public"] is False
    assert payload["top_friend_games"][0]["name"] == "Portal"
    assert "img_icon_url" in payload["top_friend_games"][0]


def test_steam_recommendations_require_linked_account():
    owner_id = uuid.uuid4()
    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(
        id=owner_id,
        steam_id=None,
        steam_persona_name=None,
        steam_avatar=None,
        steam_country_code=None,
        steam_linked_at=None,
    )

    try:
        response = client.post("/steam/recommendations", json={"prompt": ""})
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 409
    assert response.json()["detail"] == "Connect Steam first"


def test_steam_recommendations_use_most_played_games(monkeypatch):
    owner_id = uuid.uuid4()
    linked_at = datetime.now(timezone.utc)
    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(
        id=owner_id,
        steam_id="76561198000000000",
        steam_persona_name="Steam Player",
        steam_avatar=None,
        steam_country_code="UA",
        steam_linked_at=linked_at,
    )

    async def fake_fetch_owned_games(_steam_id):
        return [
            {
                "appid": 20,
                "name": "Half-Life 2",
                "playtime_forever": 1200,
                "playtime_2weeks": 0,
                "img_icon_url": None,
            },
            {
                "appid": 10,
                "name": "Portal",
                "playtime_forever": 600,
                "playtime_2weeks": 0,
                "img_icon_url": None,
            },
        ]

    def fake_get_recommendation(prompt, liked_game_ids):
        assert "Half-Life 2 - 20.0 hours played" in prompt
        assert "Portal - 10.0 hours played" in prompt
        assert "something with puzzles" in prompt
        assert liked_game_ids == [20, 10]
        return {
            "recommendations": [
                {
                    "title": "Prey",
                    "reason": "It matches your first-person immersive play history.",
                    "tags": ["immersive", "sci-fi"],
                }
            ]
        }

    monkeypatch.setattr(main, "fetch_owned_games", fake_fetch_owned_games)
    monkeypatch.setattr(main, "get_recommendation", fake_get_recommendation)

    try:
        response = client.post("/steam/recommendations", json={"prompt": "something with puzzles"})
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["recommendations"][0]["title"] == "Prey"


def test_steam_library_sync_removes_legacy_imports_without_saving_steam_games(monkeypatch):
    owner_id = uuid.uuid4()
    linked_at = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=owner_id,
        steam_id="76561198000000000",
        steam_persona_name="Steam Player",
        steam_avatar=None,
        steam_country_code="UA",
        steam_linked_at=linked_at,
    )

    class Query:
        def filter(self, *_args):
            return self

        def all(self):
            return [legacy_import]

    class Db:
        def __init__(self):
            self.added = []
            self.deleted = []
            self.committed = False

        def query(self, _model):
            return Query()

        def add(self, game):
            self.added.append(game)

        def delete(self, game):
            self.deleted.append(game)

        def commit(self):
            self.committed = True

        def rollback(self):
            raise AssertionError("sync should not roll back")

    legacy_import = SimpleNamespace(external_id="10", source="steam")
    db = Db()

    async def fake_fetch_owned_games(_steam_id):
        return [{"appid": 10, "name": "Portal", "playtime_forever": 600, "playtime_2weeks": 12, "img_icon_url": "icon"}]

    main.app.dependency_overrides[main.get_current_user] = lambda: user
    main.app.dependency_overrides[main.get_db] = lambda: db
    monkeypatch.setattr(main, "fetch_owned_games", fake_fetch_owned_games)
    try:
        response = client.post("/steam/library/sync")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["created"] == 0
    assert response.json()["updated"] == 0
    assert response.json()["removed"] == 1
    assert response.json()["games"][0]["appid"] == 10
    assert db.committed is True
    assert db.added == []
    assert db.deleted == [legacy_import]
