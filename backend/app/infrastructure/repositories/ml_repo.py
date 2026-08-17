from __future__ import annotations

"""ML model registry + predictions persistence (docs/data-model.md §10).

``ml_predictions`` is append-only by design: inserts use Postgres
ON CONFLICT DO NOTHING keyed on (ticker, asof_date, model_name, model_version),
so re-runs never overwrite or duplicate history.
"""

from datetime import date

from typing import cast

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import MLModel, MLPrediction


class MLRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def register_model(self, meta: MLModel) -> None:
        self._session.add(meta)
        await self._session.flush()

    async def get_model(self, model_name: str, model_version: str) -> MLModel | None:
        return (
            await self._session.execute(
                select(MLModel).where(
                    MLModel.model_name == model_name,
                    MLModel.model_version == model_version,
                )
            )
        ).scalar_one_or_none()

    async def get_production_model(self, model_name: str) -> MLModel | None:
        return (
            (
                await self._session.execute(
                    select(MLModel)
                    .where(
                        MLModel.model_name == model_name, MLModel.status == "production"
                    )
                    .order_by(MLModel.created_at.desc())
                    .limit(1)
                )
            )
            .scalars()
            .first()
        )

    async def set_status(
        self, model_name: str, model_version: str, status: str
    ) -> None:
        await self._session.execute(
            update(MLModel)
            .where(
                MLModel.model_name == model_name,
                MLModel.model_version == model_version,
            )
            .values(status=status)
        )
        await self._session.flush()

    async def append_predictions(self, rows: list[dict[str, object]]) -> int:
        """Insert predictions; existing rows are left untouched (append-only)."""
        if not rows:
            return 0
        stmt = pg_insert(MLPrediction).values(rows)
        stmt = stmt.on_conflict_do_nothing(
            index_elements=[
                "ticker",
                "asof_date",
                "model_name",
                "model_version",
            ]
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        rc = cast("int | None", getattr(result, "rowcount", None))
        return rc or 0

    async def latest_predictions(
        self, model_name: str, model_version: str, asof: date
    ) -> list[dict[str, object]]:
        rows = (
            (
                await self._session.execute(
                    select(MLPrediction)
                    .where(
                        MLPrediction.model_name == model_name,
                        MLPrediction.model_version == model_version,
                        MLPrediction.asof_date == asof,
                    )
                    .order_by(MLPrediction.ticker)
                )
            )
            .scalars()
            .all()
        )
        return [
            {
                "ticker": r.ticker,
                "asof_date": r.asof_date,
                "probability": (
                    float(r.probability) if r.probability is not None else None
                ),
                "expected_return": (
                    float(r.expected_return) if r.expected_return is not None else None
                ),
                "confidence": float(r.confidence) if r.confidence is not None else None,
                "prediction_class": r.prediction_class,
                "prediction_timestamp": r.created_at,
            }
            for r in rows
        ]
