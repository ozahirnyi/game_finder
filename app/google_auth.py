import base64
import hashlib
import os
import secrets
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from jose import jwt, JWTError

GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


def google_configured() -> bool:
    return bool(os.getenv("GOOGLE_CLIENT_ID", "").strip() and os.getenv("GOOGLE_CLIENT_SECRET", "").strip() and os.getenv("GOOGLE_REDIRECT_URI", "").strip())


def normalize_email(email: str) -> str:
    return email.strip().lower()


def random_token() -> str:
    return secrets.token_urlsafe(32)


def code_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def build_google_authorization_url(state: str, verifier: str, nonce: str) -> str:
    params = {"client_id": os.environ["GOOGLE_CLIENT_ID"], "redirect_uri": os.environ["GOOGLE_REDIRECT_URI"], "response_type": "code", "scope": "openid email profile", "state": state, "nonce": nonce, "code_challenge": code_challenge(verifier), "code_challenge_method": "S256", "prompt": "select_account"}
    return f"{GOOGLE_AUTHORIZATION_ENDPOINT}?{urlencode(params)}"


async def exchange_google_code(code: str, verifier: str) -> dict:
    payload = {"code": code, "client_id": os.environ["GOOGLE_CLIENT_ID"], "client_secret": os.environ["GOOGLE_CLIENT_SECRET"], "redirect_uri": os.environ["GOOGLE_REDIRECT_URI"], "grant_type": "authorization_code", "code_verifier": verifier}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(GOOGLE_TOKEN_ENDPOINT, data=payload)
    response.raise_for_status()
    return response.json()


async def verify_google_id_token(id_token: str, nonce: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(GOOGLE_JWKS_ENDPOINT)
    response.raise_for_status()
    try:
        key_id = jwt.get_unverified_header(id_token).get("kid")
        signing_key = next((key for key in response.json().get("keys", []) if key.get("kid") == key_id), None)
        if not signing_key:
            raise ValueError("Unknown Google signing key")
        claims = jwt.decode(id_token, signing_key, algorithms=["RS256"], audience=os.environ["GOOGLE_CLIENT_ID"], options={"verify_at_hash": False})
    except JWTError as exc:
        raise ValueError("Invalid Google identity token") from exc
    if claims.get("iss") not in GOOGLE_ISSUERS or claims.get("nonce") != nonce:
        raise ValueError("Invalid Google identity token")
    if claims.get("email_verified") is not True or not isinstance(claims.get("email"), str) or not isinstance(claims.get("sub"), str):
        raise ValueError("Google account email is not verified")
    return claims


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
