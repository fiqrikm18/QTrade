"""System status API route — honest runtime state."""

from datetime import datetime, time
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.infrastructure.database.session import get_session
from app.infrastructure.repositories.checkpoint_repo import CheckpointRepository
from app.interfaces.workers.jobs import get_queue

router = APIRouter()

_WIB = ZoneInfo("Asia/Jakarta")


def _market_open(now: datetime) -> bool:
    """IDX trading hours: Mon-Fri 09:00-15:50 WIB. Holidays not modelled —
    the value is derived from real time, never a static label."""
    if now.weekday() >= 5:
        return False
    return time(9, 0) <= now.time() <= time(15, 50)


async def _db_healthy(session: AsyncSession) -> bool:
    try:
        await session.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


async def _redis_healthy() -> bool:
    try:
        queue = get_queue()
        queue.connection.ping()
        return True
    except Exception:
        return False


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

    checkpoints = CheckpointRepository(session)
    ohlcv_wm = await checkpoints.get("ingest_ohlcv_daily")
    macro_wm = await checkpoints.get("ingest_macro")
    calendar_wm = await checkpoints.get("ingest_calendar")
    news_wm = await checkpoints.get("ingest_news")
    fundamentals_wm = await checkpoints.get("ingest_fundamentals")

    db_status = "healthy" if await _db_healthy(session) else "unhealthy"
    redis_status = "healthy" if await _redis_healthy() else "unhealthy"

    return {
        "market_open": _market_open(now),
        "provider": settings.market_data_provider,
        "llm_enabled": settings.llm_enabled,
        "db_status": db_status,
        "redis_status": redis_status,
        "jobs_running": jobs_running,
        "data_freshness": {
            "ohlcv": ohlcv_wm.isoformat() if ohlcv_wm else None,
            "macro": macro_wm.isoformat() if macro_wm else None,
            "news": news_wm.isoformat() if news_wm else None,
            "fundamentals": fundamentals_wm.isoformat() if fundamentals_wm else None,
            "latest_scan": calendar_wm.isoformat() if calendar_wm else None,
        },
    }
