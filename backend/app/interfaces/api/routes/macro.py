"""Macro API routes.

``GET /api/v1/macro/indicators`` serves the curated seed reference dataset
(``app/domain/reference_data``) until the ``economic_data_ingestion`` job
(PRD §40) populates the ``economic_indicators`` table (docs/data-model.md §7).
"""

from typing import Any

from fastapi import APIRouter

from app.domain.reference_data import MACRO_INDICATORS

router = APIRouter()


@router.get("/indicators", response_model=list[dict[str, Any]])
async def macro_indicators() -> list[dict[str, Any]]:
    """Get macro indicators (seed reference data)."""
    return [dict(item) for item in MACRO_INDICATORS]
