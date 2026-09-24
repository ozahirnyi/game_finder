import asyncio
import ast
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from app.integrations.igdb import IGDBError
from app.psn_catalog_matcher import PsnCatalogEvidence


def test_service_combines_raw_and_clean_query_results():
    from app.psn_catalog_service import resolve_psn_catalog_evidence

    async def batch(titles):
        return {
            title: (
                [{"id": 2, "name": "FIFA 16", "platforms": ["PlayStation 4"], "game_type": 0}]
                if title == "FIFA 16"
                else []
            )
            for title in titles
        }

    decisions = asyncio.run(resolve_psn_catalog_evidence(
        {"row": PsnCatalogEvidence("EA SPORTS™ FIFA 16", platforms=("PS4",))},
        batch_fetcher=batch,
        single_fetcher=AsyncMock(),
        localization_fetcher=AsyncMock(return_value={}),
    ))

    assert decisions["row"].match["id"] == 2


def test_service_flattens_shared_variants_once_and_scores_duplicate_catalog_ids_once():
    from app.psn_catalog_service import resolve_psn_catalog_evidence

    game = {"id": 12, "name": "Example", "platforms": ["PlayStation 5"], "game_type": 0}
    batch = AsyncMock(return_value={"Example - PS5": [game], "Example": [game]})

    decisions = asyncio.run(resolve_psn_catalog_evidence(
        {
            "first": PsnCatalogEvidence("Example - PS5", platforms=("PS5",)),
            "second": PsnCatalogEvidence("Example", platforms=("PS5",)),
        },
        batch_fetcher=batch,
        single_fetcher=AsyncMock(),
        localization_fetcher=AsyncMock(return_value={}),
    ))

    batch.assert_awaited_once_with(["Example - PS5", "Example"])
    assert {decision.match["id"] for decision in decisions.values()} == {12}


def test_service_uses_bounded_fallback_for_every_unresolved_query():
    from app.psn_catalog_service import resolve_psn_catalog_evidence

    batch = AsyncMock(return_value={})
    single = AsyncMock(return_value={"results": []})

    decisions = asyncio.run(resolve_psn_catalog_evidence(
        {"row": PsnCatalogEvidence("EA SPORTS™ FIFA 16")},
        batch_fetcher=batch,
        single_fetcher=single,
        localization_fetcher=AsyncMock(return_value={}),
    ))

    queries = batch.await_args.args[0]
    assert single.await_args_list == [((query,), {}) for query in queries]
    assert decisions["row"].state == "no_match"


def test_service_raises_when_any_attempted_query_is_unavailable():
    from app.psn_catalog_service import PsnCatalogUnavailable, resolve_psn_catalog_evidence

    batch = AsyncMock(side_effect=IGDBError("down", 502))
    single = AsyncMock(side_effect=IGDBError("down", 502))

    with pytest.raises(PsnCatalogUnavailable):
        asyncio.run(resolve_psn_catalog_evidence(
            {"row": PsnCatalogEvidence("Example")},
            batch_fetcher=batch,
            single_fetcher=single,
            localization_fetcher=AsyncMock(return_value={}),
        ))


def test_service_logs_aggregate_outcome_without_titles(caplog):
    from app.psn_catalog_service import resolve_psn_catalog_evidence

    async def batch(titles):
        return {title: [] for title in titles}

    with caplog.at_level("INFO", logger="app.psn_catalog_service"):
        asyncio.run(resolve_psn_catalog_evidence(
            {"row": PsnCatalogEvidence("Private Imported Title")},
            batch_fetcher=batch,
            single_fetcher=AsyncMock(),
            localization_fetcher=AsyncMock(return_value={}),
        ))

    assert "matcher_version=2" in caplog.text
    assert "no_match=1" in caplog.text
    assert "Private Imported Title" not in caplog.text


def test_service_uses_localizations_only_after_exact_matching_is_unresolved():
    from app.psn_catalog_service import resolve_psn_catalog_evidence

    localized = AsyncMock(return_value={"Ведьмак 3": [{
        "id": 2921, "name": "The Witcher 3: Wild Hunt",
        "localized_names": ["Ведьмак 3"], "platforms": ["PlayStation 4"], "game_type": 0,
    }]})
    decisions = asyncio.run(resolve_psn_catalog_evidence(
        {"row": PsnCatalogEvidence("Ведьмак 3", platforms=("PS4",))},
        batch_fetcher=AsyncMock(return_value={"Ведьмак 3": []}),
        single_fetcher=AsyncMock(return_value={"results": []}),
        localization_fetcher=localized,
    ))

    assert decisions["row"].match["id"] == 2921
    localized.assert_awaited_once_with(["Ведьмак 3"])


def test_psn_catalog_path_has_no_openai_dependency():
    root = Path(__file__).resolve().parents[1]
    psn_modules = [
        root / "app" / "psn_catalog_service.py",
        root / "app" / "psn_library_enrichment.py",
        root / "app" / "psn_resolution.py",
        root / "app" / "psn_catalog_matcher.py",
        root / "app" / "worker.py",
        root / "app" / "main.py",
    ]

    for module in psn_modules:
        tree = ast.parse(module.read_text(encoding="utf-8"))
        imports = [node.module or "" for node in ast.walk(tree) if isinstance(node, ast.ImportFrom)]
        assert "app.openai_client" not in imports, module.name


def test_manual_psn_catalog_helper_returns_canonical_igdb_titles():
    from app.psn_catalog_service import find_psn_catalog_titles

    result = asyncio.run(find_psn_catalog_titles(
        "Ведьмак 3",
        batch_fetcher=AsyncMock(return_value={"Ведьмак 3": []}),
        localization_fetcher=AsyncMock(return_value={"Ведьмак 3": [{
            "id": 2921, "name": "The Witcher 3: Wild Hunt", "localized_names": ["Ведьмак 3"],
        }]}),
    ))

    assert result == ["The Witcher 3: Wild Hunt"]
