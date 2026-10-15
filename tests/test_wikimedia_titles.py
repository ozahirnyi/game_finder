import asyncio
from unittest.mock import AsyncMock
import httpx
import pytest


@pytest.fixture
def provider(monkeypatch):
    from app.integrations import wikimedia_titles as service
    monkeypatch.setattr(service, 'cache_get', AsyncMock(return_value=None))
    monkeypatch.setattr(service, 'cache_set', AsyncMock())
    def install(handler):
        class Client:
            def __init__(self, **kwargs):
                pass
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
            async def get(self, url, params):
                request = httpx.Request('GET', url, params=params)
                response = handler(request)
                response.request = request
                return response
        monkeypatch.setattr(service.httpx, 'AsyncClient', Client)
    return service, install


@pytest.mark.parametrize('label_language', ['en', 'mul'])
def test_localized_full_text_search_only_returns_verified_video_game_labels(provider, label_language):
    service, install = provider
    def handler(request):
        if request.url.host == 'ru.wikipedia.org':
            assert request.url.params['gsrsearch'] == 'южный парк палка истины'
            assert request.url.params['gsrlimit'] == '3'
            return httpx.Response(200, json={'query': {'pages': {
                '1': {'pageprops': {'wikibase_item': 'Q1'}},
                '2': {'pageprops': {'wikibase_item': 'Q2'}},
            }}})
        assert request.url.host == 'www.wikidata.org'
        return httpx.Response(200, json={'entities': {
            'Q1': {'labels': {label_language: {'value': 'South Park: The Stick of Truth'}}, 'claims': {'P31': [
                {'mainsnak': {'datavalue': {'value': {'id': 'Q7889'}}}}
            ]}},
            'Q2': {'labels': {'en': {'value': 'Chef (South Park)'}}, 'claims': {}},
        }})
    install(handler)
    result = asyncio.run(service.fetch_localized_catalog_titles(['Южный Парк™: Палка Истины™']))
    assert result == {'Южный Парк™: Палка Истины™': ['South Park: The Stick of Truth']}


@pytest.mark.parametrize('status,payload,expected', [
    (503, {}, None), (200, {'query': {'pages': {}}}, []),
])
def test_empty_and_unavailable_localized_searches_remain_distinct(provider, status, payload, expected):
    service, install = provider
    install(lambda request: httpx.Response(status, json=payload))
    assert asyncio.run(service.fetch_localized_catalog_titles(['Игра'])) == {'Игра': expected}


def test_cached_translation_does_not_call_external_search(provider):
    service, install = provider
    service.cache_get.return_value = ['Known game']
    install(lambda request: (_ for _ in ()).throw(AssertionError('No network for cached title')))
    assert asyncio.run(service.fetch_localized_catalog_titles(['Игра'])) == {'Игра': ['Known game']}
