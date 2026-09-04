import asyncio

import pytest

from app.integrations.igdb import IGDBError
from app.recommendations import enrich_recommendations, normalize_catalog_title


def test_enrichment_resolves_at_most_ten_titles_in_one_batch_and_omits_unresolved():
    async def exercise():
        calls = []

        async def batch_search(titles):
            calls.append(titles)
            return {
                "Hades": [{"id": 8, "name": "Hades", "background_image": "right.jpg"}],
                "Unresolved": [{"id": 9, "name": "Different game"}],
            }

        result = await enrich_recommendations(
            [
                {"title": "Hades", "reason": "Fast runs", "tags": ["Action"]},
                {"title": "Unresolved", "reason": "Ignored", "tags": []},
                *[{"title": f"Extra {index}", "reason": "", "tags": []} for index in range(1, 11)],
            ],
            batch_search,
        )

        assert calls == [["Hades", "Unresolved", *[f"Extra {index}" for index in range(1, 9)]]]
        assert result == [{
            "title": "Hades",
            "reason": "Fast runs",
            "tags": ["Action"],
            "game": {"id": 8, "name": "Hades", "background_image": "right.jpg"},
        }]

    asyncio.run(exercise())


def test_enrichment_allows_fewer_than_ten_ai_recommendations():
    async def exercise():
        calls = []

        async def batch_search(titles):
            calls.append(titles)
            return {title: [{"id": index, "name": title}] for index, title in enumerate(titles, 1)}

        result = await enrich_recommendations(
            [{"title": title, "reason": "", "tags": []} for title in ["One", "Two", "Three"]],
            batch_search,
        )

        assert calls == [["One", "Two", "Three"]]
        assert [item["game"]["id"] for item in result] == [1, 2, 3]

    asyncio.run(exercise())


def test_enrichment_uses_only_exact_normalized_match():
    async def exercise():
        async def batch_search(_titles):
            return {"Hades II": [
                {"id": None, "name": "Hades II", "background_image": "missing-id.jpg"},
                {"id": 7, "name": "Hades II Deluxe", "background_image": "wrong.jpg"},
                {"id": 8, "name": " HÁDES---II  ", "background_image": "right.jpg", "platforms": ["PC"]},
            ]}

        result = await enrich_recommendations(
            [{"title": "Hades II", "reason": "Fast runs", "tags": ["Action"]}], batch_search
        )

        assert result[0]["game"]["id"] == 8
        assert result[0]["game"]["background_image"] == "right.jpg"
        assert result[0]["reason"] == "Fast runs"
        assert result[0]["tags"] == ["Action"]

    asyncio.run(exercise())


def test_batch_catalog_failure_discards_all_recommendations():
    async def exercise():
        async def batch_search(_titles):
            raise IGDBError("timeout", status_code=504)

        result = await enrich_recommendations(
            [
                {"title": "Broken", "reason": "One", "tags": []},
                {"title": "Working", "reason": "Two", "tags": ["Co-op"]},
            ], batch_search
        )

        assert result == []

    asyncio.run(exercise())


def test_enrichment_calls_batch_resolver_once():
    async def exercise():
        calls = []

        async def batch_search(titles):
            calls.append(titles)
            return {title: [{"id": int(title), "name": title}] for title in titles}

        result = await enrich_recommendations(
            [{"title": str(index), "reason": "", "tags": []} for index in range(1, 7)],
            batch_search,
        )
        assert calls == [[str(index) for index in range(1, 7)]]
        assert len(result) == 6

    asyncio.run(exercise())


def test_non_latin_titles_do_not_false_match_after_normalization():
    async def exercise():
        async def batch_search(_titles):
            return {"世界": [
                {"id": 1, "name": "Привет"},
                {"id": 2, "name": "世界"},
            ]}

        result = await enrich_recommendations(
            [{"title": "世界", "reason": "", "tags": []}], batch_search
        )

        assert normalize_catalog_title("Привет") != normalize_catalog_title("世界")
        assert result[0]["game"]["id"] == 2

    asyncio.run(exercise())


def test_enrichment_reraises_cancellation():
    async def exercise():
        async def search(_title):
            raise asyncio.CancelledError()

        with pytest.raises(asyncio.CancelledError):
            await enrich_recommendations(
                [{"title": "Cancelled", "reason": "", "tags": []}], search
            )

    asyncio.run(exercise())
