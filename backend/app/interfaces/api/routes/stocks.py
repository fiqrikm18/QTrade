"""Stocks API routes."""

from fastapi import APIRouter, Depends, Path
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import Stock, StockScore
from app.infrastructure.database.session import get_session

router = APIRouter()


async def get_latest_score(
    session: AsyncSession, ticker: str, profile: str = "balanced"
):
    result = await session.execute(
        select(StockScore)
        .where(StockScore.ticker == ticker)
        .where(StockScore.profile == profile)
        .order_by(StockScore.asof_date.desc())
        .limit(1)
    )
    return result.scalars().first()


@router.get("", response_model=dict)
@router.get("/", response_model=dict, include_in_schema=False)
async def list_stocks(
    page: int = 1,
    page_size: int = 20,
    sector: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Get paginated list of stocks."""
    from sqlalchemy import select

    query = select(Stock).where(Stock.is_active.is_(True))

    total_result = await session.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar() or 0

    result = await session.execute(
        query.order_by(Stock.ticker).offset((page - 1) * page_size).limit(page_size)
    )
    stocks = result.scalars().all()

    items = [
        {
            "ticker": s.ticker,
            "name": s.name,
            "sector_id": s.sector_id,
            "board": s.board,
            "listing_date": s.listing_date.isoformat() if s.listing_date else None,
            "is_active": s.is_active,
        }
        for s in stocks
    ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{ticker}/analysis", response_model=dict[str, object])
async def stock_analysis(
    ticker: str,
    profile: str = "balanced",
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Get full stock analysis with opportunity score and components."""
    score = await get_latest_score(session, ticker, profile)
    if not score:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail=f"Score not found for {ticker}")

    # Get stock info
    from sqlalchemy import select

    result = await session.execute(select(Stock).where(Stock.ticker == ticker))
    stock = result.scalars().first()
    if not stock:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail=f"Stock {ticker} not found")

    return {
        "ticker": score.ticker,
        "name": stock.name,
        "sector": str(stock.sector_id),
        "price": 0,
        "change": 0,
        "change_pct": 0,
        "volume": 0,
        "turnover": 0,
        "market_cap": 0,
        "opportunity_score": float(score.opportunity_score)
        if score.opportunity_score is not None
        else 0.0,
        "classification": score.classification or "neutral",
        "confidence": float(score.confidence) if score.confidence is not None else 0.0,
        "risk_level": "MEDIUM",
        "regime": "NEUTRAL",
        "components": score.score_components,  # type: ignore[assignment]
        "drivers": score.drivers or [],
        "risks": score.risks or [],
        "invalidation_conditions": score.invalidation_conditions or [],
        "asof": score.asof_date.isoformat() if score.asof_date else None,
        "feature_version": score.feature_version,
        "scoring_version": score.scoring_version,
    }


@router.get("/{ticker}/technical")
async def stock_technical(
    ticker: str = Path(..., description="Stock ticker"),
    session=Depends(get_session),
):
    """Get latest technical indicators for a stock."""
    # Return mock data for now
    return {
        "ticker": ticker,
        "rsi_14": None,
        "macd": None,
        "macd_signal": None,
        "macd_hist": None,
        "sma_20": None,
        "sma_50": None,
        "sma_200": None,
        "ema_20": None,
        "atr_14": None,
        "adx_14": None,
        "bollinger_upper": None,
        "bollinger_mid": None,
        "bollinger_lower": None,
        "roc_20": None,
        "hist_vol_20": None,
        "stoch_k": None,
        "stoch_d": None,
        "asof": None,
    }
