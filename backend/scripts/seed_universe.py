"""Seed the universe from the repo-root stock-list.xlsx."""

import asyncio
from pathlib import Path

from app.application.services.universe import seed_universe
from app.infrastructure.database.session import get_session

_XLSX_PATH = Path(__file__).resolve().parents[2] / "stock-list.xlsx"


async def main() -> None:
    async with get_session() as session:
        count = await seed_universe(session, path=_XLSX_PATH)
    print(f"seeded {count} universe rows")


if __name__ == "__main__":
    asyncio.run(main())
