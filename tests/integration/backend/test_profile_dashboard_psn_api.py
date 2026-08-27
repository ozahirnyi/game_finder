from io import BytesIO
from unittest.mock import AsyncMock

import pytest
from openpyxl import Workbook

from app.database import Favorite, Friendship, Game, PriceAlert, WishlistItem


pytestmark = pytest.mark.integration


def _xlsx_bytes(sheet_name="Game Library", rows=None):
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = sheet_name
    for row in rows or [["Game Title"], ["Hades"], ["Celeste"]]:
        worksheet.append(row)
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def test_onboarding_summary_is_owner_scoped_and_counts_only_owned_alerts(
    api_client, db_session, user_factory, auth_as
):
    owner = auth_as(user_factory(email="onboarding-owner@example.com", steam_id="steam-owner"))
    other = user_factory(email="onboarding-other@example.com")
    owner_wishlist = WishlistItem(user_id=owner.id, catalog_game_id=1, title="Owned")
    other_wishlist = WishlistItem(user_id=other.id, catalog_game_id=2, title="Other")
    db_session.add_all(
        [
            Game(owner_id=owner.id, title="PSN", source="psn", external_id="psn:1"),
            Game(owner_id=other.id, title="Other PSN", source="psn", external_id="psn:2"),
            owner_wishlist,
            other_wishlist,
        ]
    )
    db_session.flush()
    db_session.add_all(
        [
            PriceAlert(user_id=owner.id, wishlist_item_id=owner_wishlist.id, target_price=10),
            PriceAlert(user_id=owner.id, wishlist_item_id=other_wishlist.id, target_price=10),
            Friendship(user_low_id=owner.id, user_high_id=other.id),
        ]
    )
    db_session.commit()

    response = api_client.get("/onboarding/summary")

    assert response.status_code == 200
    assert response.json() == {
        "steam_linked": True,
        "psn_library_games": 1,
        "wishlist_games": 1,
        "price_alerts": 1,
        "friends": 1,
    }


def test_onboarding_summary_uses_steam_or_persisted_psn_and_requires_authentication(
    api_client, db_session, user_factory, auth_as
):
    assert api_client.get("/onboarding/summary").status_code == 401

    user = auth_as(user_factory(email="onboarding-empty@example.com"))
    empty = api_client.get("/onboarding/summary")
    assert empty.json() == {
        "steam_linked": False,
        "psn_library_games": 0,
        "wishlist_games": 0,
        "price_alerts": 0,
        "friends": 0,
    }

    db_session.add(Game(owner_id=user.id, title="Imported", source="psn", external_id="psn:3"))
    db_session.commit()
    assert api_client.get("/onboarding/summary").json()["psn_library_games"] == 1


def test_profile_get_patch_persists_profile_and_visibility_fields(
    api_client, db_session, user_factory, auth_as
):
    user = auth_as(user_factory(email="profile@example.com"))

    initial = api_client.get("/profile")
    assert initial.status_code == 200
    assert initial.json()["library_visibility"] == "public"

    response = api_client.patch(
        "/profile",
        json={
            "display_name": "profile-player",
            "bio": "Co-op player",
            "platforms": ["PC", "PlayStation"],
            "favorite_genres": ["RPG", "Strategy"],
            "library_visibility": "friends",
            "favorites_visibility": "private",
            "wishlist_visibility": "friends",
            "steam_visibility": "private",
        },
    )

    assert response.status_code == 200
    assert response.json()["display_name"] == "profile-player"
    db_session.expire_all()
    stored = db_session.get(type(user), user.id)
    assert stored.bio == "Co-op player"
    assert stored.platforms == ["PC", "PlayStation"]
    assert stored.favorite_genres == ["RPG", "Strategy"]
    assert stored.library_visibility == "friends"
    assert stored.favorites_visibility == "private"
    assert stored.wishlist_visibility == "friends"
    assert stored.steam_visibility == "private"


