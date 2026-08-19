"""News API routes — read from news/news_entities (docs/data-model.md §11)."""

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_session
from app.infrastructure.repositories.news_repo import NewsRepository

router = APIRouter()


@router.get("", response_model=list[dict[str, Any]])
@router.get("/", response_model=list[dict[str, Any]], include_in_schema=False)
async def news_items(
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Get the latest ingested news items."""
    return await NewsRepository(session).latest_news(limit=limit)
