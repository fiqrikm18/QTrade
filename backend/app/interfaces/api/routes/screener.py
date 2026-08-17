"""Screener API routes."""

from typing import Any

from fastapi import APIRouter, Body, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import StockScore
from app.infrastructure.database.session import get_session

router = APIRouter()


def build_filter_query(_base_query: Any, filters: dict[str, Any]) -> list[Any]:
    """Build SQLAlchemy filter conditions from screener filters."""
    conditions: list[Any] = []

    if filters.get("min_opportunity_score") is not None:
        conditions.append(
            StockScore.opportunity_score >= filters["min_opportunity_score"]
        )
    if filters.get("max_opportunity_score") is not None:
        conditions.append(
            StockScore.opportunity_score <= filters["max_opportunity_score"]
        )

    # TODO: Add more filter conditions (sector, RSI, PE, etc.)

    return conditions


@router.post("/run", response_model=dict[str, object])
async def run_screener(
    filters: dict[str, object] = Body(...),
    page: int = 1,
    page_size: int = 20,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Run stock screener with filters."""
    from app.infrastructure.database.models import Stock

    query = select(
        StockScore.ticker,
        StockScore.asof_date,
        StockScore.profile,
        StockScore.opportunity_score,
        StockScore.technical_score,
        StockScore.fundamental_score,
        StockScore.momentum_score,
        StockScore.smart_money_score,
        StockScore.sector_score,
        StockScore.risk_score,
        StockScore.ml_score,
        StockScore.classification,
        Stock.name,
        Stock.sector_id,
    ).select_from(StockScore.__table__.join(Stock, Stock.ticker == StockScore.ticker))

    total_result = await session.execute(
        select(func.count()).select_from(query.subquery())
    )
    _total = total_result.scalar() or 0

    return {
        "items": [],
        "total": 0,
        "page": 1,
        "page_size": 20,
        "asof": None,
    }


@router.get("/saved", response_model=list[dict[str, object]])
async def list_saved_screeners() -> list[dict[str, object]]:
    """List saved screener configurations."""
    # TODO: implement
    return []


@router.post("/saved", response_model=dict[str, object])
async def save_screener(config: dict[str, object] = Body(...)) -> dict[str, object]:
    """Save a screener configuration."""
    # TODO: implement
    return {"id": "new", **config}
