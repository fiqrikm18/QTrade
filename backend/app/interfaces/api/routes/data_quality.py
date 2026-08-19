"""Data-quality API route — real report from ohlcv_daily."""

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.data_quality_service import build_quality_report
from app.infrastructure.database.session import get_session

router = APIRouter()


@router.get("", response_model=dict[str, Any])
async def data_quality(
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Real OHLCV data-quality report (scores, issues, freshness)."""
    return await build_quality_report(session)
