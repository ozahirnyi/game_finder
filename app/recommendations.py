import asyncio
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
    search_title: Callable[[str], Awaitable[Mapping[str, Any]]],
    concurrency: int = 3,
) -> list[dict[str, Any]]:
    semaphore = asyncio.Semaphore(concurrency)

    async def enrich(item: Mapping[str, Any]) -> dict[str, Any]:
        try:
            async with semaphore:
                payload = await search_title(item["title"])
            wanted = normalize_catalog_title(item["title"])
            match = next(
                (
                    candidate
                    for candidate in payload.get("results", [])
                    if candidate.get("id") is not None
                    and normalize_catalog_title(candidate.get("name") or "") == wanted
                ),
                None,
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            match = None
        return {**item, "game": match}

    return await asyncio.gather(*(enrich(item) for item in items))
