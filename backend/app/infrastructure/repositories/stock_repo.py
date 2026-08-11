"""Stock repository: universe upsert on ticker."""

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, insert, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.common.types import UniverseItem
from app.infrastructure.database.models import Stock, UniverseHistory


class StockRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert_stocks(self, items: list[UniverseItem]) -> int:
        if not items:
            return 0
        existing = set((await self._session.execute(select(Stock.ticker))).scalars())
        rows = [
            {
                "ticker": item.ticker,
                "name": item.name,
                "listing_date": item.listing_date,
                "board": item.board,
                "shares_outstanding": (
                    Decimal(item.shares_outstanding)
                    if item.shares_outstanding is not None
                    else None
                ),
            }
            for item in items
        ]
        insert_stmt = pg_insert(Stock).values(rows)
        stmt = insert_stmt.on_conflict_do_update(
            index_elements=[Stock.ticker],
            set_={
                "name": insert_stmt.excluded.name,
                "listing_date": insert_stmt.excluded.listing_date,
                "board": insert_stmt.excluded.board,
                "shares_outstanding": insert_stmt.excluded.shares_outstanding,
                "updated_at": func.now(),
            },
        )
        await self._session.execute(stmt)
        new_items = [item for item in items if item.ticker not in existing]
        if new_items:
            now = datetime.now(UTC)
            await self._session.execute(
                insert(UniverseHistory),
                [
                    {"ticker": item.ticker, "effective_from": now, "status": "active"}
                    for item in new_items
                ],
            )
        await self._session.commit()
        return len(items)
