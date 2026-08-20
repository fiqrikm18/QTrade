"""Market API routes: overview, regime, breadth, sector rotation.

All data is read from the scan artifacts (``stock_scores.score_components``)
and Redis rankings produced by ``run_market_scan``; no computation happens on
the request path (architecture.md §6).
"""

from datetime import date
from typing import Any, cast

import redis
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.infrastructure.database.models import OhlcvDaily, Sector, Stock, StockScore
from app.infrastructure.database.session import get_session

router = APIRouter()

DEFAULT_PROFILE = "balanced"
_TOP_OPPORTUNITIES = 10


async def _latest_asof(
    session: AsyncSession, profile: str = DEFAULT_PROFILE
) -> date | None:
    """Latest scanned asof for the profile (one indexed query)."""
    return (
        await session.execute(
            select(func.max(StockScore.asof_date)).where(
                StockScore.profile == profile,
                StockScore.scoring_version == "v1",
            )
        )
    ).scalar()


async def _latest_regime(session: AsyncSession) -> dict[str, Any] | None:
    """Latest regime + breadth stored in the newest scan's score_components."""
    asof = await _latest_asof(session)
    if asof is None:
        return None
    row = (
        await session.execute(
            select(StockScore.score_components)
            .where(
                StockScore.profile == DEFAULT_PROFILE,
                StockScore.asof_date == asof,
                StockScore.score_components.is_not(None),
            )
            .limit(1)
        )
    ).first()
    if row is None or row[0] is None:
        return None
    comps = cast(dict[str, object], row[0])
    regime = comps.get("regime")
    if regime is None:
        return None
    reg_comps_raw = comps.get("regime_components")
    reg_comps = (
        cast(dict[str, object], reg_comps_raw)
        if isinstance(reg_comps_raw, dict)
        else {}
    )
    confidence = reg_comps.get("confidence")
    confidence_f: float = (
        float(confidence) if isinstance(confidence, (int, float)) else 0.0
    )
    return {
        "regime": regime,
        "confidence": confidence_f,
        "components": reg_comps,
        "asof": asof.isoformat(),
    }


async def _latest_breadth(session: AsyncSession) -> dict[str, Any] | None:
    """Latest breadth from the newest scan (breadth_score in components)."""
    asof = await _latest_asof(session)
    if asof is None:
        return None
    row = (
        await session.execute(
            select(StockScore.score_components)
            .where(
                StockScore.profile == DEFAULT_PROFILE,
                StockScore.asof_date == asof,
                StockScore.score_components.is_not(None),
            )
            .limit(1)
        )
    ).first()
    if row is None or row[0] is None:
        return None
    score = row[0].get("breadth_score")
    return {
        "breadth_score": float(score) if score is not None else 0.0,
        "asof": asof.isoformat(),
    }


def _latest_rankings(profile: str = DEFAULT_PROFILE) -> list[dict[str, Any]]:
    """Top-N ranking from the Redis scan cache (written by the scanner)."""
    try:
        rc: redis.Redis = redis.from_url(get_settings().redis_url)  # pyright: ignore[reportUnknownMemberType]
        keys: list[str] = sorted(cast(list[str], rc.scan_iter(f"scan:{profile}:*")))  # pyright: ignore[reportUnknownMemberType]
        if not keys:
            return []
        key = keys[-1]
        raw_payload = cast(bytes | None, rc.get(key))  # pyright: ignore[reportUnknownMemberType]
        if not raw_payload:
            return []
        import json

        data: dict[str, object] = json.loads(raw_payload)
        ranking_raw = data.get("ranking")
        ranking_list = (
            cast(list[object], ranking_raw) if isinstance(ranking_raw, list) else []
        )
        out: list[dict[str, Any]] = []
        for item in ranking_list[:_TOP_OPPORTUNITIES]:
            if not isinstance(item, dict):
                continue
            item_dict = cast(dict[str, object], item)
            ticker = item_dict.get("ticker")
            score = item_dict.get("score")
            out.append(
                {
                    "ticker": ticker if isinstance(ticker, str) else "",
                    "opportunity_score": (
                        float(score) if isinstance(score, (int, float)) else 0.0
                    ),
                }
            )
        return out
    except Exception:
        return []


async def _top_movers(session: AsyncSession) -> list[dict[str, Any]]:
    """Top movers (gainers then losers) from latest OHLCV close vs previous."""
    # Latest two trade dates per ticker (indexed, no request-path computation).
    latest = (await session.execute(select(func.max(OhlcvDaily.trade_date)))).scalar()
    if latest is None:
        return []
    prev = (
        await session.execute(
            select(func.max(OhlcvDaily.trade_date)).where(
                OhlcvDaily.trade_date < latest
            )
        )
    ).scalar()
    if prev is None:
        return []
    rows = (
        await session.execute(
            select(
                OhlcvDaily.ticker,
                OhlcvDaily.trade_date,
                OhlcvDaily.close,
            )
            .where(OhlcvDaily.trade_date.in_([prev, latest]))
            .order_by(OhlcvDaily.ticker, OhlcvDaily.trade_date)
        )
    ).all()
    by_ticker: dict[str, dict[date, float]] = {}
    for ticker, trade_date, close in rows:
        by_ticker.setdefault(ticker, {})[trade_date] = float(close)
    movers: list[dict[str, Any]] = []
    for ticker, closes in by_ticker.items():
        if latest in closes and prev in closes:
            prev_close = closes[prev]
            if prev_close <= 0:
                continue
            change_pct = (closes[latest] - prev_close) / prev_close * 100.0
            movers.append(
                {
                    "ticker": ticker,
                    "price": closes[latest],
                    "change_pct": change_pct,
                    "asof": latest.isoformat(),
                }
            )
    movers.sort(key=lambda m: m["change_pct"], reverse=True)
    return movers


