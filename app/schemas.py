from pydantic import BaseModel, Field
from datetime import datetime


class GameCreate(BaseModel):
    title: str
    notes: str | None = None

class GameRead(BaseModel):
    id: str
    title: str
    notes: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class GameUpdate(BaseModel):
    title: str | None = None
    notes: str | None = None