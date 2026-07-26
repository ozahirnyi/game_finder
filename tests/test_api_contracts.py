from datetime import datetime, timezone
from types import SimpleNamespace
import uuid

from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

import app.main as main


client = TestClient(main.app)


class CatalogGameDb:
    def __init__(self):
        self.games = []

    def query(self, _model):
        return CatalogGameQuery(self)

    def add(self, game):
        if game.id is None:
            game.id = uuid.uuid4()
        if game.created_at is None:
            game.created_at = datetime.now(timezone.utc)
        self.games.append(game)

    def commit(self):
        return None

    def refresh(self, _game):
        return None


class CatalogGameQuery:
    def __init__(self, db):
        self.db = db
        self.criteria = []

    def filter(self, *criteria):
        self.criteria.extend(criteria)
        return self

    def first(self):
        expected = {
            criterion.left.key: criterion.right.value
            for criterion in self.criteria
            if hasattr(criterion.left, "key") and hasattr(criterion.right, "value")
        }
        return next(
            (game for game in self.db.games if all(getattr(game, field) == value for field, value in expected.items())),
            None,
        )


def test_catalog_library_save_is_idempotent_and_server_authoritative(monkeypatch):
    owner_id = uuid.uuid4()
    db = CatalogGameDb()

    async def fake_fetch(rawg_id: int):
        assert rawg_id == 274755
        return {"id": rawg_id, "name": "Hades II", "description_raw": "Fight beyond the Underworld."}

    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=owner_id)
    main.app.dependency_overrides[main.get_db] = lambda: db
    monkeypatch.setattr(main, "fetch_rawg_game_detail", fake_fetch)

    try:
        first = client.post("/library/catalog-games/274755")
        again = client.post("/library/catalog-games/274755")
    finally:
        main.app.dependency_overrides.clear()

    assert first.status_code == 201
    assert first.json()["title"] == "Hades II"
    assert first.json()["info"] == "Fight beyond the Underworld."
    assert first.json()["source"] == "catalog"
    assert first.json()["external_id"] == "rawg:274755"
    assert again.status_code == 200
    assert again.json()["id"] == first.json()["id"]
    assert len(db.games) == 1


def test_catalog_library_save_is_isolated_by_owner(monkeypatch):
    first_owner_id = uuid.uuid4()
    second_owner_id = uuid.uuid4()
    db = CatalogGameDb()

    async def fake_fetch(rawg_id: int):
        return {"id": rawg_id, "name": "Hades II", "description_raw": None}

    main.app.dependency_overrides[main.get_db] = lambda: db
    monkeypatch.setattr(main, "fetch_rawg_game_detail", fake_fetch)

    try:
        main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=first_owner_id)
        first = client.post("/library/catalog-games/274755")
        main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=second_owner_id)
        second = client.post("/library/catalog-games/274755")
    finally:
        main.app.dependency_overrides.clear()

    assert first.status_code == 201
    assert second.status_code == 201
    assert len(db.games) == 2
    assert {game.owner_id for game in db.games} == {first_owner_id, second_owner_id}


def test_catalog_library_save_requires_authentication():
    response = client.post("/library/catalog-games/274755")

    assert response.status_code == 401


def test_catalog_wishlist_save_is_idempotent_and_server_authoritative(monkeypatch):
    owner_id = uuid.uuid4()
    db = CatalogGameDb()

    async def fake_fetch(rawg_id: int):
        assert rawg_id == 274755
        return {
            "id": rawg_id,
            "name": "Hades II",
            "background_image": "https://example.com/hades-ii.jpg",
        }

    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=owner_id)
    main.app.dependency_overrides[main.get_db] = lambda: db
    monkeypatch.setattr(main, "fetch_rawg_game_detail", fake_fetch)

    try:
        first = client.post("/wishlist/catalog-games/274755")
        again = client.post("/wishlist/catalog-games/274755")
    finally:
        main.app.dependency_overrides.clear()

    assert first.status_code == 201
    assert first.json()["catalog_game_id"] == 274755
    assert first.json()["title"] == "Hades II"
    assert first.json()["cover_url"] == "https://example.com/hades-ii.jpg"
    assert again.status_code == 200
    assert again.json()["id"] == first.json()["id"]
    assert len(db.games) == 1


