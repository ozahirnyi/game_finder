import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import HTTPException

import app.price_alerts as runner


class FakeQuery:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, *args):
        return self

    def all(self):
        return self.rows


class FakeDb:
    def __init__(self, users):
        self.users = users
        self.commits = 0
        self.rollbacks = 0
        self.closed = False

    def query(self, model):
        return FakeQuery(self.users if model is runner.User else [])

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed = True


def deal(**overrides):
    value = {
        "shop": "Steam",
        "price": {"amount": 9.99, "currency": "USD"},
        "regular": {"amount": 24.99},
        "cut": 60,
        "url": "https://store.example/game",
    }
    value.update(overrides)
    return value


def test_env_helpers_accept_values_and_apply_clamps(monkeypatch):
    monkeypatch.setenv("PRICE_ALERT_WATCHER_ENABLED", " YeS ")
    monkeypatch.setenv("PRICE_ALERT_INTERVAL_SECONDS", "1")
    monkeypatch.setenv("PRICE_ALERT_INITIAL_DELAY_SECONDS", "-2")
    monkeypatch.setenv("PRICE_ALERT_MIN_CUT", "0")

    assert runner.price_alerts_enabled() is True
    assert runner.price_alert_interval_seconds() == 300
    assert runner.price_alert_initial_delay_seconds() == 0
    assert runner.price_alert_min_cut() == 1

    monkeypatch.setenv("PRICE_ALERT_WATCHER_ENABLED", "off")
    assert runner.price_alerts_enabled() is False


@pytest.mark.parametrize(
    "name",
    ["PRICE_ALERT_INTERVAL_SECONDS", "PRICE_ALERT_INITIAL_DELAY_SECONDS", "PRICE_ALERT_MIN_CUT"],
)
def test_env_numeric_helpers_raise_for_invalid_values(monkeypatch, name):
    monkeypatch.setenv(name, "invalid")
    with pytest.raises(ValueError):
        getattr(runner, {
            "PRICE_ALERT_INTERVAL_SECONDS": "price_alert_interval_seconds",
            "PRICE_ALERT_INITIAL_DELAY_SECONDS": "price_alert_initial_delay_seconds",
            "PRICE_ALERT_MIN_CUT": "price_alert_min_cut",
        }[name])()


@pytest.mark.parametrize("value", [{}, {"price": {"currency": "USD"}}, {"price": {"amount": 1}}])
def test_build_price_alert_key_returns_none_for_incomplete_deals(value):
    assert runner.build_price_alert_key(value) is None


@pytest.mark.parametrize(
    "data",
    [{}, {"current": None}, {"current": {"price": {"amount": 1}, "cut": 50}}],
)
def test_format_message_returns_none_without_current_or_required_discount(data):
    assert runner.format_price_alert_message("Game", data) is None


def test_format_message_supports_fallbacks_and_optional_lines(monkeypatch):
    monkeypatch.setenv("PRICE_ALERT_MIN_CUT", "10")
    message = runner.format_price_alert_message(
        "Game",
        {"current": deal(regular={}, shop=None, url=None), "url": "https://fallback"},
    )
    assert message == "Game is on sale.\nNow: 9.99 USD at a store (60% off).\nhttps://fallback"


def test_format_message_includes_regular_and_history_low(monkeypatch):
    monkeypatch.setenv("PRICE_ALERT_MIN_CUT", "1")
    message = runner.format_price_alert_message(
        "Game",
        {"current": deal(), "history_low_all": {"amount": 5, "currency": "EUR"}},
    )
    assert "Regular: 24.99 USD." in message
    assert "Historical low: 5 EUR." in message


def test_check_price_alerts_no_users_and_no_games(monkeypatch):
    db = FakeDb([])
    result = asyncio.run(runner.check_price_alerts(db))
    assert result.users_checked == result.games_checked == 0
    assert db.commits == 0


