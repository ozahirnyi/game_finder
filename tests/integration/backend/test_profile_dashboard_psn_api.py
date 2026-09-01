from datetime import datetime, timezone
from io import BytesIO
from unittest.mock import AsyncMock

import pytest
from openpyxl import Workbook

from app.database import Favorite, Friendship, Game, PriceAlert, WishlistItem
from app.psn_catalog_matcher import PSN_CATALOG_MATCHER_VERSION, PsnCatalogDecision, PsnCatalogEvidence
from app.psn_catalog_service import PsnCatalogUnavailable
from app.psn_export import psn_manual_external_id
from app.psn_resolution import CatalogResolution


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


def _batch_from_search(search):
    async def batch(titles):
        return {title: (await search(title)).get("results", []) for title in titles}
    return batch


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


def test_psn_import_preview_groups_reversible_candidates_and_batches_catalog_queries(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-reversible@example.com"))
    batch = AsyncMock(return_value={
        "Hades": [{"id": 101, "name": "Hades"}],
        "Unknown": [{"id": 102, "name": "Similar game"}],
    })
    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", batch)
    response = api_client.post(
        "/psn/import/preview",
        files={"file": ("export.xlsx", _xlsx_bytes("Transaction Detail", [
            ["Game Name", "Product Name", "Content Type", "Transaction Type", "Platform"],
            ["Hades", "Hades", "Violence", "Product Purchase", "PS5"],
            ["Unknown", "Unknown", "Violence", "Product Purchase", "PS5"],
            ["Spotify", "Spotify", "Violence", "Product Purchase", "PS4"],
        ]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["status"] for item in items] == ["ready", "ready", "suggested_skip"]
    assert [item["recommended_action"] for item in items] == ["raw", "raw", "skip"]
    assert items[0]["candidate_token"]
    assert items[1]["suggestions"] == []
    batch.assert_not_awaited()


def test_psn_preview_does_not_skip_game_with_related_demo_evidence(api_client, user_factory, auth_as, app_main, monkeypatch):
    auth_as(user_factory(email="psn-row-evidence@example.com"))
    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", AsyncMock(return_value={
        "Example Game": [{"id": 101, "name": "Example Game", "platforms": ["PlayStation 5"]}],
    }))
    response = api_client.post(
        "/psn/import/preview",
        files={"file": ("export.xlsx", _xlsx_bytes("Transaction Detail", [
            ["Game Name", "Product Name", "Content Type", "Transaction Type", "Platform"],
            ["Example Game", "Example Game", "Game", "Product Purchase", "PS5"],
            ["Example Game", "Example Game Demo", "Game", "Product Purchase", "PS5"],
        ]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["status"] == "ready"


def test_psn_preview_keeps_partial_catalog_success_and_marks_unavailable(api_client, user_factory, auth_as, app_main, monkeypatch):
    from app.psn_resolution import CatalogResolution

    auth_as(user_factory(email="psn-catalog-status@example.com"))
    monkeypatch.setattr(app_main, "resolve_psn_catalog_titles", AsyncMock(return_value={
        "Hades": CatalogResolution("matched", [{"id": 101, "name": "Hades", "platforms": ["PlayStation 5"]}]),
        "Celeste": CatalogResolution("unavailable", []),
    }))

    response = api_client.post("/psn/import/preview", files={"file": ("export.csv", b"Game Name\nHades\nCeleste\n", "text/csv")})

    assert response.status_code == 200
    assert [(item["source_title"], item["status"], item["reason"]) for item in response.json()["items"]] == [
        ("Hades", "ready", None),
        ("Celeste", "ready", None),
    ]


def test_psn_import_catalog_outage_keeps_every_plausible_title_importable_as_raw(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    from app.psn_resolution import CatalogResolution

    owner = auth_as(user_factory(email="psn-import-first-outage@example.com"))
    titles = [f"Owned game {index}" for index in range(25)]
    monkeypatch.setattr(
        app_main,
        "resolve_psn_catalog_titles",
        AsyncMock(return_value={title: CatalogResolution("unavailable", []) for title in titles}),
    )
    content = ("Game Name\n" + "\n".join(titles) + "\n").encode()

    response = api_client.post(
        "/psn/import/preview",
        files={"file": ("export.csv", content, "text/csv")},
    )

    items = response.json()["items"]
    assert len(items) == 25
    assert {item["status"] for item in items} == {"ready"}
    assert {item["recommended_action"] for item in items} == {"raw"}
    assert response.json()["confirmed_total"] == 25

    confirmed = api_client.post(
        "/psn/import/confirm",
        json={"selections": [
            {"candidate_token": item["candidate_token"], "action": "raw"}
            for item in items
        ]},
    )

    assert confirmed.status_code == 200
    assert confirmed.json()["total"] == 25
    stored = db_session.query(Game).filter_by(owner_id=owner.id, source="psn", link_state="raw").all()
    assert len(stored) == 25


def test_psn_preview_reports_unavailable_before_entitlement_review(api_client, user_factory, auth_as, app_main, monkeypatch):
    auth_as(user_factory(email="psn-entitlement-unavailable@example.com"))
    monkeypatch.setattr(app_main, "resolve_psn_catalog_titles", AsyncMock(return_value={
        "Example Game": CatalogResolution("unavailable", []),
    }))

    response = api_client.post(
        "/psn/import/preview",
        files={"file": ("export.xlsx", _xlsx_bytes("Transaction Detail", [
            ["Game Name", "Product Name", "Content Type", "Transaction Type", "Platform"],
            ["Example Game", "Example Game Demo", "Game", "Product Purchase", "PS5"],
        ]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    assert response.json()["items"][0]["status"] == "needs_mapping"


def test_psn_import_preview_matches_provider_formatting_only(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-provider-formatting@example.com"))
    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", AsyncMock(return_value={
        "Hades — Deluxe Edition (PS5)": [{"id": 101, "name": "Hades", "platforms": ["PlayStation 5"]}],
    }))

    response = api_client.post(
        "/psn/import/preview",
        files={"file": ("export.csv", "Game Name\nHades — Deluxe Edition (PS5)\n".encode(), "text/csv")},
    )

    item = response.json()["items"][0]
    assert (item["status"], item["igdb_id"], item["title"]) == ("ready", None, None)


def test_psn_import_preview_confirms_catalog_games_and_keeps_plus_purchases_in_review(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-transaction-preview@example.com"))

    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", AsyncMock(return_value={
        "GOD OF WAR": [{"id": 101, "name": "God of War"}],
        "FORTNITE": [],
    }))
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
    items = response.json()["items"]
    assert [(item["source_title"], item["status"], item["igdb_id"]) for item in items] == [("GOD OF WAR", "ready", None), ("FORTNITE", "needs_mapping", None)]
    assert all(item["candidate_token"] for item in items)
    assert db_session.query(Game).count() == 0


def test_psn_import_preview_classifies_a_sanitized_representative_export(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-representative-export@example.com"))
    normal_titles = [f"Owned game {index}" for index in range(1, 11)]

    async def search_catalog_batch(titles):
        return {title: ([{"id": normal_titles.index(title) + 1, "name": title, "platforms": ["PlayStation 4"]}] if title in normal_titles else [{"id": 101 if title == "Catalog platform gap" else 102, "name": title, "platforms": ["PC"]}] if title in {"Catalog platform gap", "Catalog type gap"} else []) for title in titles}

    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", search_catalog_batch)
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
    assert statuses.count("ready") == 14
    assert statuses.count("needs_mapping") == 2
    assert statuses.count("suggested_skip") == 0


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

    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", _batch_from_search(search_catalog))
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
        ("App-like item", "ready"),
        ("Playable item", "ready"),
        ("Other platform", "ready"),
        ("Unknown catalog type", "ready"),
    ]
    assert [item["igdb_id"] for item in response.json()["items"]] == [None, None, None, None]


def test_psn_import_preview_keeps_a_unique_exact_catalog_collection_eligible(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-catalog-collection@example.com"))

    async def search_catalog(query, page=1):
        assert query == "Catalog collection"
        return {
            "results": [
                {
                    "id": 501,
                    "name": "Catalog collection",
                    "platforms": ["PlayStation 5"],
                    "game_type": "bundle",
                }
            ]
        }

    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", _batch_from_search(search_catalog))
    response = api_client.post(
        "/psn/import/preview",
        files={
            "file": (
                "export.xlsx",
                _xlsx_bytes(
                    "Transaction Detail",
                    [
                        ["Game Name", "Product Name", "Content Type", "Transaction Type", "Platform"],
                        ["Catalog collection", "Catalog collection", "Violence", "Product Purchase", "PS5"],
                    ],
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    item = response.json()["items"][0]
    assert (item["source_title"], item["status"], item["igdb_id"], item["title"]) == ("Catalog collection", "ready", None, None)
    assert item["candidate_token"]


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

    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", _batch_from_search(search_catalog))
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
                        ["Ad Sales PS4 Themes", "Store promotion", "Violence", "Product Purchase", "PS4"],
                        ["Subscription item", "PS Plus", "Game", "Product Purchase", "PS5"],
                        ["Wallet funding", "Wallet top up", "Currency", "Wallet Funding", "Web"],
                        ["Extra content", "Expansion Pack", "Add-On", "Product Purchase", "PS5"],
                    ],
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    items = {item["source_title"]: item["status"] for item in response.json()["items"]}
    assert items["Adventure Theme Park"] == items["Trial Grounds"] == "ready"
    assert items["Ad Sales PS4 Themes"] == "suggested_skip"
    assert {items[title] for title in ("Streaming service", "Console appearance", "Subscription item", "Wallet funding", "Extra content")} <= {"ready", "needs_mapping"}


@pytest.mark.parametrize("game_type", [1, 2, 3, 6, 7, 14])
def test_psn_import_preview_keeps_unique_exact_catalog_candidates_eligible_regardless_of_type(
    api_client, user_factory, auth_as, app_main, monkeypatch, game_type
):
    auth_as(user_factory(email=f"psn-catalog-type-{game_type}@example.com"))
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_games_batch",
        AsyncMock(return_value={"Catalog item": [{"id": 1, "name": "Catalog item", "platforms": ["PlayStation 5"], "game_type": game_type}]}),
    )

    response = api_client.post(
        "/psn/import/preview",
        files={"file": ("export.csv", b"Game Name\nCatalog item\n", "text/csv")},
    )

    assert response.json()["items"][0]["status"] == "ready"
    assert response.json()["items"][0]["igdb_id"] is None


def test_psn_import_preview_uses_catalog_type_only_to_choose_between_duplicate_exact_candidates(
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

    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", _batch_from_search(search_catalog))
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
        ("Duplicate game", "ready"),
        ("Web game", "ready"),
        ("Mixed catalog records", "ready"),
    ]


def test_psn_import_preview_matches_edition_and_platform_suffixes(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-edition-match@example.com"))

    async def search_catalog(query, page=1):
        return {"results": [{"id": 101, "name": "Horizon Zero Dawn", "game_type": 0}]}

    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", _batch_from_search(search_catalog))
    response = api_client.post(
        "/psn/import/preview",
        files={"file": ("export.xlsx", _xlsx_bytes(rows=[["Game Title"], ["Horizon Zero Dawn™ Complete Edition PS4 & PS5"]]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert (item["status"], item["igdb_id"], item["title"]) == ("ready", None, None)
    assert item["candidate_token"]


def test_psn_import_preview_keeps_ambiguous_normalized_titles_in_review(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-ambiguous-match@example.com"))

    async def search_catalog(query, page=1):
        return {"results": [{"id": 101, "name": "Horizon Zero Dawn", "game_type": 0}, {"id": 102, "name": "Horizon Zero Dawn™", "game_type": 8}]}

    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", _batch_from_search(search_catalog))
    response = api_client.post(
        "/psn/import/preview",
        files={"file": ("export.xlsx", _xlsx_bytes(rows=[["Game Title"], ["Horizon Zero Dawn Complete Edition"]]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert (item["status"], item["reason"]) == ("ready", None)
    assert item["suggestions"] == []


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

    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", _batch_from_search(search_catalog))
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

    item = response.json()["items"][0]
    assert (item["status"], item["igdb_id"], item["title"]) == ("ready", None, None)


def test_psn_import_preview_keeps_duplicate_titles_without_playstation_platform_ambiguous(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-web-ambiguous@example.com"))

    async def search_catalog(query, page=1):
        return {"results": [{"id": 1905, "name": "FORTNITE", "platforms": ["PlayStation 4"], "game_type": 0}, {"id": 231090, "name": "FORTNITE", "platforms": ["PC"], "game_type": 11}]}

    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", _batch_from_search(search_catalog))
    response = api_client.post("/psn/import/preview", files={"file": ("export.csv", b"Game Name\nFORTNITE\n", "text/csv")})

    assert response.json()["items"][0]["status"] == "ready"


def test_psn_import_preview_reports_unmatched_catalog_titles(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="psn-unmatched@example.com"))

    async def search_catalog(query, page=1):
        return {"results": [{"id": 1, "name": "Not the PSN title"}]}

    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", _batch_from_search(search_catalog))
    response = api_client.post("/psn/import/preview", files={"file": ("export.csv", b"Game Name\nHades\n", "text/csv")})

    assert response.json()["items"][0]["status"] == "ready"


def test_psn_import_preview_reports_catalog_unavailability(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    from app.integrations.igdb import IGDBError

    auth_as(user_factory(email="psn-catalog-unavailable@example.com"))

    async def search_catalog(query, page=1):
        raise IGDBError("unavailable")

    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", _batch_from_search(search_catalog))
    response = api_client.post("/psn/import/preview", files={"file": ("export.csv", b"Game Name\nHades\n", "text/csv")})

    assert response.json()["items"][0]["status"] == "ready"


def test_psn_import_preview_excludes_marker_products(api_client, user_factory, auth_as, app_main, monkeypatch):
    auth_as(user_factory(email="psn-excluded@example.com"))
    search_catalog = AsyncMock(return_value={"results": [{"id": 101, "name": "FORTNITE"}]})
    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", _batch_from_search(search_catalog))
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

    assert response.json()["items"][0]["status"] == "needs_mapping"
    search_catalog.assert_not_awaited()


@pytest.mark.parametrize(
    "product_name",
    ["Demo entitlement", "Season Pass", "Expansion add-on", "Virtual Currency", "Game Bundle"],
)
def test_psn_import_preview_excludes_clear_non_game_product_classes(
    api_client, user_factory, auth_as, app_main, monkeypatch, product_name
):
    auth_as(user_factory(email=f"psn-product-{product_name[:4]}@example.com"))
    search_catalog = AsyncMock(return_value={"results": [{"id": 101, "name": "Playable item", "game_type": 0}]})
    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", _batch_from_search(search_catalog))

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

    assert response.json()["items"][0]["status"] == "needs_mapping"
    search_catalog.assert_not_awaited()


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

    assert response.json()["items"][0]["status"] == "ready"
    search_catalog.assert_not_awaited()


def test_psn_import_mixed_preview_and_confirmation_flow(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    async def search_catalog(query, page=1):
        return {"results": [{"id": 101, "name": "God of War", "platforms": ["PlayStation 4"], "game_type": 0}]} if query == "GOD OF WAR" else {"results": []}

    async def catalog_detail(igdb_id):
        assert igdb_id == 101
        return {"id": 101, "name": "God of War"}

    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", _batch_from_search(search_catalog))
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

    assert [item["status"] for item in preview.json()["items"]] == ["ready", "ready", "suggested_skip"]
    items = preview.json()["items"]
    confirm = api_client.post("/psn/import/confirm", json={"selections": [
        {"candidate_token": items[0]["candidate_token"], "action": "catalog", "catalog_id": 101},
        {"candidate_token": items[1]["candidate_token"], "action": "raw"},
    ]})

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


def test_confirm_persists_signed_psn_catalog_evidence(
    api_client, db_session, user_factory, auth_as
):
    auth_as(user_factory(email="matcher-v2-import@example.com"))
    content = _xlsx_bytes("Transaction Detail", rows=[
        ["Transaction Date", "Game Name", "Product Name", "Content Type", "Platform", "Transaction Type"],
        ["2026-01-01", "Example Game", "Example Game", "Game", "PS5", "Product Purchase"],
        ["2026-01-02", "Example Game", "Example Game Complete Edition", "Game", "PS4", "Product Purchase"],
    ])
    preview = api_client.post("/psn/import/preview", files={"file": ("export.xlsx", content)}).json()
    token = preview["items"][0]["candidate_token"]
    response = api_client.post("/psn/import/confirm", json={
        "selections": [{"candidate_token": token, "action": "raw"}],
    })

    assert response.status_code == 200
    stored = db_session.query(Game).filter(Game.source == "psn").one()
    assert stored.psn_source_platforms == ["PS5", "PS4"]
    assert stored.psn_search_aliases == ["Example Game", "Example Game Complete Edition"]
    assert stored.catalog_lookup_version is None


def test_legacy_title_only_candidate_token_remains_valid(user_factory, auth_as, app_main):
    from jose import jwt

    user = auth_as(user_factory(email="matcher-v2-legacy@example.com"))
    token = jwt.encode({
        "sub": str(user.id),
        "title": "Legacy Game",
        "hash": app_main._psn_catalog_match_key("Legacy Game"),
    }, app_main.SECRET_KEY, algorithm="HS256")

    assert app_main._psn_candidate_from_token(token, user.id) == PsnCatalogEvidence("Legacy Game")


def test_reimport_merges_psn_evidence_and_preserves_user_data(
    api_client, db_session, user_factory, auth_as
):
    auth_as(user_factory(email="matcher-v2-merge@example.com"))
    first = _xlsx_bytes("Transaction Detail", rows=[
        ["Game Name", "Product Name", "Platform", "Transaction Type"],
        ["Example Game", "Example Game", "PS4", "Product Purchase"],
    ])
    first_item = api_client.post("/psn/import/preview", files={"file": ("first.xlsx", first)}).json()["items"][0]
    api_client.post("/psn/import/confirm", json={"selections": [{"candidate_token": first_item["candidate_token"], "action": "raw"}]})
    stored = db_session.query(Game).filter(Game.source == "psn").one()
    stored.notes = "keep me"
    stored.playtime_forever = 90
    db_session.commit()

    second = _xlsx_bytes("Transaction Detail", rows=[
        ["Game Name", "Product Name", "Platform", "Transaction Type"],
        ["Example Game", "Example Game Complete Edition", "PS5", "Product Purchase"],
    ])
    second_item = api_client.post("/psn/import/preview", files={"file": ("second.xlsx", second)}).json()["items"][0]
    api_client.post("/psn/import/confirm", json={"selections": [{"candidate_token": second_item["candidate_token"], "action": "raw"}]})
    db_session.refresh(stored)

    assert stored.psn_source_platforms == ["PS4", "PS5"]
    assert stored.psn_search_aliases == ["Example Game", "Example Game Complete Edition"]
    assert (stored.notes, stored.playtime_forever) == ("keep me", 90)


def test_psn_import_confirm_persists_owner_scoped_idempotent_games(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    async def catalog_detail(igdb_id):
        return {101: {"id": 101, "name": "Hades"}, 102: {"id": 102, "name": "Celeste"}}[igdb_id]

    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", catalog_detail)
    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", AsyncMock(return_value={"Hades": [{"id": 101, "name": "Hades"}], "Celeste": [{"id": 102, "name": "Celeste"}]}))
    owner = auth_as(user_factory(email="psn-owner@example.com"))
    preview = api_client.post("/psn/import/preview", files={"file": ("export.csv", b"Game Name\nHades\nCeleste\n", "text/csv")}).json()
    tokens = {title: item["candidate_token"] for title, item in zip(["Hades", "Celeste"], preview["items"])}
    first = api_client.post("/psn/import/confirm", json={"selections": [{"candidate_token": tokens["Hades"], "action": "catalog", "catalog_id": 101}, {"candidate_token": tokens["Hades"], "action": "catalog", "catalog_id": 101}, {"candidate_token": tokens["Celeste"], "action": "catalog", "catalog_id": 102}]})
    assert first.status_code == 200
    assert first.json() == {"created": 2, "updated": 0, "skipped": 0, "total": 2}
    assert db_session.query(Game).filter_by(owner_id=owner.id, source="psn").count() == 2
    second = api_client.post("/psn/import/confirm", json={"selections": [{"candidate_token": tokens["Hades"], "action": "catalog", "catalog_id": 101}, {"candidate_token": tokens["Celeste"], "action": "catalog", "catalog_id": 102}]})
    assert second.json() == {"created": 0, "updated": 0, "skipped": 2, "total": 2}

    other = auth_as(user_factory(email="psn-other@example.com"))
    other_preview = api_client.post("/psn/import/preview", files={"file": ("export.csv", b"Game Name\nHades\n", "text/csv")}).json()
    other_import = api_client.post("/psn/import/confirm", json={"selections": [{"candidate_token": other_preview["items"][0]["candidate_token"], "action": "catalog", "catalog_id": 101}]})
    assert other_import.json()["created"] == 1
    assert db_session.query(Game).filter_by(owner_id=other.id, source="psn").count() == 1
    assert db_session.query(Game).filter_by(owner_id=owner.id, source="psn").count() == 2


def test_psn_catalog_confirmation_promotes_matching_owner_raw_row(api_client, db_session, user_factory, auth_as, app_main, monkeypatch):
    owner = auth_as(user_factory(email="psn-promote-owner@example.com"))
    raw = Game(owner_id=owner.id, title="Hades", source="psn", external_id=psn_manual_external_id("Hades"), link_state="raw", notes="keep", playtime_forever=12)
    other = Game(owner_id=user_factory(email="psn-promote-other@example.com").id, title="Hades", source="psn", external_id=psn_manual_external_id("Hades"), link_state="raw")
    db_session.add_all([raw, other]); db_session.commit()
    created_at = raw.created_at
    monkeypatch.setattr(app_main, "resolve_psn_catalog_titles", AsyncMock(return_value={"Hades": CatalogResolution("matched", [{"id": 101, "name": "Hades"}])}))
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", AsyncMock(return_value={"id": 101, "name": "Hades", "background_image": "https://cover"}))
    preview = api_client.post("/psn/import/preview", files={"file": ("export.csv", b"Game Name\nHades\n", "text/csv")}).json()
    response = api_client.post("/psn/import/confirm", json={"selections": [{"candidate_token": preview["items"][0]["candidate_token"], "action": "catalog", "catalog_id": 101}]})

    assert response.status_code == 200
    games = db_session.query(Game).filter_by(owner_id=owner.id, source="psn").all()
    assert len(games) == 1
    assert (games[0].external_id, games[0].catalog_game_id, games[0].link_state, games[0].notes, games[0].playtime_forever, games[0].created_at) == ("psn:101", 101, "linked", "keep", 12, created_at)
    assert db_session.query(Game).filter_by(owner_id=other.owner_id, source="psn").one().link_state == "raw"


def test_psn_catalog_confirmation_merges_each_matching_raw_row_for_one_catalog_selection(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory(email="psn-promote-two-raw-owner@example.com"))
    first_raw = Game(
        owner_id=owner.id,
        title="Hades",
        source="psn",
        external_id=psn_manual_external_id("Hades"),
        link_state="raw",
        notes="first note",
        playtime_forever=12,
        psn_search_aliases=["Hades legacy"],
        psn_source_platforms=["PS4"],
        created_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )
    second_raw = Game(
        owner_id=owner.id,
        title="Hades Complete Edition",
        source="psn",
        external_id=psn_manual_external_id("Hades Complete Edition"),
        link_state="raw",
        notes="second note",
        playtime_forever=24,
        psn_search_aliases=["Hades Complete legacy"],
        psn_source_platforms=["PS5"],
        created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
    )
    db_session.add_all([first_raw, second_raw])
    db_session.commit()
    monkeypatch.setattr(app_main, "resolve_psn_catalog_titles", AsyncMock(return_value={
        "Hades": CatalogResolution("matched", [{"id": 101, "name": "Hades"}]),
        "Hades Complete Edition": CatalogResolution("matched", [{"id": 101, "name": "Hades"}]),
    }))
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", AsyncMock(return_value={
        "id": 101, "name": "Hades", "background_image": "https://cover",
    }))
    preview = api_client.post(
        "/psn/import/preview",
        files={"file": ("export.csv", b"Game Name\nHades\nHades Complete Edition\n", "text/csv")},
    ).json()

    response = api_client.post("/psn/import/confirm", json={"selections": [
        {"candidate_token": preview["items"][0]["candidate_token"], "action": "catalog", "catalog_id": 101},
        {"candidate_token": preview["items"][1]["candidate_token"], "action": "catalog", "catalog_id": 101},
    ]})

    assert response.status_code == 200
    games = db_session.query(Game).filter_by(owner_id=owner.id, source="psn").all()
    assert len(games) == 1
    game = games[0]
    assert (game.external_id, game.catalog_game_id, game.link_state) == ("psn:101", 101, "linked")
    assert (game.notes, game.playtime_forever, game.created_at) == (
        "first note", 24, datetime(2024, 1, 1),
    )
    assert game.psn_search_aliases == [
        "Hades legacy", "Hades Complete legacy", "Hades", "Hades Complete Edition",
    ]
    assert game.psn_source_platforms == ["PS4", "PS5"]


def test_psn_catalog_confirmation_enriches_linked_row_and_merges_raw_duplicate(api_client, db_session, user_factory, auth_as, app_main, monkeypatch):
    owner = auth_as(user_factory(email="psn-merge-owner@example.com"))
    raw = Game(
        owner_id=owner.id, title="Hades", source="psn", external_id=psn_manual_external_id("Hades"),
        link_state="raw", notes="keep", playtime_forever=12,
        created_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )
    linked = Game(
        owner_id=owner.id, title="Hades", source="psn", external_id="psn:101",
        catalog_game_id=101, link_state="linked", img_icon_url=None,
        created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
    )
    db_session.add_all([raw, linked])
    db_session.commit()
    monkeypatch.setattr(app_main, "resolve_psn_catalog_titles", AsyncMock(return_value={
        "Hades": CatalogResolution("matched", [{"id": 101, "name": "Hades"}]),
    }))
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", AsyncMock(return_value={
        "id": 101, "name": "Hades", "background_image": "https://cover",
    }))
    preview = api_client.post(
        "/psn/import/preview", files={"file": ("export.csv", b"Game Name\nHades\n", "text/csv")},
    ).json()

    response = api_client.post("/psn/import/confirm", json={"selections": [{
        "candidate_token": preview["items"][0]["candidate_token"], "action": "catalog", "catalog_id": 101,
    }]})

    assert response.json() == {"created": 0, "updated": 1, "skipped": 0, "total": 1}
    games = db_session.query(Game).filter_by(owner_id=owner.id, source="psn").all()
    assert len(games) == 1
    assert (games[0].img_icon_url, games[0].notes, games[0].playtime_forever, games[0].created_at) == (
        "https://cover", "keep", 12, datetime(2024, 1, 1),
    )



def test_psn_import_confirm_accepts_typed_catalog_and_manual_selections(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    async def catalog_detail(igdb_id):
        assert igdb_id == 101
        return {"id": 101, "name": "Hades"}

    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", catalog_detail)
    async def search_catalog(query, page=1):
        return {"results": [{"id": 101, "name": "Hades", "game_type": 0}]} if query == "Hades" else {"results": []}

    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", _batch_from_search(search_catalog))
    owner = auth_as(user_factory(email="psn-typed-selections@example.com"))
    preview = api_client.post("/psn/import/preview", files={"file": ("export.csv", b"Game Name\nHades\nDisco Elysium\n", "text/csv")})
    items = preview.json()["items"]
    assert [item["status"] for item in items] == ["ready", "ready"]

    first = api_client.post(
        "/psn/import/confirm",
        json={"selections": [{"candidate_token": items[0]["candidate_token"], "action": "catalog", "catalog_id": 101}, {"candidate_token": items[1]["candidate_token"], "action": "raw"}]},
    )

    assert first.status_code == 200
    assert first.json() == {"created": 2, "updated": 0, "skipped": 0, "total": 2}
    games = db_session.query(Game).filter_by(owner_id=owner.id, source="psn").order_by(Game.external_id).all()
    assert [(game.external_id, game.title) for game in games] == [
        ("psn:101", "Hades"),
        ("psn:manual:25e9313cd2d548983d20a0d2ed07f60f", "Disco Elysium"),
    ]

    second = api_client.post("/psn/import/confirm", json={"selections": [{"candidate_token": items[1]["candidate_token"], "action": "raw"}]})
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


def test_psn_import_confirm_allows_a_suggested_skip_to_be_restored_as_raw(
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
    item = preview.json()["items"][0]
    assert item["status"] == "needs_mapping"

    response = api_client.post("/psn/import/confirm", json={"selections": [{"candidate_token": item["candidate_token"], "action": "raw"}]})

    assert response.status_code == 200
    assert db_session.query(Game).filter_by(owner_id=owner.id, source="psn").count() == 1


def test_psn_library_repair_links_raw_rows_and_hides_quarantine(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory(email="psn-repair-owner@example.com"))
    raw = Game(owner_id=owner.id, title="Hades", source="psn", external_id="psn:manual:test", link_state="raw")
    junk = Game(owner_id=owner.id, title="Spotify", source="psn", external_id="psn:manual:junk", link_state="raw")
    db_session.add_all([raw, junk])
    db_session.commit()
    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", AsyncMock(return_value={"Hades": [{"id": 101, "name": "Hades", "background_image": "https://cover"}]}))
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", AsyncMock(return_value={"id": 101, "name": "Hades", "background_image": "https://cover"}))

    preview = api_client.get("/psn/library-repair/preview")
    assert preview.status_code == 200
    suggestions = {item["title"]: item for item in preview.json()["items"]}
    assert suggestions["Hades"]["suggestion"] == "auto_link"
    assert suggestions["Spotify"]["suggestion"] == "quarantine"

    applied = api_client.post("/psn/library-repair/apply", json={"decisions": [
        {"game_id": str(raw.id), "action": "link", "catalog_id": 101},
        {"game_id": str(junk.id), "action": "quarantine"},
    ]})
    assert applied.status_code == 200
    overview = api_client.get("/library/overview").json()["games"]
    assert [(item["title"], item["catalog_game_id"], item["detail_game_id"]) for item in overview] == [("Hades", 101, "101")]
    assert db_session.get(Game, junk.id).link_state == "quarantined"


def test_library_overview_uses_matcher_version_for_psn_catalog_lookup_progress(
    api_client, db_session, user_factory, auth_as
):
    owner = auth_as(user_factory(email="psn-lookup-overview@example.com"))
    db_session.add_all([
        Game(
            owner_id=owner.id,
            source="psn",
            external_id="psn:manual:pending",
            title="Pending",
            link_state="raw",
            catalog_lookup_state="skipped",
        ),
        Game(
            owner_id=owner.id,
            source="psn",
            external_id="psn:manual:review",
            title="Review",
            link_state="raw",
            catalog_lookup_state="review",
            catalog_lookup_version=1,
        ),
        Game(
            owner_id=owner.id,
            source="psn",
            external_id="psn:manual:no-match",
            title="No match",
            link_state="raw",
            catalog_lookup_state="no_match",
        ),
        Game(
            owner_id=owner.id,
            source="psn",
            external_id="psn:101",
            title="Linked",
            link_state="linked",
            catalog_game_id=101,
        ),
        Game(
            owner_id=owner.id,
            source="psn",
            external_id="psn:manual:hidden",
            title="Hidden",
            link_state="quarantined",
            catalog_lookup_version=1,
        ),
    ])
    db_session.commit()

    payload = api_client.get("/library/overview").json()

    assert payload["pending_catalog_count"] == 2
    assert {item["title"]: item["catalog_lookup_state"] for item in payload["games"]} == {
        "Linked": None,
        "No match": "no_match",
        "Pending": "skipped",
        "Review": "review",
    }


def test_library_overview_exposes_clean_catalog_search_query_only_for_raw_psn_rows(
    api_client, db_session, user_factory, auth_as
):
    owner = auth_as(user_factory(email="psn-query-overview@example.com"))
    db_session.add_all([
        Game(owner_id=owner.id, source="psn", external_id="psn:manual:fifa", title="EA SPORTS™ FIFA 16", link_state="raw", psn_search_aliases=["FIFA 16"], psn_source_platforms=["PS4"]),
        Game(owner_id=owner.id, source="psn", external_id="psn:2", title="FIFA 16", link_state="linked", catalog_game_id=2),
        Game(owner_id=owner.id, source="steam", external_id="10", title="Steam game"),
        Game(owner_id=owner.id, source="manual", title="Manual game"),
    ])
    db_session.commit()

    items = {item["title"]: item for item in api_client.get("/library/overview").json()["games"]}

    assert items["EA SPORTS™ FIFA 16"]["catalog_search_query"] == "FIFA 16"
    assert items["FIFA 16"]["catalog_search_query"] is None
    assert items["Steam game"]["catalog_search_query"] is None
    assert items["Manual game"]["catalog_search_query"] is None


def test_enrichment_uses_stored_alias_and_platform(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    user = auth_as(user_factory(email="matcher-v2-alias@example.com"))
    game = Game(owner_id=user.id, source="psn", external_id="psn:manual:fifa", title="EA SPORTS™ FIFA 16", link_state="raw", psn_search_aliases=["FIFA 16"], psn_source_platforms=["PS4"])
    db_session.add(game)
    db_session.commit()
    resolver = AsyncMock(return_value={str(game.id): PsnCatalogDecision("linked", {"id": 2, "name": "FIFA 16", "platforms": ["PlayStation 4"], "game_type": 0}, "safe_winner", "safe_alias", 150)})
    monkeypatch.setattr(app_main, "resolve_psn_catalog_evidence", resolver)

    response = api_client.post("/psn/library-repair/enrich")

    assert response.status_code == 200
    resolver.assert_awaited_once()
    assert resolver.await_args.args == ({str(game.id): PsnCatalogEvidence("EA SPORTS™ FIFA 16", ("FIFA 16",), ("PS4",))},)
    db_session.refresh(game)
    assert game.catalog_game_id == 2
    assert game.catalog_lookup_version == PSN_CATALOG_MATCHER_VERSION


def test_provider_failure_does_not_advance_matcher_version(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    user = auth_as(user_factory(email="matcher-v2-failure@example.com"))
    game = Game(owner_id=user.id, source="psn", external_id="psn:manual:retry", title="Retry", link_state="raw")
    db_session.add(game)
    db_session.commit()
    monkeypatch.setattr(app_main, "resolve_psn_catalog_evidence", AsyncMock(side_effect=PsnCatalogUnavailable))

    response = api_client.post("/psn/library-repair/enrich")

    assert response.status_code == 502
    db_session.refresh(game)
    assert game.catalog_lookup_version is None


def test_preview_is_independent_of_catalog_provider(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="matcher-v2-preview@example.com"))
    batch = AsyncMock(side_effect=AssertionError("preview must not call IGDB"))
    single = AsyncMock(side_effect=AssertionError("preview must not call IGDB"))
    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", batch)
    monkeypatch.setattr(app_main, "fetch_igdb_games", single)

    response = api_client.post("/psn/import/preview", files={"file": ("export.xlsx", _xlsx_bytes(rows=[["Game Title"], ["Example Game"]]))})

    assert response.status_code == 200
    assert response.json()["items"][0]["status"] == "ready"
    assert response.json()["items"][0]["recommended_action"] == "raw"
    batch.assert_not_awaited()
    single.assert_not_awaited()


def test_unresolved_success_records_matcher_version(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    user = auth_as(user_factory(email="matcher-v2-review@example.com"))
    game = Game(owner_id=user.id, source="psn", external_id="psn:manual:review", title="Review", link_state="raw")
    db_session.add(game)
    db_session.commit()
    monkeypatch.setattr(app_main, "resolve_psn_catalog_evidence", AsyncMock(return_value={str(game.id): PsnCatalogDecision("review", reason="ambiguous_top_candidates")}))

    assert api_client.post("/psn/library-repair/enrich").status_code == 200
    db_session.refresh(game)
    assert game.catalog_lookup_state == "review"
    assert game.catalog_lookup_version == PSN_CATALOG_MATCHER_VERSION


def test_psn_enrichment_processes_every_raw_row_in_bounded_batches(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory(email="psn-enrichment-all@example.com"))
    db_session.add_all([
        Game(
            owner_id=owner.id,
            source="psn",
            external_id=f"psn:manual:{number}",
            title=f"Game {number}",
            link_state="raw",
        )
        for number in range(21)
    ])
    db_session.commit()
    batch = AsyncMock(return_value={})

    async def single_lookup(title: str):
        number = int(title.removeprefix("Game "))
        return {
            "results": [{
                "id": 1000 + number,
                "name": title,
                "background_image": f"https://covers/{number}.jpg",
            }]
        }

    single = AsyncMock(side_effect=single_lookup)
    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", batch)
    monkeypatch.setattr(app_main, "fetch_igdb_games", single)

    attempts = []
    remaining = 1
    while remaining:
        response = api_client.post("/psn/library-repair/enrich")
        assert response.status_code == 200
        payload = response.json()
        attempts.append(payload["attempted"])
        remaining = payload["remaining"]

    games = db_session.query(Game).filter_by(owner_id=owner.id, source="psn").all()
    assert len(games) == 21
    assert all(game.link_state == "linked" and game.catalog_game_id for game in games)
    assert all(game.img_icon_url and game.img_icon_url.startswith("https://covers/") for game in games)
    assert attempts == [8, 8, 5]
    assert single.await_count == 21


def test_psn_enrichment_persists_review_and_no_match_without_repeating(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory(email="psn-enrichment-review@example.com"))
    ambiguous = Game(
        owner_id=owner.id,
        source="psn",
        external_id="psn:manual:ambiguous",
        title="Example",
        link_state="raw",
    )
    missing = Game(
        owner_id=owner.id,
        source="psn",
        external_id="psn:manual:missing",
        title="Missing",
        link_state="raw",
    )
    db_session.add_all([ambiguous, missing])
    db_session.commit()
    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", AsyncMock(return_value={
        "Example": [
            {"id": 1, "name": "Example (2010)"},
            {"id": 2, "name": "Example Remake"},
        ],
        "Missing": [],
    }))

    first = api_client.post("/psn/library-repair/enrich")
    second = api_client.post("/psn/library-repair/enrich")

    assert first.status_code == 200
    assert first.json() == {
        "attempted": 2,
        "linked": 0,
        "review": 2,
        "quarantined": 0,
        "remaining": 0,
    }
    assert second.json()["attempted"] == 0
    db_session.refresh(ambiguous)
    db_session.refresh(missing)
    assert ambiguous.catalog_lookup_state == "review"
    assert missing.catalog_lookup_state == "no_match"


def test_psn_enrichment_rolls_back_provider_unavailability(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    from app.integrations.igdb import IGDBError

    owner = auth_as(user_factory(email="psn-enrichment-unavailable@example.com"))
    game = Game(
        owner_id=owner.id,
        source="psn",
        external_id="psn:manual:retry",
        title="Retry Me",
        link_state="raw",
    )
    db_session.add(game)
    db_session.commit()
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_games_batch",
        AsyncMock(side_effect=IGDBError("batch unavailable", 502)),
    )
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_games",
        AsyncMock(side_effect=IGDBError("single unavailable", 502)),
    )

    response = api_client.post("/psn/library-repair/enrich")

    assert response.status_code == 502
    db_session.refresh(game)
    assert game.link_state == "raw"
    assert game.catalog_lookup_state is None


def test_psn_enrichment_quarantines_only_existing_high_confidence_non_games(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory(email="psn-enrichment-quarantine@example.com"))
    junk = Game(
        owner_id=owner.id,
        source="psn",
        external_id="psn:manual:spotify",
        title="Spotify",
        link_state="raw",
    )
    game = Game(
        owner_id=owner.id,
        source="psn",
        external_id="psn:manual:bloodborne",
        title="Bloodborne",
        link_state="raw",
    )
    db_session.add_all([junk, game])
    db_session.commit()
    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", AsyncMock(return_value={
        "Bloodborne": [{
            "id": 7334,
            "name": "Bloodborne",
            "background_image": "https://covers/bloodborne.jpg",
        }],
    }))

    response = api_client.post("/psn/library-repair/enrich")

    assert response.status_code == 200
    assert response.json() == {
        "attempted": 2,
        "linked": 1,
        "review": 0,
        "quarantined": 1,
        "remaining": 0,
    }
    db_session.refresh(junk)
    db_session.refresh(game)
    assert junk.link_state == "quarantined"
    assert (game.link_state, game.catalog_game_id) == ("linked", 7334)


def test_psn_repair_preserves_partial_catalog_success_and_surfaces_unavailable(api_client, db_session, user_factory, auth_as, app_main, monkeypatch):
    from app.integrations.igdb import IGDBError

    owner = auth_as(user_factory(email="psn-repair-unavailable@example.com"))
    db_session.add_all([
        Game(owner_id=owner.id, title="Hades", source="psn", external_id="psn:manual:hades", link_state="raw"),
        Game(owner_id=owner.id, title="Celeste", source="psn", external_id="psn:manual:celeste", link_state="raw"),
    ]); db_session.commit()
    batch = AsyncMock(return_value={"Hades": [{"id": 101, "name": "Hades"}]})
    single = AsyncMock(side_effect=IGDBError("catalog unavailable"))
    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", batch)
    monkeypatch.setattr(app_main, "fetch_igdb_games", single)

    items = {item["title"]: item for item in api_client.get("/psn/library-repair/preview").json()["items"]}

    assert items["Hades"]["suggestion"] == "auto_link"
    assert (items["Celeste"]["suggestion"], items["Celeste"]["reason"]) == ("unavailable", "Catalog temporarily unavailable.")
    batch.assert_awaited_once_with(["Hades", "Celeste"])
    single.assert_awaited_once_with("Celeste")


def test_remove_all_psn_library_games_is_owner_scoped(api_client, db_session, user_factory, auth_as):
    owner = auth_as(user_factory(email="remove-all-psn@example.com"))
    other = user_factory(email="keep-other-psn@example.com")
    db_session.add_all([
        Game(owner_id=owner.id, title="PSN one", source="psn", external_id="psn:1"),
        Game(owner_id=owner.id, title="PSN raw", source="psn", external_id="psn:manual:one"),
        Game(owner_id=owner.id, title="Manual", source="manual"),
        Game(owner_id=other.id, title="Other PSN", source="psn", external_id="psn:2"),
    ])
    db_session.commit()

    response = api_client.delete("/psn/library")

    assert response.status_code == 200
    assert response.json() == {"deleted": 2}
    assert [(game.owner_id, game.source) for game in db_session.query(Game).order_by(Game.title).all()] == [
        (owner.id, "manual"), (other.id, "psn"),
    ]
