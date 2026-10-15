import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest


@pytest.fixture(autouse=True)
def no_external_localized_search(monkeypatch):
    from app import catalog_title_translation as service
    monkeypatch.setattr(service, 'fetch_localized_catalog_titles', AsyncMock(return_value={}), raising=False)


def test_public_catalog_title_lookup_works_without_ai_credit(monkeypatch):
    from app import catalog_title_translation as service
    lookup = AsyncMock(return_value={'Южный Парк': ['South Park: The Stick of Truth']})
    monkeypatch.setattr(service, 'fetch_localized_catalog_titles', lookup)
    monkeypatch.setattr(service, 'get_client', lambda: (_ for _ in ()).throw(AssertionError('AI must not be required')))
    assert asyncio.run(service.translate_library_titles(['Южный Парк'])) == {'Южный Парк': ['South Park: The Stick of Truth']}


def test_translation_batches_are_bounded_and_only_return_input_rows(monkeypatch):
    from app import catalog_title_translation as service
    calls = []
    def create(**kwargs):
        titles = json.loads(kwargs['input'][1]['content'])
        calls.append(titles)
        return SimpleNamespace(output_text=json.dumps({'titles': [
            {'index': i, 'suggestions': ['South Park: The Stick of Truth', '', 'South Park: The Stick of Truth']}
            for i in range(len(titles))
        ] + [{'index': 999, 'suggestions': ['Injected game']}] }))
    monkeypatch.setattr(service, 'get_client', lambda: SimpleNamespace(responses=SimpleNamespace(create=create)))
    result = asyncio.run(service.translate_library_titles([f'Игра {i}' for i in range(23)]))
    assert sorted(len(call) for call in calls) == [3, 10, 10]
    assert len(result) == 23
    assert all(values == ['South Park: The Stick of Truth'] for values in result.values())


def test_invalid_translation_response_reports_unavailable_without_invented_names(monkeypatch):
    from app import catalog_title_translation as service
    monkeypatch.setattr(service, 'get_client', lambda: SimpleNamespace(responses=SimpleNamespace(
        create=lambda **kwargs: SimpleNamespace(output_text='not JSON'))))
    assert asyncio.run(service.translate_library_titles(['Южный Парк'])) == {'Южный Парк': None}