def test_profile_summary_reports_empty_then_ready_persisted_sections(
    api_client, db_session, user_factory, auth_as
):
    user = auth_as(user_factory(email="summary@example.com"))

    empty = api_client.get("/profile/summary")
    assert empty.status_code == 200
    body = empty.json()
    assert body["profile"]["status"] == "empty"
    assert body["library"]["status"] == "empty"
    assert body["favorites"]["status"] == "empty"
    assert body["wishlist"]["status"] == "empty"

    db_session.add_all(
        [
            Game(owner_id=user.id, title="PSN Game", source="psn", external_id="psn:1"),
            Favorite(user_id=user.id, catalog_game_id=11, title="Favorite Game"),
            WishlistItem(user_id=user.id, catalog_game_id=12, title="Wishlist Game"),
        ]
    )
    db_session.commit()
    ready = api_client.get("/profile/summary")
    assert ready.status_code == 200
    body = ready.json()
    assert body["library"]["status"] == "ready"
    assert body["library"]["data"]["psn_games"] == 1
    assert body["favorites"]["data"]["total"] == 1
    assert body["wishlist"]["data"]["total"] == 1


def test_profile_summary_adds_linked_steam_library(app_main, api_client, user_factory, auth_as, monkeypatch):
    user = auth_as(user_factory(email="summary-steam@example.com", steam_id="7656119"))
    fetch = AsyncMock(return_value=[{"appid": 42, "name": "Steam Game", "playtime_forever": 120}])
    monkeypatch.setattr(app_main, "fetch_owned_games", fetch)

    response = api_client.get("/profile/summary")

    assert response.status_code == 200
    assert response.json()["library"]["status"] == "ready"
    assert response.json()["library"]["data"]["total_games"] == 1
    assert response.json()["library"]["data"]["total_playtime_minutes"] == 120
    fetch.assert_awaited_once_with("7656119")


