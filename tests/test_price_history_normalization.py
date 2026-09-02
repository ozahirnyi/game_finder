from datetime import datetime, timezone

from app import prices


def test_price_history_keeps_cheapest_valid_current_deal_and_weekly_points():
    current, history = prices.normalize_price_history(
        [
            {"shop": {"name": "Expensive"}, "price": {"amount": 19.99, "currency": "USD"}, "regular": {"amount": 29.99, "currency": "USD"}},
            {"shop": {"name": "Cheapest"}, "price": {"amount": 4.99, "currency": "USD"}, "regular": {"amount": 29.99, "currency": "USD"}},
            {"shop": {"name": "Invalid negative"}, "price": {"amount": -1, "currency": "USD"}},
            {"shop": {"name": "Invalid missing currency"}, "price": {"amount": 1, "currency": ""}},
        ],
        [
            {"timestamp": "2026-08-04T00:00:00+00:00", "shop": {"name": "First"}, "deal": {"price": {"amount": 9.99, "currency": "USD"}}},
            {"timestamp": "2026-08-06T00:00:00+00:00", "shop": {"name": "Weekly low"}, "deal": {"price": {"amount": 7.99, "currency": "USD"}}},
            {"timestamp": "2026-07-01T00:00:00+00:00", "shop": {"name": "July"}, "deal": {"price": {"amount": 8.99, "currency": "USD"}}},
            {"timestamp": "2026-01-01T00:00:00+00:00", "shop": {"name": "Old"}, "deal": {"price": {"amount": 1.99, "currency": "USD"}}},
            {"timestamp": "not-a-date", "shop": {"name": "Bad date"}, "deal": {"price": {"amount": 1.99, "currency": "USD"}}},
            {"timestamp": "2026-08-05T00:00:00+00:00", "shop": {"name": "Bad price"}, "deal": {"price": {"amount": -5, "currency": "USD"}}},
        ],
        now=datetime(2026, 9, 2, tzinfo=timezone.utc),
    )

    assert current == {
        "shop": "Cheapest",
        "price": {"amount": 4.99, "currency": "USD"},
        "regular": {"amount": 29.99, "currency": "USD"},
        "cut": None,
        "url": None,
        "timestamp": None,
    }
    assert history == [
        {"timestamp": "2026-07-01T00:00:00+00:00", "shop": "July", "price": {"amount": 8.99, "currency": "USD"}, "regular": None},
        {"timestamp": "2026-08-06T00:00:00+00:00", "shop": "Weekly low", "price": {"amount": 7.99, "currency": "USD"}, "regular": None},
    ]


def test_price_history_removes_an_invalid_current_deal_timestamp():
    current, history = prices.normalize_price_history(
        [{"shop": {"name": "Store"}, "price": {"amount": 5, "currency": "USD"}, "timestamp": "not-a-date"}],
        [],
        now=datetime(2026, 9, 2, tzinfo=timezone.utc),
    )

    assert current["timestamp"] is None
    assert history == []


def test_price_history_skips_malformed_provider_entries():
    current, history = prices.normalize_price_history(
        [None, "not-a-deal", {"shop": "not-an-object", "price": "not-money"}],
        [None, "not-a-history-point", {"timestamp": "2026-08-04T00:00:00+00:00", "deal": "not-a-deal"}],
        now=datetime(2026, 9, 2, tzinfo=timezone.utc),
    )

    assert current is None
    assert history == []
