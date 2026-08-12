import asyncio
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from app.database import Favorite, Notification, PriceAlert, WishlistItem
from app import price_alerts as runner


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
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", fetch)

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


def test_price_alert_accepts_one_percent_for_the_any_discount_preset(
    api_client, db_session, user_factory, auth_as
):
    user = auth_as(user_factory(email="any-discount-alert@example.com"))
    api_client.post("/wishlist", json=collection_payload(606, "Hades"))

    response = api_client.post(
        "/price-alerts",
        json={"wishlist_catalog_game_id": 606, "target_discount": 1, "delivery_channels": ["in_app"]},
    )

    assert response.status_code == 201
    assert db_session.query(PriceAlert).filter_by(user_id=user.id).one().target_discount == 1


def test_in_app_price_alert_notification_is_owner_scoped_and_deduplicated(
    db_session, user_factory, monkeypatch
):
    owner = user_factory(email="notification-alert-owner@example.com")
    other = user_factory(email="notification-alert-other@example.com")
    owner_item = WishlistItem(user_id=owner.id, catalog_game_id=707, title="Hades")
    other_item = WishlistItem(user_id=other.id, catalog_game_id=808, title="Celeste")
    db_session.add_all([owner_item, other_item])
    db_session.commit()
    db_session.add_all([
        PriceAlert(user_id=owner.id, wishlist_item_id=owner_item.id, target_price=10, target_discount=50, delivery_channels=["in_app"]),
        PriceAlert(user_id=other.id, wishlist_item_id=other_item.id, target_price=5, delivery_channels=["telegram"]),
    ])
    db_session.commit()

    monkeypatch.setattr(
        runner,
        "fetch_game_price_history",
        AsyncMock(return_value={"current": {"shop": "Steam", "price": {"amount": 9.99, "currency": "USD"}, "cut": 60, "url": "https://store.example/hades"}}),
    )

    first = asyncio.run(runner.check_price_alerts(db_session))
    second = asyncio.run(runner.check_price_alerts(db_session))

    notices = db_session.query(Notification).all()
    assert first.in_app_notifications_created == 1
    assert second.in_app_notifications_created == 0
    assert [(notice.user_id, notice.type, notice.payload) for notice in notices] == [
        (owner.id, "price_alert", {"catalog_game_id": 707}),
    ]


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
