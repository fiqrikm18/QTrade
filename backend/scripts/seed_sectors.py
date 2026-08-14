"""Seed sectors and assign sector_id to stocks by board."""

import asyncio

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config.settings import get_settings
from app.infrastructure.database.models import Sector, Stock

BOARD_TO_SECTOR = {
    "Utama": "MAIN_BOARD",
    "Pengembangan": "DEVELOPMENT_BOARD",
    "Pemantauan Khusus": "SPECIAL_MONITORING",
    "Akselerasi": "ACCELERATION_BOARD",
    "Ekonomi Baru": "NEW_ECONOMY",
    "Papan Baru": "NEW_BOARD",
}

async def seed_sectors() -> None:
    """Create sectors and assign sector_id to stocks based on board mapping."""
    settings = get_settings()
    engine = create_async_engine(settings.postgres_dsn)
    async_session = async_sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )

    async with async_session() as session:
        # Create sectors
        for _board_name, sector_code in BOARD_TO_SECTOR.items():
            existing = await session.execute(
                select(Sector).where(Sector.code == sector_code)
            )
            if not existing.scalar_one_or_none():
                sector = Sector(
                    code=sector_code,
                    name=sector_code.replace("_", " ").title(),
                )
                session.add(sector)

        await session.commit()

        # Get sector IDs
        sector_rows = await session.execute(select(Sector.id, Sector.code))
        sector_map = {code: id for id, code in sector_rows.all()}

        # Update stocks with sector_id based on board
        for board_name, sector_code in BOARD_TO_SECTOR.items():
            sector_id = sector_map.get(sector_code)
            if sector_id:
                await session.execute(
                    update(Stock)
                    .where(Stock.board == board_name)
                    .values(sector_id=sector_id)
                )

        await session.commit()
        print("Sectors seeded and stocks updated.")


if __name__ == "__main__":
    asyncio.run(seed_sectors())
