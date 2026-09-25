from alembic.config import Config
from alembic.script import ScriptDirectory
import pytest


def test_alembic_has_a_single_upgrade_head():
    script = ScriptDirectory.from_config(Config("alembic.ini"))

    assert script.get_heads() == ["c6d8e0f2a4b6"]
    assert script.get_revision("c6d8e0f2a4b6").down_revision == "e5f6a7b8c9d0"


def test_typed_invite_message_migration_preserves_existing_messages(monkeypatch):
    import uuid

    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import Column, MetaData, String, Table, Uuid, create_engine, inspect, text

    engine = create_engine("sqlite://")
    metadata = MetaData()
    Table("game_invites", metadata, Column("id", Uuid(), primary_key=True))
    messages = Table(
        "messages",
        metadata,
        Column("id", Uuid(), primary_key=True),
        Column("conversation_id", Uuid(), nullable=False),
        Column("sender_id", Uuid(), nullable=False),
        Column("body", String(2000), nullable=False),
    )
    metadata.create_all(engine)
    message_id = uuid.uuid4()
    with engine.begin() as connection:
        connection.execute(
            messages.insert().values(
                id=message_id,
                conversation_id=uuid.uuid4(),
                sender_id=uuid.uuid4(),
                body="Existing history",
            )
        )
        migration = ScriptDirectory.from_config(Config("alembic.ini")).get_revision("c6d8e0f2a4b6").module
        monkeypatch.setattr(migration, "op", Operations(MigrationContext.configure(connection)))
        migration.upgrade()
        assert connection.execute(text("select kind from messages")).scalar_one() == "text"
        assert {column["name"] for column in inspect(connection).get_columns("messages")} >= {
            "kind",
            "game_invite_id",
        }
        assert inspect(connection).get_foreign_keys("messages")[0]["referred_table"] == "game_invites"
        migration.downgrade()
        assert {column["name"] for column in inspect(connection).get_columns("messages")} == {
            "id",
            "conversation_id",
            "sender_id",
            "body",
        }
        assert connection.execute(text("select body from messages")).scalar_one() == "Existing history"
    engine.dispose()


def test_background_jobs_lease_migration_accepts_the_table_left_by_the_rolled_back_release(monkeypatch):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import Column, MetaData, String, Table, create_engine

    engine = create_engine("sqlite://")
    metadata = MetaData()
    Table("background_jobs", metadata, Column("status", String(16), nullable=False))
    metadata.create_all(engine)
    migration = ScriptDirectory.from_config(Config("alembic.ini")).get_revision("e5f6a7b8c9d0").module
    with engine.begin() as connection:
        monkeypatch.setattr(migration, "op", Operations(MigrationContext.configure(connection)))
        migration.upgrade()
        columns = {column["name"] for column in connection.dialect.get_columns(connection, "background_jobs")}
        assert {"lease_token", "lease_expires_at"} <= columns
    engine.dispose()


def test_social_contact_migration_round_trip(monkeypatch):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import create_engine, inspect
    from app.database import Base

    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    script = ScriptDirectory.from_config(Config("alembic.ini"))
    migration = script.get_revision("af42c8d9e510").module
    with engine.begin() as connection:
        monkeypatch.setattr(migration, "op", Operations(MigrationContext.configure(connection)))
        migration.downgrade()
        assert "social_blocks" not in inspect(connection).get_table_names()
        assert "client_message_id" not in {column["name"] for column in inspect(connection).get_columns("messages")}
        migration.upgrade()
        assert "steam_friend_suppressions" in inspect(connection).get_table_names()
        assert "client_message_id" in {column["name"] for column in inspect(connection).get_columns("messages")}
        assert "uq_message_sender_client" in {item["name"] for item in inspect(connection).get_unique_constraints("messages")}
    engine.dispose()


@pytest.mark.parametrize("existing_conversation", [False, True])
def test_legacy_messages_migrate_into_existing_conversation_once(monkeypatch, existing_conversation):
    import uuid
    from datetime import datetime, timezone
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session
    from app.database import Base, User, Friendship, DirectMessage, Conversation, Message

    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        first, second = User(email="migration-first@test"), User(email="migration-second@test")
        db.add_all([first, second]); db.flush()
        low, high = sorted([first.id, second.id])
        friendship = Friendship(user_low_id=low, user_high_id=high)
        conversation = Conversation(user_low_id=low, user_high_id=high)
        db.add(friendship)
        if existing_conversation:
            db.add(conversation)
        db.flush()
        legacy_id = uuid.uuid4()
        db.add(DirectMessage(id=legacy_id, friendship_id=friendship.id, author_id=first.id,
                             text="Existing history", created_at=datetime.now(timezone.utc)))
        if existing_conversation:
            db.add(Message(conversation_id=conversation.id, sender_id=second.id, body="Canonical history"))
        conversation_id = conversation.id
        db.commit()
    migration = ScriptDirectory.from_config(Config("alembic.ini")).get_revision("af42c8d9e510").module
    with engine.begin() as connection:
        monkeypatch.setattr(migration, "op", Operations(MigrationContext.configure(connection)))
        migration.downgrade()
        migration.upgrade()
        migration.migrate_legacy_messages(connection)
        rows = connection.execute(select(Message.__table__)).mappings().all()
        assert len(rows) == (2 if existing_conversation else 1)
        legacy = next(row for row in rows if row["id"] == legacy_id)
        if existing_conversation:
            assert legacy["conversation_id"] == conversation_id
        else:
            assert connection.execute(select(Conversation.id)).scalar_one() == legacy["conversation_id"]
        assert legacy["body"] == "Existing history"
    engine.dispose()
