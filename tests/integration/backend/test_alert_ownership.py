import asyncio
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.database import Game, Notification, PriceAlert, WishlistItem
from app.steam_library import persist_steam_library_snapshot
from app.alert_ownership import item_is_owned
from app.game_identity import owned_library_games
from app import price_alerts


pytestmark = pytest.mark.integration


def test_unverified_wishlist_identity_does_not_claim_library_ownership(db_session, user_factory):
    user = user_factory(email="unverified-identity@example.com")
    assert owned_library_games(db_session, user.id) == []
    invalid_steam = WishlistItem(user_id=user.id, source="steam", external_id="not-an-appid",
                                 catalog_game_id=1, title="Unknown")
    assert item_is_owned(db_session, user.id, invalid_steam) is False
    other_provider = WishlistItem(user_id=user.id, source="other", external_id="1",
                                  catalog_game_id=1, title="Unknown")
    assert item_is_owned(db_session, user.id, other_provider) is False


def test_alerts_target_provider_wishlist_identity_and_hide_other_users(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory(email="alert-identity-owner@example.com"))
    monkeypatch.setattr(app_main, "fetch_steam_store_game_detail", AsyncMock(return_value={"name": "Steam 730"}))
    catalog = api_client.post("/wishlist", json={"catalog_game_id": 730, "title": "Catalog 730"}).json()
    steam = api_client.post("/wishlist/steam-games/730").json()
    assert catalog["id"] != steam["id"]

    for item in (catalog, steam):
        created = api_client.post("/price-alerts", json={
            "wishlist_item_id": item["id"], "target_discount": 25, "delivery_channels": ["in_app"]
        })
        assert created.status_code == 201
        assert created.json()["wishlist_item_id"] == item["id"]
        assert created.json()["source"] == item["source"]

    assert db_session.query(PriceAlert).filter_by(user_id=owner.id).count() == 2
    auth_as(user_factory(email="alert-identity-other@example.com"))
    assert api_client.post("/price-alerts", json={
        "wishlist_item_id": steam["id"], "target_discount": 25
    }).status_code == 404


def test_owned_game_blocks_new_wishlist_and_pauses_existing_steam_alert(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory(email="alert-owned@example.com"))
    monkeypatch.setattr(app_main, "fetch_steam_store_game_detail", AsyncMock(return_value={"name": "Steam 730"}))
    steam = api_client.post("/wishlist/steam-games/730").json()
    alert = api_client.post("/price-alerts", json={
        "wishlist_item_id": steam["id"], "target_discount": 25
    }).json()

    persist_steam_library_snapshot(db_session, owner.id, [{"appid": 730, "name": "Steam 730"}])
    db_session.commit()
    db_session.refresh(db_session.query(PriceAlert).filter_by(id=UUID(alert["id"])).one())
    paused = api_client.get("/price-alerts").json()[0]
    assert paused["paused_at"] is not None
    assert paused["pause_reason"] == "owned"
    assert api_client.post("/wishlist/steam-games/730").status_code == 409
    assert api_client.post("/price-alerts", json={
        "wishlist_item_id": steam["id"], "target_discount": 30
    }).status_code == 409
    assert db_session.query(Notification).filter_by(user_id=owner.id, type="price_alert_paused").count() == 1
    persist_steam_library_snapshot(db_session, owner.id, [{"appid": 730, "name": "Steam 730"}])
    db_session.commit()
    assert db_session.query(Notification).filter_by(user_id=owner.id, type="price_alert_paused").count() == 1


def test_saved_offer_notification_is_only_visible_to_its_owner(
    api_client, db_session, user_factory, auth_as
):
    owner = user_factory(email="saved-offer-owner@example.com")
    other = user_factory(email="saved-offer-other@example.com")
    notice = Notification(user_id=owner.id, type="price_alert", payload={
        "source": "steam", "external_id": "730", "offer": {"shop": "Steam", "price": 9.99}
    })
    db_session.add(notice)
    db_session.commit()
    auth_as(owner)
    response = api_client.get(f"/notifications/{notice.id}")
    assert response.status_code == 200
    assert response.json()["payload"]["offer"]["price"] == 9.99
    auth_as(other)
    assert api_client.get(f"/notifications/{notice.id}").status_code == 404


def test_watcher_pauses_alert_when_steam_owns_game_without_a_saved_snapshot(
    db_session, user_factory, monkeypatch
):
    owner = user_factory(email="watcher-live-owned@example.com")
    owner.steam_id = "76561198000000005"
    item = WishlistItem(
        user_id=owner.id, source="steam", external_id="730",
        catalog_game_id=730, title="Counter-Strike 2",
    )
    db_session.add(item)
    db_session.flush()
    alert = PriceAlert(
        user_id=owner.id, wishlist_item_id=item.id,
        target_discount=25, delivery_channels=["in_app"],
    )
    db_session.add(alert)
    db_session.commit()
    monkeypatch.setattr(
        price_alerts, "fetch_owned_games",
        AsyncMock(return_value=[{"appid": 730, "name": "Counter-Strike 2"}]),
        raising=False,
    )
    price_lookup = AsyncMock()
    monkeypatch.setattr(price_alerts, "fetch_steam_alert_price", price_lookup)

    asyncio.run(price_alerts.check_persisted_price_alerts(
        db_session, price_alerts.PriceAlertRunResult()
    ))

    db_session.refresh(alert)
    assert alert.paused_at is not None
    assert alert.pause_reason == "owned"
    assert db_session.query(Notification).filter_by(
        user_id=owner.id, type="price_alert_paused"
    ).count() == 1
    price_lookup.assert_not_awaited()


def test_watcher_skips_steam_alert_when_live_ownership_cannot_be_checked(
    db_session, user_factory, monkeypatch
):
    owner = user_factory(email="watcher-live-unavailable@example.com")
    owner.steam_id = "76561198000000006"
    item = WishlistItem(
        user_id=owner.id, source="steam", external_id="730",
        catalog_game_id=730, title="Counter-Strike 2",
    )
    db_session.add(item)
    db_session.flush()
    alert = PriceAlert(
        user_id=owner.id, wishlist_item_id=item.id,
        target_discount=25, delivery_channels=["in_app"],
    )
    db_session.add(alert)
    db_session.commit()
    monkeypatch.setattr(
        price_alerts, "fetch_owned_games",
        AsyncMock(side_effect=HTTPException(status_code=502, detail="Steam unavailable")),
    )
    price_lookup = AsyncMock()
    monkeypatch.setattr(price_alerts, "fetch_steam_alert_price", price_lookup)
    result = price_alerts.PriceAlertRunResult()

    asyncio.run(price_alerts.check_persisted_price_alerts(db_session, result))

    db_session.refresh(alert)
    assert alert.paused_at is None
    assert result.errors == 1
    price_lookup.assert_not_awaited()
