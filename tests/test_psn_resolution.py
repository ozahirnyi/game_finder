import pytest

from app.psn_export import PsnExportCandidate


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
    )

    assert classify_psn_candidate(candidate).kind == "needs_review"


def test_classification_skips_known_self_title_app():
    from app.psn_resolution import classify_psn_candidate

    assert classify_psn_candidate(PsnExportCandidate("Spotify")).kind == "suggested_skip"
