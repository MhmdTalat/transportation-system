import hashlib
import json
from collections.abc import Callable
from typing import TypeVar

from django.core.cache import cache
from django.core.serializers.json import DjangoJSONEncoder


T = TypeVar('T')


def get_or_set(namespace: str, key: object, ttl: int, fetch: Callable[[], T]) -> T:
    version_key = f'{namespace}:version'
    try:
        version = cache.get(version_key, 1)
        if version is None:
            cache.add(version_key, 1, timeout=None)
            version = 1
    except Exception:
        version = 1

    serialized_key = json.dumps(key, sort_keys=True, default=str, cls=DjangoJSONEncoder)
    digest = hashlib.sha256(serialized_key.encode('utf-8')).hexdigest()
    cache_key = f'{namespace}:v{version}:{digest}'

    try:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
    except Exception:
        pass

    value = fetch()
    try:
        cache.set(cache_key, value, timeout=ttl)
    except Exception:
        pass
    return value


def invalidate(namespace: str) -> None:
    try:
        if not cache.add(f'{namespace}:version', 1, timeout=None):
            cache.incr(f'{namespace}:version')
    except Exception:
        try:
            cache.set(f'{namespace}:version', 1, timeout=None)
        except Exception:
            pass
