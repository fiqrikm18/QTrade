"""GET /api/v1/system/status — real runtime state, nothing fabricated."""

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import IngestionCheckpoint, StockScore

BASE_URL = "/api/v1/system/status"


async def test_status_shape(client, session: AsyncSession):
    await session.execute(delete(StockScore))
    await session.execute(delete(IngestionCheckpoint))
    await session.commit()
    response = await client.get(BASE_URL)
    assert response.status_code == 200
    data = response.json()
    for key in (
        "market_open",
        "provider",
        "llm_enabled",
        "db_status",
        "redis_status",
        "jobs_running",
        "data_freshness",
    ):
        assert key in data, f"missing key {key}"
    assert isinstance(data["market_open"], bool)
    assert data["provider"] in ("yfinance",)
    assert isinstance(data["llm_enabled"], bool)
    assert data["db_status"] in ("healthy", "unhealthy")
    assert data["redis_status"] in ("healthy", "unhealthy")
    freshness = data["data_freshness"]
    assert "ohlcv" in freshness
    assert "macro" in freshness
    assert "news" in freshness
    assert "fundamentals" in freshness
    assert "latest_scan" in freshness
    assert "latest_event" not in freshness
    # All freshness values should be None when no checkpoints exist
    for v in freshness.values():
        assert v is None
