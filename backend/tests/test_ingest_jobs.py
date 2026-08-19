"""Ingestion jobs: watermark semantics + idempotency (providers mocked)."""

from datetime import UTC, datetime

import polars as pl
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import (
    EconomicEvent,
    EconomicIndicator,
    IngestionCheckpoint,
    NewsArticle,
    NewsEntity,
)
from app.infrastructure.repositories.checkpoint_repo import CheckpointRepository


@pytest_asyncio.fixture(loop_scope="session", scope="function")
async def clean_tables(session: AsyncSession):
    for model in (
        NewsEntity,
        NewsArticle,
        EconomicEvent,
        EconomicIndicator,
        IngestionCheckpoint,
    ):
        await session.execute(delete(model))
    await session.commit()


def _indicator_rows() -> pl.DataFrame:
    from datetime import date

    return pl.DataFrame(
        {
            "indicator": ["usd_idr"],
            "asof_date": [date(2026, 8, 18)],
            "value": [17836.0],
            "unit": [""],
            "source": ["BI"],
        }
    )


def _event_rows() -> pl.DataFrame:
    t0 = datetime(2026, 8, 20, 14, 0, tzinfo=UTC)
    return pl.DataFrame(
        {
            "event": ["BI Rate Decision"],
            "country": ["ID"],
            "scheduled_at": [t0],
            "importance": [3],
            "category": ["CENTRAL_BANK"],
            "previous": [5.75],
            "consensus": [5.75],
            "actual": [None],
            "status": ["scheduled"],
            "source": ["BI"],
        }
    )


def _news_rows() -> pl.DataFrame:
    return pl.DataFrame(
        {
            "title": ["BBCA posts strong profit"],
            "source": ["test.example"],
            "published_at": [datetime(2026, 8, 19, 9, 0, tzinfo=UTC)],
            "url": ["https://test.example/1"],
            "summary": ["results"],
            "tickers": [["BBCA"]],
        }
    )


async def test_ingest_macro_writes_and_advances_watermark(
    session: AsyncSession, clean_tables, monkeypatch
):
    from app.interfaces.workers import jobs as jobs_module

    monkeypatch.setattr(
        jobs_module,
        "_macro_frame",
        lambda start, end: _indicator_rows(),
    )
    written = await jobs_module._ingest_macro()
    assert written == 1
    repo = CheckpointRepository(session)
    assert await repo.get("ingest_macro") is not None
    count = (await session.execute(select(EconomicIndicator))).scalars().all()
    assert len(count) == 1


async def test_ingest_calendar_writes(session: AsyncSession, clean_tables, monkeypatch):
    from app.interfaces.workers import jobs as jobs_module

    monkeypatch.setattr(
        jobs_module,
        "_calendar_frame",
        lambda start, end: _event_rows(),
    )
    assert await jobs_module._ingest_calendar() == 1
    assert (await session.execute(select(EconomicEvent))).scalars().all()


async def test_ingest_news_writes_and_entities(
    session: AsyncSession, clean_tables, monkeypatch
):
    from app.interfaces.workers import jobs as jobs_module

    monkeypatch.setattr(
        jobs_module,
        "_news_frame",
        lambda since: _news_rows(),
    )
    assert await jobs_module._ingest_news() == 1
    articles = (await session.execute(select(NewsArticle))).scalars().all()
    assert len(articles) == 1
    entities = (await session.execute(select(NewsEntity))).scalars().all()
    assert len(entities) == 1
    assert entities[0].ticker == "BBCA"
