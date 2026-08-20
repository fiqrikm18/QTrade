"""Run the production market scan against already-ingested data."""

import asyncio

from app.application.services.scanner import run_market_scan
from app.infrastructure.database.session import get_session


async def main() -> None:
    async for session in get_session():
        result = await run_market_scan(session)
        await session.commit()
        print(
            f"scan asof={result.asof} rows_written={result.rows_written} "
            f"ranking_len={len(result.ranking)}"
        )


if __name__ == "__main__":
    asyncio.run(main())
