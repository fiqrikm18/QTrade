"""Stock repository: universe upsert on ticker."""

from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import func, insert, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.common.types import UniverseItem
from app.domain.fundamental.ratios import FundamentalSnapshot
from app.infrastructure.database.models import (
    FinancialStatement,
    Sector,
    Stock,
    UniverseHistory,
)


def _to_date(dt: datetime) -> date:
    """Convert datetime to date (for timestamptz → date conversion)."""
    return dt.date()


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

    async def load_active_universe(self) -> list[Stock]:
        """Active stocks with sector + shares outstanding for the scan."""
        rows = (
            (
                await self._session.execute(
                    select(Stock)
                    .where(Stock.is_active.is_(True))
                    .where(Stock.sector_id.is_not(None))
                    .order_by(Stock.ticker)
                )
            )
            .scalars()
            .all()
        )
        return list(rows)

    async def load_sector_index(self) -> dict[str, list[str]]:
        """sector_code -> tickers, for sector-score grouping."""
        rows = (
            await self._session.execute(
                select(Stock.ticker, Sector.code)
                .join(Sector, Stock.sector_id == Sector.id)
                .where(Stock.is_active.is_(True))
                .where(Stock.sector_id.is_not(None))
            )
        ).fetchall()
        mapping: dict[str, list[str]] = {}
        for ticker, code in rows:
            mapping.setdefault(code, []).append(ticker)
        return mapping

    async def load_statements(
        self, tickers: list[str], asof
    ) -> dict[str, list[FundamentalSnapshot]]:
        """PIT-gated candidate statements per ticker (``available_at <= asof``).

        The domain ``latest_snapshot`` does the point-in-time selection; this
        repo only filters the availability gate so the engine never sees a
        future statement.
        """
        if not tickers:
            return {}
        rows = (
            await self._session.execute(
                select(
                    FinancialStatement.ticker,
                    FinancialStatement.asof_date,
                    FinancialStatement.available_at,
                    FinancialStatement.reported_at,
                    FinancialStatement.period_end,
                    FinancialStatement.is_annual,
                    FinancialStatement.items,
                )
                .where(FinancialStatement.ticker.in_(tickers))
                .where(FinancialStatement.available_at <= asof)
                .order_by(FinancialStatement.ticker, FinancialStatement.available_at)
            )
        ).fetchall()
        buckets: dict[str, list[FundamentalSnapshot]] = {}
        for r in rows:
            snap = FundamentalSnapshot(
                ticker=r.ticker,
                asof_date=r.asof_date,
                # available_at is stored as timestamptz; FundamentalSnapshot
                # models it as a date (PIT gate for backtest asof dates).
                available_at=_to_date(r.available_at),
                period_end=r.period_end,
                is_annual=r.is_annual,
                items=dict(r.items),
            )
            buckets.setdefault(r.ticker, []).append(snap)
        return buckets
