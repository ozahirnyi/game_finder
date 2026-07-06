from datetime import datetime, timezone
from types import SimpleNamespace
import uuid

from fastapi.testclient import TestClient

import app.main as main


client = TestClient(main.app)


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
