from app.price_alerts import build_price_alert_key, format_price_alert_message


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
