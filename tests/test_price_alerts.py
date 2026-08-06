from app.price_alerts import build_price_alert_key, format_price_alert_message
from types import SimpleNamespace
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, Notification, PriceAlert, User


def test_any_discount_matches_only_positive_cut():
    from app.price_alerts import alert_matches_deal

    alert = SimpleNamespace(mode="any_discount", threshold=None)
    assert alert_matches_deal(alert, {"cut": 25, "price": {"amount": 10, "currency": "USD"}})
    assert not alert_matches_deal(alert, {"cut": 0, "price": {"amount": 10, "currency": "USD"}})


def test_matching_persisted_alert_creates_in_app_notification(monkeypatch):
    from app.price_alerts import check_price_alerts

    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    user = User(email="watcher@example.test")
    db.add(user)
    db.commit()
    alert = PriceAlert(
        user_id=user.id,
        identity_kind="rawg",
        identity_value="30",
        title="Hades",
        mode="any_discount",
        in_app=True,
        telegram=False,
    )
    db.add(alert)
    db.commit()

    async def fake_history(_title, country="US"):
        return {"current": {"shop": "Steam", "price": {"amount": 10, "currency": "USD"}, "cut": 25, "url": "https://store.steampowered.com/app/1145360"}}

    monkeypatch.setattr("app.price_alerts.fetch_game_price_history", fake_history)
    asyncio.run(check_price_alerts(db))

    assert db.query(Notification).filter_by(price_alert_id=alert.id).count() == 1


def test_price_alert_message_includes_current_discount(monkeypatch):
    monkeypatch.setenv("PRICE_ALERT_MIN_CUT", "10")

    message = format_price_alert_message(
        "Hades",
        {
            "url": "https://isthereanydeal.com/game/hades/",
            "current": {
                "shop": "Steam",
                "price": {"amount": 9.99, "currency": "USD"},
                "regular": {"amount": 24.99, "currency": "USD"},
                "cut": 60,
                "url": "https://store.steampowered.com/app/1145360",
            },
            "history_low_all": {"amount": 8.99, "currency": "USD"},
        },
    )

    assert message is not None
    assert "Hades is on sale." in message
    assert "9.99 USD" in message
    assert "60% off" in message
    assert "Historical low: 8.99 USD" in message


def test_price_alert_message_skips_small_discounts(monkeypatch):
    monkeypatch.setenv("PRICE_ALERT_MIN_CUT", "25")

    message = format_price_alert_message(
        "Portal 2",
        {
            "current": {
                "shop": "Steam",
                "price": {"amount": 7.99, "currency": "USD"},
                "regular": {"amount": 9.99, "currency": "USD"},
                "cut": 20,
            }
        },
    )

    assert message is None


def test_price_alert_key_changes_with_price():
    first = build_price_alert_key(
        {
            "shop": "Steam",
            "price": {"amount": 9.99, "currency": "USD"},
            "cut": 60,
            "url": "https://example.com/a",
        }
    )
    second = build_price_alert_key(
        {
            "shop": "Steam",
            "price": {"amount": 8.99, "currency": "USD"},
            "cut": 64,
            "url": "https://example.com/a",
        }
    )

    assert first != second
