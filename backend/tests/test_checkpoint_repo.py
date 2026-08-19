"""CheckpointRepository watermark persistence."""

from datetime import UTC, datetime

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import IngestionCheckpoint
from app.infrastructure.repositories.checkpoint_repo import CheckpointRepository


async def test_checkpoint_roundtrip(session: AsyncSession):
    await session.execute(delete(IngestionCheckpoint))
    await session.commit()
    repo = CheckpointRepository(session)
    assert await repo.get("ingest_macro") is None
    wm = datetime(2026, 8, 19, 0, 0, tzinfo=UTC)
    await repo.set("ingest_macro", wm)
    assert await repo.get("ingest_macro") == wm
    wm2 = datetime(2026, 8, 20, 0, 0, tzinfo=UTC)
    await repo.set("ingest_macro", wm2)
    assert await repo.get("ingest_macro") == wm2
