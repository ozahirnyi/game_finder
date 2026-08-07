import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.database import FavoriteItem, User
from app.schemas import FavoriteItemCreate


def list_favorites(db: Session, user_id: uuid.UUID) -> list[FavoriteItem]:
    return db.query(FavoriteItem).filter_by(user_id=user_id).order_by(FavoriteItem.created_at.desc()).all()


def create_favorite(db: Session, user: User, data: FavoriteItemCreate) -> FavoriteItem:
    if db.query(FavoriteItem).filter_by(user_id=user.id, identity_kind=data.identity_kind, identity_value=data.identity_value).first():
        raise HTTPException(status_code=409, detail="This game is already a favorite.")
    item = FavoriteItem(user_id=user.id, **data.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return item


def delete_favorite(db: Session, user_id: uuid.UUID, item_id: uuid.UUID) -> bool:
    item = db.query(FavoriteItem).filter_by(id=item_id, user_id=user_id).first()
    if item is None:
        return False
    db.delete(item); db.commit()
    return True
