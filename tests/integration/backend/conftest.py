import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, User


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def app_main():
    import app.main as main

    try:
        yield main
    finally:
        main.app.dependency_overrides.clear()


@pytest.fixture
def api_client(app_main, db_session):
    app_main.app.dependency_overrides[app_main.get_db] = lambda: db_session
    with TestClient(app_main.app) as client:
        yield client
    app_main.app.dependency_overrides.clear()


@pytest.fixture
def user_factory(db_session):
    def create_user(email="player@example.com", **overrides):
        user = User(email=email, **overrides)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    return create_user


@pytest.fixture
def auth_as(app_main):
    def authenticate(user):
        app_main.app.dependency_overrides[app_main.get_current_user] = lambda: user
        app_main.app.dependency_overrides[app_main.get_optional_current_user] = lambda: user
        return user

    return authenticate
