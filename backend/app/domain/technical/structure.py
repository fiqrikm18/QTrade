"""Price structure detection: swings, support/resistance, breakouts.

Rules per docs/technical-analysis.md section 6. Pure Polars over OHLCV.
Swing marking uses a centered fractal window (forward look is allowed for
marking only, never for returns). No look-ahead in return-producing columns.
"""

from __future__ import annotations

import polars as pl

from app.domain.technical.indicators import atr

_LEVEL_LOOKBACK = 20
_ATR_TOL = 1.5
_REL_VOL_THRESHOLD = 1.5
_CONSOLIDATION_BARS = 10

_REQUIRED_COLUMNS = ["trade_date", "open", "high", "low", "close", "volume"]

_OUTPUT_COLUMNS = [
    "swing_high",
    "swing_low",
    "hh",
    "hl",
    "lh",
    "ll",
    "support_levels",
    "resistance_levels",
    "breakout",
    "breakdown",
    "consolidation",
    "gap_up",
    "gap_down",
]


def _merge_levels(values: list[float], tol: float) -> list[float]:
    """Merge sorted values within ``tol`` of each other into distinct levels."""
    levels: list[float] = []
    for value in sorted(values):
        if levels and value - levels[-1] <= tol:
            levels[-1] = value
        else:
            levels.append(value)
    return levels


def detect_structure(df: pl.DataFrame, swing_k: int = 5) -> pl.DataFrame:
    """Add market-structure columns to an OHLCV frame (input + new columns).

    Swings: ``high_t`` is a swing high if it exceeds the max of the ``k``
    prior and next highs (last ``k`` rows get no swing). HH/HL/LH/LL compare
    consecutive swings. Support/resistance are prior swing extremes, merged
    into levels within ``1.5 * ATR``. Breakout/breakdown need close beyond a
    level plus relative volume above ``1.5``. Consolidation is a 10-bar range
    within ``1.5 * ATR``. Gaps compare close to the prior bar's high/low.
    """
    missing = [c for c in _REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"missing required columns: {missing}")

    high = pl.col("high")
    low = pl.col("low")
    close = pl.col("close")

    prev_high = pl.max_horizontal(*(high.shift(i) for i in range(1, swing_k + 1)))
    fwd_high = pl.max_horizontal(*(high.shift(-i) for i in range(1, swing_k + 1)))
    prev_low = pl.min_horizontal(*(low.shift(i) for i in range(1, swing_k + 1)))
    fwd_low = pl.min_horizontal(*(low.shift(-i) for i in range(1, swing_k + 1)))

    swing_high = ((high > prev_high) & (high >= fwd_high)).fill_null(False)
    swing_low = ((low < prev_low) & (low <= fwd_low)).fill_null(False)

    cand_high = pl.when(swing_high).then(high).otherwise(None)
    cand_low = pl.when(swing_low).then(low).otherwise(None)

    prev_swing_high = cand_high.forward_fill().shift(1)
    prev_swing_low = cand_low.forward_fill().shift(1)

    hh = (
        pl.when(swing_high)
        .then((high > prev_swing_high).fill_null(False))
        .otherwise(False)
    )
    lh = (
        pl.when(swing_high)
        .then((high < prev_swing_high).fill_null(False))
        .otherwise(False)
    )
    hl = (
        pl.when(swing_low)
        .then((low > prev_swing_low).fill_null(False))
        .otherwise(False)
    )
    ll = (
        pl.when(swing_low)
        .then((low < prev_swing_low).fill_null(False))
        .otherwise(False)
    )

    out = df.with_columns(
        swing_high.alias("swing_high"),
        swing_low.alias("swing_low"),
        hh.alias("hh"),
        hl.alias("hl"),
        lh.alias("lh"),
        ll.alias("ll"),
        cand_high.alias("_cand_high"),
        cand_low.alias("_cand_low"),
        pl.Series("_atr", atr(df)),
    )

    prior = out.with_columns(
        pl.concat_list(
            *[pl.col("_cand_high").shift(i) for i in range(1, _LEVEL_LOOKBACK + 1)]
        ).alias("_prior_highs"),
        pl.concat_list(
            *[pl.col("_cand_low").shift(i) for i in range(1, _LEVEL_LOOKBACK + 1)]
        ).alias("_prior_lows"),
        (pl.col("_atr") * _ATR_TOL).forward_fill().fill_null(0.0).alias("_tol"),
    )

    high_lists = prior["_prior_highs"].to_list()
    low_lists = prior["_prior_lows"].to_list()
    tols = prior["_tol"].to_list()

    resistance = [
        _merge_levels([v for v in row if v is not None], tol or 0.0)
        for row, tol in zip(high_lists, tols, strict=True)
    ]
    support = [
        _merge_levels([v for v in row if v is not None], tol or 0.0)
        for row, tol in zip(low_lists, tols, strict=True)
    ]

    res_max = pl.col("resistance_levels").list.max()
    sup_min = pl.col("support_levels").list.min()
    rel_volume = pl.col("volume") / pl.col("volume").rolling_mean(20, min_samples=20)

    range_10 = pl.col("high").rolling_max(
        _CONSOLIDATION_BARS, min_samples=_CONSOLIDATION_BARS
    ) - pl.col("low").rolling_min(_CONSOLIDATION_BARS, min_samples=_CONSOLIDATION_BARS)

    with_levels = prior.with_columns(
        pl.Series("support_levels", support, dtype=pl.List(pl.Float64)),
        pl.Series("resistance_levels", resistance, dtype=pl.List(pl.Float64)),
    )

    result = with_levels.with_columns(
        ((close > res_max) & (rel_volume > _REL_VOL_THRESHOLD))
        .fill_null(False)
        .alias("breakout"),
        ((close < sup_min) & (rel_volume > _REL_VOL_THRESHOLD))
        .fill_null(False)
        .alias("breakdown"),
        (range_10 <= pl.col("_atr") * _ATR_TOL).fill_null(False).alias("consolidation"),
        (close > pl.col("high").shift(1)).fill_null(False).alias("gap_up"),
        (close < pl.col("low").shift(1)).fill_null(False).alias("gap_down"),
    )

    return result.select(df.columns + _OUTPUT_COLUMNS)
