import time
import uuid
import os
from dotenv import load_dotenv
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import create_engine, String, DateTime, ForeignKey, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Mapped, mapped_column
from sqlalchemy.exc import OperationalError


load_dotenv()
echo = os.getenv("DEBUG", "false").lower() == "true"

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set")
engine = create_engine(DATABASE_URL, echo=echo)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def ensure_runtime_columns() -> None:
    inspector = inspect(engine)
    if "games" not in inspector.get_table_names():
        return

    game_columns = {column["name"] for column in inspector.get_columns("games")}
    if "info" in game_columns:
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE games ADD COLUMN info VARCHAR(500)"))
        conn.execute(
            text(
                """
                UPDATE games
                SET info = notes,
                    notes = NULL
                WHERE notes LIKE 'Released:%'
                   OR notes LIKE 'Rating:%'
                   OR notes LIKE 'Platforms:%'
                """
            )
        )


class Base(DeclarativeBase):
    pass


class Game(Base):
    __tablename__ = "games"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255))
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    info: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=lambda: datetime.now(timezone.utc))
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),ForeignKey("users.id"),nullable=False)

    def __repr__(self) -> str:
        return f"Game(id={self.id!r}, title={self.title!r}, notes={self.notes!r}, info={self.info!r}, created_at={self.created_at!r})"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255),nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255),nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=lambda: datetime.now(timezone.utc))



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def wait_for_db(engine):
    for i in range(30):
        try:
            with engine.connect():
                return
        except OperationalError:
            print(f"DB not ready... retry {i+1}/30")
            time.sleep(1)
    raise Exception("DB not ready after retries")