def test_catalog_wishlist_save_is_isolated_by_owner(monkeypatch):
    first_owner_id = uuid.uuid4()
    second_owner_id = uuid.uuid4()
    db = CatalogGameDb()

    async def fake_fetch(rawg_id: int):
        return {"id": rawg_id, "name": "Hades II", "background_image": None}

    main.app.dependency_overrides[main.get_db] = lambda: db
    monkeypatch.setattr(main, "fetch_rawg_game_detail", fake_fetch)

    try:
        main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=first_owner_id)
        first = client.post("/wishlist/catalog-games/274755")
        main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=second_owner_id)
        second = client.post("/wishlist/catalog-games/274755")
    finally:
        main.app.dependency_overrides.clear()

    assert first.status_code == 201
    assert second.status_code == 201
    assert len(db.games) == 2
    assert {game.user_id for game in db.games} == {first_owner_id, second_owner_id}


def test_catalog_wishlist_save_requires_authentication():
    response = client.post("/wishlist/catalog-games/274755")

    assert response.status_code == 401


def test_catalog_favorite_save_is_idempotent_and_server_authoritative(monkeypatch):
    owner_id = uuid.uuid4()
    db = CatalogGameDb()

    async def fake_fetch(rawg_id: int):
        assert rawg_id == 274755
        return {
            "id": rawg_id,
            "name": "Hades II",
            "background_image": "https://example.com/hades-ii.jpg",
        }

    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=owner_id)
    main.app.dependency_overrides[main.get_db] = lambda: db
    monkeypatch.setattr(main, "fetch_rawg_game_detail", fake_fetch)

    try:
        first = client.post("/favorites/catalog-games/274755")
        again = client.post("/favorites/catalog-games/274755")
    finally:
        main.app.dependency_overrides.clear()

    assert first.status_code == 201
    assert first.json()["catalog_game_id"] == 274755
    assert first.json()["title"] == "Hades II"
    assert first.json()["cover_url"] == "https://example.com/hades-ii.jpg"
    assert again.status_code == 200
    assert again.json()["id"] == first.json()["id"]
    assert len(db.games) == 1


def test_catalog_favorite_save_is_isolated_by_owner(monkeypatch):
    first_owner_id = uuid.uuid4()
    second_owner_id = uuid.uuid4()
    db = CatalogGameDb()

    async def fake_fetch(rawg_id: int):
        return {"id": rawg_id, "name": "Hades II", "background_image": None}

    main.app.dependency_overrides[main.get_db] = lambda: db
    monkeypatch.setattr(main, "fetch_rawg_game_detail", fake_fetch)

    try:
        main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=first_owner_id)
        first = client.post("/favorites/catalog-games/274755")
        main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=second_owner_id)
        second = client.post("/favorites/catalog-games/274755")
    finally:
        main.app.dependency_overrides.clear()

    assert first.status_code == 201
    assert second.status_code == 201
    assert len(db.games) == 2
    assert {game.user_id for game in db.games} == {first_owner_id, second_owner_id}


def test_catalog_favorite_save_requires_authentication():
    response = client.post("/favorites/catalog-games/274755")

    assert response.status_code == 401


def test_catalog_favorite_save_rejects_invalid_rawg_id():
    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=uuid.uuid4())
    main.app.dependency_overrides[main.get_db] = lambda: CatalogGameDb()

    try:
        response = client.post("/favorites/catalog-games/0")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json()["detail"] == "rawg_id must be >= 1"