@router.get("/overview", response_model=dict[str, Any])
async def market_overview(
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Get market overview: regime, breadth, movers, opportunities, rotation."""
    regime = await _latest_regime(session)
    breadth = await _latest_breadth(session)
    opportunities = _latest_rankings()
    movers = await _top_movers(session)
    asof = (
        await _latest_asof(session)
        if regime is None
        else date.fromisoformat(regime["asof"])
    )

    # Real sector rotation: average sector_score per sector from the latest scan.
    sector_rotation: list[dict[str, object]] = []
    if asof is not None:
        sector_rows = (
            await session.execute(
                select(StockScore.sector_score, Sector.name)
                .join(Stock, Stock.ticker == StockScore.ticker)
                .join(Sector, Sector.id == Stock.sector_id)
                .where(
                    StockScore.profile == DEFAULT_PROFILE,
                    StockScore.asof_date == asof,
                    StockScore.sector_score.is_not(None),
                )
            )
        ).fetchall()
        by_sector: dict[str, list[float]] = {}
        for score, name in sector_rows:
            if name is not None:
                by_sector.setdefault(name, []).append(float(score))
        sector_rotation = [
            {
                "sector": name,
                "score": round(sum(vals) / len(vals), 2),
                "asof": asof.isoformat(),
            }
            for name, vals in sorted(
                by_sector.items(), key=lambda kv: sum(kv[1]) / len(kv[1]), reverse=True
            )
        ]

    # Real macro risk/support (0.0 fallback when no data).
    from app.domain.macro.scores import compute_macro_scores
    from app.infrastructure.repositories.macro_repo import MacroRepository

    macro_repo = MacroRepository(session)
    series: dict[str, list[tuple[date, float]]] = {}
    for code in ("usd_idr", "dxy", "us_10y", "sp500"):
        # USD/IDR is monthly while the other configured FRED series are daily.
        # Ninety days provides enough monthly observations to calculate a trend.
        rows = await macro_repo.indicator_series(code, days=90, asof=asof)
        series[code] = [
            (r["asof_date"], float(r["value"]))  # type: ignore[misc]
            for r in rows
            if isinstance(r["asof_date"], date)
        ]
    macro_scores = compute_macro_scores(series)

    # Real upcoming events from economic_events.
    upcoming_events = await macro_repo.upcoming_events(limit=5)

    return {
        "regime": regime
        or {"regime": "UNKNOWN", "confidence": 0.0, "components": {}, "asof": None},
        "breadth": {
            "breadth_score": breadth["breadth_score"] if breadth else 0.0,
            "asof": breadth["asof"] if breadth else None,
        },
        "top_gainers": [m for m in movers if m["change_pct"] > 0][:_TOP_OPPORTUNITIES],
        "top_losers": sorted(
            [m for m in movers if m["change_pct"] < 0],
            key=lambda m: m["change_pct"],
        )[:_TOP_OPPORTUNITIES],
        "top_opportunities": opportunities,
        "sector_rotation": sector_rotation,
        "macro": macro_scores,
        "upcoming_events": upcoming_events,
        "asof": asof.isoformat() if asof else None,
    }


@router.get("/regime", response_model=dict[str, Any])
async def market_regime(
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Get current market regime from the latest scan."""
    regime = await _latest_regime(session)
    return regime or {
        "regime": "UNKNOWN",
        "confidence": 0,
        "components": {},
        "asof": None,
    }


@router.get("/breadth", response_model=dict[str, Any])
async def market_breadth(
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Get market breadth from the latest scan."""
    breadth = await _latest_breadth(session)
    return breadth or {"breadth_score": 0, "asof": None}


@router.get("/sectors", response_model=list[dict[str, Any]])
async def sector_performance(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Get sector rotation from the latest scan's sector scores."""
    asof = await _latest_asof(session)
    if asof is None:
        return []
    rows = (
        await session.execute(
            select(StockScore.ticker, StockScore.sector_score)
            .where(
                StockScore.profile == DEFAULT_PROFILE,
                StockScore.asof_date == asof,
                StockScore.sector_score.is_not(None),
            )
            .order_by(StockScore.sector_score.desc())
        )
    ).all()
    return [
        {
            "ticker": ticker,
            "sector_score": float(sector_score) if sector_score is not None else 0.0,
            "asof": asof.isoformat(),
        }
        for ticker, sector_score in rows
    ]
