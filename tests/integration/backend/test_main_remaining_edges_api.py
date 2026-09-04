import asyncio
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import Request

from app.database import Favorite, FriendRequest, Game, GameInvite, OAuthIdentity, WishlistItem
from app.recommendation_quota import QuotaDenied, QuotaSnapshot


pytestmark = pytest.mark.integration


def test_config_helpers_and_basic_routes(api_client, app_main, monkeypatch):
    monkeypatch.setenv("FRONTEND_ORIGIN", " https://one.example/, https://two.example ")
    monkeypatch.setenv("FRONTEND_ORIGINS", "https://two.example,https://three.example/")
    monkeypatch.delenv("FRONTEND_PUBLIC_URL", raising=False)
    assert app_main.get_allowed_origins() == [
        "http://localhost:3000", "http://localhost:5173", "https://one.example",
        "https://three.example", "https://two.example",
    ]
    assert app_main.get_frontend_url() == "https://one.example"
    monkeypatch.setenv("FRONTEND_PUBLIC_URL", "https://frontend.example/")
    assert app_main.get_frontend_url() == "https://frontend.example"
    monkeypatch.delenv("FRONTEND_PUBLIC_URL")
    monkeypatch.delenv("FRONTEND_ORIGIN")
    monkeypatch.delenv("FRONTEND_ORIGINS")
    assert app_main.get_frontend_url() == "http://localhost:3000"
    monkeypatch.setenv("BACKEND_PUBLIC_URL", "https://api.example/")
    request = Request({"type": "http", "scheme": "http", "server": ("test", 80), "path": "/", "headers": []})
    assert app_main.get_backend_public_url(request) == "https://api.example"
    monkeypatch.delenv("BACKEND_PUBLIC_URL")
    assert app_main.get_backend_public_url(request) == "http://test"
    assert api_client.get("/", follow_redirects=False).status_code == 307
    assert api_client.get("/favicon.ico", follow_redirects=False).status_code == 307
    assert api_client.get("/health").json() == {"status": "ok"}


def test_optional_user_rejects_invalid_tokens(api_client, user_factory):
    owner = user_factory()
    assert api_client.get("/users/unknown", headers={"Authorization": "Basic nope"}).status_code == 404
    assert api_client.get(
        f"/users/{owner.public_id}", headers={"Authorization": "Bearer not-a-token"}
    ).status_code == 401


def test_helper_response_edges(db_session, app_main, user_factory):
    owner = user_factory(email="helper@example.com", display_name=None, steam_id="123")
    assert app_main.steam_account_response(owner).linked is True
    assert app_main.user_response(owner, db=db_session).google_linked is False
    db_session.add(OAuthIdentity(user_id=owner.id, provider="google", provider_subject="g1"))
    db_session.commit()
    assert app_main.user_response(owner, db=db_session).google_linked is True
    assert app_main.public_user_response(owner).display_name.startswith("player-")
    assert app_main.public_steam_block(user_factory(email="no-steam@example.com")).status == "empty"
    assert app_main.public_steam_block(owner).data["profile_url"].endswith("/123")
    assert app_main.public_steam_block(user_factory(email="steam-name@example.com", steam_id="vanity")).data["profile_url"] is None
    assert app_main.empty_block("nothing").message == "nothing"
    notification = app_main.create_notification(db_session, owner.id, "test", {"x": 1})
    assert notification.user_id == owner.id
    friend = FriendRequest(sender_id=owner.id, recipient_id=owner.id, message=None)
    db_session.add(friend)
    db_session.flush()
    assert app_main.friend_request_response(db_session, friend).sender.id == owner.id
    invite = GameInvite(sender_id=owner.id, recipient_id=owner.id, game_name="Game", game_id=None, note=None)
    db_session.add(invite)
    db_session.flush()
    assert app_main.game_invite_response(db_session, invite).game_name == "Game"


def test_notify_saved_game_without_telegram_and_failed_delivery(app_main, user_factory, monkeypatch):
    user = user_factory(telegram_chat_id="123")
    sent = []
    monkeypatch.setattr(app_main, "send_telegram_message", lambda chat_id, message: sent.append((chat_id, message)))
    app_main.notify_saved_game(user, "Hades")
    assert sent and sent[0][0] == "123"
    monkeypatch.setattr(app_main, "send_telegram_message", lambda *_: (_ for _ in ()).throw(RuntimeError("down")))
    app_main.notify_saved_game(user, "Hades")
    app_main.notify_saved_game(user_factory(email="none@example.com"), "Hades")


