from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, User


def test_favorites_are_owned_and_distinct_from_wishlist():
    import app.main as main

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    alice = User(email="favorite-alice@example.test", display_name="Alice")
    bob = User(email="favorite-bob@example.test", display_name="Bob")
    db.add_all([alice, bob]); db.commit()
    main.app.dependency_overrides[main.get_db] = lambda: db
    main.app.dependency_overrides[main.get_current_user] = lambda: alice
    try:
        client = TestClient(main.app)
        created = client.post("/favorites", json={"identity_kind": "rawg", "identity_value": "30", "title": "Hades", "cover_url": "https://cover"})
        assert created.status_code == 201
        assert client.get("/favorites").json()[0]["title"] == "Hades"
        main.app.dependency_overrides[main.get_current_user] = lambda: bob
        assert client.delete(f"/favorites/{created.json()['id']}").status_code == 404
    finally:
        main.app.dependency_overrides.clear()


def test_public_profile_hides_private_favorites_from_anonymous_viewer():
    import app.main as main
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine); db = sessionmaker(bind=engine)()
    owner = User(email="private-owner@example.test", display_name="Owner", favorites_visibility="private")
    db.add(owner); db.commit()
    main.app.dependency_overrides[main.get_db] = lambda: db
    try:
        response = TestClient(main.app).get(f"/profiles/{owner.profile_id}")
        assert response.status_code == 200
        assert response.json()["favorites"] == {"state": "hidden", "message": "This section is private."}
    finally:
        main.app.dependency_overrides.clear()


def test_friends_only_profile_block_is_ready_for_confirmed_friend_only():
    from app.database import FavoriteItem
    from app.social import create_friend_request, public_profile_payload, transition_friend_request

    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    owner = User(email="owner-friends@example.test", display_name="Owner", favorites_visibility="friends")
    friend = User(email="friend-profile@example.test", display_name="Friend")
    stranger = User(email="stranger-profile@example.test", display_name="Stranger")
    db.add_all([owner, friend, stranger]); db.commit()
    db.add(FavoriteItem(user_id=owner.id, identity_kind="rawg", identity_value="30", title="Hades", cover_url="https://cover")); db.commit()
    request = create_friend_request(db, friend, profile_id=owner.profile_id, friend_code=None)
    transition_friend_request(db, owner.id, request.id, "accept")

    assert public_profile_payload(db, friend, owner)["favorites"]["state"] == "ready"
    hidden = public_profile_payload(db, stranger, owner)["favorites"]
    assert hidden == {"state": "hidden", "message": "This section is private."}
    assert "Hades" not in str(hidden)
