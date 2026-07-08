from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional
import uuid


class GameCreate(BaseModel):
    title: str = Field(max_length=255)
    notes: Optional[str] = Field(default=None, max_length=255)
    info: Optional[str] = Field(default=None, max_length=500)


class GameRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    notes: Optional[str] = None
    info: Optional[str] = None
    created_at: datetime


class GameUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = Field(default=None, max_length=255)


class UserCreate(BaseModel):
    email: str
    password: str


class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    created_at: datetime


class UserLogin(BaseModel):
    email: str
    password: str


class RecommendationRequest(BaseModel):
    prompt: str
    liked_game_ids: list[int] = Field(default_factory=list)


class RecommendationItem(BaseModel):
    title: str
    reason: str
    tags: list[str] = Field(default_factory=list)


class RecommendationResponse(BaseModel):
    recommendations: list[RecommendationItem] = Field(default_factory=list)


class GameSearchItem(BaseModel):
    id: int | None = None
    name: str | None = None
    released: str | None = None
    background_image: str | None = None


class GameSearchResponse(BaseModel):
    results: list[GameSearchItem]


class GameCatalogDetail(BaseModel):
    id: int
    name: str
    released: str | None = None
    background_image: str | None = None
    description_raw: str | None = None
    rating: float | None = None
    genres: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)
