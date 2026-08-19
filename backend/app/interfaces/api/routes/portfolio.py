"""Portfolio API routes — real positions + real market prices."""

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import Stock
from app.infrastructure.database.session import get_session
from app.infrastructure.repositories.portfolio_repo import PortfolioRepository

router = APIRouter()


class PositionIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=16)
    quantity: float = Field(gt=0)
    avg_price: float = Field(gt=0)


class PositionUpdate(BaseModel):
    quantity: float = Field(gt=0)
    avg_price: float = Field(gt=0)


@router.get("", response_model=list[dict[str, Any]])
@router.get("/", response_model=list[dict[str, Any]], include_in_schema=False)
async def portfolio(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Get the user portfolio with derived pnl and weights from real quotes."""
    return await PortfolioRepository(session).list_positions()


@router.post("/positions", response_model=dict[str, Any])
async def add_position(
    payload: PositionIn = Body(...),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Add a position to the default portfolio (ticker must be in universe)."""
    stock = (
        (await session.execute(select(Stock).where(Stock.ticker == payload.ticker)))
        .scalars()
        .first()
    )
    if stock is None:
        raise HTTPException(status_code=400, detail=f"unknown ticker: {payload.ticker}")
    repo = PortfolioRepository(session)
    try:
        await repo.add_position(payload.ticker, payload.quantity, payload.avg_price)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return await _single_position(session, payload.ticker)


@router.put("/positions/{ticker}", response_model=dict[str, Any])
async def update_position(
    ticker: str,
    payload: PositionUpdate = Body(...),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Update quantity/avg price of an existing position."""
    repo = PortfolioRepository(session)
    position = await repo.update_position(ticker, payload.quantity, payload.avg_price)
    if position is None:
        raise HTTPException(status_code=404, detail=f"position not found: {ticker}")
    return await _single_position(session, ticker)


@router.delete("/positions/{ticker}", response_model=dict[str, bool])
async def remove_position(
    ticker: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    """Remove a position from the default portfolio."""
    removed = await PortfolioRepository(session).remove_position(ticker)
    if not removed:
        raise HTTPException(status_code=404, detail=f"position not found: {ticker}")
    return {"removed": True}


async def _single_position(session: AsyncSession, ticker: str) -> dict[str, Any]:
    rows = await PortfolioRepository(session).list_positions()
    for row in rows:
        if row["ticker"] == ticker:
            return row
    raise HTTPException(status_code=404, detail=f"position not found: {ticker}")
