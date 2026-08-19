"""Crawler watermark checkpoints (docs/data-pipeline.md §2.1)."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import IngestionCheckpoint


class CheckpointRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, job_name: str) -> datetime | None:
        row = await self._session.scalar(
            select(IngestionCheckpoint.watermark).where(
                IngestionCheckpoint.job_name == job_name
            )
        )
        return row

    async def set(self, job_name: str, watermark: datetime) -> None:
        stmt = pg_insert(IngestionCheckpoint).values(
            job_name=job_name, watermark=watermark
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["job_name"],
            set_={"watermark": stmt.excluded["watermark"]},
        )
        await self._session.execute(stmt)
        await self._session.commit()
