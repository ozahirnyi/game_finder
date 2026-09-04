import unicodedata
from collections.abc import Awaitable, Callable, Iterable, Mapping
from typing import Any


def normalize_catalog_title(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    without_diacritics = "".join(
        character
        for character in decomposed
        if not unicodedata.category(character).startswith("M")
    )
    return " ".join(
        "".join(
            character if character.isalnum() else " "
            for character in without_diacritics.casefold()
        ).split()
    )


async def enrich_recommendations(
    items: Iterable[Mapping[str, Any]],
    resolve_titles: Callable[[list[str]], Awaitable[Mapping[str, list[Mapping[str, Any]]]]],
) -> list[dict[str, Any]]:
    candidates = [dict(item) for item in items if str(item.get("title") or "").strip()][:10]
    if not candidates:
        return []
    try:
        catalog_by_title = await resolve_titles([str(item["title"]).strip() for item in candidates])
    except Exception:
        return []

    resolved: list[dict[str, Any]] = []
    for item in candidates:
        title = str(item["title"]).strip()
        wanted = normalize_catalog_title(title)
        match = next(
            (
                candidate
                for candidate in catalog_by_title.get(title, [])
                if isinstance(candidate.get("id"), int)
                and normalize_catalog_title(str(candidate.get("name") or "")) == wanted
            ),
            None,
        )
        if match is not None:
            resolved.append({**item, "game": match})
    return resolved
