"""Stock-score repository: idempotent upsert + Redis scan cache."""

import json
from datetime import date
from typing import Any, cast

import polars as pl
import redis.asyncio as redis
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import StockScore, TechnicalFeature

_SCAN_CACHE_TTL = 86400  # 24h, docs/data-pipeline.md §10


class StockScoreRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert_scores(self, rows: list[dict[str, object]]) -> int:
        """Idempotent upsert keyed on (ticker, asof_date, profile, scoring_version).

        ``created_at`` is left to the DB default (append-only fact); only the
        derived score columns + ``updated_at`` advance on conflict.
        Returns the number of rows affected.
        """
        if not rows:
            return 0
        stmt = pg_insert(StockScore).values(rows)
        set_: dict[str, Any] = {
            col: stmt.excluded[col]
            for col in rows[0]
            if col
            not in {"ticker", "asof_date", "profile", "scoring_version", "created_at"}
        }
        set_["updated_at"] = func.now()
        upsert = stmt.on_conflict_do_update(
            index_elements=["ticker", "asof_date", "profile", "scoring_version"],
            set_=set_,
        )
        result = await self._session.execute(upsert)
        await self._session.flush()
        rc = cast("int | None", getattr(result, "rowcount", None))
        return rc or 0

    async def upsert_technical_features(
        self, rows: list[dict[str, object]], asof: date
    ) -> int:
        """Idempotent latest-only upsert keyed on (ticker, asof_date, feature_version).

        Older scan rows are left untouched (append-only); the newest scan date
        wins for reads. Returns rows affected.
        """
        if not rows:
            return 0
        stmt = pg_insert(TechnicalFeature).values(rows)
        set_: dict[str, Any] = {
            col: stmt.excluded[col]
            for col in rows[0]
            if col not in {"ticker", "asof_date", "feature_version", "created_at"}
        }
        set_["updated_at"] = func.now()
        upsert = stmt.on_conflict_do_update(
            index_elements=["ticker", "asof_date", "feature_version"],
            set_=set_,
        )
        result = await self._session.execute(upsert)
        await self._session.flush()
        rc = cast("int | None", getattr(result, "rowcount", None))
        return rc or 0

    async def latest_technical_features(self, ticker: str) -> dict[str, object] | None:
        """Newest feature row for ``ticker`` (any version), else None."""
        row = (
            await self._session.execute(
                select(TechnicalFeature.indicators)
                .where(TechnicalFeature.ticker == ticker)
                .order_by(TechnicalFeature.asof_date.desc())
                .limit(1)
            )
        ).first()
        if row is None or row[0] is None:
            return None
        return row[0]

    async def count_scores(self, asof: date, profile: str) -> int:
        n = await self._session.scalar(
            select(func.count())
            .select_from(StockScore)
            .where(StockScore.asof_date == asof)
            .where(StockScore.profile == profile)
        )
        return int(n or 0)

    async def latest_feature_frame(self, tickers: list[str]) -> pl.DataFrame | None:
        """Feature rows for ``tickers`` at the latest persisted asof date."""
        latest = (
            await self._session.execute(
                select(TechnicalFeature.asof_date)
                .where(TechnicalFeature.ticker.in_(tickers))
                .order_by(TechnicalFeature.asof_date.desc())
                .limit(1)
            )
        ).scalar()
        if latest is None:
            return None
        rows = (
            (
                await self._session.execute(
                    select(TechnicalFeature)
                    .where(
                        TechnicalFeature.ticker.in_(tickers),
                        TechnicalFeature.asof_date == latest,
                    )
                    .order_by(TechnicalFeature.ticker)
                )
            )
            .scalars()
            .all()
        )
        records = [
            {"ticker": r.ticker, "asof_date": r.asof_date.isoformat(), **r.indicators}
            for r in rows
        ]
        if not records:
            return None
        return pl.DataFrame(records)


async def cache_scan_rankings(
    redis_url: str,
    profile: str,
    asof: date,
    ranking: list[tuple[str, float]],
    scoring_version: str,
    rows_written: int,
    *,
    top_n: int | None = None,
) -> str:
    """Persist the top-N ranking in Redis under ``scan:{profile}:{asof}``.

    Returns the cache key. TTL = 24h so a missed scan surfaces stale-data state
    to the terminal (docs/data-pipeline.md §10, §37) rather than serving old.
    """
    payload = list(ranking)
    if top_n is not None:
        payload = payload[:top_n]
    body = json.dumps(
        {
            "asof": asof.isoformat(),
            "profile": profile,
            "scoring_version": scoring_version,
            "rows_written": rows_written,
            "ranking": [{"ticker": t, "score": round(float(s), 4)} for t, s in payload],
        }
    )
    key = f"scan:{profile}:{asof.isoformat()}"
    # ponytail: redis-py 5 stubs lack a precise from_url return signature under
    # pyright strict; this is a third-party typing gap (redis.Redis is accurate).
    rc: redis.Redis = redis.Redis.from_url(redis_url)  # pyright: ignore[reportUnknownMemberType]
    try:
        await rc.setex(key, _SCAN_CACHE_TTL, body)
    finally:
        await rc.close()
    return key
