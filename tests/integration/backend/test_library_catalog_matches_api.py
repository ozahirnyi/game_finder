from unittest.mock import AsyncMock

import pytest

from app.database import Game, Notification, PriceAlert, WishlistItem


pytestmark = pytest.mark.integration


def row(db, owner, title="Hades", source="manual", **kwargs):
    game = Game(owner_id=owner.id, title=title, source=source, **kwargs)
    db.add(game)
    db.commit()
    return game


def decision(game, action="link", catalog_id=1, **kwargs):
    return {"game_id": str(game.id), "action": action,
            **({"catalog_id": catalog_id} if action == "link" else {}), **kwargs}


def test_psn_preview_does_not_include_manual_or_foreign_records(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory())
    psn = row(db_session, owner, source='psn')
    row(db_session, owner, source='manual')
    row(db_session, user_factory(email='scope-other@example.com'), source='psn')
    monkeypatch.setattr(app_main, 'fetch_igdb_matching_games_batch', AsyncMock(return_value={'Hades': []}))
    monkeypatch.setattr(app_main, 'fetch_igdb_localized_games', AsyncMock(return_value={}))
    response = api_client.post('/library/catalog-matches/preview?source=psn')
    assert response.status_code == 200
    assert response.json()['total'] == 1
    assert [item['game_id'] for item in response.json()['items']] == [str(psn.id)]
    assert api_client.post('/library/catalog-matches/preview?source=steam').status_code == 422


def test_preview_retries_all_unresolved_and_supports_explicit_linked_corrections(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory())
    other = user_factory(email="matching-other@example.com")
    raw = row(db_session, owner, source="psn", link_state="raw", catalog_lookup_state="skipped", catalog_lookup_version=999)
    manual = row(db_session, owner, title="Factorio")
    linked = row(db_session, owner, title="Linked", catalog_game_id=3, link_state="linked")
    row(db_session, other)
    row(db_session, owner, source="steam")
    row(db_session, owner, source="psn", link_state="quarantined")
    async def batch(titles):
        return {title: [{"id": 1, "name": title, "platforms": ["PC (Microsoft Windows)", "PlayStation 4"]}] for title in titles}
    monkeypatch.setattr(app_main, "fetch_igdb_matching_games_batch", batch)
    monkeypatch.setattr(app_main, "fetch_igdb_localized_games", AsyncMock(return_value={}), raising=False)
    response = api_client.post("/library/catalog-matches/preview")
    assert response.status_code == 200
    assert {item["game_id"] for item in response.json()["items"]} == {str(raw.id), str(manual.id)}
    assert all(item["status"] == "matched" for item in response.json()["items"])
    db_session.refresh(raw)
    assert raw.catalog_game_id is None
    corrected = api_client.post("/library/catalog-matches/preview?include_linked=true")
    assert str(linked.id) in {item["game_id"] for item in corrected.json()["items"]}


def test_matching_requires_authentication(api_client):
    assert api_client.post("/library/catalog-matches/preview").status_code == 401
    assert api_client.post("/library/catalog-matches/apply", json={"decisions": []}).status_code == 401


def test_apply_validates_all_owner_ids_before_fetching_or_mutating(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory())
    own = row(db_session, owner)
    foreign = row(db_session, user_factory(email="matching-foreign@example.com"))
    fetch = AsyncMock(return_value={"id": 1, "name": "Hades"})
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", fetch)
    response = api_client.post("/library/catalog-matches/apply", json={"decisions": [decision(own), decision(foreign)]})
    assert response.status_code == 404
    fetch.assert_not_awaited()
    db_session.refresh(own)
    assert own.catalog_game_id is None


