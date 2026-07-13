import os
import secrets
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException


TELEGRAM_API_BASE = "https://api.telegram.org"


def get_telegram_bot_token() -> str:
    return os.getenv("TELEGRAM_BOT_TOKEN", "").strip()


def get_telegram_bot_username() -> str:
    return os.getenv("TELEGRAM_BOT_USERNAME", "").strip().lstrip("@")


def get_telegram_webhook_secret() -> str:
    return os.getenv("TELEGRAM_WEBHOOK_SECRET", "").strip()


def telegram_configured() -> bool:
    return bool(get_telegram_bot_token() and get_telegram_bot_username())


def create_telegram_link_token() -> str:
    return secrets.token_urlsafe(24)


def build_telegram_link_url(link_token: str) -> str:
    username = get_telegram_bot_username()
    if not username:
        raise HTTPException(status_code=503, detail="Telegram bot username is not configured")
    return f"https://t.me/{username}?start={link_token}"


def parse_start_token(update: dict[str, Any]) -> tuple[str, str, str | None]:
    message = update.get("message") or update.get("edited_message") or {}
    text = str(message.get("text") or "").strip()
    chat = message.get("chat") or {}
    sender = message.get("from") or {}

    if not text.startswith("/start"):
        raise HTTPException(status_code=400, detail="Only /start messages are supported")

    parts = text.split(maxsplit=1)
    if len(parts) != 2 or not parts[1].strip():
        raise HTTPException(status_code=400, detail="Open Telegram from the Game Finder profile link")

    chat_id = chat.get("id")
    if chat_id is None:
        raise HTTPException(status_code=400, detail="Telegram chat id is missing")

    username = sender.get("username")
    return parts[1].strip(), str(chat_id), str(username) if username else None


def send_telegram_message(chat_id: str, text: str) -> bool:
    token = get_telegram_bot_token()
    if not token:
        return False

    response = httpx.post(
        f"{TELEGRAM_API_BASE}/bot{token}/sendMessage",
        json={
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": True,
        },
        timeout=8,
    )
    return response.status_code < 400


def telegram_linked_at() -> datetime:
    return datetime.now(timezone.utc)
