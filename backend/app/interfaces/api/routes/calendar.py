"""Economic calendar API routes.

``GET /api/v1/calendar/events`` serves the curated seed reference dataset
(``app/domain/reference_data``) until the ``economic_data_ingestion`` job
(PRD §40) populates the ``economic_events`` table (docs/data-model.md §7).

The path is ``/calendar/events`` to match the frontend contract
(``frontend/src/lib/api.ts`` → ``getCalendarEvents``), not the PRD's planned
``/economic-calendar`` path.
"""

from typing import Any

from fastapi import APIRouter

from app.domain.reference_data import CALENDAR_EVENTS

router = APIRouter()


@router.get("/events", response_model=list[dict[str, Any]])
async def calendar_events() -> list[dict[str, Any]]:
    """Get upcoming economic events (seed reference data)."""
    return [dict(item) for item in CALENDAR_EVENTS]
