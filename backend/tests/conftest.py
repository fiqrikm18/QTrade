"""Pytest isolation + shared fixtures.

``ihsg_quant_test`` is migrated via alembic (see README/dev docs). Setting the
DSN before any app import keeps the dev database untouched by destructive test
fixtures (e.g. ``delete(StockScore)`` in scanner/api tests).
"""

import asyncio
import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config.settings import get_settings
from app.main import create_app

os.environ["POSTGRES_DSN"] = (
    "postgresql+asyncpg://ihsg:ihsg@localhost:5432/ihsg_quant_test"
)

_settings = get_settings()


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(loop_scope="session", scope="function")
async def session():
    """Per-test async session on the session loop; uncommitted changes roll back."""
    engine = create_async_engine(_settings.postgres_dsn)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as s:
        yield s


@pytest_asyncio.fixture(loop_scope="session", scope="function")
async def client():
    """HTTPX client bound to the test FastAPI app (reads test DB via get_session)."""
    app = create_app()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
