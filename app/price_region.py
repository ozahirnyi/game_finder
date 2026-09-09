from typing import Any


PRICE_COUNTRY_CODES = ("US", "UA", "GB", "DE", "PL", "TR", "AR", "KZ")
PRICE_COUNTRY_SET = frozenset(PRICE_COUNTRY_CODES)


def normalize_price_country(value: Any, default: str = "US") -> str:
    code = str(value or "").strip().upper()
    return code if code in PRICE_COUNTRY_SET else default


def effective_price_country(user: Any | None, requested: Any = None) -> str:
    if user is not None:
        preferred = getattr(user, "price_country_code", None)
        if preferred:
            return normalize_price_country(preferred)
    return normalize_price_country(requested)
