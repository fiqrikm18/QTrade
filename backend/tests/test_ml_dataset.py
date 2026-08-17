"""ML dataset builder: point-in-time features + forward labels."""

from datetime import date, timedelta

import polars as pl

from app.domain.ml.dataset import (
    FEATURE_COLUMNS,
    build_labeled_dataset,
    cross_sectional_threshold,
    features_hash,
)


def _feature_frame(n_days: int = 30, n_tickers: int = 2) -> pl.DataFrame:
    start = date(2024, 1, 1)
    dates = [start + timedelta(days=i) for i in range(n_days)]
    rows = []
    for t in range(n_tickers):
        for i, d in enumerate(dates):
            rows.append(
                {
                    "ticker": f"T{t}",
                    "trade_date": d,
                    **{c: 50.0 + i for c in FEATURE_COLUMNS},
                }
            )
    return pl.DataFrame(
        rows,
        schema={
            **{c: pl.Float64 for c in FEATURE_COLUMNS},
            "ticker": pl.Utf8,
            "trade_date": pl.Date,
        },
    )


def _close_frame(n_days: int = 30, n_tickers: int = 2) -> pl.DataFrame:
    start = date(2024, 1, 1)
    dates = [start + timedelta(days=i) for i in range(n_days)]
    rows = []
    for t in range(n_tickers):
        base = 1000.0 if t == 0 else 500.0
        for i, d in enumerate(dates):
            rows.append(
                {"ticker": f"T{t}", "trade_date": d, "close": base * (1 + 0.01 * i)}
            )
    return pl.DataFrame(
        rows, schema={"ticker": pl.Utf8, "trade_date": pl.Date, "close": pl.Float64}
    )


def test_features_hash_is_stable_and_content_sensitive():
    h1 = features_hash("v1", ["rsi_14", "macd"])
    h2 = features_hash("v1", ["rsi_14", "macd"])
    h3 = features_hash("v1", ["rsi_14", "macd_hist"])
    assert h1 == h2
    assert h1 != h3


def test_labeled_dataset_has_forward_return_no_leakage():
    feat = _feature_frame()
    closes = _close_frame()
    df = build_labeled_dataset(feat, closes, horizon=5)
    labeled = df.filter(pl.col("forward_return").is_not_null())
    assert labeled.height == (30 - 5) * 2
    t0 = labeled.filter(pl.col("ticker") == "T0").sort("asof_date")
    # close[i] = base*(1+0.01*i) (linear) -> forward_return over 5 bars = 0.05
    assert abs(t0["forward_return"][0] - 0.05) < 1e-9


def test_cross_sectional_threshold_uses_per_date_median():
    df = pl.DataFrame(
        {
            "ticker": ["A", "B", "C", "A", "B", "C"],
            "asof_date": [date(2024, 1, 1)] * 3 + [date(2024, 1, 2)] * 3,
            "forward_return": [0.10, 0.05, 0.00, 0.01, -0.02, -0.05],
        }
    )
    out = cross_sectional_threshold(df)
    d1 = out.filter(pl.col("asof_date") == date(2024, 1, 1))
    d2 = out.filter(pl.col("asof_date") == date(2024, 1, 2))
    # d1 median 0.05, strict >: 0.10->1, 0.05->0, 0.00->0
    assert d1["label_class"].to_list() == [1, 0, 0]
    # d2 median -0.02, strict >: 0.01->1, -0.02->0, -0.05->0
    assert d2["label_class"].to_list() == [1, 0, 0]
