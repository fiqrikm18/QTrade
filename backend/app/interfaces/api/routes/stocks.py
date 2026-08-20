"""Stocks API routes."""

from datetime import UTC, date, datetime, time
from decimal import Decimal
from typing import Any, Sequence

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import func, or_, select
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import OhlcvDaily, Stock, StockScore
from app.infrastructure.database.session import get_session

router = APIRouter()

_OhlcvRiskRow = Row[
    tuple[date, Decimal | None, Decimal | None, Decimal | None]
]

_SMART_MONEY_FETCH = 60  # rows needed for the 50-window RS proxy
_DRAWDOWN_WINDOW = 250  # trading days
_BETA_WINDOW = 60  # trading days for beta vs IHSG
_SMART_MONEY_PROXY_KEYS = (
    "accumulation_proxy",
    "volume_proxy",
    "structure_proxy",
    "rs_proxy",
    "liquidity_proxy",
    "vol_behavior_proxy",
)


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


def _ohlcv_ticker(ticker: str) -> str:
    return f"{ticker}.JK"


async def _valuation_and_fundamental(
    session: AsyncSession,
    ticker: str,
    asof: date,
    price: float,
    shares: float | None,
) -> tuple[dict[str, float | None] | None, dict[str, float | None] | None]:
    """PIT-gated valuation + fundamental ratio blocks from financial statements.

    Only statements already available at ``asof`` are eligible
    (``available_at <= asof`` AND ``asof_date <= asof``); latest available wins.
    Returns (None, None) when no statement qualifies yet.
    """
    from app.domain.fundamental.ratios import (
        FundamentalSnapshot,
        calculate_ratios,
    )
    from app.infrastructure.database.models import FinancialStatement

    cutoff = datetime.combine(asof, time.min, tzinfo=UTC)
    result = await session.execute(
        select(FinancialStatement)
        .where(FinancialStatement.ticker == ticker)
        .where(FinancialStatement.available_at <= cutoff)
        .where(FinancialStatement.asof_date <= asof)
        .order_by(
            FinancialStatement.available_at.desc(),
            FinancialStatement.period_end.desc(),
        )
        .limit(1)
    )
    stmt = result.scalars().first()
    if stmt is None:
        return None, None

    snapshot = FundamentalSnapshot(
        ticker=ticker,
        asof_date=asof,
        available_at=stmt.available_at.date(),
        period_end=stmt.period_end or asof,
        is_annual=stmt.is_annual,
        items=stmt.items,
    )
    ratios = calculate_ratios(snapshot, price, shares_outstanding=shares)
    return (
        {
            "per": ratios.per,
            "pbv": ratios.pbv,
            "psr": ratios.psr,
            "ev_ebitda": ratios.ev_ebitda,
            "fcf_yield": ratios.fcf_yield,
            "dividend_yield": ratios.dividend_yield,
        },
        {
            "roe": ratios.roe,
            "roa": ratios.roa,
            "roic": ratios.roic,
            "npm": ratios.npm,
            "gpm": ratios.gpm,
            "opm": ratios.opm,
            "debt_equity": ratios.debt_equity,
            "current_ratio": ratios.current_ratio,
            "interest_coverage": ratios.interest_coverage,
        },
    )


async def _smart_money_proxies(
    session: AsyncSession, ticker: str
) -> dict[str, float] | None:
    """Latest smart-money proxies from OHLCV history, else None.

    Requires >= 20 rows (accumulation/volume windows); the RS proxy needs 50.
    Proxies with insufficient warm-up are reported honestly as None.
    """
    import polars as pl

    from app.domain.technical.smart_money import smart_money_score

    rows = (
        (
            await session.execute(
                select(
                    OhlcvDaily.trade_date,
                    OhlcvDaily.open,
                    OhlcvDaily.high,
                    OhlcvDaily.low,
                    OhlcvDaily.close,
                    OhlcvDaily.volume,
                    OhlcvDaily.turnover,
                )
                .where(OhlcvDaily.ticker == _ohlcv_ticker(ticker))
                .order_by(OhlcvDaily.trade_date.desc())
                .limit(_SMART_MONEY_FETCH)
            )
        )
        .all()
    )
    if not rows:
        return None
    rows_asc = rows[::-1]
    frame = pl.DataFrame(
        {
            "trade_date": [r[0] for r in rows_asc],
            "open": [float(r[1]) for r in rows_asc],
            "high": [float(r[2]) for r in rows_asc],
            "low": [float(r[3]) for r in rows_asc],
            "close": [float(r[4]) for r in rows_asc],
            "volume": [float(r[5]) for r in rows_asc],
            "turnover": [
                float(r[6]) if r[6] is not None else float(r[4]) * float(r[5])
                for r in rows_asc
            ],
        }
    )
    scored = smart_money_score(frame)
    last = scored.tail(1)
    proxies: dict[str, float] = {}
    for key in _SMART_MONEY_PROXY_KEYS:
        value = last[key][0]
        if isinstance(value, int | float):
            proxies[key] = float(value)
    return proxies


