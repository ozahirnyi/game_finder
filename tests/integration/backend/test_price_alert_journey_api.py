import asyncio
from unittest.mock import AsyncMock

import pytest

from app import price_alerts
from app.database import Notification


pytestmark = pytest.mark.integration


def test_steam_only_wishlist_alert_offer_and_owner_scoped_notification(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory(email="journey-owner@example.com"))
    other = user_factory(email="journey-other@example.com")
    monkeypatch.setattr(app_main, "fetch_steam_store_game_detail", AsyncMock(return_value={"name": "Steam only"}))
    item_response = api_client.post("/wishlist/steam-games/730")
    assert item_response.status_code == 201
    item = item_response.json()
    alert_response = api_client.post("/price-alerts", json={
        "wishlist_item_id": item["id"], "target_discount": 25, "delivery_channels": ["in_app"],
    })
    assert alert_response.status_code == 201
    assert alert_response.json()["source"] == "steam"

    monkeypatch.setattr(price_alerts, "fetch_steam_alert_price", AsyncMock(return_value={
        "current": {
            "shop": "Steam", "price": {"amount": 9.99, "currency": "USD"},
            "cut": 50, "url": "https://store.example/730",
        },
    }))
    first = price_alerts.PriceAlertRunResult()
    asyncio.run(price_alerts.check_persisted_price_alerts(db_session, first))
    second = price_alerts.PriceAlertRunResult()
    asyncio.run(price_alerts.check_persisted_price_alerts(db_session, second))
    assert first.in_app_notifications_created == 1
    assert second.in_app_notifications_created == 0

    notice = db_session.query(Notification).filter_by(user_id=owner.id, type="price_alert").one()
    saved = api_client.get(f"/notifications/{notice.id}")
    assert saved.status_code == 200
    assert saved.json()["payload"]["offer"]["url"] == "https://store.example/730"
    assert saved.json()["payload"]["external_id"] == "730"

    auth_as(other)
    assert api_client.get(f"/notifications/{notice.id}").status_code == 404
    assert api_client.patch(f"/price-alerts/{alert_response.json()['id']}", json={
        "target_discount": 10,
    }).status_code == 404


def test_live_owned_steam_game_cannot_be_added_to_wishlist(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = user_factory(email="journey-live-owned@example.com")
    owner.steam_id = "76561198000000003"
    db_session.commit()
    auth_as(owner)
    monkeypatch.setattr(
        app_main,
        "fetch_owned_games",
        AsyncMock(return_value=[{"appid": 730, "name": "Counter-Strike 2"}]),
    )
    detail = AsyncMock(return_value={"name": "Counter-Strike 2"})
    monkeypatch.setattr(app_main, "fetch_steam_store_game_detail", detail)

    response = api_client.post("/wishlist/steam-games/730")
    assert response.status_code == 409
    detail.assert_not_awaited()


def test_live_owned_steam_game_cannot_get_a_price_alert(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory(email="journey-live-alert@example.com"))
    monkeypatch.setattr(
        app_main,
        "fetch_steam_store_game_detail",
        AsyncMock(return_value={"name": "Counter-Strike 2"}),
    )
    item = api_client.post("/wishlist/steam-games/730").json()
    owner.steam_id = "76561198000000004"
    db_session.commit()
    monkeypatch.setattr(
        app_main,
        "fetch_owned_games",
        AsyncMock(return_value=[{"appid": 730, "name": "Counter-Strike 2"}]),
    )

    response = api_client.post("/price-alerts", json={
        "wishlist_item_id": item["id"], "target_discount": 25,
        "delivery_channels": ["in_app"],
    })
    assert response.status_code == 409
