from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from app.database import Game, Notification, PriceAlert, WishlistItem
from app.steam_library import persist_steam_library_snapshot
from app.alert_ownership import item_is_owned
from app.game_identity import owned_library_games


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
