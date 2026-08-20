"""Portfolio API routes — real positions + real market prices."""

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import Portfolio, PortfolioPosition, Stock
from app.infrastructure.database.session import get_session
from app.infrastructure.repositories.portfolio_repo import PortfolioRepository

router = APIRouter()


class PortfolioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class PortfolioResponse(BaseModel):
    id: str
    name: str
    created_at: str
    positions: list[dict[str, Any]] = []


class PositionIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=16)
    quantity: float = Field(gt=0)
    avg_price: float = Field(gt=0)


class PositionUpdate(BaseModel):
    quantity: float | None = Field(default=None, gt=0)
    avg_price: float | None = Field(default=None, gt=0)


@router.get("", response_model=list[PortfolioResponse])
@router.get("/", response_model=list[PortfolioResponse], include_in_schema=False)
async def list_portfolios(
    session: AsyncSession = Depends(get_session),
) -> list[PortfolioResponse]:
    """List all portfolios."""
    portfolios = await PortfolioRepository(session).list_portfolios()
    return [
        PortfolioResponse(
            id=str(p.id),
            name=p.name,
            created_at=p.created_at.isoformat() if p.created_at else "",
            positions=[],
        )
        for p in portfolios
    ]


@router.post("", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
async def create_portfolio(
    payload: PortfolioCreate = Body(...),
    session: AsyncSession = Depends(get_session),
) -> PortfolioResponse:
    """Create a new portfolio."""
    portfolio = await PortfolioRepository(session).create_portfolio(payload.name)
    return PortfolioResponse(
        id=str(portfolio.id),
        name=portfolio.name,
        created_at=portfolio.created_at.isoformat() if portfolio.created_at else "",
        positions=[],
    )


@router.get("/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio(
    portfolio_id: int,
    session: AsyncSession = Depends(get_session),
) -> PortfolioResponse:
    """Get portfolio with positions and PnL."""
    repo = PortfolioRepository(session)
    portfolio = await repo.get_portfolio(portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="portfolio not found")
    positions = await repo.list_positions(portfolio_id)
    return PortfolioResponse(
        id=str(portfolio.id),
        name=portfolio.name,
        created_at=portfolio.created_at.isoformat() if portfolio.created_at else "",
        positions=positions,
    )


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio(
    portfolio_id: int,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a portfolio."""
    removed = await PortfolioRepository(session).delete_portfolio(portfolio_id)
    if not removed:
        raise HTTPException(status_code=404, detail="portfolio not found")


@router.post("/{portfolio_id}/positions", response_model=dict[str, Any])
async def add_position(
    portfolio_id: int,
    payload: PositionIn = Body(...),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Add a position to a portfolio."""
    stock = (
        (await session.execute(select(Stock).where(Stock.ticker == payload.ticker)))
        .scalars()
        .first()
    )
    if stock is None:
        raise HTTPException(status_code=400, detail=f"unknown ticker: {payload.ticker}")
    repo = PortfolioRepository(session)
    try:
        await repo.add_position(portfolio_id, payload.ticker, payload.quantity, payload.avg_price)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    positions = await repo.list_positions(portfolio_id)
    for pos in positions:
        if pos["ticker"] == payload.ticker:
            return pos
    raise HTTPException(status_code=500, detail="position not found after creation")


@router.put("/{portfolio_id}/positions/{ticker}", response_model=dict[str, Any])
async def update_position(
    portfolio_id: int,
    ticker: str,
    payload: PositionUpdate = Body(...),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Update quantity/avg price of an existing position."""
    repo = PortfolioRepository(session)
    position = await repo.update_position(portfolio_id, ticker, payload.quantity, payload.avg_price)
    if position is None:
        raise HTTPException(status_code=404, detail=f"position not found: {ticker}")
    return position


@router.delete("/{portfolio_id}/positions/{ticker}", response_model=dict[str, bool])
async def remove_position(
    portfolio_id: int,
    ticker: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    """Remove a position from a portfolio."""
    removed = await PortfolioRepository(session).remove_position(portfolio_id, ticker)
    if not removed:
        raise HTTPException(status_code=404, detail=f"position not found: {ticker}")
    return {"removed": True}