def test_check_price_alerts_sends_updates_and_suppresses_duplicate(monkeypatch):
    game = SimpleNamespace(title="Hades", owner_id="u1", price_alert_last_key=None)
    user = SimpleNamespace(id="u1", telegram_chat_id="chat", steam_country_code="us")
    db = FakeDb([user])
    db.query = Mock(side_effect=[FakeQuery([user]), FakeQuery([game]), FakeQuery([user]), FakeQuery([game])])
    fetch = AsyncMock(return_value={"current": deal()})
    send = Mock(return_value=True)
    monkeypatch.setattr(runner, "fetch_game_price_history", fetch)
    monkeypatch.setattr(runner, "send_telegram_message", send)
    monkeypatch.setattr(runner, "check_persisted_price_alerts", AsyncMock())

    first = asyncio.run(runner.check_price_alerts(db))
    second = asyncio.run(runner.check_price_alerts(db))
    assert first.alerts_sent == 1
    assert second.alerts_sent == 0
    assert send.call_count == 1
    assert game.price_alert_last_amount == 9.99
    assert game.price_alert_last_currency == "USD"
    assert game.price_alert_last_cut == 60
    assert db.commits == 2


def test_check_price_alerts_handles_no_deal_failed_delivery_and_provider_error(monkeypatch):
    games = [SimpleNamespace(title="No deal", owner_id="u1", price_alert_last_key=None),
             SimpleNamespace(title="Failed send", owner_id="u1", price_alert_last_key=None),
             SimpleNamespace(title="Error", owner_id="u1", price_alert_last_key=None)]
    user = SimpleNamespace(id="u1", telegram_chat_id="chat", steam_country_code="USA")
    db = FakeDb([user])
    db.query = Mock(side_effect=[FakeQuery([user]), FakeQuery(games)])
    monkeypatch.setattr(runner, "fetch_game_price_history", AsyncMock(side_effect=[{}, {"current": deal()}, RuntimeError("down")]))
    monkeypatch.setattr(runner, "send_telegram_message", Mock(return_value=False))
    monkeypatch.setattr(runner, "check_persisted_price_alerts", AsyncMock())

    result = asyncio.run(runner.check_price_alerts(db))
    assert (result.users_checked, result.games_checked, result.alerts_sent, result.errors) == (1, 3, 0, 1)
    assert games[0].price_alert_checked_at is not None
    assert games[1].price_alert_last_key is None
    assert db.rollbacks == 1


def test_check_price_alerts_handles_http_exception(monkeypatch):
    game = SimpleNamespace(title="Error", owner_id="u1", price_alert_last_key=None)
    user = SimpleNamespace(id="u1", telegram_chat_id="chat", steam_country_code="US")
    db = FakeDb([user])
    db.query = Mock(side_effect=[FakeQuery([user]), FakeQuery([game])])
    monkeypatch.setattr(
        runner,
        "fetch_game_price_history",
        AsyncMock(side_effect=HTTPException(status_code=503, detail="provider unavailable")),
    )
    monkeypatch.setattr(runner, "check_persisted_price_alerts", AsyncMock())

    result = asyncio.run(runner.check_price_alerts(db))
    assert result.errors == 1
    assert db.rollbacks == 1


def test_run_once_closes_session(monkeypatch):
    db = FakeDb([])
    monkeypatch.setattr(runner, "SessionLocal", Mock(return_value=db))
    monkeypatch.setattr(runner, "check_price_alerts", AsyncMock(return_value=runner.PriceAlertRunResult(users_checked=2)))
    result = asyncio.run(runner.run_price_alerts_once())
    assert result.users_checked == 2
    assert db.closed is True


def test_watcher_loop_can_be_cancelled_before_first_run(monkeypatch):
    monkeypatch.setattr(runner, "price_alert_initial_delay_seconds", Mock(return_value=0))
    sleep = AsyncMock(side_effect=asyncio.CancelledError)
    check = AsyncMock()
    monkeypatch.setattr(runner.asyncio, "sleep", sleep)
    monkeypatch.setattr(runner, "run_price_alerts_once", check)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(runner.price_alert_watcher_loop())
    check.assert_not_awaited()


def test_watcher_loop_runs_once_then_cancellation(monkeypatch):
    monkeypatch.setattr(runner, "price_alert_initial_delay_seconds", Mock(return_value=0))
    monkeypatch.setattr(runner, "price_alert_interval_seconds", Mock(return_value=300))
    monkeypatch.setattr(runner.asyncio, "sleep", AsyncMock(side_effect=[None, asyncio.CancelledError]))
    check = AsyncMock(return_value=runner.PriceAlertRunResult())
    monkeypatch.setattr(runner, "run_price_alerts_once", check)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(runner.price_alert_watcher_loop())
    check.assert_awaited_once()
