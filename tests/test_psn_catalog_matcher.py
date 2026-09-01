import pytest

from app.psn_export import PsnExportCandidate


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("Apex Legends™", "apex legends"),
        ("DC UNIVERSE ONLINE [SCEE PS4]", "dc universe online"),
        ("Terraria – PlayStation®4 Edition", "terraria"),
        ("EA SPORTS™ FIFA 16", "fifa 16"),
        ("R4: Ridge Racer", "r 4 ridge racer"),
    ],
)
def test_query_variants_include_clean_identity(source, expected):
    from app.psn_catalog_matcher import (
        PsnCatalogEvidence,
        build_psn_query_variants,
        normalize_psn_catalog_identity,
    )

    evidence = PsnCatalogEvidence(source)

    identities = {normalize_psn_catalog_identity(value) for value in build_psn_query_variants(evidence)}

    assert expected in identities


def test_query_variants_keep_provider_visible_cleanup():
    from app.psn_catalog_matcher import (
        PsnCatalogEvidence,
        build_psn_query_variants,
        preferred_psn_catalog_query,
    )

    assert "Apex Legends" in build_psn_query_variants(PsnCatalogEvidence("Apex Legends™"))
    assert "R 4: Ridge Racer" in build_psn_query_variants(PsnCatalogEvidence("R4: Ridge Racer"))
    assert preferred_psn_catalog_query(PsnCatalogEvidence("EA SPORTS™ FIFA 16")) == "FIFA 16"


def test_safe_aliases_keep_game_products_and_drop_entitlements():
    from app.psn_catalog_matcher import safe_psn_search_aliases

    candidate = PsnExportCandidate(
        "Example Game",
        product_names=("Example Game", "Example Game Complete Edition", "Example Game PlayStation Plus Pack"),
    )

    assert safe_psn_search_aliases(candidate) == ("Example Game", "Example Game Complete Edition")


@pytest.mark.parametrize("title", ["Adventure Theme Park", "Pack Your Bags", "Test Drive Adventure"])
def test_variant_cleanup_does_not_classify_generic_words_as_non_games(title):
    from app.psn_catalog_matcher import PsnCatalogEvidence, build_psn_query_variants

    assert build_psn_query_variants(PsnCatalogEvidence(title))[0] == title
