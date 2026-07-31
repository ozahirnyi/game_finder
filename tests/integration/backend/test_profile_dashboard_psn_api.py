from io import BytesIO
from unittest.mock import AsyncMock

import pytest
from openpyxl import Workbook

from app.database import Favorite, Game, WishlistItem


pytestmark = pytest.mark.integration


def _xlsx_bytes(sheet_name="Game Library", rows=None):
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = sheet_name
    for row in rows or [["Game Title"], ["Hades"], ["Celeste"]]:
        worksheet.append(row)
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def test_profile_get_patch_persists_profile_and_visibility_fields(
    api_client, db_session, user_factory, auth_as
):
    user = auth_as(user_factory(email="profile@example.com"))

    initial = api_client.get("/profile")
    assert initial.status_code == 200
    assert initial.json()["library_visibility"] == "public"

    response = api_client.patch(
        "/profile",
        json={
            "display_name": "profile-player",
            "bio": "Co-op player",
            "platforms": ["PC", "PlayStation"],
            "favorite_genres": ["RPG", "Strategy"],
            "library_visibility": "friends",
            "favorites_visibility": "private",
            "wishlist_visibility": "friends",
            "steam_visibility": "private",
        },
    )

    assert response.status_code == 200
    assert response.json()["display_name"] == "profile-player"
    db_session.expire_all()
    stored = db_session.get(type(user), user.id)
    assert stored.bio == "Co-op player"
    assert stored.platforms == ["PC", "PlayStation"]
    assert stored.favorite_genres == ["RPG", "Strategy"]
    assert stored.library_visibility == "friends"
    assert stored.favorites_visibility == "private"
    assert stored.wishlist_visibility == "friends"
    assert stored.steam_visibility == "private"


def test_profile_summary_reports_empty_then_ready_persisted_sections(
    api_client, db_session, user_factory, auth_as
):
    user = auth_as(user_factory(email="summary@example.com"))

    empty = api_client.get("/profile/summary")
    assert empty.status_code == 200
    body = empty.json()
    assert body["profile"]["status"] == "empty"
    assert body["library"]["status"] == "empty"
    assert body["favorites"]["status"] == "empty"
    assert body["wishlist"]["status"] == "empty"

    db_session.add_all(
        [
            Game(owner_id=user.id, title="PSN Game", source="psn", external_id="psn:1"),
            Favorite(user_id=user.id, catalog_game_id=11, title="Favorite Game"),
            WishlistItem(user_id=user.id, catalog_game_id=12, title="Wishlist Game"),
        ]
    )
    db_session.commit()
    ready = api_client.get("/profile/summary")
    assert ready.status_code == 200
    body = ready.json()
    assert body["library"]["status"] == "ready"
    assert body["library"]["data"]["psn_games"] == 1
    assert body["favorites"]["data"]["total"] == 1
    assert body["wishlist"]["data"]["total"] == 1


def test_profile_summary_adds_linked_steam_library(app_main, api_client, user_factory, auth_as, monkeypatch):
    user = auth_as(user_factory(email="summary-steam@example.com", steam_id="7656119"))
    fetch = AsyncMock(return_value=[{"appid": 42, "name": "Steam Game", "playtime_forever": 120}])
    monkeypatch.setattr(app_main, "fetch_owned_games", fetch)

    response = api_client.get("/profile/summary")

    assert response.status_code == 200
    assert response.json()["library"]["status"] == "ready"
    assert response.json()["library"]["data"]["total_games"] == 1
    assert response.json()["library"]["data"]["total_playtime_minutes"] == 120
    fetch.assert_awaited_once_with("7656119")


