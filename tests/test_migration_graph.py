from alembic.config import Config
from alembic.script import ScriptDirectory
import pytest


def test_alembic_has_a_single_upgrade_head():
    script = ScriptDirectory.from_config(Config("alembic.ini"))

    assert script.get_heads() == ["af42c8d9e510"]


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
