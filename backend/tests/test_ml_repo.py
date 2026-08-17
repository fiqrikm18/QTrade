"""ML registry + predictions repository."""

from __future__ import annotations

from datetime import date

import pytest_asyncio
from sqlalchemy import func, select

from app.infrastructure.database.models import MLModel, MLPrediction
from app.infrastructure.repositories.ml_repo import MLRepository


@pytest_asyncio.fixture(loop_scope="session", autouse=True)
async def _clean(session):
    await session.execute(MLPrediction.__table__.delete())
    await session.execute(MLModel.__table__.delete())
    await session.commit()
    yield


async def test_register_and_promote(session):
    repo = MLRepository(session)
    meta = MLModel(
        model_name="lr_up",
        model_version="v1",
        target="up",
        horizon=5,
        feature_version="v1",
        features_hash="abc",
        training_start=date(2024, 1, 1),
        training_end=date(2024, 12, 31),
        metrics={"roc_auc": 0.55},
        artifact_path="models/lr_up_v1.joblib",
        status="staging",
    )
    await repo.register_model(meta)
    await repo.set_status("lr_up", "v1", "production")
    prod = await repo.get_production_model("lr_up")
    assert prod is not None and prod.status == "production"


async def test_append_predictions_is_append_only(session):
    repo = MLRepository(session)
    row = {
        "ticker": "BBCA",
        "asof_date": date(2024, 3, 1),
        "model_name": "lr_up",
        "model_version": "v1",
        "feature_version": "v1",
        "probability": 0.62,
        "expected_return": 0.01,
        "confidence": 0.55,
        "prediction_class": "up",
    }
    n1 = await repo.append_predictions([row])
    n2 = await repo.append_predictions([row])
    assert n1 == 1 and n2 == 0  # second insert is a no-op (unique key), never an update
    count = (
        await session.execute(select(func.count()).select_from(MLPrediction))
    ).scalar()
    assert count == 1


async def test_latest_predictions_returns_rows(session):
    repo = MLRepository(session)
    await repo.append_predictions(
        [
            {
                "ticker": "BBCA",
                "asof_date": date(2024, 3, 1),
                "model_name": "lr_up",
                "model_version": "v1",
                "feature_version": "v1",
                "probability": 0.62,
                "prediction_class": "up",
            },
            {
                "ticker": "BBRI",
                "asof_date": date(2024, 3, 1),
                "model_name": "lr_up",
                "model_version": "v1",
                "feature_version": "v1",
                "probability": 0.51,
                "prediction_class": "up",
            },
        ]
    )
    rows = await repo.latest_predictions("lr_up", "v1", date(2024, 3, 1))
    assert len(rows) == 2
    assert {r["ticker"] for r in rows} == {"BBCA", "BBRI"}
