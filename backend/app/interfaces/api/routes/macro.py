"""Macro API routes — read from economic_indicators (docs/data-model.md §7)."""

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_session
from app.infrastructure.repositories.macro_repo import MacroRepository

router = APIRouter()


@router.get("/indicators", response_model=list[dict[str, Any]])
async def macro_indicators(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Get the latest macro indicator values from the ingested series."""
    return await MacroRepository(session).latest_indicators()
