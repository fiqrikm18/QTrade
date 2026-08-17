"""Walk-forward trainer: time-only splits, train-only normalization."""

from __future__ import annotations

from datetime import date, timedelta

import polars as pl

from app.application.services.ml_trainer import (
    WalkForwardResult,
    run_walk_forward,
    save_model_artifact,
)
from app.domain.ml.dataset import (
    FEATURE_COLUMNS,
    build_labeled_dataset,
    cross_sectional_threshold,
)


def _synthetic_dataset(n_days: int = 120, n_tickers: int = 4) -> pl.DataFrame:
    """Labeled dataset with a learnable per-date signal: higher rsi -> higher return.

    rsi differs per ticker per day (t-offset + day cycle); close embeds the rsi
    term so forward_return correlates with rsi across tickers within each date,
    guaranteeing both label classes appear (per-date median threshold splits them).
    """
    start = date(2024, 1, 1)
    dates = [start + timedelta(days=i) for i in range(n_days)]
    rows = []
    for t in range(n_tickers):
        base = 100.0 + 10.0 * t
        for i, d in enumerate(dates):
            rsi = 30.0 + (i % 40) + 5.0 * t
            rows.append(
                {
                    "ticker": f"T{t}",
                    "trade_date": d,
                    **{c: float(rsi) for c in FEATURE_COLUMNS},
                    "close": base * (1 + 0.001 * i + 0.001 * rsi),
                }
            )
    feat = pl.DataFrame(
        rows,
        schema={
            **{c: pl.Float64 for c in FEATURE_COLUMNS},
            "ticker": pl.Utf8,
            "trade_date": pl.Date,
            "close": pl.Float64,
        },
    )
    closes = feat.select("ticker", "trade_date", "close")
    labeled = build_labeled_dataset(feat.drop("close"), closes, horizon=5)
    return cross_sectional_threshold(labeled)


def test_walk_forward_splits_are_temporal():
    df = _synthetic_dataset()
    result = run_walk_forward(
        df, horizon=5, feature_version="v1", val_frac=0.2, test_frac=0.2
    )
    assert isinstance(result, WalkForwardResult)
    assert result.training_end < result.validation_start
    assert result.validation_end < result.test_start
    assert result.test_end <= df["asof_date"].max()


def test_walk_forward_learns_and_reports_metrics():
    df = _synthetic_dataset()
    result = run_walk_forward(df, horizon=5, feature_version="v1")
    assert "roc_auc" in result.metrics
    assert "ic" in result.metrics
    assert result.feature_columns == FEATURE_COLUMNS
    assert result.features_hash == result.features_hash
    # A learnable synthetic signal must beat 0.5 AUC on the held-out test.
    assert result.metrics["roc_auc"] > 0.5


def test_artifact_roundtrip(tmp_path):
    df = _synthetic_dataset()
    result = run_walk_forward(df, horizon=5, feature_version="v1")
    path = tmp_path / "model.joblib"
    save_model_artifact(result, str(path))
    assert path.exists()
    import joblib

    blob = joblib.load(path)
    assert blob["feature_columns"] == FEATURE_COLUMNS
    assert blob["features_hash"] == result.features_hash
    assert "model" in blob and "calibrator" in blob
