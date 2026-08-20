"""Live scan smoke: real BBCA OHLCV + IHSG index -> full market scan.

Usage:
    python -m scripts.live_scan [ticker] [days]

Steps:
  1. Ingest real OHLCV history for the target stock (default BBCA.JK) and the
     IHSG index (^JKSE stored under internal ticker "IHSG").
  2. Run the production full-universe scan (``run_market_scan``).
  3. Verify stock_scores rows and the Redis ranking cache.
"""

import asyncio
import sys
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from typing import Protocol, cast

import redis
from sqlalchemy import func, select

from app.application.services.data_quality import validate_ohlcv
from app.application.services.market_data import ingest_ohlcv
from app.application.services.scanner import run_market_scan
from app.config.settings import get_settings
from app.infrastructure.database.models import StockScore
from app.infrastructure.database.session import get_session
from app.infrastructure.providers.yfinance_provider import YFinanceProvider
from app.infrastructure.repositories.market_data_repo import MarketDataRepository


class _RedisClient(Protocol):
    def scan_iter(self, match: str) -> Iterator[bytes]: ...

    def get(self, name: bytes) -> bytes | None: ...


def _symbol(arg: str) -> str:
    return arg if "." in arg else f"{arg}.JK"


async def main() -> None:
    ticker = _symbol(sys.argv[1]) if len(sys.argv) > 1 else "BBCA.JK"
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 400
    today = date.today()
    start = today - timedelta(days=days)
    settings = get_settings()
    provider = YFinanceProvider()

    print(f"== live scan: {ticker} last {days} days + IHSG index ==")

    async for session in get_session():
        rows, report = await ingest_ohlcv(ticker, start, today, session, provider)
        print(f"ingest {ticker}: rows_written={rows} valid={report.rows_valid}")
        if report.issues:
            print(f"  issues={report.issues}")

        index_df = provider.get_index_ohlcv("IHSG", start, today)
        _report, valid_index = validate_ohlcv("IHSG", index_df)
        if not valid_index.is_empty():
            index_rows = await MarketDataRepository(session).upsert_ohlcv(
                "IHSG",
                valid_index,
                settings.market_data_provider,
                datetime.now(tz=UTC),
            )
            print(f"ingest IHSG index: rows_written={index_rows}")
        else:
            print(f"ingest IHSG index: no valid rows ({_report.issues})")

        result = await run_market_scan(session)
        await session.commit()  # scanner flushes; caller owns the transaction
        print(
            f"scan: asof={result.asof} rows_written={result.rows_written} "
            f"ranking_len={len(result.ranking)}"
        )
        for tk, score in result.ranking[:5]:
            print(f"  {tk}: {score:.2f}")

        count = (
            await session.execute(select(func.count()).select_from(StockScore))
        ).scalar_one()
        print(f"stock_scores db_rows={count}")

        r = cast(_RedisClient, redis.from_url(settings.redis_url))
        keys = list(r.scan_iter("scan:*"))
        print(f"redis cache keys={keys}")
        for k in keys:
            payload = r.get(k)
            if payload is not None:
                print(f"  {k} -> {payload[:200]}...")


if __name__ == "__main__":
    asyncio.run(main())