def test_catalog_favorite_save_recovers_from_concurrent_duplicate(monkeypatch):
    owner_id = uuid.uuid4()

    class RaceFavoriteQuery:
        def __init__(self, db):
            self.db = db

        def filter(self, *_criteria):
            return self

        def first(self):
            return self.db.existing

    class RaceFavoriteDb:
        def __init__(self):
            self.existing = None
            self.rollback_called = False

        def query(self, _model):
            return RaceFavoriteQuery(self)

        def add(self, _item):
            return None

        def commit(self):
            self.existing = SimpleNamespace(
                id=uuid.uuid4(),
                catalog_game_id=274755,
                title="Hades II",
                cover_url="https://example.com/hades-ii.jpg",
                created_at=datetime.now(timezone.utc),
                updated_at=None,
            )
            raise IntegrityError("INSERT INTO favorites", {}, Exception("duplicate"))

        def rollback(self):
            self.rollback_called = True

        def refresh(self, _item):
            raise AssertionError("a racing duplicate must not be refreshed")

    db = RaceFavoriteDb()

    async def fake_fetch(rawg_id: int):
        return {
            "id": rawg_id,
            "name": "Hades II",
            "background_image": "https://example.com/hades-ii.jpg",
        }

    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=owner_id)
    main.app.dependency_overrides[main.get_db] = lambda: db
    monkeypatch.setattr(main, "fetch_rawg_game_detail", fake_fetch)

    try:
        response = client.post("/favorites/catalog-games/274755")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["catalog_game_id"] == 274755
    assert db.rollback_called is True


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


def test_genre_deals_returns_popular_discounts_and_fallback_sections(monkeypatch):
    async def fake_cache(_key, _ttl, fetch):
        return await fetch()

    async def fake_fetch_deal_candidates(country: str):
        assert country == "US"
        return {
            "popular": [
                {"steam_appid": 1, "name": "Hades", "background_image": "steam-hades", "url": "https://store.test/hades", "current": {"cut": 50}},
                {"steam_appid": 2, "name": "Baldur's Gate 3", "background_image": "steam-bg3", "url": "https://store.test/bg3", "current": {"cut": 20}},
                {"steam_appid": 3, "name": "Stardew Valley", "background_image": "steam-stardew", "url": "https://store.test/stardew", "current": {"cut": 40}},
                {"steam_appid": 5, "name": "Cyberpunk 2077", "background_image": "steam-cyberpunk", "url": "https://store.test/cyberpunk", "current": {"cut": 55}},
            ],
            "candidates": [
                {"steam_appid": 1, "name": "Hades", "background_image": "steam-hades", "url": "https://store.test/hades", "current": {"cut": 50}},
                {"steam_appid": 4, "name": "Civilization VII", "background_image": "steam-civ", "url": "https://store.test/civ", "current": {"cut": 25}},
            ],
        }

    async def fake_fetch_rawg_games(query: str, page: int):
        assert page == 1
        return {
            "results": {
                "Hades": [{"id": 1, "name": "Hades", "released": "2020-09-17", "background_image": "rawg-hades", "genres": ["Action", "RPG"]}],
                "Civilization VII": [{"id": 2, "name": "Civilization VII", "released": "2025-02-11", "background_image": "rawg-civ", "genres": ["Strategy"]}],
            }.get(query, [])
        }

    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(
        favorite_genres=[], steam_country_code=None
    )
    monkeypatch.setattr(main, "get_json_cached", fake_cache)
    monkeypatch.setattr(main, "fetch_steam_store_deal_candidates", fake_fetch_deal_candidates, raising=False)
    monkeypatch.setattr(main, "fetch_rawg_games", fake_fetch_rawg_games)

    try:
        response = client.get("/prices/genre-deals")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert [item["name"] for item in payload["popular"]] == ["Hades", "Baldur's Gate 3", "Stardew Valley", "Cyberpunk 2077"]
    assert [section["genre"] for section in payload["sections"]] == ["Action", "RPG", "Strategy", "Adventure", "Indie"]
    assert [item["name"] for item in payload["sections"][0]["results"]] == ["Hades"]
    assert [item["name"] for item in payload["sections"][2]["results"]] == ["Civilization VII"]
    assert payload["sections"][3]["results"] == []