def test_link_retry_correction_unlink_preserve_source_title_and_pause_once(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory())
    game = row(db_session, owner, title="My Hades", notes="Personal notes")
    item = WishlistItem(user_id=owner.id, catalog_game_id=1, title="Hades")
    db_session.add(item)
    db_session.flush()
    alert = PriceAlert(user_id=owner.id, wishlist_item_id=item.id, target_price=10)
    db_session.add(alert)
    db_session.commit()
    async def detail(catalog_id):
        return {"id": catalog_id, "name": "Catalog Hades", "platforms": ["PC (Microsoft Windows)"],
                "background_image": "https://images.example/catalog-cover.jpg" if catalog_id == 1 else None}
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", detail)
    payload = {"decisions": [decision(game)]}
    assert api_client.post("/library/catalog-matches/apply", json=payload).json() == {"updated": 1}
    assert api_client.post("/library/catalog-matches/apply", json=payload).status_code == 200
    db_session.refresh(game)
    db_session.refresh(alert)
    assert game.title == "My Hades" and game.notes == "Personal notes"
    assert game.catalog_game_id == 1 and alert.pause_reason == "owned"
    assert game.img_icon_url == "https://images.example/catalog-cover.jpg"
    assert db_session.query(Notification).filter_by(user_id=owner.id, type="price_alert_paused").count() == 1
    stale = {"decisions": [decision(game, catalog_id=2)]}
    assert api_client.post("/library/catalog-matches/apply", json=stale).status_code == 409
    correction = {"decisions": [decision(game, catalog_id=2, expected_catalog_game_id=1)]}
    assert api_client.post("/library/catalog-matches/apply", json=correction).status_code == 200
    db_session.refresh(game)
    assert game.img_icon_url is None
    unlink = {"decisions": [decision(game, action="unlink", expected_catalog_game_id=2)]}
    assert api_client.post("/library/catalog-matches/apply", json=unlink).status_code == 200
    assert api_client.post("/library/catalog-matches/apply", json=unlink).status_code == 200
    db_session.refresh(game)
    db_session.refresh(alert)
    assert game.catalog_game_id is None and game.title == "My Hades"
    assert game.img_icon_url is None
    assert alert.pause_reason == "owned"


def test_apply_is_atomic_on_invalid_detail_id(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory())
    first, second = row(db_session, owner), row(db_session, owner, title="Celeste")
    async def detail(catalog_id):
        return {"id": 1 if catalog_id == 1 else 999, "name": "Catalog"}
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", detail)
    response = api_client.post("/library/catalog-matches/apply", json={"decisions": [decision(first), decision(second, catalog_id=2)]})
    assert response.status_code == 422
    db_session.refresh(first)
    assert first.catalog_game_id is None


def test_unlink_clears_catalog_cover_without_provider_lookup(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory())
    game = row(db_session, owner, catalog_game_id=1, link_state="linked",
               img_icon_url="https://images.example/old-cover.jpg")
    fetch = AsyncMock(side_effect=RuntimeError("Unlink must not fetch catalog details"))
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", fetch)
    response = api_client.post("/library/catalog-matches/apply", json={"decisions": [
        decision(game, action="unlink", expected_catalog_game_id=1),
    ]})
    assert response.status_code == 200
    db_session.refresh(game)
    assert game.catalog_game_id is None and game.img_icon_url is None
    assert game.title == "Hades"
    fetch.assert_not_awaited()


def test_keep_raw_and_input_validation(api_client, db_session, user_factory, auth_as):
    owner = auth_as(user_factory())
    game = row(db_session, owner)
    response = api_client.post("/library/catalog-matches/apply", json={"decisions": [decision(game, action="keep_raw")]})
    assert response.status_code == 200
    db_session.refresh(game)
    assert game.catalog_game_id is None and game.catalog_lookup_state == "skipped"
    assert api_client.post("/library/catalog-matches/apply", json={"decisions": [decision(game)] * 501}).status_code == 422
    assert api_client.post("/library/catalog-matches/apply", json={"decisions": [decision(game)] * 2}).status_code == 422


def test_same_source_duplicate_preserves_both_notes_info_and_retry_identity(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory())
    existing = row(db_session, owner, title="Skyrim - Special Edition", source="psn",
                   catalog_game_id=1, link_state="linked", notes="Old notes", info="Old info", playtime_forever=80)
    raw = row(db_session, owner, title="Skyrim Special Edition", source="psn",
              notes="New notes", info="New info", playtime_forever=20)
    manual = row(db_session, owner, source="manual", catalog_game_id=1, notes="Manual notes")
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", AsyncMock(return_value={"id": 1, "name": "Skyrim"}))
    existing_id = existing.id
    payload = {"decisions": [decision(raw)]}
    assert api_client.post("/library/catalog-matches/apply", json=payload).status_code == 200
    assert api_client.post("/library/catalog-matches/apply", json=payload).status_code == 200
    db_session.refresh(raw)
    assert raw.title == "Skyrim Special Edition"
    assert "Old notes" in raw.notes and "New notes" in raw.notes
    assert "Old info" in raw.info and "New info" in raw.info
    assert raw.playtime_forever == 80
    assert db_session.get(Game, existing_id) is None
    assert db_session.get(Game, manual.id) is not None


