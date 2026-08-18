from __future__ import annotations

import hashlib
import json
from typing import Any

import redis.asyncio as redis

from app.config.settings import get_settings

_DEFAULT_TTL = 86400  # 24h


def make_cache_key(feature: str, context: dict[str, Any], model: str) -> str:
    """Stable hash of feature + sorted context + model."""
    material = feature + ":" + json.dumps(context, sort_keys=True) + ":" + model
    return "llm:" + hashlib.sha256(material.encode()).hexdigest()[:32]


class LLMCache:
    def __init__(self) -> None:
        settings = get_settings()
        self._redis = redis.Redis.from_url(  # type: ignore[attr-defined]
            settings.redis_url, decode_responses=True
        )

    async def get(self, key: str) -> str | None:
        return await self._redis.get(key)  # type: ignore[return-value]

    async def set(self, key: str, value: str, ttl: int = _DEFAULT_TTL) -> None:
        await self._redis.set(key, value, ex=ttl)

    async def close(self) -> None:
        await self._redis.aclose()