def test_genre_deals_caps_sections_and_uses_stable_cache_key(monkeypatch):
    cache_keys = []
    candidate_calls = 0

    async def fake_cache(key, _ttl, fetch):
        nonlocal candidate_calls
        cache_keys.append(key)
        if candidate_calls:
            return {"popular": [], "sections": []}
        candidate_calls += 1
        return await fetch()

    async def fake_fetch_deal_candidates(_country: str):
        return {
            "popular": [],
            "candidates": [
                {"steam_appid": appid, "name": f"Action {appid}", "background_image": None, "url": None, "current": None}
                for appid in range(1, 8)
            ],
        }

    async def fake_fetch_rawg_games(query: str, _page: int):
        return {"results": [{"id": int(query.split()[-1]), "name": query, "released": None, "background_image": None, "genres": ["ACTION"]}]}

    user = SimpleNamespace(favorite_genres=[" Action "], steam_country_code="us")
    main.app.dependency_overrides[main.get_current_user] = lambda: user
    monkeypatch.setattr(main, "get_json_cached", fake_cache)
    monkeypatch.setattr(main, "fetch_steam_store_deal_candidates", fake_fetch_deal_candidates, raising=False)
    monkeypatch.setattr(main, "fetch_rawg_games", fake_fetch_rawg_games)

    try:
        first = client.get("/prices/genre-deals")
        second = client.get("/prices/genre-deals")
    finally:
        main.app.dependency_overrides.clear()

    assert first.status_code == 200
    assert len(first.json()["sections"][0]["results"]) == 5
    assert second.status_code == 200
    assert cache_keys[0] == cache_keys[1]
    assert cache_keys[0].startswith("steam_genre_deals_v2:")


def test_genre_deals_fill_profile_genres_with_current_sale_genres(monkeypatch):
    async def fake_cache(_key, _ttl, fetch):
        return await fetch()

    async def fake_fetch_deal_candidates(_country: str):
        return {
            "popular": [],
            "candidates": [
                {"steam_appid": 1, "name": "Action One", "background_image": None, "url": None, "current": None},
                {"steam_appid": 2, "name": "Action Two", "background_image": None, "url": None, "current": None},
                {"steam_appid": 3, "name": "Action Three", "background_image": None, "url": None, "current": None},
                {"steam_appid": 4, "name": "Adventure One", "background_image": None, "url": None, "current": None},
                {"steam_appid": 5, "name": "Adventure Two", "background_image": None, "url": None, "current": None},
                {"steam_appid": 6, "name": "RPG One", "background_image": None, "url": None, "current": None},
            ],
        }

    async def fake_fetch_rawg_games(query: str, _page: int):
        genre = query.split()[0]
        return {"results": [{"id": hash(query), "name": query, "released": None, "background_image": None, "genres": [genre]}]}

    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(
        favorite_genres=["Sports"], steam_country_code="US"
    )
    monkeypatch.setattr(main, "get_json_cached", fake_cache)
    monkeypatch.setattr(main, "fetch_steam_store_deal_candidates", fake_fetch_deal_candidates, raising=False)
    monkeypatch.setattr(main, "fetch_rawg_games", fake_fetch_rawg_games)

    try:
        response = client.get("/prices/genre-deals")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    assert [section["genre"] for section in response.json()["sections"]] == [
        "Sports", "Action", "Adventure", "RPG", "Strategy"
    ]


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


