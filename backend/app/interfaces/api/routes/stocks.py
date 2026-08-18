"""Stocks API routes."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import OhlcvDaily, Stock, StockScore
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
        raise HTTPException(status_code=404, detail=f"Score not found for {ticker}")

    # Get stock info
    from sqlalchemy import select

    result = await session.execute(select(Stock).where(Stock.ticker == ticker))
    stock = result.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {ticker} not found")

    # Latest price + change from OHLCV (indexed read, no request-path compute)
    price_row = (
        await session.execute(
            select(
                OhlcvDaily.close,
                OhlcvDaily.trade_date,
                OhlcvDaily.volume,
                OhlcvDaily.turnover,
            )
            .where(OhlcvDaily.ticker == f"{ticker}.JK")
            .order_by(OhlcvDaily.trade_date.desc())
            .limit(1)
        )
    ).first()
    prev_row = (
        await session.execute(
            select(OhlcvDaily.close)
            .where(OhlcvDaily.ticker == f"{ticker}.JK")
            .order_by(OhlcvDaily.trade_date.desc())
            .offset(1)
            .limit(1)
        )
    ).first()
    price = float(price_row[0]) if price_row and price_row[0] is not None else 0.0
    prev = float(prev_row[0]) if prev_row and prev_row[0] is not None else price
    change = price - prev
    change_pct = change / prev * 100.0 if prev else 0.0
    shares = float(stock.shares_outstanding) if stock.shares_outstanding else 0.0

    return {
        "ticker": score.ticker,
        "name": stock.name,
        "sector": str(stock.sector_id),
        "price": price,
        "change": change,
        "change_pct": change_pct,
        "volume": int(price_row[2]) if price_row and price_row[2] is not None else 0,
        "turnover": (
            float(price_row[3]) if price_row and price_row[3] is not None else 0.0
        ),
        "market_cap": price * shares,
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
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Get latest technical indicators for a stock (from the newest scan)."""
    from app.infrastructure.repositories.stock_score_repo import StockScoreRepository

    repo = StockScoreRepository(session)
    indicators = await repo.latest_technical_features(ticker)
    if indicators is None:
        raise HTTPException(status_code=404, detail=f"No features for {ticker}")
    keys = (
        "rsi_14",
        "macd",
        "macd_signal",
        "macd_hist",
        "sma_20",
        "sma_50",
        "sma_200",
        "ema_20",
        "atr_14",
        "adx_14",
        "boll_upper",
        "boll_mid",
        "boll_lower",
        "roc_20",
        "rel_volume",
        "hist_vol_20",
        "stoch_k",
        "stoch_d",
    )
    return {
        "ticker": ticker,
        **{key: indicators.get(key) for key in keys},
        "asof": indicators.get("asof_date"),
    }


@router.get("/compare", response_model=list[dict[str, Any]])
async def stock_compare(
    tickers: list[str] = Query(..., description="List of tickers to compare"),
    profile: str = "balanced",
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Compare multiple stocks side by side."""
    results = []
    for ticker in tickers:
        score = await get_latest_score(session, ticker, profile)
        if not score:
            continue

        from sqlalchemy import select

        result = await session.execute(select(Stock).where(Stock.ticker == ticker))
        stock = result.scalars().first()
        if not stock:
            continue

        price_row = (
            await session.execute(
                select(
                    OhlcvDaily.close,
                    OhlcvDaily.trade_date,
                    OhlcvDaily.volume,
                    OhlcvDaily.turnover,
                )
                .where(OhlcvDaily.ticker == f"{ticker}.JK")
                .order_by(OhlcvDaily.trade_date.desc())
                .limit(1)
            )
        ).first()
        prev_row = (
            await session.execute(
                select(OhlcvDaily.close)
                .where(OhlcvDaily.ticker == f"{ticker}.JK")
                .order_by(OhlcvDaily.trade_date.desc())
                .offset(1)
                .limit(1)
            )
        ).first()
        price = float(price_row[0]) if price_row and price_row[0] is not None else 0.0
        prev = float(prev_row[0]) if prev_row and prev_row[0] is not None else price
        change = price - prev
        change_pct = change / prev * 100.0 if prev else 0.0
        shares = float(stock.shares_outstanding) if stock.shares_outstanding else 0.0

        comps = score.score_components or {}

        results.append({
            "ticker": score.ticker,
            "company": stock.name,
            "sector": str(stock.sector_id) if stock.sector_id else "UNKNOWN",
            "price": price,
            "change": change,
            "volume": int(price_row[2]) if price_row and price_row[2] is not None else 0,
            "turnover": (
                float(price_row[3]) if price_row and price_row[3] is not None else 0.0
            ),
            "marketCap": price * shares,
            "technical": comps.get("technical", 0),
            "fundamental": comps.get("fundamental", 0),
            "momentum": comps.get("momentum", 0),
            "smartMoney": comps.get("smart_money", 0),
            "sectorScore": score.sector_score or 0,
            "risk": comps.get("risk", 0),
            "ml": comps.get("ml", 0),
            "opportunity": score.opportunity_score or 0,
        })
    return results
