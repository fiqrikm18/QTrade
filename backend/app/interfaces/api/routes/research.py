"""Research memo API routes.

``GET /api/v1/research/memos`` derives memos from the latest scan artifacts
(``stock_scores`` at the newest ``asof`` for the default profile). Each memo
summarizes the top opportunities with their component scores — the same data
the screener and stock analysis pages show. No memo is fabricated; thesis text
is templated from persisted scores and the classification label.

A future ``research_memos`` table (docs/PRD.md §29 research workflow) will
hold analyst-written memos; until then the scan-derived view is the source.
"""

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import Stock, StockScore
from app.infrastructure.database.session import get_session

router = APIRouter()

DEFAULT_PROFILE = "balanced"
_MAX_MEMOS = 10


@router.get("/memos", response_model=list[dict[str, Any]])
async def research_memos(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Get research memos for the top opportunities (latest scan)."""
    asof: date | None = (
        await session.execute(
            select(func.max(StockScore.asof_date)).where(
                StockScore.profile == DEFAULT_PROFILE,
                StockScore.scoring_version == "v1",
            )
        )
    ).scalar()
    if asof is None:
        return []
    scores = list(
        (
            await session.execute(
                select(StockScore)
                .where(
                    StockScore.profile == DEFAULT_PROFILE,
                    StockScore.asof_date == asof,
                )
                .order_by(StockScore.opportunity_score.desc())
                .limit(_MAX_MEMOS)
            )
        ).scalars()
    )
    rows = (
        await session.execute(
            select(Stock.ticker, Stock.name).where(
                Stock.ticker.in_([score.ticker for score in scores])
            )
        )
    ).all()
    names: dict[str, str] = {ticker: name for ticker, name in rows}
    out: list[dict[str, Any]] = []
    for score in scores:
        ticker = score.ticker
        name = names.get(ticker, ticker)
        opportunity = (
            float(score.opportunity_score)
            if score.opportunity_score is not None
            else 0.0
        )
        technical = (
            float(score.technical_score) if score.technical_score is not None else 0.0
        )
        fundamental = (
            float(score.fundamental_score)
            if score.fundamental_score is not None
            else 0.0
        )
        smart_money = (
            float(score.smart_money_score)
            if score.smart_money_score is not None
            else 0.0
        )
        classification = score.classification or "NEUTRAL"
        drivers = score.drivers or []
        thesis = (
            f"{name} ({ticker}) scores {opportunity:.0f}/100 on the latest scan "
            f"({asof.isoformat()}) with a {classification.lower()} classification. "
            f"Technical {technical:.0f}, fundamental {fundamental:.0f}, "
            f"smart-money {smart_money:.0f}. "
            f"Key drivers: {'; '.join(drivers[:3]) if drivers else 'n/a'}."
        )
        out.append(
            {
                "id": f"memo-{ticker}-{asof.isoformat()}",
                "title": f"{name}: {classification.lower()} play",
                "tickers": [ticker],
                "date": asof.isoformat(),
                "thesis": thesis,
                "scores": {
                    "technical": technical,
                    "smartMoney": smart_money,
                    "fundamental": fundamental,
                },
            }
        )
    return out
