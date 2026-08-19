"""NewsRepository upsert + latest_news shape."""

from datetime import UTC, datetime

import polars as pl
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import NewsArticle, NewsEntity
from app.infrastructure.repositories.news_repo import NewsRepository


def _news_frame() -> pl.DataFrame:
    t0 = datetime(2026, 8, 19, 9, 0, tzinfo=UTC)
    return pl.DataFrame(
        {
            "title": ["BBCA posts strong profit", "Market up"],
            "source": ["news.google.com", "antaranews.com"],
            "published_at": [t0, t0],
            "url": ["https://a.example/1", "https://a.example/2"],
            "summary": ["Bank Central Asia results.", "IDX gained."],
            "tickers": [["BBCA"], []],
        }
    )


async def test_upsert_news_and_entities(session: AsyncSession):
    await session.execute(delete(NewsEntity))
    await session.execute(delete(NewsArticle))
    await session.commit()
    repo = NewsRepository(session)
    assert await repo.upsert_news(_news_frame()) == 2
    assert await repo.upsert_news(_news_frame()) == 2  # idempotent

    rows = await repo.latest_news(limit=10)
    assert len(rows) == 2
    first = next(r for r in rows if r["tickers"] == ["BBCA"])
    assert first["id"] is not None
    assert first["title"] == "BBCA posts strong profit"
    assert first["date"] == "2026-08-19"
    assert first["time"] == "09:00"
    assert first["impact"] is None
    assert first["sentiment"] is None
    assert first["category"] == "MARKET"
    assert first["source"] == "news.google.com"


async def test_latest_news_empty(session: AsyncSession):
    await session.execute(delete(NewsEntity))
    await session.execute(delete(NewsArticle))
    await session.commit()
    repo = NewsRepository(session)
    assert await repo.latest_news(limit=10) == []
