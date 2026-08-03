from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from app.database import Favorite, PriceAlert, WishlistItem


pytestmark = pytest.mark.integration


def collection_payload(catalog_game_id=101, title="Hades", cover_url="https://img.test/hades.jpg"):
    return {
        "catalog_game_id": catalog_game_id,
        "title": title,
        "cover_url": cover_url,
    }


def test_favorites_manual_crud_and_owner_scoping(api_client, db_session, user_factory, auth_as):
    owner = user_factory(email="favorites-owner@example.com")
    other = user_factory(email="favorites-other@example.com")
    auth_as(owner)

    created = api_client.post("/favorites", json=collection_payload())
    assert created.status_code == 201
    favorite_id = created.json()["id"]

    stored = db_session.query(Favorite).filter_by(id=UUID(favorite_id)).one()
    assert stored.user_id == owner.id
    assert stored.catalog_game_id == 101
    assert stored.title == "Hades"

    assert [item["catalog_game_id"] for item in api_client.get("/favorites").json()] == [101]

    auth_as(other)
    assert api_client.get("/favorites").json() == []
    assert api_client.delete("/favorites/101").status_code == 404
    assert db_session.query(Favorite).filter_by(id=UUID(favorite_id)).one().user_id == owner.id

    auth_as(owner)
    assert api_client.delete("/favorites/101").status_code == 204
    assert db_session.query(Favorite).filter_by(id=UUID(favorite_id)).one_or_none() is None


def test_wishlist_manual_crud_and_owner_scoping(api_client, db_session, user_factory, auth_as):
    owner = user_factory(email="wishlist-owner@example.com")
    other = user_factory(email="wishlist-other@example.com")
    auth_as(owner)

    created = api_client.post("/wishlist", json=collection_payload(202, "Celeste"))
    assert created.status_code == 201
    item_id = created.json()["id"]
    assert db_session.query(WishlistItem).filter_by(id=UUID(item_id), user_id=owner.id).one().title == "Celeste"

    auth_as(other)
    assert api_client.get("/wishlist").json() == []
    assert api_client.patch("/wishlist/202", json={"title": "Changed"}).status_code == 404
    assert api_client.delete(f"/wishlist/{item_id}").status_code == 404
    assert db_session.query(WishlistItem).filter_by(id=UUID(item_id)).one().title == "Celeste"

    auth_as(owner)
    updated = api_client.patch("/wishlist/202", json={"title": "Celeste Remastered"})
    assert updated.status_code == 200
    db_session.expire_all()
    assert db_session.query(WishlistItem).filter_by(id=UUID(item_id)).one().title == "Celeste Remastered"
    assert api_client.delete(f"/wishlist/{item_id}").status_code == 204
    assert db_session.query(WishlistItem).filter_by(id=UUID(item_id)).one_or_none() is None


def test_wishlist_saves_steam_games_by_app_id(api_client, db_session, user_factory, auth_as, app_main, monkeypatch):
    owner = auth_as(user_factory(email="steam-wishlist@example.com"))
    monkeypatch.setattr(
        app_main,
        "fetch_steam_store_game_detail",
        AsyncMock(return_value={"appid": 1091500, "name": "Cyberpunk 2077", "background_image": "https://img.test/cyberpunk.jpg"}),
    )

    first = api_client.post("/wishlist/steam-games/1091500")
    second = api_client.post("/wishlist/steam-games/1091500")

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["source"] == "steam"
    assert first.json()["external_id"] == "1091500"
    assert db_session.query(WishlistItem).filter_by(user_id=owner.id, source="steam", external_id="1091500").count() == 1


@pytest.mark.parametrize("endpoint", ["favorites", "wishlist"])
def test_catalog_collection_fetch_persists_and_is_idempotent(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch, endpoint
):
    user = auth_as(user_factory(email=f"{endpoint}-catalog@example.com"))
    fetch = AsyncMock(return_value={"name": "Catalog Game", "background_image": "https://img.test/catalog.jpg"})
    monkeypatch.setattr(app_main, "fetch_rawg_game_detail", fetch)

    first = api_client.post(f"/{endpoint}/catalog-games/303")
    second = api_client.post(f"/{endpoint}/catalog-games/303")

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert fetch.await_count == 1
    model = Favorite if endpoint == "favorites" else WishlistItem
    rows = db_session.query(model).filter_by(user_id=user.id, catalog_game_id=303).all()
    assert len(rows) == 1
    assert rows[0].title == "Catalog Game"
    assert rows[0].cover_url == "https://img.test/catalog.jpg"


def test_price_alert_crud_persists_changes_and_is_owner_scoped(
    api_client, db_session, user_factory, auth_as
):
    owner = user_factory(email="alerts-owner@example.com")
    other = user_factory(email="alerts-other@example.com")
    auth_as(owner)
    wishlist = api_client.post("/wishlist", json=collection_payload(404, "Dead Cells")).json()

    created = api_client.post(
        "/price-alerts",
        json={"wishlist_catalog_game_id": 404, "target_price": 19.99, "delivery_channels": ["in_app"]},
    )
    assert created.status_code == 201
    alert_id = created.json()["id"]
    stored = db_session.query(PriceAlert).filter_by(id=UUID(alert_id)).one()
    assert stored.user_id == owner.id
    assert stored.wishlist_item_id == UUID(wishlist["id"])
    assert stored.target_price == 19.99

    auth_as(other)
    assert api_client.get("/price-alerts").json() == []
    assert api_client.patch(f"/price-alerts/{alert_id}", json={"target_discount": 30}).status_code == 404
    assert api_client.delete(f"/price-alerts/{alert_id}").status_code == 404
    assert db_session.query(PriceAlert).filter_by(id=UUID(alert_id)).one().target_discount is None

    auth_as(owner)
    updated = api_client.patch(f"/price-alerts/{alert_id}", json={"target_discount": 30})
    assert updated.status_code == 200
    db_session.expire_all()
    stored = db_session.query(PriceAlert).filter_by(id=UUID(alert_id)).one()
    assert stored.target_discount == 30
    assert api_client.get("/price-alerts").json()[0]["target_discount"] == 30
    assert api_client.delete(f"/price-alerts/{alert_id}").status_code == 204
    assert db_session.query(PriceAlert).filter_by(id=UUID(alert_id)).one_or_none() is None


def test_telegram_delivery_requires_linked_chat_without_persisting_or_updating(
    api_client, db_session, user_factory, auth_as
):
    user = auth_as(user_factory(email="telegram-alerts@example.com"))
    api_client.post("/wishlist", json=collection_payload(505, "Disco Elysium"))

    create = api_client.post(
        "/price-alerts",
        json={"wishlist_catalog_game_id": 505, "target_price": 10, "delivery_channels": ["telegram"]},
    )
    assert create.status_code == 400
    assert db_session.query(PriceAlert).count() == 0

    valid = api_client.post(
        "/price-alerts",
        json={"wishlist_catalog_game_id": 505, "target_price": 10, "delivery_channels": ["in_app"]},
    )
    alert_id = valid.json()["id"]
    update = api_client.patch(
        f"/price-alerts/{alert_id}",
        json={"delivery_channels": ["telegram"]},
    )
    assert update.status_code == 400
    db_session.expire_all()
    assert db_session.query(PriceAlert).filter_by(id=UUID(alert_id)).one().delivery_channels == ["in_app"]
