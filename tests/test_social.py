import importlib

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base


def test_social_identity_allows_duplicate_display_names_and_generates_safe_ids():
    crud = importlib.import_module("app.crud")
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()

    first = crud.create_user(db, "first@example.test", "hash", "Alex")
    second = crud.create_user(db, "second@example.test", "hash", "Alex")

    assert first.display_name == second.display_name == "Alex"
    assert first.profile_id != second.profile_id
    assert first.friend_code != second.friend_code


def test_user_create_requires_a_display_name():
    schemas = importlib.import_module("app.schemas")

    with pytest.raises(Exception):
        schemas.UserCreate(email="a@example.test", password="password")
