"""Economic calendar API routes — read from economic_events."""

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_session
from app.infrastructure.repositories.macro_repo import MacroRepository

router = APIRouter()


@router.get("/events", response_model=list[dict[str, Any]])
async def calendar_events(
    limit: int = Query(default=30, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Get upcoming economic calendar events from the ingested series."""
    return await MacroRepository(session).upcoming_events(limit=limit)
