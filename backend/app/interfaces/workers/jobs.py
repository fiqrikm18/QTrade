"""RQ job functions for market-data ingestion and watchdog.

Job bodies are sync by RQ convention; the async ingestion service is driven
via ``asyncio.run``.
"""

import asyncio
import logging
from datetime import date, timedelta

import redis
from rq import Queue
from sqlalchemy import select

from app.application.services.market_data import ingest_ohlcv
from app.config.settings import get_settings
from app.infrastructure.database.models import Stock
from app.infrastructure.database.session import get_session

logger = logging.getLogger("app.workers")

_DEFAULT_QUEUE = "default"


def get_queue() -> Queue:
    return Queue(
        _DEFAULT_QUEUE,
        connection=redis.from_url(get_settings().redis_url),
    )


async def _ingest_all() -> int:
    total = 0
    today = date.today()
    start = today - timedelta(days=5)
    async for session in get_session():
        tickers: list[str] = list(
            (await session.execute(select(Stock.ticker))).scalars().all()
        )
        for ticker in tickers:
            symbol = f"{ticker}.JK"
            try:
                rows, _report = await ingest_ohlcv(symbol, start, today, session)
                total += rows
            except Exception:
                logger.exception("ingest %s failed", symbol)
    return total


def ingest_ohlcv_daily() -> int:
    return asyncio.run(_ingest_all())


def watchdog() -> int:
    logger.info("watchdog: health check ok")
    return 0


def ping() -> str:
    return "pong"


__all__ = [
    "get_queue",
    "ingest_ohlcv_daily",
    "watchdog",
    "ping",
]
