"""News API routes.

``GET /api/v1/news`` serves the curated seed reference dataset
(``app/domain/reference_data``) until the ``news_ingestion`` job (PRD §40)
populates the ``news`` / ``news_entities`` / ``news_sentiment_scores`` tables
(docs/data-model.md §8).
"""

from typing import Any

from fastapi import APIRouter

from app.domain.reference_data import NEWS_ITEMS

router = APIRouter()


@router.get("", response_model=list[dict[str, Any]])
@router.get("/", response_model=list[dict[str, Any]], include_in_schema=False)
async def news_items() -> list[dict[str, Any]]:
    """Get recent news items (seed reference data)."""
    return [dict(item) for item in NEWS_ITEMS]
