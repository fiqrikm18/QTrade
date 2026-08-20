"""Backfill OHLCV for every active stock and the IHSG benchmark.

Usage:
    python -m scripts.backfill_ohlcv [days]
"""

import asyncio
import sys

from app.interfaces.workers.jobs import ingest_ohlcv_history


def _days_from_args() -> int:
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 730
    if days < 1:
        raise SystemExit("days must be at least 1")
    return days


async def main() -> None:
    days = _days_from_args()
    print(f"backfilling active stock universe and IHSG for the last {days} days")
    rows = await ingest_ohlcv_history(days=days)
    print(f"rows_written={rows}")


if __name__ == "__main__":
    asyncio.run(main())