def test_dashboard_empty_and_not_connected_states(api_client, user_factory, auth_as, app_main, monkeypatch):
    auth_as(user_factory(email="dashboard-empty@example.com"))
    monkeypatch.setattr(app_main, "fetch_steam_store_deals", AsyncMock(return_value=[]))

    response = api_client.get("/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert body["deals"]["status"] == "empty"
    assert body["steam"]["status"] == "not_connected"
    assert body["recommendations"]["status"] == "empty"


def test_dashboard_ready_and_error_states_are_boundary_mocked(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    user = auth_as(
        user_factory(
            email="dashboard-ready@example.com",
            steam_id="76561191",
            favorite_genres=["RPG"],
        )
    )
    monkeypatch.setattr(
        app_main,
        "fetch_steam_store_deals",
        AsyncMock(return_value=[{"title": "Deal", "discount_percent": 50}]),
    )
    monkeypatch.setattr(
        app_main,
        "fetch_owned_games",
        AsyncMock(return_value=[{"appid": 7, "name": "Owned", "playtime_forever": 60}]),
    )
    recommendations = AsyncMock(return_value={"recommendations": [{"title": "Suggested"}]})
    monkeypatch.setattr(app_main, "get_personalized_recommendations", recommendations)

    response = api_client.get("/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert body["deals"]["status"] == "ready"
    assert body["steam"]["status"] == "ready"
    assert body["library"]["data"]["total_playtime_minutes"] == 60
    assert body["recommendations"]["status"] == "ready"
    recommendations.assert_awaited_once()

    monkeypatch.setattr(app_main, "fetch_steam_store_deals", AsyncMock(side_effect=RuntimeError("deals")))
    monkeypatch.setattr(app_main, "fetch_owned_games", AsyncMock(side_effect=RuntimeError("steam")))
    failed = api_client.get("/dashboard")
    assert failed.json()["deals"]["status"] == "error"
    assert failed.json()["steam"]["status"] == "error"


def test_psn_import_preview_parses_xlsx_without_persisting(api_client, db_session, user_factory, auth_as):
    auth_as(user_factory(email="psn-preview@example.com"))

    response = api_client.post(
        "/psn/import/preview",
        files={"file": ("export.xlsx", _xlsx_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    assert response.status_code == 200
    assert response.json()["games"] == ["Hades", "Celeste"]
    assert response.json()["total"] == 2
    assert db_session.query(Game).count() == 0


@pytest.mark.parametrize(
    ("filename", "content", "content_type", "expected_games"),
    [
        ("export.csv", b"Game Name\nHades\nCeleste\n", "text/csv", ["Hades", "Celeste"]),
        (
            "export.json",
            b'{"games": [{"title": "Returnal"}, {"title": "Hades"}]}',
            "application/json",
            ["Returnal", "Hades"],
        ),
    ],
)
def test_psn_import_preview_accepts_supported_non_xlsx_exports(
    api_client, user_factory, auth_as, filename, content, content_type, expected_games
):
    auth_as(user_factory(email=f"psn-{filename}@example.com"))

    response = api_client.post("/psn/import/preview", files={"file": (filename, content, content_type)})

    assert response.status_code == 200
    assert response.json()["games"] == expected_games


def test_psn_import_confirm_persists_owner_scoped_idempotent_games(
    api_client, db_session, user_factory, auth_as
):
    owner = auth_as(user_factory(email="psn-owner@example.com"))
    first = api_client.post("/psn/import/confirm", json={"games": ["Hades", " Hades ", "Celeste"]})
    assert first.status_code == 200
    assert first.json() == {"created": 2, "updated": 0, "skipped": 0, "total": 2}
    assert db_session.query(Game).filter_by(owner_id=owner.id, source="psn").count() == 2

    second = api_client.post("/psn/import/confirm", json={"games": ["Hades", "Celeste"]})
    assert second.json() == {"created": 0, "updated": 0, "skipped": 2, "total": 2}

    other = auth_as(user_factory(email="psn-other@example.com"))
    other_import = api_client.post("/psn/import/confirm", json={"games": ["Hades"]})
    assert other_import.json()["created"] == 1
    assert db_session.query(Game).filter_by(owner_id=other.id, source="psn").count() == 1
    assert db_session.query(Game).filter_by(owner_id=owner.id, source="psn").count() == 2