def test_steam_social_returns_requested_friend_page_and_metadata(monkeypatch):
    linked_at = datetime.now(timezone.utc)
    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(
        id=uuid.uuid4(),
        steam_id="76561198000000000",
        steam_persona_name="Steam Player",
        steam_avatar=None,
        steam_country_code="UA",
        steam_linked_at=linked_at,
    )

    async def fake_fetch_owned_games(steam_id):
        if steam_id == "76561198000000000":
            return []
        if steam_id == "friend-3":
            return []
        raise AssertionError(f"unexpected friend library request: {steam_id}")

    async def fake_fetch_steam_friends(steam_id, *, limit, offset):
        assert steam_id == "76561198000000000"
        assert limit == 2
        assert offset == 2
        return (
            [
                {
                    "steam_id": "friend-3",
                    "persona_name": "Third",
                    "avatar": None,
                    "friend_since": 1,
                },
            ],
            3,
        )

    monkeypatch.setattr(main, "fetch_owned_games", fake_fetch_owned_games)
    monkeypatch.setattr(main, "fetch_steam_friends", fake_fetch_steam_friends)

    try:
        response = client.get("/steam/social?friends_limit=2&friends_offset=2")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert [friend["steam_id"] for friend in payload["friends"]] == ["friend-3"]
    assert payload["friends_total"] == 3
    assert payload["friends_has_more"] is False


def test_steam_social_rejects_invalid_friend_pagination():
    linked_at = datetime.now(timezone.utc)
    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(
        id=uuid.uuid4(),
        steam_id="76561198000000000",
        steam_persona_name="Steam Player",
        steam_avatar=None,
        steam_country_code="UA",
        steam_linked_at=linked_at,
    )

    try:
        assert client.get("/steam/social?friends_limit=0").status_code == 400
        assert client.get("/steam/social?friends_limit=25").status_code == 400
        assert client.get("/steam/social?friends_offset=-1").status_code == 400
    finally:
        main.app.dependency_overrides.clear()


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

    async def fake_cached_recommendations(user_id, games, prompt):
        assert user_id == owner_id
        assert [game["appid"] for game in games] == [20, 10]
        assert prompt == "something with puzzles"
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
    monkeypatch.setattr(main, "get_cached_steam_recommendations", fake_cached_recommendations)

    try:
        response = client.post("/steam/recommendations", json={"prompt": "something with puzzles"})
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["recommendations"][0]["title"] == "Prey"


def test_dashboard_requires_authentication():
    response = client.get("/dashboard")

    assert response.status_code == 401


def test_dashboard_returns_explicit_empty_and_not_connected_blocks():
    owner_id = uuid.uuid4()
    user = SimpleNamespace(
        id=owner_id,
        email="player@example.com",
        created_at=datetime.now(timezone.utc),
        steam_id=None,
        steam_persona_name=None,
        steam_avatar=None,
        steam_country_code=None,
        steam_linked_at=None,
        telegram_chat_id=None,
        telegram_username=None,
        telegram_linked_at=None,
        bio=None,
        platforms=[],
        favorite_genres=[],
    )

    class Query:
        def filter(self, *_args):
            return self

        def order_by(self, *_args):
            return self

        def all(self):
            return []

        def first(self):
            return None

    db = SimpleNamespace(query=lambda _model: Query())
    main.app.dependency_overrides[main.get_current_user] = lambda: user
    main.app.dependency_overrides[main.get_db] = lambda: db

    try:
        response = client.get("/dashboard")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["library"]["status"] == "empty"
    assert payload["steam"]["status"] == "not_connected"
    assert payload["recommendations"]["status"] == "empty"
    assert payload["social"]["status"] == "not_connected"


def test_user_profile_patch_persists_profile_fields():
    owner_id = uuid.uuid4()
    user = SimpleNamespace(
        id=owner_id,
        email="player@example.com",
        created_at=datetime.now(timezone.utc),
        bio=None,
        platforms=[],
        favorite_genres=[],
    )
    db = SimpleNamespace(query=lambda _model: SimpleNamespace(filter=lambda *_args: SimpleNamespace(first=lambda: None)), commit=lambda: None, refresh=lambda _user: None)
    main.app.dependency_overrides[main.get_current_user] = lambda: user
    main.app.dependency_overrides[main.get_db] = lambda: db

    try:
        response = client.patch(
            "/profile",
            json={"bio": "Indie fan", "platforms": ["PC", "PS5"], "favorite_genres": ["RPG"]},
        )
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["bio"] == "Indie fan"
    assert response.json()["platforms"] == ["PC", "PS5"]


