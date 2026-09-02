import asyncio

import pytest

from app.integrations.igdb import IGDBError
from app.recommendations import enrich_recommendations, normalize_catalog_title


def test_enrichment_uses_only_exact_normalized_match():
    async def exercise():
        async def search(_title):
            return {"results": [
                {"id": None, "name": "Hades II", "background_image": "missing-id.jpg"},
                {"id": 7, "name": "Hades II Deluxe", "background_image": "wrong.jpg"},
                {"id": 8, "name": " HÁDES---II  ", "background_image": "right.jpg", "platforms": ["PC"]},
            ]}

        result = await enrich_recommendations(
            [{"title": "Hades II", "reason": "Fast runs", "tags": ["Action"]}], search
        )

        assert result[0]["game"]["id"] == 8
        assert result[0]["game"]["background_image"] == "right.jpg"
        assert result[0]["reason"] == "Fast runs"
        assert result[0]["tags"] == ["Action"]

    asyncio.run(exercise())


def test_one_catalog_failure_does_not_discard_other_recommendations():
    async def exercise():
        async def search(title):
            if title == "Broken":
                raise IGDBError("timeout", status_code=504)
            return {"results": [{"id": 9, "name": title, "background_image": "ok.jpg"}]}

        result = await enrich_recommendations(
            [
                {"title": "Broken", "reason": "One", "tags": []},
                {"title": "Working", "reason": "Two", "tags": ["Co-op"]},
            ], search
        )

        assert result[0]["game"] is None
        assert result[1]["game"]["id"] == 9

    asyncio.run(exercise())


def test_enrichment_limits_parallel_catalog_searches():
    async def exercise():
        active = 0
        peak = 0
        release = asyncio.Event()

        async def search(title):
            nonlocal active, peak
            active += 1
            peak = max(peak, active)
            await release.wait()
            active -= 1
            return {"results": [{"id": int(title), "name": title}]}

        task = asyncio.create_task(enrich_recommendations(
            [{"title": str(index), "reason": "", "tags": []} for index in range(1, 7)],
            search,
            concurrency=3,
        ))
        while peak < 3:
            await asyncio.sleep(0)
        assert peak == 3
        release.set()
        await task
        assert peak == 3

    asyncio.run(exercise())


def test_non_latin_titles_do_not_false_match_after_normalization():
    async def exercise():
        async def search(_title):
            return {"results": [
                {"id": 1, "name": "Привет"},
                {"id": 2, "name": "世界"},
            ]}

        result = await enrich_recommendations(
            [{"title": "世界", "reason": "", "tags": []}], search
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
