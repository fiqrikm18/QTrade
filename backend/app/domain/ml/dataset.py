"""ML dataset builder: point-in-time features joined with forward labels.

Anti-leakage contract (docs/ml.md §3-4): feature columns are computed by the
same ``build_technical_features`` engine used by scoring (all trailing
indicators -> values at ``asof`` use only data ``<= asof``); labels use only
data at the label date (``asof + horizon``). ``cross_sectional_threshold``
derives the positive class from per-date medians of the label column, so no
future information reaches training.
"""

from __future__ import annotations

import hashlib

import polars as pl

FEATURE_COLUMNS = [
    "rsi_14",
    "macd",
    "macd_signal",
    "macd_hist",
    "sma_20",
    "sma_50",
    "sma_200",
    "ema_20",
    "atr_14",
    "boll_upper",
    "boll_mid",
    "boll_lower",
    "roc_20",
    "adx_14",
    "rel_volume",
    "hist_vol_20",
    "stoch_k",
    "stoch_d",
]


def features_hash(feature_version: str, columns: list[str]) -> str:
    """Hash of feature version + sorted column names (drift detection)."""
    material = feature_version + ":" + ",".join(sorted(columns))
    return hashlib.sha256(material.encode()).hexdigest()[:16]


def build_labeled_dataset(
    features: pl.DataFrame, closes: pl.DataFrame, horizon: int
) -> pl.DataFrame:
    """Join per-ticker features at ``asof`` with forward return at asof+horizon.

    ``features`` has ``ticker, trade_date, <indicators>`` (output of
    ``build_technical_features``); ``closes`` has ``ticker, trade_date, close``.
    Rows where the label date is missing (end of history) are dropped.
    """
    closes = closes.sort("trade_date")
    shifted = (
        closes.group_by("ticker", maintain_order=True)
        .agg(
            pl.col("trade_date").alias("asof_date"),
            pl.col("trade_date").shift(-horizon).alias("label_date"),
            pl.col("close").shift(-horizon).alias("future_close"),
            pl.col("close").alias("close"),
        )
        .explode(["asof_date", "label_date", "future_close", "close"])
        .drop_nulls(["label_date", "future_close"])
    )
    feat = features.rename({"trade_date": "asof_date"})
    joined = feat.join(shifted, on=["ticker", "asof_date"], how="inner")
    return joined.with_columns(
        (pl.col("future_close") / pl.col("close") - 1.0).alias("forward_return")
    ).drop(["close", "future_close", "label_date"])


def cross_sectional_threshold(df: pl.DataFrame) -> pl.DataFrame:
    """Positive class: forward_return strictly above per-date median."""
    medians = (
        df.group_by("asof_date")
        .agg(pl.col("forward_return").median().alias("x_median"))
        .select("asof_date", "x_median")
    )
    return (
        df.join(medians, on="asof_date")
        .with_columns(
            (pl.col("forward_return") > pl.col("x_median"))
            .cast(pl.Int8)
            .alias("label_class")
        )
        .drop("x_median")
    )
