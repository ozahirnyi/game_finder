import uuid
from types import SimpleNamespace

from app import main


def test_public_friend_response_includes_steam_persona_name():
    user = SimpleNamespace(
        id=uuid.uuid4(),
        public_id="steam-user-public-id",
        email="steam-user@steam.invalid",
        display_name="Playfinder name",
        bio=None,
        steam_avatar=None,
        steam_persona_name="Steam Persona",
    )

    response = main.public_user_response(user)

    assert response.public_id == "steam-user-public-id"
    assert response.steam_persona_name == "Steam Persona"
