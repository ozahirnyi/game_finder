"""Read English video-game labels for localized catalog search, never ownership."""
import asyncio
import hashlib
import re

import httpx

from app.psn_catalog_matcher import normalize_psn_catalog_identity
from app.redis_client import cache_get, cache_set


async def fetch_localized_catalog_titles(titles: list[str]) -> dict[str, list[str] | None]:
    result = {}
    missing = []
    for title in dict.fromkeys(titles):
        key = 'localized_catalog_titles_v2:' + hashlib.sha256(title.encode()).hexdigest()
        try:
            cached = await cache_get(key)
        except Exception:
            cached = None
        if isinstance(cached, list) and all(isinstance(value, str) for value in cached):
            result[title] = cached
        else:
            missing.append((title, key))
    semaphore = asyncio.Semaphore(2)
    async with httpx.AsyncClient(timeout=8, headers={'User-Agent': 'PlayFinder/1.0 (video game catalog lookup)'}) as client:
        async def search(title):
            if not re.search(r'[\u0400-\u04ff]', title):
                return []
            language = 'uk' if re.search('[їєіґЇЄІҐ]', title) else 'ru'
            async with semaphore:
                try:
                    response = await client.get(f'https://{language}.wikipedia.org/w/api.php', params={
                        'action': 'query', 'format': 'json', 'generator': 'search', 'gsrnamespace': 0,
                        'gsrsearch': normalize_psn_catalog_identity(title), 'gsrlimit': 3, 'prop': 'pageprops',
                    })
                    response.raise_for_status()
                    data = response.json()
                    if 'error' in data:
                        return None
                    return [entity_id for page in data.get('query', {}).get('pages', {}).values()
                            if re.fullmatch(r'Q[1-9]\d*', entity_id := page.get('pageprops', {}).get('wikibase_item', ''))]
                except (httpx.HTTPError, ValueError, TypeError, AttributeError):
                    return None
        rows = dict(zip((title for title, _ in missing), await asyncio.gather(*(search(title) for title, _ in missing))))
        ids = list(dict.fromkeys(value for values in rows.values() if values for value in values))
        entities, unavailable = {}, set()
        for offset in range(0, len(ids), 50):
            batch = ids[offset:offset + 50]
            try:
                response = await client.get('https://www.wikidata.org/w/api.php', params={
                    'action': 'wbgetentities', 'ids': '|'.join(batch), 'props': 'labels|claims', 'languages': 'en|mul', 'format': 'json',
                })
                response.raise_for_status()
                entities.update(response.json()['entities'])
            except (httpx.HTTPError, ValueError, KeyError, TypeError):
                unavailable.update(batch)
    for title, key in missing:
        entity_ids = rows[title]
        if entity_ids is None or unavailable.intersection(entity_ids):
            result[title] = None
            continue
        names = []
        for entity_id in entity_ids:
            entity = entities.get(entity_id, {})
            is_game = any(claim.get('mainsnak', {}).get('datavalue', {}).get('value', {}).get('id') == 'Q7889'
                          for claim in entity.get('claims', {}).get('P31', []))
            labels = entity.get('labels', {})
            name = (labels.get('en') or labels.get('mul') or {}).get('value')
            if is_game and isinstance(name, str) and name.strip():
                names.append(name.strip())
        result[title] = list(dict.fromkeys(names))[:3]
        try:
            await cache_set(key, result[title], 604800 if names else 3600)
        except Exception:
            pass
    return result