def test_manual_duplicate_without_link_state_preserves_notes(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory())
    old = row(db_session, owner, catalog_game_id=1, notes="Existing manual notes")
    raw = row(db_session, owner, notes="Incoming manual notes")
    old_id = old.id
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", AsyncMock(return_value={"id": 1, "name": "Hades"}))
    assert api_client.post("/library/catalog-matches/apply", json={"decisions": [decision(raw)]}).status_code == 200
    db_session.refresh(raw)
    assert "Existing manual notes" in raw.notes and "Incoming manual notes" in raw.notes
    assert db_session.get(Game, old_id) is None


def test_multiple_explicit_same_target_rows_merge_deterministically_and_retry_safely(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory())
    first = row(db_session, owner, notes="First notes", info="First info", playtime_forever=10)
    second = row(db_session, owner, title="Another title", notes="Second notes", info="Second info", playtime_forever=50)
    first_id, second_id = first.id, second.id
    fetch = AsyncMock(return_value={"id": 1, "name": "Hades"})
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", fetch)
    payload = {"decisions": [decision(first), decision(second)]}
    assert api_client.post("/library/catalog-matches/apply", json=payload).status_code == 200
    fetch.reset_mock()
    fetch.side_effect = RuntimeError("Retry must not require a provider call")
    assert api_client.post("/library/catalog-matches/apply", json=payload).status_code == 404
    fetch.assert_not_awaited()
    remaining = db_session.query(Game).filter_by(owner_id=owner.id).all()
    assert len(remaining) == 1
    retained = remaining[0]
    assert retained.id == min(first_id, second_id)
    assert retained.catalog_game_id == 1
    assert "First notes" in retained.notes and "Second notes" in retained.notes
    assert "First info" in retained.info and "Second info" in retained.info
    assert retained.playtime_forever == 50
    assert api_client.post("/library/catalog-matches/apply", json={"decisions": [decision(retained)]}).status_code == 200


def test_duplicate_note_overflow_rolls_back_without_dropping_either_entry(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory())
    old = row(db_session, owner, catalog_game_id=1, notes="a" * 200)
    raw = row(db_session, owner, notes="b" * 200)
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", AsyncMock(return_value={"id": 1, "name": "Hades"}))
    assert api_client.post("/library/catalog-matches/apply", json={"decisions": [decision(raw)]}).status_code == 409
    db_session.refresh(raw)
    db_session.refresh(old)
    assert raw.catalog_game_id is None and raw.notes == "b" * 200
    assert old.catalog_game_id == 1 and old.notes == "a" * 200


def test_preview_pages_more_than_500_owner_records_in_stable_order(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory())
    other = user_factory(email="paging-other@example.com")
    db_session.add_all([Game(owner_id=owner.id, title=f"Game {index}", source="manual") for index in range(513)])
    db_session.add(Game(owner_id=other.id, title="Foreign", source="manual"))
    db_session.commit()
    expected = [str(game.id) for game in db_session.query(Game).filter_by(owner_id=owner.id).order_by(Game.created_at, Game.id)]
    async def batch(titles):
        return {title: [] for title in titles}
    monkeypatch.setattr(app_main, "fetch_igdb_matching_games_batch", batch)
    monkeypatch.setattr(app_main, "fetch_igdb_localized_games", AsyncMock(return_value={}))
    ids = []
    offset = 0
    while offset is not None:
        response = api_client.post(f"/library/catalog-matches/preview?offset={offset}&limit=100")
        assert response.status_code == 200
        page = response.json()
        assert page["total"] == 513 and len(page["items"]) <= 100
        ids.extend(item["game_id"] for item in page["items"])
        offset = page["next_offset"]
    assert ids == expected
    assert api_client.post("/library/catalog-matches/preview?limit=501").status_code == 422
