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

    async def list_portfolios(self) -> list[Portfolio]:
        """List all portfolios."""
        rows = (await self._session.execute(select(Portfolio).order_by(Portfolio.created_at.desc()))).scalars().all()
        return list(rows)

    async def create_portfolio(self, name: str) -> Portfolio:
        """Create a new portfolio."""
        portfolio = Portfolio(name=name)
        self._session.add(portfolio)
        await self._session.commit()
        await self._session.refresh(portfolio)
        return portfolio

    async def get_portfolio(self, portfolio_id: int) -> Portfolio | None:
        """Get portfolio by ID."""
        return await self._session.get(Portfolio, portfolio_id)

    async def delete_portfolio(self, portfolio_id: int) -> bool:
        """Delete a portfolio (cascades to positions)."""
        portfolio = await self._session.get(Portfolio, portfolio_id)
        if portfolio is None:
            return False
        await self._session.delete(portfolio)
        await self._session.commit()
        return True

    async def list_positions(self, portfolio_id: int) -> list[dict[str, Any]]:
        """List all positions for a portfolio with PnL from latest OHLCV."""
        rows = (
            await self._session.execute(
                select(PortfolioPosition, Stock.name)
                .join(Stock, Stock.ticker == PortfolioPosition.ticker)
                .where(PortfolioPosition.portfolio_id == portfolio_id)
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

            if price_row and price_row[0] is not None:
                current_price = float(price_row[0])
            else:
                current_price = float(position.avg_price)

            quantity = float(position.quantity)
            avg_price = float(position.avg_price)
            market_value = round(current_price * quantity, 2)

            entry = {
                "ticker": position.ticker,
                "name": name,
                "quantity": float(position.quantity),
                "avgPrice": float(position.avg_price),
                "currentPrice": current_price,
                "marketValue": market_value,
                "pnl": round((current_price - float(position.avg_price)) * float(position.quantity), 2),
                "pnlPct": round((current_price - float(position.avg_price)) / float(position.avg_price) * 100, 2),
            }
            enriched.append(entry)
            total_value += Decimal(str(market_value))

        for entry in enriched:
            entry["weight"] = (
                round(float(entry["marketValue"]) / float(total_value) * 100, 2)
                if total_value > 0
                else 0.0
            )

        return enriched

    async def add_position(
        self, portfolio_id: int, ticker: str, quantity: float, avg_price: float
    ) -> None:
        """Add a position to a portfolio."""
        stmt = pg_insert(PortfolioPosition).values(
            portfolio_id=portfolio_id,
            ticker=ticker,
            quantity=Decimal(str(quantity)),
            avg_price=Decimal(str(avg_price)),
        ).on_conflict_do_nothing(constraint="uq_portfolio_position")
        result = await self._session.execute(stmt)
        await self._session.commit()
        if result.rowcount == 0:
            raise ValueError(f"position already exists: {ticker}")

    async def update_position(
        self, portfolio_id: int, ticker: str, quantity: float | None, avg_price: float | None
    ) -> dict[str, Any] | None:
        """Update quantity/avg price of an existing position."""
        # Fetch existing
        stmt = select(PortfolioPosition).where(
            PortfolioPosition.portfolio_id == portfolio_id,
            PortfolioPosition.ticker == ticker,
        )
        position = (await self._session.execute(stmt)).scalar_one_or_none()
        if position is None:
            return None

        new_quantity = Decimal(str(quantity)) if quantity is not None else position.quantity
        new_avg_price = Decimal(str(avg_price)) if avg_price is not None else position.avg_price

        # Direct update
        from sqlalchemy import update
        stmt = (
            update(PortfolioPosition)
            .where(
                PortfolioPosition.portfolio_id == portfolio_id,
                PortfolioPosition.ticker == ticker,
            )
            .values(quantity=new_quantity, avg_price=new_avg_price)
            .returning(PortfolioPosition)
        )
        result = (await self._session.execute(stmt)).scalar_one_or_none()
        await self._session.commit()

        if result is None:
            return None

        # Return enriched position
        price_row = (
            await self._session.execute(
                select(OhlcvDaily.close)
                .where(OhlcvDaily.ticker == f"{ticker}.JK")
                .order_by(OhlcvDaily.trade_date.desc())
                .limit(1)
            )
        ).first()

        if price_row and price_row[0] is not None:
            current_price = float(price_row[0])
        else:
            current_price = float(result.avg_price)

        quantity = float(result.quantity)
        avg_price = float(result.avg_price)
        market_value = round(current_price * quantity, 2)

        return {
            "ticker": ticker,
            "name": "",  # name not fetched here
            "quantity": quantity,
            "avgPrice": avg_price,
            "currentPrice": current_price,
            "marketValue": market_value,
            "pnl": round((current_price - float(result.avg_price)) * quantity, 2),
            "pnlPct": round((current_price - float(result.avg_price)) / float(result.avg_price) * 100, 2),
            "weight": 0.0,
        }

    async def remove_position(self, portfolio_id: int, ticker: str) -> bool:
        """Remove a position from a portfolio."""
        result = await self._session.execute(
            delete(PortfolioPosition).where(
                PortfolioPosition.portfolio_id == portfolio_id,
                PortfolioPosition.ticker == ticker,
            )
        )
        await self._session.commit()
        return bool(result.rowcount)

    async def get_portfolio(self, portfolio_id: int) -> "Portfolio | None":
        """Get portfolio by ID."""
        return await self._session.get(Portfolio, portfolio_id)

    async def create_portfolio(self, name: str) -> "Portfolio":
        """Create a new portfolio."""
        portfolio = Portfolio(name=name)
        self._session.add(portfolio)
        await self._session.commit()
        await self._session.refresh(portfolio)
        return portfolio

    async def delete_portfolio(self, portfolio_id: int) -> bool:
        """Delete a portfolio (cascades to positions)."""
        portfolio = await self._session.get(Portfolio, portfolio_id)
        if portfolio is None:
            return False
        await self._session.delete(portfolio)
        await self._session.commit()
        return True

    async def list_portfolios(self) -> list["Portfolio"]:
        """List all portfolios."""
        rows = (await self._session.execute(select(Portfolio).order_by(Portfolio.created_at.desc()))).scalars().all()
        return list(rows)