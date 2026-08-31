import pytest
import asyncio
from unittest.mock import AsyncMock

from app.psn_export import PsnExportCandidate, PsnTransactionEvidence


def test_classification_keeps_base_purchase_eligible_when_related_demo_exists():
    from app.psn_resolution import classify_psn_candidate

    candidate = PsnExportCandidate(
        "Example Game",
        product_names=("Example Game", "Example Game Demo"),
        transaction_types=("Product Purchase", "Product Purchase"),
    )

    assert classify_psn_candidate(candidate).kind == "eligible"


def test_classification_marks_entitlement_only_game_for_review():
    from app.psn_resolution import classify_psn_candidate

    candidate = PsnExportCandidate(
        "Example Game",
        product_names=("Example Game Demo",),
        transaction_types=("Product Purchase",),
        transactions=(PsnTransactionEvidence("Example Game Demo", "PS5", "Product Purchase", "Game"),),
    )

    assert classify_psn_candidate(candidate).kind == "needs_review"


def test_classification_skips_known_self_title_app():
    from app.psn_resolution import classify_psn_candidate

    assert classify_psn_candidate(PsnExportCandidate("Spotify")).kind == "suggested_skip"


@pytest.mark.parametrize(
    "title",
    [
        "Example Game Demo",
        "Example Game Trial",
        "Example Game Season Pass",
        "Example Game Public Test Server",
        "Example Game Beta Client",
        "Example Game Soundtrack",
        "Example Game Virtual Currency",
        "Example Game PS4 Theme",
    ],
)
def test_classifier_skips_only_explicit_self_title_non_games(title):
    from app.psn_resolution import classify_psn_candidate

    assert classify_psn_candidate(PsnExportCandidate(title)).kind == "suggested_skip"


@pytest.mark.parametrize(
    "title",
    ["Adventure Theme Park", "Pack Your Bags", "Test Drive Adventure", "Avatar Frontier"],
)
def test_classifier_does_not_use_broad_non_game_substrings(title):
    from app.psn_resolution import classify_psn_candidate

    assert classify_psn_candidate(PsnExportCandidate(title)).kind == "eligible"


@pytest.mark.parametrize("title", ["EA Play", "PlayStation Plus", "Base Theme", "Example Public Test Server", "Example Test Client", "Example Beta Client", "Example Playtest", "Example Theme"])
def test_classification_and_repair_quarantine_affirmative_generic_non_games(title):
    from app.psn_classification import psn_repair_quarantine_reason
    from app.psn_resolution import classify_psn_candidate

    assert classify_psn_candidate(PsnExportCandidate(title)).kind == "suggested_skip"
    assert psn_repair_quarantine_reason(title) is not None


def test_generic_theme_category_does_not_substring_match_game_title():
    from app.psn_classification import psn_repair_quarantine_reason
    from app.psn_resolution import classify_psn_candidate

    assert classify_psn_candidate(PsnExportCandidate("Adventure Theme Park")).kind == "eligible"
    assert psn_repair_quarantine_reason("Adventure Theme Park") is None


def test_classification_uses_paired_transaction_rows_not_aggregate_order():
    from app.psn_resolution import classify_psn_candidate

    candidate = PsnExportCandidate(
        "Example Game",
        product_names=("Example Game Demo", "Example Game"),
        transaction_types=("Product Purchase", "Voucher Purchase"),
        transactions=(
            PsnTransactionEvidence("Example Game", "PS5", "Product Purchase", "Game"),
            PsnTransactionEvidence("Example Game Demo", "PS5", "Voucher Purchase", "Game"),
            PsnTransactionEvidence("Example Game PlayStation Plus Pack", "PS5", "Product Purchase", "Game"),
        ),
    )

    assert classify_psn_candidate(candidate).kind == "eligible"


def test_resolver_falls_back_only_for_missing_batch_titles(monkeypatch):
    from app import psn_resolution

    monkeypatch.setattr(psn_resolution, "fetch_igdb_games_batch", AsyncMock(return_value={"Hades": [{"id": 1, "name": "Hades"}]}))
    single = AsyncMock(return_value={"results": [{"id": 2, "name": "Celeste"}]})
    monkeypatch.setattr(psn_resolution, "fetch_igdb_games", single)

    result = asyncio.run(psn_resolution.resolve_psn_catalog_titles(["Hades", "Celeste"]))

    assert result["Hades"].kind == "matched"
    assert result["Celeste"].kind == "matched"
    single.assert_awaited_once_with("Celeste")


def test_resolver_marks_titles_beyond_fallback_budget_unavailable(monkeypatch):
    from app import psn_resolution

    monkeypatch.setattr(psn_resolution, "fetch_igdb_games_batch", AsyncMock(return_value={}))
    single = AsyncMock(return_value={"results": []})
    monkeypatch.setattr(psn_resolution, "fetch_igdb_games", single)

    result = asyncio.run(psn_resolution.resolve_psn_catalog_titles(["One", "Two"], max_fallback_titles=1))

    assert result["One"].kind == "no_match"
    assert result["Two"].kind == "unavailable"
    single.assert_awaited_once_with("One")


def test_resolver_recovers_from_malformed_batch_shape(monkeypatch):
    from app import psn_resolution

    monkeypatch.setattr(psn_resolution, "fetch_igdb_games_batch", AsyncMock(return_value=None))
    monkeypatch.setattr(psn_resolution, "fetch_igdb_games", AsyncMock(return_value={"results": [{"id": 1, "name": "Hades"}]}))

    result = asyncio.run(psn_resolution.resolve_psn_catalog_titles(["Hades"]))

    assert result["Hades"].kind == "matched"


def test_resolver_logs_aggregate_provider_failures_without_titles(caplog):
    from app.integrations.igdb import IGDBError
    from app import psn_resolution

    batch = AsyncMock(side_effect=IGDBError("rate limited", 502))
    single = AsyncMock(side_effect=IGDBError("still unavailable", 502))

    with caplog.at_level("WARNING", logger="app.psn_resolution"):
        result = asyncio.run(psn_resolution.resolve_psn_catalog_titles(
            ["Private title one", "Private title two"],
            batch_fetcher=batch,
            single_fetcher=single,
        ))

    assert {item.kind for item in result.values()} == {"unavailable"}
    text = caplog.text
    assert "batch_size=2" in text
    assert "error_type=IGDBError" in text
    assert "status_code=502" in text
    assert "fallback_failures=2" in text
    assert "Private title" not in text
