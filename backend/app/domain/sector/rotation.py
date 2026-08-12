"""Sector rotation engine (docs/scoring.md §3, PRD §12).

Pure Polars, no DB, no look-ahead. Per sector per trade_date: 1M/3M
performance, relative strength vs IHSG, blended momentum, volume trend,
breadth (% members above SMA50), a weighted ``sector_score`` (0-100), and a
``rotation_class`` from the 2D momentum x relative-strength matrix
(leading/improving/weakening/lagging). Component percentiles are computed
cross-sectionally per date so scores stay 0-100 and comparable.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import polars as pl

from app.domain.technical.indicators import sma

_WINDOW_1M = 21
_WINDOW_3M = 63
_VOL_WINDOW = 20
_SMA_BREADTH = 50

_MOM_1M_WEIGHT = 0.7
_MOM_3M_WEIGHT = 0.3

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

_OUTPUT_COLUMNS = [
    "sector",
    "trade_date",
    "perf_1m",
    "perf_3m",
    "rel_strength",
    "momentum",
    "vol_trend",
    "breadth",
    "sector_score",
    "rotation_class",
]


@dataclass(frozen=True)
class SectorWeights:
    """sector_score blend weights; must sum to 1.0."""

    momentum: float = 0.35
    rel_strength: float = 0.25
    vol_trend: float = 0.10
    breadth: float = 0.30

    def __post_init__(self) -> None:
        total = self.momentum + self.rel_strength + self.vol_trend + self.breadth
        if not math.isclose(total, 1.0, rel_tol=0.0, abs_tol=1e-6):
            raise ValueError(f"SectorWeights must sum to 1.0, got {total:.4f}")


_DEFAULT_WEIGHTS = SectorWeights()


def _require_columns(df: pl.DataFrame, required: list[str], label: str) -> None:
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"{label} frame missing columns: {missing}")


def sector_membership(
    sector_frames: dict[str, pl.DataFrame],
) -> dict[str, list[str]]:
    """Ticker per sector, derived from the member frames."""
    return {
        name: sorted(frame["ticker"].unique().to_list())
        for name, frame in sector_frames.items()
    }


def _sector_index_level(frame: pl.DataFrame) -> pl.DataFrame:
    """Equal-weight sector index level = mean member close per date."""
    return (
        frame.group_by("trade_date", maintain_order=True)
        .agg(pl.col("close").mean().alias("sector_index"))
        .sort("trade_date")
    )


def _member_features(frame: pl.DataFrame) -> pl.DataFrame:
    """Per-member trailing breadth feature (no look-ahead), aligned to rows."""
    return frame.sort(["ticker", "trade_date"]).with_columns(
        pl.col("close").gt(sma(pl.col("close"), _SMA_BREADTH))
        .over("ticker")
        .alias("above_sma50")
    )


def _sector_features(frame: pl.DataFrame) -> pl.DataFrame:
    """Per-date sector features: performance, momentum, vol trend, breadth."""
    level = _sector_index_level(frame)
    volume = (
        frame.group_by("trade_date", maintain_order=True)
        .agg(pl.col("volume").sum().alias("sector_volume"))
        .sort("trade_date")
    )
    member_features = _member_features(frame)
    breadth = (
        member_features.group_by("trade_date", maintain_order=True)
        .agg(pl.col("above_sma50").mean().alias("breadth"))
        .sort("trade_date")
    )

    out = level.join(volume, on="trade_date", how="left").join(
        breadth, on="trade_date", how="left"
    ).with_columns(
        (pl.col("sector_index") / pl.col("sector_index").shift(_WINDOW_1M) - 1.0).alias(
            "perf_1m"
        ),
        (pl.col("sector_index") / pl.col("sector_index").shift(_WINDOW_3M) - 1.0).alias(
            "perf_3m"
        ),
        (
            pl.col("sector_volume")
            / sma(pl.col("sector_volume"), _VOL_WINDOW)
        ).alias("vol_trend"),
    ).with_columns(
        (
            pl.when(pl.col("perf_3m").is_null())
            .then(pl.col("perf_1m"))
            .otherwise(
                _MOM_1M_WEIGHT * pl.col("perf_1m")
                + _MOM_3M_WEIGHT * pl.col("perf_3m")
            )
        ).alias("momentum")
    )
    return out.select(
        "trade_date", "perf_1m", "perf_3m", "momentum", "vol_trend", "breadth"
    )


def _pctile_expr(col: str) -> pl.Expr:
    """Cross-sectional percentile (0-100) of ``col`` per trade_date.

    Ties average; a group with a single non-null value scores neutral 50 —
    mirrors percentile_rank in the fundamental scorer.
    """
    rank = pl.col(col).rank().over("trade_date")
    count = pl.col(col).count().over("trade_date")
    return pl.when(count > 1).then(100.0 * (rank - 1.0) / (count - 1.0)).otherwise(
        50.0
    )


def _score_and_class(f: pl.DataFrame, weights: SectorWeights) -> pl.DataFrame:
    with_rs = f.with_columns(
        (pl.col("perf_1m") - pl.col("index_perf_1m")).alias("rel_strength")
    )

    comps: dict[str, pl.Expr] = {
        "momentum": _pctile_expr("momentum"),
        "rel_strength": _pctile_expr("rel_strength"),
        "vol_trend": _pctile_expr("vol_trend"),
        "breadth": 100.0 * pl.col("breadth"),
    }
    num = pl.lit(0.0)
    den = pl.lit(0.0)
    for field, expr in comps.items():
        w = getattr(weights, field)
        num = num + (w * expr).fill_null(0.0)
        den = den + pl.when(expr.is_not_null()).then(w).otherwise(0.0)
    score = pl.when(den > 0).then(num / den).otherwise(None)

    rotation = (
        pl.when(pl.col("momentum").is_null() | pl.col("rel_strength").is_null()).then(
            None
        )
        .when((pl.col("momentum") > 0.0) & (pl.col("rel_strength") > 0.0)).then(
            pl.lit("leading")
        )
        .when((pl.col("momentum") > 0.0) & (pl.col("rel_strength") < 0.0)).then(
            pl.lit("improving")
        )
        .when((pl.col("momentum") < 0.0) & (pl.col("rel_strength") > 0.0)).then(
            pl.lit("weakening")
        )
        .when((pl.col("momentum") < 0.0) & (pl.col("rel_strength") < 0.0)).then(
            pl.lit("lagging")
        )
        .otherwise(None)
    )
    return with_rs.with_columns(
        score.alias("sector_score"), rotation.alias("rotation_class")
    )


def sector_score(
    sector_frames: dict[str, pl.DataFrame],
    index_df: pl.DataFrame,
    weights: SectorWeights = _DEFAULT_WEIGHTS,
) -> pl.DataFrame:
    """Per-sector-per-date rotation scores (docs/scoring.md §3)."""
    if not sector_frames:
        raise ValueError("sector_frames must not be empty")
    for frame in sector_frames.values():
        _require_columns(frame, _REQUIRED_STOCK_COLUMNS, "stock")
    _require_columns(index_df, _REQUIRED_INDEX_COLUMNS, "index")

    index_features = index_df.sort("trade_date").select(
        "trade_date",
        (pl.col("close") / pl.col("close").shift(_WINDOW_1M) - 1.0).alias(
            "index_perf_1m"
        ),
    )

    parts: list[pl.DataFrame] = []
    for name, frame in sector_frames.items():
        features = _sector_features(frame)
        joined = features.join(index_features, on="trade_date", how="left")
        parts.append(joined.with_columns(pl.lit(name).alias("sector")))
    combined = pl.concat(parts).sort(["sector", "trade_date"])
    return _score_and_class(combined, weights).select(_OUTPUT_COLUMNS)