def test_profile_summary_marks_unconfigured_profile_and_empty_collections():
    owner_id = uuid.uuid4()
    user = SimpleNamespace(
        id=owner_id,
        email="player@example.com",
        created_at=datetime.now(timezone.utc),
        steam_id=None,
        steam_persona_name=None,
        steam_avatar=None,
        steam_country_code=None,
        steam_linked_at=None,
        telegram_chat_id=None,
        telegram_username=None,
        telegram_linked_at=None,
        bio=None,
        platforms=[],
        favorite_genres=[],
    )

    class Query:
        def filter(self, *_args):
            return self

        def order_by(self, *_args):
            return self

        def all(self):
            return []

        def first(self):
            return None

    db = SimpleNamespace(query=lambda _model: Query())
    main.app.dependency_overrides[main.get_current_user] = lambda: user
    main.app.dependency_overrides[main.get_db] = lambda: db

    try:
        response = client.get("/profile/summary")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["profile"]["status"] == "empty"
    assert payload["favorites"]["status"] == "empty"
    assert payload["wishlist"]["status"] == "empty"


def test_dashboard_reports_ready_and_error_deal_states(monkeypatch):
    user = SimpleNamespace(
        id=uuid.uuid4(), email="player@example.com", created_at=datetime.now(timezone.utc),
        steam_id=None, steam_persona_name=None, steam_avatar=None, steam_country_code=None, steam_linked_at=None,
        telegram_chat_id=None, telegram_username=None, telegram_linked_at=None,
        bio=None, platforms=[], favorite_genres=[],
    )

    class Query:
        def filter(self, *_args):
            return self

        def order_by(self, *_args):
            return self

        def all(self):
            return []

        def first(self):
            return None

    main.app.dependency_overrides[main.get_current_user] = lambda: user
    main.app.dependency_overrides[main.get_db] = lambda: SimpleNamespace(query=lambda _model: Query())

    async def available_deals(**_kwargs):
        return [{"name": "Hades"}]

    monkeypatch.setattr(main, "fetch_steam_store_deals", available_deals)
    try:
        ready = client.get("/dashboard")

        async def unavailable_deals(**_kwargs):
            raise RuntimeError("Steam is unavailable")

        monkeypatch.setattr(main, "fetch_steam_store_deals", unavailable_deals)
        failed = client.get("/dashboard")
    finally:
        main.app.dependency_overrides.clear()

    assert ready.status_code == 200
    assert ready.json()["deals"]["status"] == "ready"
    assert failed.status_code == 200
    assert failed.json()["deals"]["status"] == "error"


def test_dashboard_library_stats_and_linked_steam_library_contract(monkeypatch):
    user = SimpleNamespace(
        id=uuid.uuid4(), email="player@example.com", created_at=datetime.now(timezone.utc),
        steam_id="76561198000000000", steam_persona_name="Steam Player", steam_avatar=None,
        steam_country_code="UA", steam_linked_at=datetime.now(timezone.utc),
        telegram_chat_id=None, telegram_username=None, telegram_linked_at=None,
        bio=None, platforms=[], favorite_genres=[],
    )
    games = [
        SimpleNamespace(id=uuid.uuid4(), title="Manual", notes=None, info=None, source="manual", external_id=None,
                        playtime_forever=None, playtime_2weeks=None, img_icon_url=None, synced_at=None, created_at=datetime.now(timezone.utc)),
        SimpleNamespace(id=uuid.uuid4(), title="PSN", notes=None, info=None, source="psn", external_id="psn:1",
                        playtime_forever=90, playtime_2weeks=None, img_icon_url=None, synced_at=None, created_at=datetime.now(timezone.utc)),
    ]

    class Query:
        def filter(self, *_args):
            return self

        def order_by(self, *_args):
            return self

        def all(self):
            return games

        def first(self):
            return None

    async def steam_games(_steam_id):
        return [{"appid": 10, "name": "Portal", "playtime_forever": 120, "playtime_2weeks": 30, "img_icon_url": None}]

    async def deals(**_kwargs):
        return []

    main.app.dependency_overrides[main.get_current_user] = lambda: user
    main.app.dependency_overrides[main.get_db] = lambda: SimpleNamespace(query=lambda _model: Query())
    monkeypatch.setattr(main, "fetch_owned_games", steam_games)
    monkeypatch.setattr(main, "fetch_steam_store_deals", deals)

    try:
        response = client.get("/dashboard")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["library"]["data"]["total_games"] == 3
    assert payload["library"]["data"]["total_playtime_hours"] == 3.5
    assert payload["library"]["data"]["manual_games"] == 1
    assert payload["library"]["data"]["psn_games"] == 1
    assert payload["steam"]["status"] == "ready"
    assert payload["steam"]["data"]["steam"]["linked"] is True
    assert payload["steam"]["data"]["games"][0]["name"] == "Portal"


