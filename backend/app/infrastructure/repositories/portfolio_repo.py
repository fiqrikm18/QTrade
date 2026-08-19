"""Repository for portfolios / portfolio_positions (docs/data-model.md §11)."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import (
    OhlcvDaily,
    Portfolio,
    PortfolioPosition,
    Stock,
)


class PortfolioRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_or_create_default(self) -> Portfolio:
        portfolio = await self._session.scalar(
            select(Portfolio).order_by(Portfolio.id.asc()).limit(1)
        )
        if portfolio is not None:
            return portfolio
        portfolio = Portfolio(name="Default")
        self._session.add(portfolio)
        await self._session.commit()
        await self._session.refresh(portfolio)
        return portfolio

    async def list_positions(self) -> list[dict[str, Any]]:
        portfolio = await self.get_or_create_default()
        rows = (
            await self._session.execute(
                select(PortfolioPosition, Stock.name)
                .join(Stock, Stock.ticker == PortfolioPosition.ticker)
                .where(PortfolioPosition.portfolio_id == portfolio.id)
            )
        ).fetchall()
        total_value = Decimal("0")
        enriched: list[dict[str, Any]] = []
        for position, name in rows:
            price_row = (
                await self._session.execute(
                    select(OhlcvDaily.close)
                    .where(OhlcvDaily.ticker == f"{position.ticker}.JK")
                    .order_by(OhlcvDaily.trade_date.desc())
                    .limit(1)
                )
            ).first()
            current_price = (
                float(price_row[0]) if price_row and price_row[0] is not None else None
            )
            quantity = float(position.quantity)
            avg_price = float(position.avg_price)
            entry = {
                "ticker": position.ticker,
                "name": name,
                "quantity": quantity,
                "avgPrice": avg_price,
                "currentPrice": current_price,
                "marketValue": round(current_price * quantity, 2)
                if current_price is not None
                else None,
                "pnl": round((current_price - avg_price) * quantity, 2)
                if current_price is not None
                else None,
                "pnlPct": round((current_price - avg_price) / avg_price * 100, 2)
                if current_price is not None
                else None,
            }
            enriched.append(entry)
            if current_price is not None:
                total_value += Decimal(str(entry["marketValue"]))
        for entry in enriched:
            entry["weight"] = (
                round(float(entry["marketValue"]) / float(total_value) * 100, 2)
                if entry["marketValue"] is not None and total_value > 0
                else None
            )
        return enriched

    async def add_position(
        self, ticker: str, quantity: float, avg_price: float
    ) -> PortfolioPosition:
        portfolio = await self.get_or_create_default()
        stmt = pg_insert(PortfolioPosition).values(
            portfolio_id=portfolio.id,
            ticker=ticker,
            quantity=Decimal(str(quantity)),
            avg_price=Decimal(str(avg_price)),
        )
        stmt = stmt.on_conflict_do_nothing(index_elements=["portfolio_id", "ticker"])
        result = await self._session.execute(stmt)
        await self._session.commit()
        if result.rowcount == 0:
            raise ValueError(f"position already exists: {ticker}")
        return await self._session.scalar(
            select(PortfolioPosition).where(
                PortfolioPosition.portfolio_id == portfolio.id,
                PortfolioPosition.ticker == ticker,
            )
        )  # type: ignore[return-value]

    async def update_position(
        self, ticker: str, quantity: float, avg_price: float
    ) -> PortfolioPosition | None:
        portfolio = await self.get_or_create_default()
        insert_stmt = pg_insert(PortfolioPosition).values(
            portfolio_id=portfolio.id,
            ticker=ticker,
            quantity=Decimal(str(quantity)),
            avg_price=Decimal(str(avg_price)),
        )
        stmt = insert_stmt.on_conflict_do_update(
            index_elements=["portfolio_id", "ticker"],
            set_={
                "quantity": insert_stmt.excluded["quantity"],
                "avg_price": insert_stmt.excluded["avg_price"],
            },
        ).returning(PortfolioPosition)
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def remove_position(self, ticker: str) -> bool:
        portfolio = await self.get_or_create_default()
        result = await self._session.execute(
            delete(PortfolioPosition).where(
                PortfolioPosition.portfolio_id == portfolio.id,
                PortfolioPosition.ticker == ticker,
            )
        )
        await self._session.commit()
        return bool(result.rowcount)
