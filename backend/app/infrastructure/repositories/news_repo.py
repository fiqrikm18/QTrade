"""Repository for news + news_entities (docs/data-model.md §11)."""

from __future__ import annotations

from datetime import UTC, datetime

import polars as pl
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import NewsArticle, NewsEntity


class NewsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert_news(self, df: pl.DataFrame) -> int:
        if df.is_empty():
            return 0
        now = datetime.now(UTC)
        total = 0
        for rec in df.to_dicts():
            stmt = pg_insert(NewsArticle).values(
                {
                    "title": rec["title"],
                    "source": rec["source"],
                    "published_at": rec["published_at"],
                    "url": rec["url"],
                    "summary": rec["summary"],
                    "category": "MARKET",
                    "sentiment": None,
                    "impact": None,
                    "available_at": now,
                }
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["source", "url"],
                set_={
                    "title": stmt.excluded["title"],
                    "published_at": stmt.excluded["published_at"],
                    "summary": stmt.excluded["summary"],
                },
            ).returning(NewsArticle.id)
            article_id = (await self._session.execute(stmt)).scalar_one_or_none()
            if article_id is not None:
                total += 1
            tickers: list[str] = rec["tickers"] or []
            if article_id is not None and tickers:
                for tk in tickers:
                    ent = pg_insert(NewsEntity).values(article_id=article_id, ticker=tk)
                    ent = ent.on_conflict_do_nothing(
                        index_elements=["article_id", "ticker"]
                    )
                    await self._session.execute(ent)
        await self._session.commit()
        return total

    async def latest_news(self, limit: int = 50) -> list[dict[str, object]]:
        rows = (
            await self._session.execute(
                select(
                    NewsArticle.id,
                    NewsArticle.title,
                    NewsArticle.source,
                    NewsArticle.published_at,
                    NewsArticle.url,
                    NewsArticle.summary,
                    NewsArticle.category,
                    NewsArticle.sentiment,
                    NewsArticle.impact,
                )
                .order_by(NewsArticle.published_at.desc())
                .limit(limit)
            )
        ).fetchall()
        out: list[dict[str, object]] = []
        for r in rows:
            published = r.published_at.astimezone(UTC)
            entities = (
                (
                    await self._session.execute(
                        select(NewsEntity.ticker).where(NewsEntity.article_id == r.id)
                    )
                )
                .scalars()
                .all()
            )
            out.append(
                {
                    "id": str(r.id),
                    "date": published.date().isoformat(),
                    "time": published.strftime("%H:%M"),
                    "title": r.title,
                    "source": r.source,
                    "category": r.category,
                    "impact": r.impact,
                    "sentiment": r.sentiment,
                    "tickers": list(entities),
                    "summary": r.summary,
                }
            )
        return out
