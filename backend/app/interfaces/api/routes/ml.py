"""ML API routes: model registry + predictions metadata."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import MLModel
from app.infrastructure.database.session import get_session
from app.infrastructure.repositories.ml_repo import MLRepository

router = APIRouter()


@router.get("/models", response_model=list[dict[str, object]])
async def list_models(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    rows = (
        (await session.execute(select(MLModel).order_by(MLModel.created_at.desc())))
        .scalars()
        .all()
    )
    return [
        {
            "model_name": r.model_name,
            "model_version": r.model_version,
            "target": r.target,
            "horizon": r.horizon,
            "feature_version": r.feature_version,
            "features_hash": r.features_hash,
            "training_start": r.training_start.isoformat()
            if r.training_start
            else None,
            "training_end": r.training_end.isoformat() if r.training_end else None,
            "metrics": r.metrics or {},
            "status": r.status,
        }
        for r in rows
    ]


@router.get("/models/{model_name}/{model_version}", response_model=dict[str, object])
async def get_model(
    model_name: str,
    model_version: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    repo = MLRepository(session)
    model = await repo.get_model(model_name, model_version)
    if model is None:
        raise HTTPException(status_code=404, detail="model not found")
    return {
        "model_name": model.model_name,
        "model_version": model.model_version,
        "target": model.target,
        "horizon": model.horizon,
        "feature_version": model.feature_version,
        "features_hash": model.features_hash,
        "training_start": model.training_start.isoformat()
        if model.training_start
        else None,
        "training_end": model.training_end.isoformat() if model.training_end else None,
        "metrics": model.metrics or {},
        "status": model.status,
        "artifact_path": model.artifact_path,
    }
