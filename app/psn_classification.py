"""Explicit PSN purchase evidence used to keep imports free of non-games."""

from app.psn_export import PsnExportCandidate


def normalize_psn_product_identity(value: str | None) -> str:
    """Normalize a PSN product identity for exact comparisons only."""
    return " ".join("".join(char if char.isalnum() else " " for char in (value or "").casefold()).split())


# Maintain this as exact normalized PSN product names, not keyword fragments.
# Add an entry only after verifying it is a PSN app, service, or system theme;
# do not add game titles or generic words such as "theme".
KNOWN_NON_GAME_PSN_PRODUCT_IDENTITIES = frozenset(
    normalize_psn_product_identity(value)
    for value in (
        "Spotify",
        "YouTube",
        "Netflix",
        "Hulu",
        "Twitch",
        "Crunchyroll",
        "Amazon Prime Video",
        "Disney+",
        "HBO Max",
        "Apple TV",
        "PlayStation Video",
        "PlayStation Music",
        "PlayStation Now",
        "ShareFactory",
        "Live from PlayStation",
        "PS4 Base Theme",
        "PS4 Dynamic Theme",
        "PlayStation 4 Base Theme",
    )
)

EXPLICIT_NON_GAME_CONTENT_IDENTITIES = frozenset(
    {
        "demo",
        "trial",
        "dlc",
        "downloadable content",
        "add on",
        "expansion",
        "bundle",
        "season pass",
        "subscription",
        "currency",
        "virtual currency",
        "points",
    }
)

EXPLICIT_NON_GAME_PRODUCT_IDENTITIES = (
    "playstation plus",
    "ps plus",
    "subscription",
    "season pass",
    "wallet",
    "virtual currency",
    "currency",
    "points",
    "demo",
    "trial",
    "dlc",
    "downloadable content",
    "add-on",
    "add on",
    "expansion",
    "expansion pack",
    "bundle",
)


def _is_explicit_product_identity(product_name: str, title: str) -> bool:
    if product_name in {"playstation plus", "ps plus"} or "playstation plus" in product_name:
        return True
    if product_name == title:
        return False
    return any(
        product_name == identity
        or product_name.startswith(f"{identity} ")
        or product_name.endswith(f" {identity}")
        for identity in EXPLICIT_NON_GAME_PRODUCT_IDENTITIES
    )


def psn_purchase_exclusion_reason(candidate: PsnExportCandidate) -> str | None:
    """Return a reason only when the PSN row itself explicitly proves it is not a game."""
    if candidate.transaction_type and candidate.transaction_type.casefold() != "product purchase":
        return "Excluded: this transaction is not a product purchase."

    identities = {
        normalize_psn_product_identity(value)
        for value in (candidate.title, candidate.product_name)
        if value
    }
    if identities & KNOWN_NON_GAME_PSN_PRODUCT_IDENTITIES:
        return "Excluded: this PSN product is a known app, service, or system theme."

    product_name = normalize_psn_product_identity(candidate.product_name)
    content_type = normalize_psn_product_identity(candidate.content_type)
    title = normalize_psn_product_identity(candidate.title)
    if content_type in EXPLICIT_NON_GAME_CONTENT_IDENTITIES or _is_explicit_product_identity(product_name, title):
        return "Excluded: this purchase is explicitly a subscription, currency item, demo, add-on, pass, or bundle."
    return None
