import pytest

from app.genre_deals import _enrich_deal


@pytest.mark.parametrize("candidate", [
    {"id": 42, "name": "Same title", "steam_appid": 999},
    {"id": 42, "name": "Same title"},
    {"id": 42, "name": "Similar title"},
])
def test_deal_title_does_not_establish_catalog_identity(candidate):
    deal, genres = _enrich_deal({"steam_appid": 620, "name": "Same title"}, [candidate])
    assert deal["id"] is None
    assert deal["steam_appid"] == 620
    assert genres == set()


def test_deal_uses_verified_appid_despite_different_catalog_spelling():
    deal, genres = _enrich_deal({"steam_appid": 620, "name": "Store title"}, [
        {"id": 99, "name": "Store title", "steam_appid": 999},
        {"id": 72, "name": "Canonical title", "steam_appid": 620, "genres": ["Puzzle"]},
    ])
    assert deal["id"] == 72
    assert genres == {"puzzle"}