def test_lifespan_cancels_price_alert_watcher(app_main, monkeypatch):
    cancelled = False

    class Task:
        def cancel(self):
            nonlocal cancelled
            cancelled = True

        def __await__(self):
            async def done():
                return None
            return done().__await__()

    monkeypatch.setattr(app_main, "wait_for_db", lambda *_: None)
    monkeypatch.setattr(app_main, "price_alerts_enabled", lambda: True)
    async def watcher():
        await asyncio.sleep(3600)
    monkeypatch.setattr(app_main, "price_alert_watcher_loop", watcher)
    def create_task(coro):
        coro.close()
        return Task()
    monkeypatch.setattr(app_main.asyncio, "create_task", create_task)
    async def exercise():
        async with app_main.lifespan(app_main.app):
            pass
    asyncio.run(exercise())
    assert cancelled


def test_auth_negative_and_profile_name_conflict(api_client, user_factory, auth_as):
    assert api_client.post("/auth/login", data={"username": "missing@example.com", "password": "bad"}).status_code == 401
    user = user_factory(email="login@example.com", password_hash=__import__("app.auth", fromlist=["hash_password"]).hash_password("correct"))
    assert api_client.post("/auth/login", data={"username": user.email, "password": "bad"}).status_code == 401
    current = auth_as(user)
    other = user_factory(email="other@example.com", display_name="Taken")
    response = api_client.patch("/profile", json={"display_name": other.display_name})
    assert response.status_code == 409
    assert current.display_name != other.display_name


def test_social_search_and_profile_negative_edges(api_client, user_factory, auth_as):
    viewer = auth_as(user_factory(email="viewer@example.com", public_nickname="Viewer"))
    hidden = user_factory(email="hidden@example.com", public_nickname=None)
    assert api_client.get("/social/players", params={"cursor": "missing"}).status_code == 400
    assert api_client.get(f"/social/profiles/{hidden.public_id}").status_code == 404
    assert api_client.get("/users/search", params={"q": "zz"}).json() == []
    assert api_client.get("/users/missing-public-id").status_code == 404
    assert viewer.public_nickname == "Viewer"


def test_social_nickname_conflict_and_validation(api_client, user_factory, auth_as):
    current = auth_as(user_factory(email="social@example.com", public_nickname="Current"))
    user_factory(email="taken@example.com", public_nickname="Taken")
    assert api_client.patch("/social/me", json={"nickname": "Taken"}).status_code == 409
    assert api_client.patch("/social/me", json={"nickname": ""}).status_code == 422
    assert current.public_nickname == "Current"


def test_public_profile_visibility_and_ready_blocks(api_client, user_factory, auth_as, db_session):
    viewer = auth_as(user_factory(email="viewer2@example.com", public_nickname="Viewer2"))
    owner = user_factory(email="public@example.com", public_nickname="Public", steam_id="vanity", library_visibility="private", favorites_visibility="private", wishlist_visibility="private", steam_visibility="private")
    assert api_client.get(f"/users/{owner.public_id}").json()["library"]["status"] == "hidden"
    auth_as(owner)
    assert api_client.get(f"/users/{owner.public_id}").json()["steam"]["status"] == "ready"
    assert viewer.id != owner.id


def test_public_profile_hides_every_private_section_without_sensitive_data(
    api_client, user_factory, auth_as, db_session
):
    owner = user_factory(
        email="private-owner@example.com",
        public_nickname="PrivateOwner",
        steam_id="76561198000000000",
        library_visibility="private",
        favorites_visibility="private",
        wishlist_visibility="private",
        steam_visibility="private",
    )
    stranger = auth_as(user_factory(email="private-viewer@example.com", public_nickname="Viewer"))
    db_session.add_all(
        [
            Game(owner_id=owner.id, title="Secret Library", source="manual"),
            Favorite(
                user_id=owner.id,
                catalog_game_id=901,
                title="Secret Favorite",
                cover_url="https://cover.test/private-favorite.jpg",
            ),
            WishlistItem(
                user_id=owner.id,
                catalog_game_id=902,
                title="Secret Wishlist",
                cover_url="https://cover.test/private-wishlist.jpg",
            ),
        ]
    )
    db_session.commit()

    response = api_client.get(f"/users/{owner.public_id}")

    assert response.status_code == 200
    payload = response.json()
    for section in ("library", "favorites", "wishlist", "steam"):
        assert payload[section] == {
            "status": "hidden",
            "data": [],
            "message": "This section is private.",
        }
    for sensitive_value in (
        "Secret Library",
        "Secret Favorite",
        "Secret Wishlist",
        "private-favorite.jpg",
        "private-wishlist.jpg",
        "76561198000000000",
    ):
        assert sensitive_value not in response.text
    assert stranger.id != owner.id


