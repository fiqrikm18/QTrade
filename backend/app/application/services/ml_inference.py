"""ML inference after each market scan (docs/ml.md §6), gated by ML_ENABLED.

Deterministic path is unchanged when ML is off: ``ml_score`` stays None and
no predictions are written. With ML on, the deployed production artifact is
loaded once, predictions are appended (never overwritten), and ``ml_score``
is blended into the scan's ScoreComponents.
"""

from __future__ import annotations

import joblib  # pyright: ignore[reportMissingTypeStubs]
from datetime import date
from typing import Protocol, cast

import numpy as np
import polars as pl

from app.config.settings import get_settings
from app.domain.ml.dataset import FEATURE_COLUMNS
from app.infrastructure.database.session import AsyncSession
from app.infrastructure.repositories.ml_repo import MLRepository
from app.infrastructure.repositories.stock_score_repo import StockScoreRepository


class _Load(Protocol):
    def __call__(self, filename: object) -> dict[str, object]: ...


_joblib_load = cast("_Load", getattr(joblib, "load"))


class _ProbaModel(Protocol):
    def predict_proba(self, x: np.ndarray) -> np.ndarray: ...


def compute_ml_score(probability: float, confidence: float) -> float:
    """docs/ml.md §6 default formula (versioned)."""
    base = 50.0 + 50.0 * (2.0 * (probability - 0.5))
    base = max(0.0, min(100.0, base))
    confidence_factor = 0.5 + 0.5 * confidence
    return max(0.0, min(100.0, base * confidence_factor))


def predict_frame(blob: dict[str, object], features: pl.DataFrame) -> pl.DataFrame:
    """Add probability/confidence/prediction_class/ml_score from a loaded artifact."""
    calibrator = cast(_ProbaModel, blob["calibrator"])
    x = features.select(FEATURE_COLUMNS).to_numpy()
    proba = calibrator.predict_proba(x)[:, 1]
    confidence = np.maximum(proba, 1.0 - proba)
    score = np.array(
        [
            compute_ml_score(float(p), float(c))
            for p, c in zip(proba, confidence, strict=True)
        ]
    )
    return features.with_columns(
        pl.Series("probability", proba),
        pl.Series("confidence", confidence),
        pl.Series(
            "prediction_class",
            ["up" if p >= 0.5 else "down" for p in proba],
        ),
        pl.Series("ml_score", score),
    )


async def run_ml_inference(
    session: AsyncSession,
    tickers: list[str],
    asof: date,
    model_name: str = "lr_up",
) -> int:
    """Load production artifact, predict on latest features, append predictions.

    Returns the number of prediction rows appended (0 when ML is disabled or
    no production model exists).
    """
    settings = get_settings()
    if not settings.ml_enabled:
        return 0
    repo = MLRepository(session)
    model = await repo.get_production_model(model_name)
    if model is None or model.artifact_path is None:
        return 0
    blob = _joblib_load(model.artifact_path)
    features = await StockScoreRepository(session).latest_feature_frame(tickers)
    if features is None or features.is_empty():
        return 0
    predicted = predict_frame(blob, features)
    rows: list[dict[str, object]] = [
        {
            "ticker": r["ticker"],
            "asof_date": asof,
            "model_name": model_name,
            "model_version": model.model_version,
            "feature_version": model.feature_version,
            "probability": r["probability"],
            "confidence": r["confidence"],
            "prediction_class": r["prediction_class"],
        }
        for r in predicted.to_dicts()
    ]
    return await repo.append_predictions(rows)