def test_dashboard_keeps_steam_external_failure_as_error(monkeypatch):
    user = SimpleNamespace(
        id=uuid.uuid4(), email="player@example.com", created_at=datetime.now(timezone.utc),
        steam_id="76561198000000000", steam_persona_name="Steam Player", steam_avatar=None,
        steam_country_code="UA", steam_linked_at=datetime.now(timezone.utc),
        telegram_chat_id=None, telegram_username=None, telegram_linked_at=None,
        bio=None, platforms=[], favorite_genres=[],
    )

    class Query:
        def filter(self, *_args): return self
        def order_by(self, *_args): return self
        def all(self): return []
        def first(self): return None

    async def unavailable_library(_steam_id):
        raise RuntimeError("Steam is unavailable")

    async def deals(**_kwargs):
        return []

    main.app.dependency_overrides[main.get_current_user] = lambda: user
    main.app.dependency_overrides[main.get_db] = lambda: SimpleNamespace(query=lambda _model: Query())
    monkeypatch.setattr(main, "fetch_owned_games", unavailable_library)
    monkeypatch.setattr(main, "fetch_steam_store_deals", deals)
    try:
        response = client.get("/dashboard")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["steam"]["status"] == "error"


def test_dashboard_generates_recommendations_for_linked_steam_games(monkeypatch):
    user = SimpleNamespace(id=uuid.uuid4(), email="player@example.com", created_at=datetime.now(timezone.utc), steam_id="76561198000000000", steam_persona_name="Steam Player", steam_avatar=None, steam_country_code="US", steam_linked_at=datetime.now(timezone.utc), telegram_chat_id=None, telegram_username=None, telegram_linked_at=None, bio=None, platforms=[], favorite_genres=[])

    class Query:
        def filter(self, *_args): return self
        def order_by(self, *_args): return self
        def all(self): return []
        def first(self): return None

    async def steam_games(_steam_id):
        return [{"appid": 10, "name": "Portal", "playtime_forever": 120, "playtime_2weeks": 30, "img_icon_url": None}]

    async def cached(user_id, games):
        assert user_id == user.id
        assert games[0]["appid"] == 10
        return {"recommendations": [{"title": "Hades", "reason": "Action", "tags": ["Action"]}]}

    main.app.dependency_overrides[main.get_current_user] = lambda: user
    main.app.dependency_overrides[main.get_db] = lambda: SimpleNamespace(query=lambda _model: Query())
    monkeypatch.setattr(main, "fetch_owned_games", steam_games)
    monkeypatch.setattr(main, "fetch_steam_store_deals", lambda **_kwargs: [])
    monkeypatch.setattr(main, "get_cached_steam_recommendations", cached)
    try:
        response = client.get("/dashboard")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["recommendations"]["status"] == "ready"
    assert response.json()["recommendations"]["data"]["recommendations"][0]["title"] == "Hades"


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
