import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, Favorite, FriendRequest, User, WishlistItem
from app.e2e_fixtures import (
    FIXTURE_KEY_RE,
    MANIFEST,
    delete_fixture,
    inventory_fixture,
    seed_fixture,
    set_fixture_hidden,
    validate_fixture_key,
    validate_user_facing_fields,
)


@pytest.fixture
def fixture_db():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_fixture_keys_are_stable_and_strictly_operational():
    assert validate_fixture_key("local-slate-2026") == "local-slate-2026"
    assert FIXTURE_KEY_RE.fullmatch("staging-business")
    with pytest.raises(ValueError):
        validate_fixture_key("business_fixture")
    with pytest.raises(ValueError):
        validate_fixture_key("ab")


def test_manifest_has_natural_user_facing_content_without_markers():
    assert {item["role"] for item in MANIFEST} == {"mara", "jonas"}
    for item in MANIFEST:
        validate_user_facing_fields(item)


def test_forbidden_markers_cannot_enter_user_facing_fields():
    with pytest.raises(ValueError, match="user-facing"):
        validate_user_facing_fields({"message": "See you after the e2e session"})


def test_inventory_expands_fixture_users_to_owned_and_cross_user_records(fixture_db):
    db_session = fixture_db
    first = User(email="mara@ops.example", display_name="Mara Ellison", e2e_fixture_key="local-slate", e2e_fixture_hidden=True)
    second = User(email="jonas@ops.example", display_name="Jonas Reed", e2e_fixture_key="local-slate", e2e_fixture_hidden=True)
    db_session.add_all([first, second])
    db_session.flush()
    db_session.add(FriendRequest(sender_id=first.id, recipient_id=second.id, status="pending"))
    db_session.add(Favorite(user_id=first.id, catalog_game_id=42, title="Hades"))
    db_session.add(WishlistItem(user_id=second.id, catalog_game_id=42, title="Hades", source="catalog", external_id="igdb:42"))
    db_session.commit()

    result = inventory_fixture(db_session, "local-slate")

    assert result["counts"]["users"] == 2
    assert result["counts"]["friend_requests"] == 1
    assert result["counts"]["favorites"] == 1
    assert result["counts"]["wishlist_items"] == 1


def test_seed_hide_and_guarded_delete_are_repeatable(fixture_db, monkeypatch):
    monkeypatch.setenv("E2E_FIXTURE_EMAIL_DOMAIN", "ops.example")
    monkeypatch.setenv("E2E_FIXTURE_MARA_PASSWORD", "a-long-enough-secret")
    monkeypatch.setenv("E2E_FIXTURE_JONAS_PASSWORD", "another-long-secret")

    seeded = seed_fixture(fixture_db, "local-slate", environment="test")
    rerun = seed_fixture(fixture_db, "local-slate", environment="test")
    assert seeded["counts"]["users"] == rerun["counts"]["users"] == 2
    assert fixture_db.query(User).count() == 2

    hidden = set_fixture_hidden(fixture_db, "local-slate", True)
    assert hidden["action"] == "hide"
    assert fixture_db.query(User).filter(User.e2e_fixture_hidden.is_(True)).count() == 2
    assert set_fixture_hidden(fixture_db, "local-slate", False, dry_run=True)["dry_run"] is True

    with pytest.raises(ValueError, match="exact fixture key"):
        delete_fixture(fixture_db, "local-slate", confirm="wrong-key")
    preview = delete_fixture(fixture_db, "local-slate", dry_run=True)
    assert preview["counts"]["users"] == 2
    delete_fixture(fixture_db, "local-slate", confirm="local-slate")
    assert fixture_db.query(User).count() == 0
