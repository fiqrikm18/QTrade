"""LLM response cache."""

import asyncio

import pytest_asyncio

from app.infrastructure.cache.llm_cache import LLMCache, make_cache_key


def test_make_cache_key_stable_and_content_sensitive():
    k1 = make_cache_key("explain", {"ticker": "BBCA"}, "gpt-4o-mini")
    k2 = make_cache_key("explain", {"ticker": "BBCA"}, "gpt-4o-mini")
    k3 = make_cache_key("explain", {"ticker": "BBRI"}, "gpt-4o-mini")
    assert k1 == k2
    assert k1 != k3


@pytest_asyncio.fixture
async def redis_client():
    """Redis client for testing."""
    import redis.asyncio as redis

    from app.config.settings import get_settings

    settings = get_settings()
    client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    yield client
    await client.flushdb()
    await client.aclose()


async def test_cache_get_set(redis_client):
    """Cache round-trip stores and retrieves value."""
    cache = LLMCache()
    await cache.set("test_key", "cached_response")
    val = await cache.get("test_key")
    assert val == "cached_response"


async def test_cache_miss_returns_none(redis_client):
    cache = LLMCache()
    val = await cache.get("nonexistent")
    assert val is None


async def test_cache_ttl_expires(redis_client):
    """Entries expire after TTL."""
    cache = LLMCache()
    await cache.set("expiring", "value", ttl=1)
    await asyncio.sleep(1.1)
    val = await cache.get("expiring")
    assert val is None
