"""Backfill real fundamentals for one ticker (yfinance), point-in-time correct.

Usage:
    python -m scripts.ingest_fundamentals BBCA
"""

import asyncio
import sys
from datetime import UTC, date, datetime, time
from typing import cast

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.infrastructure.database.models import FinancialStatement
from app.infrastructure.database.session import get_session
from app.infrastructure.providers.factory import build_fundamentals_provider


async def main() -> None:
    ticker = (sys.argv[1] if len(sys.argv) > 1 else "BBCA").upper()
    provider = build_fundamentals_provider()
    snapshot = provider.get_latest_fundamentals(ticker)
    period_end = date.fromisoformat(str(snapshot["period_end"]))
    reported_at = date.fromisoformat(str(snapshot["reported_at"]))
    items = cast(dict[str, float], snapshot["items"])

    async for session in get_session():
        stmt = pg_insert(FinancialStatement).values(
            {
                "ticker": ticker,
                "asof_date": period_end,
                "available_at": datetime.combine(reported_at, time.min, tzinfo=UTC),
                "reported_at": reported_at,
                "period_end": period_end,
                "is_annual": True,
                "items": items,
            }
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["ticker", "asof_date", "available_at"],
            set_={"items": stmt.excluded["items"]},
        )
        await session.execute(stmt)
        await session.commit()
        print(
            f"upserted {ticker} fundamentals period_end={period_end} "
            f"reported_at={reported_at} items={len(items)}"
        )


if __name__ == "__main__":
    asyncio.run(main())
