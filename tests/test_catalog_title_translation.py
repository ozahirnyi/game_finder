import asyncio
from unittest.mock import AsyncMock, Mock
import pytest


@pytest.mark.parametrize('localized', [
    {'Южный Парк': ['South Park: The Stick of Truth']},
    {'Южный Парк': []},
    {'Южный Парк': None},
])
def test_library_title_lookup_never_uses_openai(monkeypatch, localized):
    from app import catalog_title_translation as service
    from app import openai_client

    lookup = AsyncMock(return_value=localized)
    client = Mock(side_effect=AssertionError('Library matching must not spend API tokens'))
    monkeypatch.setattr(service, 'fetch_localized_catalog_titles', lookup)
    monkeypatch.setattr(openai_client, 'OpenAI', client)
    monkeypatch.setenv('OPENAI_API_KEY', 'test-key-must-not-be-used')

    result = asyncio.run(service.translate_library_titles(['Южный Парк', 'Южный Парк']))

    client.assert_not_called()
    lookup.assert_awaited_once_with(['Южный Парк'])
    assert result == localized


def test_library_title_lookup_handles_empty_input_without_ai(monkeypatch):
    from app import catalog_title_translation as service
    lookup = AsyncMock(return_value={})
    monkeypatch.setattr(service, 'fetch_localized_catalog_titles', lookup)
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)

    assert asyncio.run(service.translate_library_titles([])) == {}
