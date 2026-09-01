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
        "EA Play",
        "PlayStation Plus",
        "Base Theme",
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

# Exact names used by PlayStation Store for non-game storefront categories.
# Keep these separate from apps/services and add only verified category labels;
# never add a game title or a generic keyword such as "theme".
KNOWN_NON_GAME_PSN_STORE_CATEGORY_IDENTITIES = frozenset(
    {
        "ad sales ps4 themes",
    }
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
        "wallet",
        "currency",
        "virtual currency",
        "points",
    }
)

EXPLICIT_NON_GAME_PRODUCT_IDENTITIES = (
    "ps plus",
    "demo entitlement",
    "season pass",
    "expansion add on",
    "virtual currency",
    "game bundle",
    "wallet top up",
)

EXPLICIT_NON_GAME_DESCRIPTOR_IDENTITIES = frozenset(
    {
        "demo",
        "trial",
        "dlc",
        "downloadable content",
        "add on",
        "expansion",
        "expansion pack",
        "bundle",
        "season pass",
        "subscription",
        "wallet",
        "currency",
        "virtual currency",
        "points",
    }
)


def _is_explicit_product_identity(product_name: str, title: str) -> bool:
    if product_name in EXPLICIT_NON_GAME_PRODUCT_IDENTITIES or "playstation plus" in product_name:
        return True
    if not title or not product_name.startswith(f"{title} "):
        return False
    descriptor = product_name[len(title) + 1 :]
    return descriptor in EXPLICIT_NON_GAME_DESCRIPTOR_IDENTITIES or descriptor.startswith("playstation plus ")


def is_explicit_psn_non_game_product(title: str, product_name: str) -> bool:
    """Return whether a product name explicitly identifies non-game PSN content."""
    return _is_explicit_product_identity(
        normalize_psn_product_identity(product_name),
        normalize_psn_product_identity(title),
    )


def psn_purchase_exclusion_reason(candidate: PsnExportCandidate) -> str | None:
    """Return a reason only when the PSN row itself explicitly proves it is not a game."""
    if any(value.casefold() != "product purchase" for value in candidate.transaction_types):
        return "Excluded: this transaction is not a product purchase."

    identities = {
        normalize_psn_product_identity(value)
        for value in (candidate.title, *candidate.product_names)
        if value
    }
    if identities & KNOWN_NON_GAME_PSN_PRODUCT_IDENTITIES:
        return "Excluded: this PSN product is a known app, service, or system theme."
    if identities & KNOWN_NON_GAME_PSN_STORE_CATEGORY_IDENTITIES:
        return "Excluded: this PSN title is a known non-game storefront category."

    title = normalize_psn_product_identity(candidate.title)
    if any(normalize_psn_product_identity(value) in EXPLICIT_NON_GAME_CONTENT_IDENTITIES for value in candidate.content_types) or any(_is_explicit_product_identity(normalize_psn_product_identity(value), title) for value in candidate.product_names):
        return "Excluded: this purchase is explicitly a subscription, currency item, demo, add-on, pass, or bundle."
    return None


REPAIR_NON_GAME_CATEGORY_PHRASES = frozenset({
    "public test server", "test client", "beta client", "playtest", "subscription",
    "theme", "dlc", "add on", "wallet", "currency",
})

SELF_TITLE_NON_GAME_CATEGORY_SUFFIXES = frozenset({
    "demo",
    "trial",
    "dlc",
    "downloadable content",
    "add on",
    "season pass",
    "public test server",
    "test client",
    "beta client",
    "playtest",
    "soundtrack",
    "subscription",
    "virtual currency",
    "wallet top up",
    "theme",
})


def is_explicit_non_game_self_title(title: str) -> bool:
    """Recognize narrow standalone PSN service/category identities, never substrings."""
    identity = normalize_psn_product_identity(title)
    return any(identity == suffix or identity.endswith(f" {suffix}") for suffix in SELF_TITLE_NON_GAME_CATEGORY_SUFFIXES)


def psn_repair_quarantine_reason(title: str) -> str | None:
    """Return evidence-based generic non-game classification for stored PSN titles."""
    identity = normalize_psn_product_identity(title)
    if identity in KNOWN_NON_GAME_PSN_PRODUCT_IDENTITIES or identity in KNOWN_NON_GAME_PSN_STORE_CATEGORY_IDENTITIES:
        return "Known PlayStation app, service, or theme."
    if identity in REPAIR_NON_GAME_CATEGORY_PHRASES or is_explicit_non_game_self_title(identity):
        return "Stored title is an explicit non-game category."
    return None
