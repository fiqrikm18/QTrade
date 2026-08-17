"""Walk-forward model training (docs/ml.md §4): time-only splits, no leakage.

Protocol:
1. Split rows by ``asof_date``: train [start, split1], validation
   (split1, split2], test (split2, end].
2. Fit StandardScaler + LogisticRegression on train only.
3. Calibrate probabilities (Platt/sigmoid) on validation via
   ``CalibratedClassifierCV(cv='prefit')``.
4. Evaluate metrics ONCE on test (held-out, most recent).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Protocol, cast

import joblib  # pyright: ignore[reportMissingTypeStubs]
import numpy as np
import polars as pl
import sklearn.linear_model as _skll  # pyright: ignore[reportMissingTypeStubs]
import sklearn.pipeline as _skp  # pyright: ignore[reportMissingTypeStubs]
import sklearn.preprocessing as _skpr  # pyright: ignore[reportMissingTypeStubs]
from sklearn.calibration import (  # pyright: ignore[reportMissingTypeStubs]
    CalibratedClassifierCV,
    FrozenEstimator,
)

from app.domain.ml.dataset import FEATURE_COLUMNS, features_hash
from app.domain.ml.metrics import compute_classification_metrics, compute_ic


class _Classifier(Protocol):
    def fit(self, x: np.ndarray, y: list[int]) -> _Classifier: ...

    def predict_proba(self, x: np.ndarray) -> np.ndarray: ...


class _PipelineFactory(Protocol):
    def __call__(self, *steps: object) -> _Classifier: ...


class _Dump(Protocol):
    def __call__(self, value: object, filename: object) -> list[str]: ...


_StandardScaler = cast("type", getattr(_skpr, "StandardScaler"))
_LogisticRegression = cast("type", getattr(_skll, "LogisticRegression"))
_make_pipeline = cast("_PipelineFactory", getattr(_skp, "make_pipeline"))
_joblib_dump = cast("_Dump", getattr(joblib, "dump"))


@dataclass
class WalkForwardResult:
    model: object
    calibrator: object
    metrics: dict[str, float | list[float]]
    training_start: date
    training_end: date
    validation_start: date
    validation_end: date
    test_start: date
    test_end: date
    feature_columns: list[str] = field(default_factory=lambda: FEATURE_COLUMNS)
    features_hash: str = ""


def _split_dates(
    df: pl.DataFrame, val_frac: float, test_frac: float
) -> tuple[date, date, date, date, date, date]:
    dates = sorted(df["asof_date"].unique().to_list())
    n = len(dates)
    n_val = max(1, round(n * val_frac))
    n_test = max(1, round(n * test_frac))
    n_train = n - n_val - n_test
    assert n_train >= 10, "not enough distinct dates for a train window"
    train_end = dates[n_train - 1]
    val_start = dates[n_train]
    val_end = dates[n_train + n_val - 1]
    test_start = dates[n_train + n_val]
    return dates[0], train_end, val_start, val_end, test_start, dates[-1]


def run_walk_forward(
    df: pl.DataFrame,
    horizon: int,
    feature_version: str,
    val_frac: float = 0.2,
    test_frac: float = 0.2,
    seed: int = 42,
) -> WalkForwardResult:
    """Train + calibrate + evaluate on time-based splits. Returns metadata."""
    train_start, train_end, val_start, val_end, test_start, test_end = _split_dates(
        df, val_frac, test_frac
    )
    labeled = df.filter(pl.col("label_class").is_not_null())

    def slice_by_dates(a: date, b: date) -> pl.DataFrame:
        return labeled.filter((pl.col("asof_date") >= a) & (pl.col("asof_date") <= b))

    train = slice_by_dates(train_start, train_end)
    val = slice_by_dates(val_start, val_end)
    test = slice_by_dates(test_start, test_end)

    x_train = train.select(FEATURE_COLUMNS).to_numpy()
    y_train = train["label_class"].to_list()
    x_val = val.select(FEATURE_COLUMNS).to_numpy()
    y_val = val["label_class"].to_list()
    x_test = test.select(FEATURE_COLUMNS).to_numpy()
    y_test = test["label_class"].to_list()

    pipeline = _make_pipeline(
        _StandardScaler(),
        _LogisticRegression(max_iter=1000, random_state=seed),
    )
    fitted: _Classifier = pipeline.fit(x_train, y_train)

    # Platt calibration on the held-out validation window. sklearn 1.9 removed
    # ``cv="prefit"``; ``FrozenEstimator`` pins the trained estimator so only the
    # sigmoid calibrator(s) are fit on validation (no refit of the classifier).
    calibrator: _Classifier = cast(
        "_Classifier",
        CalibratedClassifierCV(FrozenEstimator(fitted), method="sigmoid", cv=2),
    )
    calibrator.fit(x_val, y_val)

    proba = calibrator.predict_proba(x_test)
    y_prob: list[float] = proba[:, 1].tolist()
    y_pred = [1 if p >= 0.5 else 0 for p in y_prob]
    metrics: dict[str, float | list[float]] = cast(
        "dict[str, float | list[float]]",
        compute_classification_metrics(y_test, y_pred, y_prob),
    )

    test_df = test.with_columns(
        pl.Series("probability", y_prob),
        pl.Series("predicted_class", y_pred),
    )
    ic = compute_ic(
        test_df.select("ticker", "asof_date", "probability", "forward_return")
    )
    metrics["ic"] = ic["ic"]
    metrics["icir"] = ic["icir"]

    return WalkForwardResult(
        model=fitted,
        calibrator=calibrator,
        metrics=metrics,
        training_start=train_start,
        training_end=train_end,
        validation_start=val_start,
        validation_end=val_end,
        test_start=test_start,
        test_end=test_end,
        feature_columns=FEATURE_COLUMNS,
        features_hash=features_hash(feature_version, FEATURE_COLUMNS),
    )


def save_model_artifact(result: WalkForwardResult, path: str) -> None:
    """Persist model + metadata as a single joblib blob."""
    _joblib_dump(
        {
            "model": result.model,
            "calibrator": result.calibrator,
            "feature_columns": result.feature_columns,
            "features_hash": result.features_hash,
            "metrics": result.metrics,
            "training_start": result.training_start.isoformat(),
            "training_end": result.training_end.isoformat(),
            "test_start": result.test_start.isoformat(),
            "test_end": result.test_end.isoformat(),
        },
        path,
    )
