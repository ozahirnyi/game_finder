from pydantic import BaseModel
from datetime import datetime


class GameCreate(BaseModel):
    title: str
    notes: str | None = None


class GameRead(BaseModel):
    id: str
    title: str
    notes: str | None = None
    created_at: datetime


class GameUpdate(BaseModel):
    title: str | None = None
    notes: str | None = None
