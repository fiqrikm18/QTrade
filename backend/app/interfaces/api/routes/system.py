"""System status API route — honest runtime state."""

from datetime import datetime, time
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.infrastructure.database.models import (
    EconomicEvent,
    EconomicIndicator,
    FinancialStatement,
    NewsArticle,
    OhlcvDaily,
    StockScore,
)
from app.infrastructure.database.session import get_session
from app.interfaces.workers.jobs import get_queue

router = APIRouter()

_WIB = ZoneInfo("Asia/Jakarta")


def _market_open(now: datetime) -> bool:
    """IDX trading hours: Mon-Fri 09:00-15:50 WIB. Holidays not modelled —
    the value is derived from real time, never a static label."""
    if now.weekday() >= 5:
        return False
    return time(9, 0) <= now.time() <= time(15, 50)


@router.get("/status", response_model=dict[str, object])
async def system_status(
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    settings = get_settings()
    now = datetime.now(_WIB)
    jobs_running: int | None
    try:
        queue = get_queue()
        jobs_running = (
            queue.started_job_registry.count + queue.scheduled_job_registry.count
        )
    except Exception:
        jobs_running = None

    latest_ohlcv = await session.scalar(select(func.max(OhlcvDaily.trade_date)))
    latest_macro = await session.scalar(select(func.max(EconomicIndicator.asof_date)))
    latest_news = await session.scalar(select(func.max(NewsArticle.published_at)))
    latest_fund = await session.scalar(
        select(func.max(FinancialStatement.available_at))
    )
    latest_scan = await session.scalar(select(func.max(StockScore.asof_date)))
    latest_event = await session.scalar(select(func.max(EconomicEvent.scheduled_at)))

    return {
        "market_open": _market_open(now),
        "provider": settings.market_data_provider,
        "llm_enabled": settings.llm_enabled,
        "jobs_running": jobs_running,
        "data_freshness": {
            "ohlcv": latest_ohlcv.isoformat() if latest_ohlcv else None,
            "macro": latest_macro.isoformat() if latest_macro else None,
            "news": latest_news.isoformat() if latest_news else None,
            "fundamentals": latest_fund.isoformat() if latest_fund else None,
            "latest_scan": latest_scan.isoformat() if latest_scan else None,
            "latest_event": latest_event.isoformat() if latest_event else None,
        },
    }
