"""Alert API routes.

``GET /api/v1/alerts`` derives alerts from the latest scan artifacts
(``stock_scores`` at the newest ``asof`` for the default profile) — the same
source the scanner and ``market`` routes use. No alert is fabricated: every
item maps a persisted score to a threshold rule (PRD §30).

The ``alerts`` / ``alert_events`` tables (docs/data-model.md §9) are reserved
for user-managed alert subscriptions once account features land; until then
the scan-derived view is the only source of truth.
"""

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import StockScore
from app.infrastructure.database.session import get_session

router = APIRouter()

DEFAULT_PROFILE = "balanced"
_MAX_ALERTS = 30


def _impact(score: float, threshold: float) -> str:
    """Map a score delta above threshold to an impact level."""
    if score >= threshold + 15:
        return "HIGH"
    if score >= threshold:
        return "MEDIUM"
    return "LOW"


@router.get("", response_model=list[dict[str, Any]])
@router.get("/", response_model=list[dict[str, Any]], include_in_schema=False)
async def alerts(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Get scan-derived alerts for the latest asof (PRD §30)."""
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
    rows = (
        await session.execute(
            select(StockScore)
            .where(
                StockScore.profile == DEFAULT_PROFILE,
                StockScore.asof_date == asof,
            )
            .order_by(StockScore.opportunity_score.desc())
        )
    ).scalars()
    out: list[dict[str, Any]] = []
    for score in rows:
        ticker = score.ticker
        asof_text = asof.isoformat()
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
        risk = float(score.risk_score) if score.risk_score is not None else 0.0

        rules: list[tuple[str, str, str, float, float]] = []
        if opportunity >= 80:
            rules.append(
                (
                    "market",
                    f"{ticker} opportunity score {opportunity:.0f} ≥ 80 — top of "
                    "the latest scan",
                    "Opportunity score ≥ 80",
                    80.0,
                    opportunity,
                )
            )
        if technical >= 80:
            rules.append(
                (
                    "technical",
                    f"{ticker} technical score {technical:.0f} ≥ 80 — strong "
                    "momentum and trend alignment",
                    "Technical score ≥ 80",
                    80.0,
                    technical,
                )
            )
        if fundamental >= 80:
            rules.append(
                (
                    "fundamental",
                    f"{ticker} fundamental score {fundamental:.0f} ≥ 80 — solid "
                    "quality and valuation profile",
                    "Fundamental score ≥ 80",
                    80.0,
                    fundamental,
                )
            )
        if smart_money >= 75:
            rules.append(
                (
                    "market",
                    f"{ticker} smart-money score {smart_money:.0f} ≥ 75 — possible "
                    "institutional accumulation",
                    "Smart-money score ≥ 75",
                    75.0,
                    smart_money,
                )
            )
        if risk >= 70:
            rules.append(
                (
                    "market",
                    f"{ticker} risk score {risk:.0f} ≥ 70 — elevated drawdown or "
                    "volatility risk",
                    "Risk score ≥ 70",
                    70.0,
                    risk,
                )
            )
        for alert_type, message, trigger, threshold, value in rules:
            out.append(
                {
                    "id": f"{ticker}-{trigger.split()[0].lower()}-{asof_text}",
                    "time": f"{asof_text}T09:00:00+07:00",
                    "type": alert_type,
                    "ticker": ticker,
                    "message": message,
                    "impact": _impact(value, threshold),
                    "status": "active",
                    "trigger": trigger,
                    "acknowledged": False,
                    "severity": _impact(value, threshold),
                }
            )
    out.sort(key=lambda a: a["impact"] != "HIGH")
    return out[:_MAX_ALERTS]
