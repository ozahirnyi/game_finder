import pytest
from pydantic import ValidationError

from app.schemas import UserProfileUpdate


def test_profile_update_accepts_160_character_bio():
    assert UserProfileUpdate(bio="a" * 160).bio == "a" * 160
    assert UserProfileUpdate(bio="a" * 159 + "😀").bio == "a" * 159 + "😀"


def test_profile_update_rejects_bio_over_160_characters():
    with pytest.raises(ValidationError):
        UserProfileUpdate(bio="a" * 161)
