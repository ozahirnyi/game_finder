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


def test_cleaned_exact_match_links_playstation_release():
    from app.psn_catalog_matcher import PsnCatalogEvidence, choose_psn_catalog_match

    evidence = PsnCatalogEvidence("EA SPORTS™ FIFA 16", platforms=("PS4",))
    decision = choose_psn_catalog_match(evidence, {
        "FIFA 16": [
            {"id": 1, "name": "FIFA 16", "platforms": ["PC"], "game_type": 0},
            {"id": 2, "name": "FIFA 16", "platforms": ["PlayStation 4"], "game_type": 0},
        ],
    })

    assert decision.state == "linked"
    assert decision.match["id"] == 2


def test_fuzzy_result_is_never_auto_linked():
    from app.psn_catalog_matcher import PsnCatalogEvidence, choose_psn_catalog_match

    evidence = PsnCatalogEvidence("Battlefront", platforms=("PS4",))
    decision = choose_psn_catalog_match(evidence, {
        "Battlefront": [{"id": 3, "name": "Star Wars Battlefront", "platforms": ["PlayStation 4"], "game_type": 0}],
    })

    assert decision.state == "review"


def test_unknown_source_platform_keeps_equal_playstation_releases_ambiguous():
    from app.psn_catalog_matcher import PsnCatalogEvidence, choose_psn_catalog_match

    evidence = PsnCatalogEvidence("Example")
    decision = choose_psn_catalog_match(evidence, {
        "Example": [
            {"id": 10, "name": "Example", "platforms": ["PlayStation 4"], "game_type": 0},
            {"id": 11, "name": "Example", "platforms": ["PlayStation 5"], "game_type": 0},
        ],
    })

    assert decision.state == "review"
    assert decision.reason == "ambiguous_top_candidates"


def test_same_catalog_id_returned_by_two_queries_scores_once():
    from app.psn_catalog_matcher import PsnCatalogEvidence, choose_psn_catalog_match

    game = {"id": 12, "name": "Example", "platforms": ["PlayStation 5"], "game_type": 0}
    decision = choose_psn_catalog_match(PsnCatalogEvidence("Example", platforms=("PS5",)), {
        "Example™": [game],
        "Example": [game],
    })

    assert decision.state == "linked"
    assert decision.match["id"] == 12


def test_conflicting_edition_is_not_auto_linked():
    from app.psn_catalog_matcher import PsnCatalogEvidence, choose_psn_catalog_match

    decision = choose_psn_catalog_match(PsnCatalogEvidence("Example Complete Edition"), {
        "Example": [{"id": 13, "name": "Example Ultimate Edition", "platforms": ["PlayStation 5"], "game_type": 0}],
    })

    assert decision.state == "review"


@pytest.mark.parametrize("game_type", [1, 2, 5, 13, 14])
def test_non_independent_catalog_types_are_not_linked(game_type):
    from app.psn_catalog_matcher import PsnCatalogEvidence, choose_psn_catalog_match

    decision = choose_psn_catalog_match(
        PsnCatalogEvidence("Example", platforms=("PS5",)),
        {"Example": [{"id": 4, "name": "Example", "platforms": ["PlayStation 5"], "game_type": game_type}]},
    )

    assert decision.state == "review"
