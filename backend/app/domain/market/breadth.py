"""Market breadth engine (docs/technical-analysis.md §8, PRD §13).

Pure Polars, no DB, no look-ahead. For each trade_date across the stock
universe: advance/decline, new highs/lows, % above SMA20/50/200, RSI breadth,
volume breadth, breakout breadth, momentum breadth, and a weighted
``breadth_score`` (0-100). Breadth fields are fractions in [0, 1];
counts are integers. The index frame is reference only — its close is joined
into the output as ``index_close`` and never drives the breadth math.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import polars as pl

from app.domain.technical.indicators import roc, rsi, sma

_WEEK_52 = 252
_RSI_N = 14
_BREAKOUT_LOOKBACK = 20
_ROC_N = 20

_REQUIRED_STOCK_COLUMNS = [
    "ticker",
    "trade_date",
    "open",
    "high",
    "low",
    "close",
    "volume",
]
_REQUIRED_INDEX_COLUMNS = ["trade_date", "close"]


@dataclass(frozen=True)
class BreadthWeights:
    """Configurable weights for the breadth score; must sum to 1.0."""

    advance: float = 0.15
    above_sma20: float = 0.15
    above_sma50: float = 0.20
    above_sma200: float = 0.15
    rsi: float = 0.10
    volume: float = 0.05
    breakout: float = 0.10
    momentum: float = 0.10

    def __post_init__(self) -> None:
        total = sum(self.__dict__.values())
        if not math.isclose(total, 1.0, rel_tol=0.0, abs_tol=1e-6):
            raise ValueError(f"BreadthWeights must sum to 1.0, got {total:.4f}")


_DEFAULT_WEIGHTS = BreadthWeights()


def _require_columns(df: pl.DataFrame, required: list[str], label: str) -> None:
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"{label} frame missing columns: {missing}")


def _trailing_feature_df(
    combined: pl.DataFrame,
) -> pl.DataFrame:
    """Per-stock trailing features (no look-ahead) aligned to stock rows."""
    return (
        combined.with_columns(
            [
                pl.col("close").shift(1).over("ticker").alias("prev_close"),
                sma(pl.col("close"), 20).over("ticker").alias("sma20"),
                sma(pl.col("close"), 50).over("ticker").alias("sma50"),
                sma(pl.col("close"), 200).over("ticker").alias("sma200"),
                pl.col("close")
                .map_batches(lambda s: rsi(s), return_dtype=pl.Float64)
                .over("ticker")
                .alias("rsi14"),
                roc(pl.col("close"), _ROC_N).over("ticker").alias("roc20"),
                pl.col("high")
                .rolling_max(_WEEK_52, min_samples=_WEEK_52)
                .over("ticker")
                .alias("high_52w"),
                pl.col("low")
                .rolling_min(_WEEK_52, min_samples=_WEEK_52)
                .over("ticker")
                .alias("low_52w"),
                pl.col("high")
                .shift(1)
                .rolling_max(_BREAKOUT_LOOKBACK, min_samples=_BREAKOUT_LOOKBACK)
                .over("ticker")
                .alias("prior_high_20d"),
            ]
        )
        .with_columns(
            [
                pl.col("close").gt(pl.col("prev_close")).alias("is_up"),
                pl.col("close").lt(pl.col("prev_close")).alias("is_down"),
                pl.col("close").gt(pl.col("sma20")).alias("above_sma20"),
                pl.col("close").gt(pl.col("sma50")).alias("above_sma50"),
                pl.col("close").gt(pl.col("sma200")).alias("above_sma200"),
                pl.col("rsi14").gt(50.0).alias("rsi_above_50"),
                pl.col("high").eq(pl.col("high_52w")).alias("is_new_high"),
                pl.col("low").eq(pl.col("low_52w")).alias("is_new_low"),
                (
                    pl.col("close").gt(pl.col("sma20"))
                    & pl.col("close").gt(pl.col("prior_high_20d"))
                ).alias("is_breakout"),
                pl.col("roc20").gt(0.0).alias("is_momentum"),
            ]
        )
        .with_columns(
            [
                pl.when(pl.col("is_up").is_not_null())
                .then(pl.col("volume"))
                .otherwise(None)
                .alias("advancing_volume"),
                pl.when(pl.col("is_up").is_not_null())
                .then(pl.col("volume"))
                .otherwise(None)
                .alias("traded_volume"),
            ]
        )
    )


def _aggregate_by_date(f: pl.DataFrame) -> pl.DataFrame:
    return (
        f.group_by("trade_date", maintain_order=True)
        .agg(
            pl.col("is_up").sum().cast(pl.Int64).alias("advance"),
            pl.col("is_down").sum().cast(pl.Int64).alias("decline"),
            pl.col("is_new_high").sum().cast(pl.Int64).alias("new_highs"),
            pl.col("is_new_low").sum().cast(pl.Int64).alias("new_lows"),
            pl.col("above_sma20").mean().alias("pct_above_sma20"),
            pl.col("above_sma50").mean().alias("pct_above_sma50"),
            pl.col("above_sma200").mean().alias("pct_above_sma200"),
            pl.col("rsi_above_50").mean().alias("rsi_breadth"),
            (pl.col("advancing_volume").sum() / pl.col("traded_volume").sum()).alias(
                "volume_breadth"
            ),
            pl.col("is_breakout").mean().alias("breakout_breadth"),
            pl.col("is_momentum").mean().alias("momentum_breadth"),
        )
        .sort("trade_date")
    )


def _breadth_score_col(df: pl.DataFrame, weights: BreadthWeights) -> pl.DataFrame:
    adv_denom = pl.col("advance") + pl.col("decline")
    adv_comp = (
        pl.when(adv_denom > 0).then(pl.col("advance") / adv_denom).otherwise(None)
    )
    comps = {
        "advance": adv_comp,
        "above_sma20": pl.col("pct_above_sma20"),
        "above_sma50": pl.col("pct_above_sma50"),
        "above_sma200": pl.col("pct_above_sma200"),
        "rsi": pl.col("rsi_breadth"),
        "volume": pl.col("volume_breadth"),
        "breakout": pl.col("breakout_breadth"),
        "momentum": pl.col("momentum_breadth"),
    }
    num = pl.lit(0.0)
    den = pl.lit(0.0)
    for field, expr in comps.items():
        w = getattr(weights, field)
        num = num + (w * expr).fill_null(0.0)
        den = den + pl.when(expr.is_not_null()).then(w).otherwise(0.0)
    score = pl.when(den > 0).then(100.0 * num / den).otherwise(None)
    return df.with_columns(score.alias("breadth_score"))


def market_breadth(
    stock_frames: list[pl.DataFrame],
    index_df: pl.DataFrame,
    weights: BreadthWeights = _DEFAULT_WEIGHTS,
) -> pl.DataFrame:
    """Per-date market breadth across ``stock_frames``; index close for context."""
    if not stock_frames:
        raise ValueError("stock_frames must not be empty")
    for frame in stock_frames:
        _require_columns(frame, _REQUIRED_STOCK_COLUMNS, "stock")
    _require_columns(index_df, _REQUIRED_INDEX_COLUMNS, "index")

    combined = pl.concat(stock_frames).sort(["ticker", "trade_date"])
    features = _trailing_feature_df(combined)
    by_date = _aggregate_by_date(features)
    with_score = _breadth_score_col(by_date, weights)
    index_close = index_df.select("trade_date", pl.col("close").alias("index_close"))
    return with_score.join(index_close, on="trade_date", how="left")
