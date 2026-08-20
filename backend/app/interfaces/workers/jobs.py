"""RQ job functions for market-data ingestion and watchdog.

Job bodies are sync by RQ convention; the async ingestion service is driven
via ``asyncio.run``.
"""

import asyncio
import logging
from datetime import UTC, date, datetime, timedelta
from typing import cast

import polars as pl
import redis
from rq import Queue
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.application.services.market_data import ingest_ohlcv
from app.config.settings import get_settings
from app.infrastructure.database.models import FinancialStatement, Stock
from app.infrastructure.database.session import get_session
from app.infrastructure.providers.exceptions import NoDataError, ProviderError
from app.infrastructure.providers.factory import (
    build_fundamentals_provider,
    build_macro_provider,
    build_news_provider,
)
from app.infrastructure.repositories.checkpoint_repo import CheckpointRepository
from app.infrastructure.repositories.macro_repo import MacroRepository
from app.infrastructure.repositories.news_repo import NewsRepository

logger = logging.getLogger("app.workers")

_DEFAULT_QUEUE = "default"

_MACRO_CODES = [
    "us_10y",
    "us_2y",
    "fed_funds",
    "dxy",
    "sp500",
    "usd_idr",
]


def get_queue() -> Queue:
    return Queue(
        _DEFAULT_QUEUE,
        connection=redis.from_url(get_settings().redis_url),
    )


async def ingest_ohlcv_history(days: int = 5) -> int:
    if days < 1:
        raise ValueError("days must be at least 1")
    total = 0
    fetched = 0
    skipped = 0
    failed = 0
    today = date.today()
    start = today - timedelta(days=days)
    async for session in get_session():
        tickers: list[str] = list(
            (
                await session.execute(
                    select(Stock.ticker).where(Stock.is_active.is_(True))
                )
            )
            .scalars()
            .all()
        )
        for ticker in tickers:
            symbol = f"{ticker}.JK"
            try:
                rows, _report = await ingest_ohlcv(symbol, start, today, session)
                total += rows
                fetched += 1
            except NoDataError as exc:
                skipped += 1
                logger.warning("ingest %s skipped: %s", symbol, exc)
            except Exception:
                failed += 1
                logger.exception("ingest %s failed", symbol)

        try:
            rows, _report = await ingest_ohlcv(
                "^JKSE",
                start,
                today,
                session,
                storage_ticker="IHSG",
            )
            total += rows
            fetched += 1
        except NoDataError as exc:
            skipped += 1
            logger.warning("ingest IHSG skipped: %s", exc)
        except Exception:
            failed += 1
            logger.exception("ingest IHSG failed")

        log_summary = logger.warning if skipped or failed else logger.info
        log_summary(
            "OHLCV ingest complete: fetched=%d skipped=%d failed=%d rows=%d",
            fetched,
            skipped,
            failed,
            total,
        )
        if tickers and fetched == 0:
            raise ProviderError(
                "OHLCV ingestion fetched no data for any active symbol "
                f"(skipped={skipped}, failed={failed})"
            )
    return total


def ingest_ohlcv_daily() -> int:
    return asyncio.run(ingest_ohlcv_history())


def _macro_frame(start: date, end: date) -> pl.DataFrame:
    provider, _calendar = build_macro_provider()
    return provider.get_indicators(_MACRO_CODES, start, end)


def _news_frame(since: datetime) -> pl.DataFrame:
    provider = build_news_provider()
    return provider.get_news(None, since)


def ingest_macro() -> int:
    return asyncio.run(_ingest_macro())


async def _ingest_macro() -> int:
    async for session in get_session():
        checkpoints = CheckpointRepository(session)
        repo = MacroRepository(session)
        now = datetime.now(UTC)
        watermark = await checkpoints.get("ingest_macro") or now - timedelta(days=365)
        # The configured FRED set mixes daily and monthly series. A 70-day
        # overlap ensures at least one monthly observation is fetched on
        # routine runs while idempotent upserts absorb duplicates.
        start = watermark.date() - timedelta(days=70)
        df = _macro_frame(start, date.today())
        written = await repo.upsert_indicators(df)
        # Monotonic: never move the watermark backward (clock skew / reruns).
        await checkpoints.set("ingest_macro", max(now, watermark))
        return written
    return 0


def ingest_news() -> int:
    return asyncio.run(_ingest_news())


async def _ingest_news() -> int:
    async for session in get_session():
        checkpoints = CheckpointRepository(session)
        repo = NewsRepository(session)
        now = datetime.now(UTC)
        watermark = await checkpoints.get("ingest_news") or now - timedelta(hours=3)
        since = watermark - timedelta(hours=1)  # overlap window
        df = _news_frame(since)
        written = await repo.upsert_news(df)
        await checkpoints.set("ingest_news", max(now, watermark))
        return written
    return 0


def ingest_fundamentals() -> int:
    return asyncio.run(_ingest_fundamentals())


async def _ingest_fundamentals() -> int:
    provider = build_fundamentals_provider()
    total = 0
    async for session in get_session():
        tickers: list[str] = list(
            (await session.execute(select(Stock.ticker))).scalars().all()
        )
        for ticker in tickers:
            try:
                snapshot = provider.get_latest_fundamentals(ticker)
                period_end = date.fromisoformat(str(snapshot["period_end"]))
                items = cast(dict[str, float], snapshot["items"])
                stmt = pg_insert(FinancialStatement).values(
                    {
                        "ticker": ticker,
                        "asof_date": period_end,
                        "available_at": datetime.now(UTC),
                        "reported_at": date.fromisoformat(str(snapshot["reported_at"])),
                        "period_end": period_end,
                        "is_annual": True,
                        "items": items,
                    }
                )
                stmt = stmt.on_conflict_do_update(
                    index_elements=["ticker", "asof_date", "available_at"],
                    set_={"items": stmt.excluded["items"]},
                )
                result = await session.execute(stmt)
                rc = cast("int | None", getattr(result, "rowcount", None))
                total += rc or 0
            except Exception:
                logger.exception("fundamentals fetch failed for %s", ticker)
                continue
        await session.commit()
        return total
    return 0


def watchdog() -> int:
    logger.info("watchdog: health check ok")
    return 0


def ping() -> str:
    return "pong"


__all__ = [
    "get_queue",
    "ingest_ohlcv_daily",
    "ingest_ohlcv_history",
    "ingest_macro",
    "ingest_news",
    "ingest_fundamentals",
    "watchdog",
    "ping",
]
