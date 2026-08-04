import pytest


def test_normalize_igdb_game_uses_igdb_identity_and_steam_external_id():
    from app.integrations.igdb import normalize_igdb_game

    result = normalize_igdb_game(
        {
            "id": 274755,
            "name": "Hades II",
            "first_release_date": 1712880000,
            "cover": {"url": "//images.igdb.com/igdb/image/upload/t_thumb/cover.jpg"},
            "genres": [{"name": "RPG"}],
            "platforms": [{"name": "PC (Microsoft Windows)"}],
            "external_games": [{"category": 1, "uid": "1145350"}],
        }
    )

    assert result["id"] == 274755
    assert result["name"] == "Hades II"
    assert result["background_image"].startswith("https://")
    assert result["steam_appid"] == 1145350
    assert result["genres"] == ["RPG"]


@pytest.mark.anyio
async def test_igdb_missing_credentials_is_a_service_error(monkeypatch):
    monkeypatch.delenv("IGDB_CLIENT_ID", raising=False)
    monkeypatch.delenv("IGDB_CLIENT_SECRET", raising=False)
    from app.integrations.igdb import IGDBError, fetch_igdb_games

    with pytest.raises(IGDBError, match="IGDB_CLIENT_ID"):
        await fetch_igdb_games("Hades")
