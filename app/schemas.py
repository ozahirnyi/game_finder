from pydantic import BaseModel


class GameCreate(BaseModel):
    title: str
    notes: str | None = None

class GameRead(BaseModel):
    id: str
    title: str
    notes: str | None = None

class GameUpdate(BaseModel):
    title: str | None = None
    notes: str | None = None