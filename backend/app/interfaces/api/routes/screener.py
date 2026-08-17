"""Screener API routes: run filter queries against scan artifacts."""

from typing import Any

from fastapi import APIRouter, Body, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import Sector, Stock, StockScore
from app.infrastructure.database.session import get_session

router = APIRouter()

DEFAULT_PROFILE = "balanced"


def build_filter_query(filters: dict[str, Any]) -> list[Any]:
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
    if filters.get("sector"):
        sector_names = filters["sector"]
        if isinstance(sector_names, str):
            sector_names = [sector_names]
        conditions.append(Stock.sector_id.is_not(None))
        conditions.append(
            Stock.sector_id.in_(select(Sector.id).where(Sector.code.in_(sector_names)))
        )
    if filters.get("classification"):
        classifications = filters["classification"]
        if isinstance(classifications, str):
            classifications = [classifications]
        conditions.append(StockScore.classification.in_(classifications))
    if filters.get("min_risk") is not None:
        conditions.append(StockScore.risk_score >= filters["min_risk"])
    if filters.get("max_risk") is not None:
        conditions.append(StockScore.risk_score <= filters["max_risk"])

    return conditions


async def _latest_asof(session: AsyncSession) -> Any:
    return (
        await session.execute(
            select(func.max(StockScore.asof_date)).where(
                StockScore.profile == DEFAULT_PROFILE
            )
        )
    ).scalar()


@router.post("/run", response_model=dict[str, object])
async def run_screener(
    filters: dict[str, object] = Body(default={}),
    page: int = 1,
    page_size: int = 20,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Run stock screener with filters."""
    asof = await _latest_asof(session)
    if asof is None:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "asof": None,
        }

    conditions = build_filter_query(filters)
    conditions.append(StockScore.profile == DEFAULT_PROFILE)
    conditions.append(StockScore.asof_date == asof)

    base = (
        select(
            StockScore.ticker,
            StockScore.opportunity_score,
            StockScore.technical_score,
            StockScore.fundamental_score,
            StockScore.momentum_score,
            StockScore.relative_strength,
            StockScore.smart_money_score,
            StockScore.sector_score,
            StockScore.risk_score,
            StockScore.ml_score,
            StockScore.classification,
            Stock.name,
            Stock.sector_id,
            Sector.code.label("sector_code"),
        )
        .select_from(
            StockScore.__table__.join(Stock, Stock.ticker == StockScore.ticker)
        )
        .outerjoin(Sector, Sector.id == Stock.sector_id)
        .where(*conditions)
    )
    total = (
        await session.execute(select(func.count()).select_from(base.subquery()))
    ).scalar() or 0
    rows = (
        await session.execute(
            base.order_by(StockScore.opportunity_score.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()

    return {
        "items": [
            {
                "ticker": r.ticker,
                "name": r.name,
                "sector_id": r.sector_id,
                "sector_code": r.sector_code,
                "opportunity_score": float(r.opportunity_score)
                if r.opportunity_score is not None
                else None,
                "technical_score": float(r.technical_score)
                if r.technical_score is not None
                else None,
                "fundamental_score": float(r.fundamental_score)
                if r.fundamental_score is not None
                else None,
                "momentum_score": float(r.momentum_score)
                if r.momentum_score is not None
                else None,
                "relative_strength": float(r.relative_strength)
                if r.relative_strength is not None
                else None,
                "smart_money_score": float(r.smart_money_score)
                if r.smart_money_score is not None
                else None,
                "sector_score": float(r.sector_score)
                if r.sector_score is not None
                else None,
                "risk_score": float(r.risk_score) if r.risk_score is not None else None,
                "ml_score": float(r.ml_score) if r.ml_score is not None else None,
                "classification": r.classification,
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "asof": asof.isoformat(),
    }


@router.get("/saved", response_model=list[dict[str, object]])
async def list_saved_screeners() -> list[dict[str, object]]:
    """List saved screener configurations."""
    # TODO: implement (saved screeners table is out of CP2 scope)
    return []


@router.post("/saved", response_model=dict[str, object])
async def save_screener(config: dict[str, object] = Body(...)) -> dict[str, object]:
    """Save a screener configuration."""
    # TODO: implement (saved screeners table is out of CP2 scope)
    return {"id": "new", **config}
