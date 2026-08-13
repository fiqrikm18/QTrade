"""Live smoke test for OHLCV ingestion of a real IDX ticker (yfinance).

Usage:
    python -m scripts.ingest_smoke BBCA 10
"""

import asyncio
import sys
from datetime import date, timedelta

from sqlalchemy import func, select

from app.application.services.market_data import ingest_ohlcv
from app.infrastructure.database.models import OhlcvDaily
from app.infrastructure.database.session import get_session


def _symbol(arg: str) -> str:
    return arg if "." in arg else f"{arg}.JK"


async def main() -> None:
    ticker = _symbol(sys.argv[1]) if len(sys.argv) > 1 else "BBCA.JK"
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 15
    today = date.today()
    start = today - timedelta(days=days)

    print(f"== OHLCV ingest {ticker} {start.isoformat()} .. {today.isoformat()} ==")

    async with get_session() as session:
        rows, report = await ingest_ohlcv(ticker, start, today, session)
        print(f"rows_written={rows}")
        print(
            f"quality_score={report.quality_score} rows_in={report.rows_in} "
            f"rows_valid={report.rows_valid}"
        )
        if report.issues:
            print(f"issues={report.issues}")
        count = (
            await session.execute(
                select(func.count())
                .select_from(OhlcvDaily)
                .where(OhlcvDaily.ticker == ticker)
            )
        ).scalar_one()
        print(f"db_rows={count}")


if __name__ == "__main__":
    asyncio.run(main())
