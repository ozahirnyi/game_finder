import pytest
import importlib
from types import SimpleNamespace
from pydantic import ValidationError
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

import app.schemas as schemas
from app.schemas import PriceAlertCreate
from app.database import Base, Notification, PriceAlert, User, WishlistItem


def test_any_discount_alert_rejects_a_threshold():
    with pytest.raises(ValidationError, match="any_discount must not have a threshold"):
        PriceAlertCreate(
            identity_kind="rawg",
            identity_value="30",
            title="Hades",
            mode="any_discount",
            threshold=10,
            in_app=True,
            telegram=False,
        )


def test_retention_models_have_owner_foreign_keys():
    assert WishlistItem.__table__.c.user_id.foreign_keys
    assert PriceAlert.__table__.c.user_id.foreign_keys
    assert Notification.__table__.c.user_id.foreign_keys


def test_price_alert_migration_has_owner_scoped_duplicate_index():
    assert "ix_price_alerts_owner_identity_mode_threshold" in {
        index.name for index in PriceAlert.__table__.indexes
    }
    migration = Path("alembic/versions/8c1d9e7f6a02_add_retention_models.py").read_text()
    assert "ix_price_alerts_owner_identity_mode_threshold" in migration


def test_wishlist_service_never_lists_other_owner_items():
    retention = importlib.import_module("app.retention")
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    alice = User(email="alice@example.test")
    bob = User(email="bob@example.test")
    db.add_all([alice, bob])
    db.commit()

    retention.create_wishlist_item(
        db,
        alice,
        schemas.WishlistItemCreate(identity_kind="rawg", identity_value="30", title="Hades"),
    )

    assert retention.list_wishlist_items(db, bob.id) == []


def test_price_alert_service_reports_owner_duplicate():
    retention = importlib.import_module("app.retention")
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    user = User(email="owner@example.test")
    db.add(user)
    db.commit()
    alert = PriceAlertCreate(
        identity_kind="rawg",
        identity_value="30",
        title="Hades",
        mode="target_discount",
        threshold=35,
    )

    retention.create_price_alert(db, user, alert, SimpleNamespace(configured=True, linked=True))

    with pytest.raises(Exception, match="You already have this price alert.") as error:
        retention.create_price_alert(db, user, alert, SimpleNamespace(configured=True, linked=True))
    assert error.value.status_code == 409


def test_alert_duplicate_route_returns_readable_owner_scoped_conflict():
    import app.main as main

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    user = User(email="route-owner@example.test")
    db.add(user)
    db.commit()
    main.app.dependency_overrides[main.get_db] = lambda: db
    main.app.dependency_overrides[main.get_current_user] = lambda: user
    client = TestClient(main.app)
    payload = {
        "identity_kind": "rawg",
        "identity_value": "30",
        "title": "Hades",
        "mode": "target_discount",
        "threshold": 35,
        "in_app": True,
        "telegram": False,
    }
    try:
        assert client.post("/price-alerts", json=payload).status_code == 201
        response = client.post("/price-alerts", json=payload)
        assert response.status_code == 409
        assert response.json()["detail"] == "You already have this price alert."
    finally:
        main.app.dependency_overrides.clear()
