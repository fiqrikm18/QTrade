"""ML evaluation metrics: statistical + financial (docs/ml.md §5, PRD §26).

Financial metrics (CAGR/Sharpe) come from the backtest engine (Tasks 7-8);
this module computes the model-level statistics reported in ``ml_models``.
"""

from __future__ import annotations

import math
from typing import Protocol, cast

import polars as pl
import sklearn.metrics as _skm  # pyright: ignore[reportMissingTypeStubs]


class _FloatMetric(Protocol):
    """Callable returning a float scalar (sklearn metric signature family)."""

    def __call__(self, *args: object, **kwargs: object) -> float: ...


_accuracy_score = cast("_FloatMetric", getattr(_skm, "accuracy_score"))
_brier_score_loss = cast("_FloatMetric", getattr(_skm, "brier_score_loss"))
_f1_score = cast("_FloatMetric", getattr(_skm, "f1_score"))
_precision_score = cast("_FloatMetric", getattr(_skm, "precision_score"))
_recall_score = cast("_FloatMetric", getattr(_skm, "recall_score"))
_roc_auc_score = cast("_FloatMetric", getattr(_skm, "roc_auc_score"))


def hit_ratio(y_true: list[int], y_prob: list[float], top_k_pct: float = 0.2) -> float:
    """Fraction of top-``top_k_pct``-by-probability names that were up."""
    if not y_true:
        return 0.0
    n_top = max(1, math.ceil(len(y_true) * top_k_pct))
    ranked = sorted(zip(y_prob, y_true, strict=True), key=lambda p: p[0], reverse=True)
    top = ranked[:n_top]
    if not top:
        return 0.0
    return sum(1 for _, label in top if label == 1) / len(top)


def compute_classification_metrics(
    y_true: list[int], y_pred: list[int], y_prob: list[float]
) -> dict[str, float]:
    """Standard classification metrics + Brier (calibration) + hit ratio."""
    if len(set(y_true)) < 2:
        return {
            "accuracy": _accuracy_score(y_true, y_pred),
            "precision": 0.0,
            "recall": 0.0,
            "f1": 0.0,
            "roc_auc": 0.5,
            "brier": _brier_score_loss(y_true, y_prob),
            "hit_ratio": hit_ratio(y_true, y_prob),
        }
    return {
        "accuracy": _accuracy_score(y_true, y_pred),
        "precision": _precision_score(y_true, y_pred, zero_division=0),
        "recall": _recall_score(y_true, y_pred, zero_division=0),
        "f1": _f1_score(y_true, y_pred, zero_division=0),
        "roc_auc": _roc_auc_score(y_true, y_prob),
        "brier": _brier_score_loss(y_true, y_prob),
        "hit_ratio": hit_ratio(y_true, y_prob),
    }


def compute_ic(df: pl.DataFrame) -> dict[str, float | list[float]]:
    """Spearman IC per asof date + aggregate IC/ICIR + overall Spearman.

    Expects columns ``ticker, asof_date, probability, forward_return``.
    Per-date IC: Spearman correlation of probability vs forward_return across
    tickers. ICIR = mean(IC) / std(IC); constant IC (std==0) yields ``inf``
    (perfect rank agreement across dates). Undefined IC (constant columns,
    too few rows) is skipped.
    """
    if df.height == 0:
        return {"ic": 0.0, "icir": 0.0, "per_date_ic": []}
    per_date: list[float] = []
    for _, grp in df.group_by("asof_date"):
        if grp.height < 3:
            continue
        ic = grp.select(
            pl.corr("probability", "forward_return", method="spearman")
        ).item()
        if ic is None or (isinstance(ic, float) and math.isnan(ic)):
            continue
        per_date.append(float(ic))
    if not per_date:
        return {"ic": 0.0, "icir": 0.0, "per_date_ic": []}
    mean_ic = sum(per_date) / len(per_date)
    if len(per_date) > 1:
        var = sum((x - mean_ic) ** 2 for x in per_date) / (len(per_date) - 1)
        std = math.sqrt(var)
        icir = mean_ic / std if std > 0 else float("inf")
    else:
        icir = float("inf")
    overall = df.select(
        pl.corr("probability", "forward_return", method="spearman")
    ).item()
    return {
        "ic": float(overall) if overall is not None else 0.0,
        "icir": icir,
        "per_date_ic": [round(x, 6) for x in per_date],
    }