def test_price_alert_validation(api_client, user_factory, auth_as, db_session):
    user = auth_as(user_factory(email="alerts@example.com"))
    item = WishlistItem(user_id=user.id, catalog_game_id=42, title="Hades")
    db_session.add(item)
    db_session.commit()
    assert api_client.post("/price-alerts", json={"wishlist_catalog_game_id": 999, "target_price": 5}).status_code == 404
    assert api_client.post("/price-alerts", json={"wishlist_catalog_game_id": 42, "target_price": 5, "delivery_channels": ["telegram"]}).status_code == 400
    created = api_client.post("/price-alerts", json={"wishlist_catalog_game_id": 42, "target_price": 5})
    assert created.status_code == 201
    assert api_client.post("/price-alerts", json={"wishlist_catalog_game_id": 42, "target_price": 4}).status_code == 409
    assert api_client.patch(f"/price-alerts/{created.json()['id']}", json={"target_price": None, "target_discount": None}).status_code == 422


def test_recommendations_empty_and_provider_error(api_client, app_main, monkeypatch, user_factory, auth_as):
    auth_as(user_factory(email="recommendations-empty@example.com"))
    monkeypatch.setattr(app_main, "get_recommendation", lambda *_args, **_kwargs: {"recommendations": []})
    response = api_client.post("/recommendations", json={"prompt": "cozy games"})
    assert response.status_code == 200
    assert response.json()["recommendations"] == []


def test_recommendations_expose_detail_link_only_for_an_exact_catalog_match(api_client, app_main, monkeypatch, user_factory, auth_as):
    auth_as(user_factory(email="recommendations-match@example.com"))
    monkeypatch.setattr(
        app_main,
        "get_recommendation",
        lambda *_args, **_kwargs: {"recommendations": [{"title": "Hades", "reason": "Fast runs", "tags": ["roguelike"]}]},
    )

    async def fetch_catalog(titles):
        assert titles == ["Hades"]
        return {"Hades": [{"id": 1, "name": "Hades II"}, {"id": 2, "name": "Hades", "background_image": "https://img.test/hades.jpg"}]}

    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", fetch_catalog)

    response = api_client.post("/recommendations", json={"prompt": "fast roguelikes"})

    assert response.status_code == 200
    recommendation = response.json()["recommendations"][0]
    assert recommendation["title"] == "Hades"
    assert recommendation["reason"] == "Fast runs"
    assert recommendation["tags"] == ["roguelike"]
    assert recommendation["game"]["id"] == 2
    assert recommendation["game"]["background_image"] == "https://img.test/hades.jpg"


def test_recommendations_return_structured_quota_denial(api_client, app_main, monkeypatch, user_factory, auth_as):
    auth_as(user_factory(email="recommendations-denied@example.com"))
    snapshot = QuotaSnapshot(3, 0, None, datetime(2026, 9, 3, tzinfo=timezone.utc))
    monkeypatch.setattr(
        app_main, "check_quota_available",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            QuotaDenied("ai_daily_quota_exhausted", "Daily AI search limit reached.", snapshot)
        ),
    )

    response = api_client.post("/recommendations", json={"prompt": "cozy games"})

    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "ai_daily_quota_exhausted"
    assert response.json()["detail"]["quota"]["remaining"] == 0


def test_recommendation_quota_returns_authenticated_status(api_client, app_main, monkeypatch, user_factory, auth_as):
    auth_as(user_factory(email="recommendations-status@example.com"))
    snapshot = QuotaSnapshot(3, 3, None, datetime(2026, 9, 3, tzinfo=timezone.utc))
    monkeypatch.setattr(app_main, "get_quota_status", lambda *_args, **_kwargs: snapshot)

    response = api_client.get("/recommendations/quota")

    assert response.status_code == 200
    assert response.json()["remaining"] == 3