async def _risk_metrics(
    session: AsyncSession,
    ticker: str,
    indicators: dict[str, Any] | None,
) -> dict[str, float | None]:
    """Risk metrics: stored hist vol + OHLCV-derived drawdown/turnover/beta.

    Max drawdown needs a full 250-trading-day window (honest null below);
    beta vs IHSG needs a 60-trading-day window with the index series ingested.
    """
    rows = (
        (
            await session.execute(
                select(
                    OhlcvDaily.trade_date,
                    OhlcvDaily.close,
                    OhlcvDaily.volume,
                    OhlcvDaily.turnover,
                )
                .where(OhlcvDaily.ticker == _ohlcv_ticker(ticker))
                .order_by(OhlcvDaily.trade_date.desc())
                .limit(_DRAWDOWN_WINDOW + 1)
            )
        )
        .all()
    )
    rows_asc = rows[::-1]
    closes = [float(r[1]) for r in rows_asc if r[1] is not None]

    max_drawdown: float | None = None
    if len(closes) >= _DRAWDOWN_WINDOW:
        peak = closes[0]
        worst = 0.0
        for close in closes:
            peak = max(peak, close)
            worst = min(worst, close / peak - 1.0)
        max_drawdown = worst

    turnover_values: list[float] = []
    for r in rows_asc[-20:]:
        if r[3] is not None:
            turnover_values.append(float(r[3]))
        elif r[1] is not None and r[2] is not None:
            turnover_values.append(float(r[1]) * float(r[2]))
    avg_turnover = (
        sum(turnover_values) / len(turnover_values) if turnover_values else None
    )

    hist_vol: float | None = None
    if indicators is not None:
        raw = indicators.get("hist_vol_20")
        if raw is not None:
            hist_vol = float(raw)

    beta_vs_ihsg = await _beta_vs_ihsg(session, rows_asc)

    return {
        "hist_vol_20": hist_vol,
        "max_drawdown_250d": max_drawdown,
        "avg_turnover_20d": avg_turnover,
        "beta_vs_ihsg": beta_vs_ihsg,
    }


async def _beta_vs_ihsg(
    session: AsyncSession, rows_asc: Sequence[_OhlcvRiskRow]
) -> float | None:
    """Beta of the last 60 stock returns against the IHSG index (None if N/A)."""
    if len(rows_asc) < _BETA_WINDOW:
        return None
    window_dates = [r[0] for r in rows_asc[-_BETA_WINDOW:] if r[1] is not None]
    if len(window_dates) != _BETA_WINDOW:
        return None
    idx_rows = (
        await session.execute(
            select(OhlcvDaily.close)
            .where(OhlcvDaily.ticker == "IHSG")
            .where(OhlcvDaily.trade_date.in_(window_dates))
            .order_by(OhlcvDaily.trade_date.asc())
        )
    ).all()
    if len(idx_rows) != _BETA_WINDOW:
        return None
    stock_closes = [float(r[1]) for r in rows_asc[-_BETA_WINDOW:]]
    idx_closes = [float(r[0]) for r in idx_rows]
    s_ret = [a / b - 1.0 for a, b in zip(stock_closes[1:], stock_closes[:-1], strict=True)]
    i_ret = [a / b - 1.0 for a, b in zip(idx_closes[1:], idx_closes[:-1], strict=True)]
    n = len(s_ret)
    s_mean = sum(s_ret) / n
    i_mean = sum(i_ret) / n
    cov = sum(
        (a - s_mean) * (b - i_mean) for a, b in zip(s_ret, i_ret, strict=True)
    ) / (n - 1)
    var = sum((b - i_mean) ** 2 for b in i_ret) / (n - 1)
    if var <= 0:
        return None
    return cov / var


@router.get("", response_model=dict)
@router.get("/", response_model=dict, include_in_schema=False)
async def list_stocks(
    page: int = 1,
    page_size: int = 20,
    sector: str | None = None,
    search: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Get paginated list of stocks."""
    from sqlalchemy import select

    query = select(Stock).where(Stock.is_active.is_(True))

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(or_(Stock.ticker.ilike(term), Stock.name.ilike(term)))

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

    # Derive risk level and regime from latest technical features
    from app.domain.technical.risk import derive_stock_risk_regime
    from app.infrastructure.repositories.stock_score_repo import StockScoreRepository

    indicators = await StockScoreRepository(session).latest_technical_features(ticker)
    if indicators is not None:
        risk_level, regime = derive_stock_risk_regime(indicators)
    else:
        risk_level, regime = (None, None)

    _indicator_keys = (
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
    technical_indicators = (
        {
            **{key: indicators.get(key) for key in _indicator_keys},
            "asof": indicators.get("asof_date"),
        }
        if indicators is not None
        else None
    )

    valuation, fundamental = await _valuation_and_fundamental(
        session, ticker, score.asof_date, price, shares
    )
    smart_money_proxies = await _smart_money_proxies(session, ticker)
    risk_metrics = await _risk_metrics(session, ticker, indicators)
    components = score.score_components or {}
    smart_money_score_value = components.get("smart_money")
    smart_money_score_float = (
        float(smart_money_score_value)
        if isinstance(smart_money_score_value, int | float)
        else None
    )

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
        "risk_level": risk_level,
        "regime": regime,
        "technical_indicators": technical_indicators,
        "valuation": valuation,
        "fundamental": fundamental,
        "smart_money": {
            "score": smart_money_score_float,
            "proxies": smart_money_proxies,
        },
        "risk_metrics": risk_metrics,
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

        results.append(
            {
                "ticker": score.ticker,
                "company": stock.name,
                "sector": str(stock.sector_id) if stock.sector_id else "UNKNOWN",
                "price": price,
                "change": change,
                "volume": int(price_row[2])
                if price_row and price_row[2] is not None
                else 0,
                "turnover": (
                    float(price_row[3])
                    if price_row and price_row[3] is not None
                    else 0.0
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
            }
        )
    return results