def test_dashboard_empty_and_not_connected_states(api_client, user_factory, auth_as, app_main, monkeypatch):
    auth_as(user_factory(email="dashboard-empty@example.com"))
    monkeypatch.setattr(app_main, "fetch_steam_store_deals", AsyncMock(return_value=[]))

    response = api_client.get("/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert body["deals"]["status"] == "empty"
    assert body["steam"]["status"] == "not_connected"
    assert body["recommendations"]["status"] == "ready"


def test_dashboard_ready_and_error_states_are_boundary_mocked(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    user = auth_as(
        user_factory(
            email="dashboard-ready@example.com",
            steam_id="76561191",
            favorite_genres=["RPG"],
        )
    )
    monkeypatch.setattr(
        app_main,
        "fetch_steam_store_deals",
        AsyncMock(return_value=[{"title": "Deal", "discount_percent": 50}]),
    )
    monkeypatch.setattr(
        app_main,
        "fetch_owned_games",
        AsyncMock(return_value=[{"appid": 7, "name": "Owned", "playtime_forever": 60}]),
    )
    recommendations = AsyncMock(return_value={"recommendations": [{"title": "Suggested"}]})
    monkeypatch.setattr(app_main, "get_personalized_recommendations", recommendations)

    response = api_client.get("/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert body["deals"]["status"] == "ready"
    assert body["steam"]["status"] == "ready"
    assert body["library"]["data"]["total_playtime_minutes"] == 60
    assert body["recommendations"]["status"] == "ready"
    recommendations.assert_awaited_once()

    monkeypatch.setattr(app_main, "fetch_steam_store_deals", AsyncMock(side_effect=RuntimeError("deals")))
    monkeypatch.setattr(app_main, "fetch_owned_games", AsyncMock(side_effect=RuntimeError("steam")))
    failed = api_client.get("/dashboard")
    assert failed.json()["deals"]["status"] == "error"
    assert failed.json()["steam"]["status"] == "error"


def test_dashboard_uses_saved_library_when_linked_steam_fetch_fails(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    user = auth_as(user_factory(email="dashboard-steam-fallback@example.com", steam_id="76561192"))
    db_session.add(Game(owner_id=user.id, title="Hades", source="manual"))
    db_session.commit()
    monkeypatch.setattr(app_main, "fetch_steam_store_deals", AsyncMock(return_value=[]))
    monkeypatch.setattr(app_main, "fetch_owned_games", AsyncMock(side_effect=RuntimeError("steam")))
    recommendations = AsyncMock(return_value={"recommendations": [{"title": "Celeste"}]})
    monkeypatch.setattr(app_main, "get_personalized_recommendations", recommendations)

    response = api_client.get("/dashboard")

    assert response.status_code == 200
    assert response.json()["steam"]["status"] == "error"
    assert response.json()["recommendations"]["status"] == "ready"
    recommendations.assert_awaited_once()
    arguments = recommendations.await_args.args
    assert arguments[0] is user
    assert [game.title for game in arguments[1]] == ["Hades"]
    assert arguments[2] == []


def test_dashboard_returns_popular_recommendations_without_personal_signals(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    user = auth_as(user_factory(email="dashboard-popular@example.com"))
    monkeypatch.setattr(app_main, "fetch_steam_store_deals", AsyncMock(return_value=[]))
    recommendations = AsyncMock(return_value={"recommendations": [{"title": "Popular Game"}]})
    monkeypatch.setattr(app_main, "get_personalized_recommendations", recommendations)

    response = api_client.get("/dashboard")

    assert response.status_code == 200
    assert response.json()["recommendations"]["status"] == "ready"
    recommendations.assert_awaited_once_with(user, [], [])


def test_psn_import_preview_parses_xlsx_without_persisting(api_client, db_session, user_factory, auth_as):
    auth_as(user_factory(email="psn-preview@example.com"))

    response = api_client.post(
        "/psn/import/preview",
        files={"file": ("export.xlsx", _xlsx_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    assert response.status_code == 200
    assert response.json()["games"] == ["Hades", "Celeste"]
    assert response.json()["total"] == 2
    assert db_session.query(Game).count() == 0


def test_psn_import_preview_confirms_catalog_games_and_keeps_plus_purchases_in_review(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-transaction-preview@example.com"))

    async def search_catalog(query, page=1):
        return {"results": [{"id": 101, "name": "God of War", "game_type": 0}]} if query == "GOD OF WAR" else {"results": []}

    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)
    response = api_client.post(
        "/psn/import/preview",
        files={
            "file": (
                "export.xlsx",
                _xlsx_bytes(
                    '"Transaction Detail"',
                    [
                        ["Store Transactions"],
                        [],
                        ["Transaction Detail"],
                        ["Game Name", "Product Name", "Content Type", "Transaction Type"],
                        ["GOD OF WAR", "God of War", "Violence", "Product Purchase"],
                        ["FORTNITE", "FN: PlayStation Plus Pack", "Violence", "Product Purchase"],
                    ],
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 200
    assert response.json()["items"] == [
        {"source_title": "GOD OF WAR", "status": "confirmed", "igdb_id": 101, "title": "God of War", "reason": None},
        {"source_title": "FORTNITE", "status": "excluded", "igdb_id": None, "title": None, "reason": "Excluded: this purchase is explicitly a subscription, currency item, demo, add-on, pass, or bundle."},
    ]
    assert db_session.query(Game).count() == 0


def test_psn_import_preview_classifies_a_sanitized_representative_export(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-representative-export@example.com"))
    normal_titles = [f"Owned game {index}" for index in range(1, 11)]

    async def search_catalog(query, page=1):
        if query in normal_titles:
            return {"results": [{"id": normal_titles.index(query) + 1, "name": query, "platforms": ["PlayStation 4"], "game_type": "main_game"}]}
        if query == "Catalog platform gap":
            return {"results": [{"id": 101, "name": query, "platforms": ["PC"], "game_type": "main_game"}]}
        if query == "Catalog type gap":
            return {"results": [{"id": 102, "name": query, "platforms": ["PlayStation 5"]}]}
        return {"results": []}

    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)
    rows = [["Game Name", "Product Name", "Content Type", "Transaction Type", "Platform"]]
    rows.extend([[title, title, "Violence", "Product Purchase", "PS4"] for title in normal_titles])
    rows.extend(
        [
            ["Catalog platform gap", "Catalog platform gap", "Violence", "Product Purchase", "PS5"],
            ["Catalog type gap", "Catalog type gap", "Violence", "Product Purchase", "PS5"],
            ["Subscription product", "PlayStation Plus Membership", "Violence", "Product Purchase", "PS5"],
            ["Theme purchase", "PS4 Base Theme", "Violence", "Product Purchase", "PS4"],
            ["Wallet purchase", "Wallet top up", "Violence", "Product Purchase", "PS5"],
            ["Add-on purchase", "Example DLC", "Add-On", "Product Purchase", "PS5"],
        ]
    )

    response = api_client.post(
        "/psn/import/preview",
        files={"file": ("representative.xlsx", _xlsx_bytes("Transaction Detail", rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    statuses = [item["status"] for item in response.json()["items"]]
    assert statuses.count("confirmed") == 12
    assert statuses.count("unmatched") == 0
    assert statuses.count("excluded") == 4


def test_psn_import_preview_uses_platform_and_type_only_to_choose_between_exact_candidates(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-classification@example.com"))

    async def search_catalog(query, page=1):
        return {"results": {
            "App-like item": [{"id": 1, "name": "App-like item", "platforms": ["PlayStation 5"], "game_type": 14}],
            "Playable item": [{"id": 2, "name": "Playable item", "platforms": ["PlayStation 5"], "game_type": 0}],
            "Other platform": [{"id": 3, "name": "Other platform", "platforms": ["PC"], "game_type": 0}],
            "Unknown catalog type": [{"id": 4, "name": "Unknown catalog type", "platforms": ["PlayStation 5"]}],
        }[query]}

    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)
    response = api_client.post(
        "/psn/import/preview",
        files={
            "file": (
                "export.xlsx",
                _xlsx_bytes(
                    "Transaction Detail",
                    [
                        ["Game Name", "Product Name", "Content Type", "Transaction Type", "Platform"],
                        ["App-like item", "App-like item", "Violence", "Product Purchase", "PS5"],
                        ["Playable item", "Playable item", "Violence", "Product Purchase", "PS5"],
                        ["Other platform", "Other platform", "Violence", "Product Purchase", "PS5"],
                        ["Unknown catalog type", "Unknown catalog type", "Violence", "Product Purchase", "PS5"],
                    ],
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert [(item["source_title"], item["status"]) for item in response.json()["items"]] == [
        ("App-like item", "excluded"),
        ("Playable item", "confirmed"),
        ("Other platform", "confirmed"),
        ("Unknown catalog type", "confirmed"),
    ]
    assert [item["igdb_id"] for item in response.json()["items"]] == [None, 2, 3, 4]


def test_psn_import_preview_excludes_only_explicit_psn_clutter_and_keeps_marker_titles_eligible(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-explicit-purchase-evidence@example.com"))

    async def search_catalog(query, page=1):
        if query == "Adventure Theme Park":
            return {"results": [{"id": 101, "name": query}]}
        if query == "Trial Grounds":
            return {"results": [{"id": 102, "name": query}]}
        return {"results": []}

    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)
    response = api_client.post(
        "/psn/import/preview",
        files={
            "file": (
                "export.xlsx",
                _xlsx_bytes(
                    "Transaction Detail",
                    [
                        ["Game Name", "Product Name", "Content Type", "Transaction Type", "Platform"],
                        ["Adventure Theme Park", "Adventure Theme Park", "Violence", "Product Purchase", "PS5"],
                        ["Trial Grounds", "Trial Grounds Deluxe Edition", "Violence", "Product Purchase", "PS5"],
                        ["Streaming service", "Spotify", "Entertainment", "Product Purchase", "PS4"],
                        ["Console appearance", "PS4 Base Theme", "Entertainment", "Product Purchase", "PS4"],
                        ["Wallet funding", "Wallet top up", "Currency", "Wallet Funding", "Web"],
                        ["Extra content", "Expansion Pack", "Add-On", "Product Purchase", "PS5"],
                    ],
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert [(item["source_title"], item["status"]) for item in response.json()["items"]] == [
        ("Adventure Theme Park", "confirmed"),
        ("Trial Grounds", "confirmed"),
        ("Streaming service", "excluded"),
        ("Console appearance", "excluded"),
        ("Wallet funding", "excluded"),
        ("Extra content", "excluded"),
    ]


@pytest.mark.parametrize("game_type", [1, 2, 3, 6, 7, 14])
def test_psn_import_preview_excludes_authoritatively_non_game_catalog_types(
    api_client, user_factory, auth_as, app_main, monkeypatch, game_type
):
    auth_as(user_factory(email=f"psn-catalog-type-{game_type}@example.com"))
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_games",
        AsyncMock(return_value={"results": [{"id": 1, "name": "Catalog item", "platforms": ["PlayStation 5"], "game_type": game_type}]}),
    )

    response = api_client.post(
        "/psn/import/preview",
        files={"file": ("export.csv", b"Game Name\nCatalog item\n", "text/csv")},
    )

    assert response.json()["items"][0]["status"] == "excluded"


def test_psn_import_preview_keeps_only_eligible_catalog_uncertainty_in_manual_review(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-eligible-review@example.com"))

    async def search_catalog(query, page=1):
        return {"results": {
            "Duplicate game": [
                {"id": 10, "name": "Duplicate game", "platforms": ["PlayStation 4"], "game_type": 0},
                {"id": 11, "name": "Duplicate game", "platforms": ["PlayStation 4"], "game_type": 11},
            ],
            "Web game": [{"id": 12, "name": "Web game", "platforms": ["PC"], "game_type": 8}],
            "Mixed catalog records": [
                {"id": 13, "name": "Mixed catalog records", "platforms": ["PlayStation 5"], "game_type": 14},
                {"id": 14, "name": "Mixed catalog records", "platforms": ["PC"], "game_type": 0},
            ],
        }[query]}

    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)
    response = api_client.post(
        "/psn/import/preview",
        files={
            "file": (
                "export.xlsx",
                _xlsx_bytes(
                    "Transaction Detail",
                    [
                        ["Game Name", "Product Name", "Content Type", "Transaction Type", "Platform"],
                        ["Duplicate game", "Duplicate game", "Violence", "Product Purchase", "PS4"],
                        ["Web game", "Web game", "Violence", "Product Purchase", "Web"],
                        ["Mixed catalog records", "Mixed catalog records", "Violence", "Product Purchase", "PS5"],
                    ],
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert [(item["source_title"], item["status"]) for item in response.json()["items"]] == [
        ("Duplicate game", "ambiguous"),
        ("Web game", "confirmed"),
        ("Mixed catalog records", "ambiguous"),
    ]


def test_psn_import_preview_matches_edition_and_platform_suffixes(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-edition-match@example.com"))

    async def search_catalog(query, page=1):
        return {"results": [{"id": 101, "name": "Horizon Zero Dawn", "game_type": 0}]}

    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)
    response = api_client.post(
        "/psn/import/preview",
        files={"file": ("export.xlsx", _xlsx_bytes(rows=[["Game Title"], ["Horizon Zero Dawn™ Complete Edition PS4 & PS5"]]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    assert response.status_code == 200
    assert response.json()["items"] == [
        {
            "source_title": "Horizon Zero Dawn™ Complete Edition PS4 & PS5",
            "status": "confirmed",
            "igdb_id": 101,
            "title": "Horizon Zero Dawn",
            "reason": None,
        }
    ]


def test_psn_import_preview_keeps_ambiguous_normalized_titles_in_review(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-ambiguous-match@example.com"))

    async def search_catalog(query, page=1):
        return {"results": [{"id": 101, "name": "Horizon Zero Dawn", "game_type": 0}, {"id": 102, "name": "Horizon Zero Dawn™", "game_type": 8}]}

    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)
    response = api_client.post(
        "/psn/import/preview",
        files={"file": ("export.xlsx", _xlsx_bytes(rows=[["Game Title"], ["Horizon Zero Dawn Complete Edition"]]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    assert response.status_code == 200
    assert response.json()["items"] == [
        {
            "source_title": "Horizon Zero Dawn Complete Edition",
            "status": "ambiguous",
            "igdb_id": None,
            "title": None,
            "reason": "Multiple exact catalog matches found.",
        }
    ]


def test_psn_import_preview_uses_ps4_platform_to_resolve_exact_duplicates(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-platform-match@example.com"))

    async def search_catalog(query, page=1):
        return {
            "results": [
                {"id": 7292, "name": "MORTAL KOMBAT X", "platforms": ["PlayStation 4", "PC"], "game_type": 0},
                {"id": 241492, "name": "MORTAL KOMBAT X", "platforms": ["PlayStation 3"], "game_type": 0},
            ]
        }

    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)
    response = api_client.post(
        "/psn/import/preview",
        files={
            "file": (
                "export.xlsx",
                _xlsx_bytes(
                    "Transaction Detail",
                    [
                        ["Transaction Date", "Game Name", "Product Name", "Content Type", "Platform"],
                        ["2026-01-01", "MORTAL KOMBAT X", "MORTAL KOMBAT X", "Game", "PS4"],
                    ],
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.json()["items"] == [
        {"source_title": "MORTAL KOMBAT X", "status": "confirmed", "igdb_id": 7292, "title": "MORTAL KOMBAT X", "reason": None}
    ]


def test_psn_import_preview_keeps_duplicate_titles_without_playstation_platform_ambiguous(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-web-ambiguous@example.com"))

    async def search_catalog(query, page=1):
        return {"results": [{"id": 1905, "name": "FORTNITE", "platforms": ["PlayStation 4"], "game_type": 0}, {"id": 231090, "name": "FORTNITE", "platforms": ["PC"], "game_type": 11}]}

    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)
    response = api_client.post("/psn/import/preview", files={"file": ("export.csv", b"Game Name\nFORTNITE\n", "text/csv")})

    assert response.json()["items"][0]["status"] == "ambiguous"


def test_psn_import_preview_reports_unmatched_catalog_titles(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-unmatched@example.com"))

    async def search_catalog(query, page=1):
        return {"results": [{"id": 1, "name": "Not the PSN title"}]}

    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)
    response = api_client.post("/psn/import/preview", files={"file": ("export.csv", b"Game Name\nHades\n", "text/csv")})

    assert response.json()["items"][0]["status"] == "unmatched"


def test_psn_import_preview_reports_catalog_unavailability(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    from app.integrations.igdb import IGDBError

    auth_as(user_factory(email="psn-catalog-unavailable@example.com"))

    async def search_catalog(query, page=1):
        raise IGDBError("unavailable")

    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)
    response = api_client.post("/psn/import/preview", files={"file": ("export.csv", b"Game Name\nHades\n", "text/csv")})

    assert response.json()["items"][0]["status"] == "catalog_unavailable"


def test_psn_import_preview_excludes_marker_products(api_client, user_factory, auth_as, app_main, monkeypatch):
    auth_as(user_factory(email="psn-excluded@example.com"))
    search_catalog = AsyncMock(return_value={"results": [{"id": 101, "name": "FORTNITE"}]})
    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)
    response = api_client.post(
        "/psn/import/preview",
        files={
            "file": (
                "export.xlsx",
                _xlsx_bytes(
                    "Transaction Detail",
                    [
                        ["Transaction Date", "Game Name", "Product Name", "Content Type", "Platform"],
                        ["2026-01-01", "FORTNITE", "Fortnite PlayStation Plus Pack", "Game", "PS5"],
                    ],
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.json()["items"][0]["status"] == "excluded"
    assert search_catalog.await_count == 0


@pytest.mark.parametrize(
    "product_name",
    ["Demo entitlement", "Season Pass", "Expansion add-on", "Virtual Currency", "Game Bundle"],
)
def test_psn_import_preview_excludes_clear_non_game_product_classes(
    api_client, user_factory, auth_as, app_main, monkeypatch, product_name
):
    auth_as(user_factory(email=f"psn-product-{product_name[:4]}@example.com"))
    search_catalog = AsyncMock(return_value={"results": [{"id": 101, "name": "Playable item", "game_type": 0}]})
    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)

    response = api_client.post(
        "/psn/import/preview",
        files={
            "file": (
                "export.xlsx",
                _xlsx_bytes(
                    "Transaction Detail",
                    [
                        ["Game Name", "Product Name", "Content Type", "Transaction Type", "Platform"],
                        ["Playable item", product_name, "Violence", "Product Purchase", "PS5"],
                    ],
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.json()["items"][0]["status"] == "excluded"
    assert search_catalog.await_count == 0


def test_psn_import_preview_excludes_non_product_transactions_before_catalog_lookup(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-non-product@example.com"))
    search_catalog = AsyncMock(return_value={"results": []})
    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)

    response = api_client.post(
        "/psn/import/preview",
        files={
            "file": (
                "export.xlsx",
                _xlsx_bytes(
                    "Transaction Detail",
                    [
                        ["Game Name", "Product Name", "Content Type", "Transaction Type", "Platform"],
                        ["Service item", "Service item", "Service", "Subscription Renewal", "PS5"],
                    ],
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.json()["items"][0]["reason"] == "Excluded: this transaction is not a product purchase."
    assert search_catalog.await_count == 0


def test_psn_import_mixed_preview_and_confirmation_flow(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    async def search_catalog(query, page=1):
        return {"results": [{"id": 101, "name": "God of War", "platforms": ["PlayStation 4"], "game_type": 0}]} if query == "GOD OF WAR" else {"results": []}

    async def catalog_detail(igdb_id):
        assert igdb_id == 101
        return {"id": 101, "name": "God of War"}

    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", catalog_detail)
    owner = auth_as(user_factory(email="psn-mixed-flow@example.com"))
    preview = api_client.post(
        "/psn/import/preview",
        files={
            "file": (
                "export.xlsx",
                _xlsx_bytes(
                    "Transaction Detail",
                    [
                        ["Transaction Date", "Game Name", "Product Name", "Content Type", "Platform"],
                        ["2026-01-01", "GOD OF WAR", "God of War", "Game", "PS4"],
                        ["2026-01-01", "Unknown Game", "Unknown Game", "Game", "Web"],
                        ["2026-01-01", "EA Play", "EA Play Subscription", "Game", "PS5"],
                    ],
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert [item["status"] for item in preview.json()["items"]] == ["confirmed", "unmatched", "excluded"]
    confirm = api_client.post(
        "/psn/import/confirm",
        json={"selections": [{"catalog_id": 101}, {"source_title": "Unknown Game"}]},
    )

    assert confirm.json() == {"created": 2, "updated": 0, "skipped": 0, "total": 2}
    assert db_session.query(Game).filter_by(owner_id=owner.id, source="psn").count() == 2


@pytest.mark.parametrize(
    ("filename", "content", "content_type", "expected_games"),
    [
        ("export.csv", b"Game Name\nHades\nCeleste\n", "text/csv", ["Hades", "Celeste"]),
        (
            "export.json",
            b'{"games": [{"title": "Returnal"}, {"title": "Hades"}]}',
            "application/json",
            ["Returnal", "Hades"],
        ),
    ],
)
def test_psn_import_preview_accepts_supported_non_xlsx_exports(
    api_client, user_factory, auth_as, filename, content, content_type, expected_games
):
    auth_as(user_factory(email=f"psn-{filename}@example.com"))

    response = api_client.post("/psn/import/preview", files={"file": (filename, content, content_type)})

    assert response.status_code == 200
    assert response.json()["games"] == expected_games


def test_psn_import_confirm_persists_owner_scoped_idempotent_games(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    async def catalog_detail(igdb_id):
        return {101: {"id": 101, "name": "Hades"}, 102: {"id": 102, "name": "Celeste"}}[igdb_id]

    async def search_catalog(query, page=1):
        return {
            "results": [{"id": 101, "name": "Hades", "game_type": 0}]
            if query == "Hades"
            else [{"id": 102, "name": "Celeste", "game_type": 0}]
        }

    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", catalog_detail)
    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)
    owner = auth_as(user_factory(email="psn-owner@example.com"))
    api_client.post("/psn/import/preview", files={"file": ("export.csv", b"Game Name\nHades\nCeleste\n", "text/csv")})
    first = api_client.post("/psn/import/confirm", json={"selections": [{"catalog_id": 101}, {"catalog_id": 101}, {"catalog_id": 102}]})
    assert first.status_code == 200
    assert first.json() == {"created": 2, "updated": 0, "skipped": 0, "total": 2}
    assert db_session.query(Game).filter_by(owner_id=owner.id, source="psn").count() == 2

    second = api_client.post("/psn/import/confirm", json={"selections": [{"catalog_id": 101}, {"catalog_id": 102}]})
    assert second.json() == {"created": 0, "updated": 0, "skipped": 2, "total": 2}

    other = auth_as(user_factory(email="psn-other@example.com"))
    api_client.post("/psn/import/preview", files={"file": ("export.csv", b"Game Name\nHades\n", "text/csv")})
    other_import = api_client.post("/psn/import/confirm", json={"selections": [{"catalog_id": 101}]})
    assert other_import.json()["created"] == 1
    assert db_session.query(Game).filter_by(owner_id=other.id, source="psn").count() == 1
    assert db_session.query(Game).filter_by(owner_id=owner.id, source="psn").count() == 2


def test_psn_import_confirm_accepts_typed_catalog_and_manual_selections(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    async def catalog_detail(igdb_id):
        assert igdb_id == 101
        return {"id": 101, "name": "Hades"}

    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", catalog_detail)
    async def search_catalog(query, page=1):
        return {"results": [{"id": 101, "name": "Hades", "game_type": 0}]} if query == "Hades" else {"results": []}

    monkeypatch.setattr(app_main, "fetch_igdb_games", search_catalog)
    owner = auth_as(user_factory(email="psn-typed-selections@example.com"))
    preview = api_client.post("/psn/import/preview", files={"file": ("export.csv", b"Game Name\nHades\nDisco Elysium\n", "text/csv")})
    assert [item["status"] for item in preview.json()["items"]] == ["confirmed", "unmatched"]

    first = api_client.post(
        "/psn/import/confirm",
        json={"selections": [{"catalog_id": 101}, {"source_title": "  Disco   Elysium  "}]},
    )

    assert first.status_code == 200
    assert first.json() == {"created": 2, "updated": 0, "skipped": 0, "total": 2}
    games = db_session.query(Game).filter_by(owner_id=owner.id, source="psn").order_by(Game.external_id).all()
    assert [(game.external_id, game.title) for game in games] == [
        ("psn:101", "Hades"),
        ("psn:manual:25e9313cd2d548983d20a0d2ed07f60f", "Disco Elysium"),
    ]

    second = api_client.post("/psn/import/confirm", json={"selections": [{"source_title": "disco elysium"}]})
    assert second.json() == {"created": 0, "updated": 0, "skipped": 1, "total": 1}


@pytest.mark.parametrize(
    "payload",
    [
        {"selections": [{"catalog_id": 101, "source_title": "Hades"}]},
        {"selections": [{}]},
        {"selections": [{"source_title": "   "}]},
        {"selections": [{"source_title": "EA Play Subscription"}]},
    ],
)
def test_psn_import_confirm_rejects_invalid_or_excluded_manual_selections(
    api_client, db_session, user_factory, auth_as, payload
):
    owner = auth_as(user_factory(email="psn-invalid-selections@example.com"))

    response = api_client.post("/psn/import/confirm", json=payload)

    assert response.status_code == 422
    assert db_session.query(Game).filter_by(owner_id=owner.id, source="psn").count() == 0


def test_psn_import_confirm_rejects_a_catalog_id_that_was_not_confirmed_in_the_latest_preview(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory(email="psn-catalog-bypass@example.com"))
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", AsyncMock(return_value={"id": 101, "name": "Unreviewed"}))

    response = api_client.post("/psn/import/confirm", json={"selections": [{"catalog_id": 101}]})

    assert response.status_code == 422
    assert db_session.query(Game).filter_by(owner_id=owner.id, source="psn").count() == 0


def test_psn_import_confirm_rejects_an_excluded_preview_title_even_without_marker_in_title(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory(email="psn-excluded-bypass@example.com"))
    monkeypatch.setattr(app_main, "fetch_igdb_games", AsyncMock(return_value={"results": []}))
    preview = api_client.post(
        "/psn/import/preview",
        files={
            "file": (
                "export.xlsx",
                _xlsx_bytes(
                    "Transaction Detail",
                    [
                        ["Transaction Date", "Game Name", "Product Name", "Content Type", "Platform"],
                        ["2026-01-01", "FORTNITE", "Fortnite PlayStation Plus Pack", "Game", "PS5"],
                    ],
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert preview.json()["items"][0]["status"] == "excluded"

    response = api_client.post("/psn/import/confirm", json={"selections": [{"source_title": "FORTNITE"}]})

    assert response.status_code == 422
    assert db_session.query(Game).filter_by(owner_id=owner.id, source="psn").count() == 0
