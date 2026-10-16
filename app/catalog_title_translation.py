"""Public catalog title lookup for library review, without paid AI calls."""

from app.integrations.wikimedia_titles import fetch_localized_catalog_titles


async def translate_library_titles(titles: list[str]) -> dict[str, list[str] | None]:
    """Look up localized names; preserve empty and unavailable results."""
    return await fetch_localized_catalog_titles(list(dict.fromkeys(titles)))
