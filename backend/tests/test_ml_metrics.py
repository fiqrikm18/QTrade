"""ML evaluation metrics (docs/ml.md §5)."""

from datetime import date

import polars as pl

from app.domain.ml.metrics import compute_classification_metrics, compute_ic, hit_ratio


def test_classification_metrics_known_values():
    y_true = [1, 1, 1, 0, 0, 0]
    y_pred = [1, 1, 0, 0, 0, 0]
    y_prob = [0.9, 0.8, 0.4, 0.3, 0.2, 0.1]
    m = compute_classification_metrics(y_true, y_pred, y_prob)
    assert m["accuracy"] == 5 / 6
    assert m["precision"] == 2 / 2
    assert m["recall"] == 2 / 3
    assert m["f1"] == 0.8
    assert abs(m["roc_auc"] - 1.0) < 1e-9
    assert abs(m["brier"] - 0.0916667) < 1e-3


def test_hit_ratio_top_k():
    y_true = [1, 1, 0, 0]
    y_prob = [0.9, 0.8, 0.7, 0.6]
    assert hit_ratio(y_true, y_prob, top_k_pct=0.5) == 1.0  # top-2 both up


def test_ic_is_spearman_and_icir_positive():
    df = pl.DataFrame(
        {
            "ticker": ["A", "B", "C", "D"] * 3,
            "asof_date": [date(2024, 1, 1)] * 4
            + [date(2024, 1, 2)] * 4
            + [date(2024, 1, 3)] * 4,
            "probability": [0.9, 0.7, 0.5, 0.3] * 3,
            "forward_return": [0.09, 0.07, 0.05, 0.03] * 3,
        }
    )
    out = compute_ic(df)
    assert abs(out["ic"] - 1.0) < 1e-6
    assert out["icir"] == float("inf") or out["icir"] > 0
