"""Smart-money / market-structure proxy scoring (PRD §8, docs/technical-analysis.md §7).

Deterministic, vectorized Polars. Every output is a *proxy* — the module
never claims factual institutional activity (PRD §8: labels are prefixed
``proxy``). Relative-strength uses the stock's own SMA50 as a placeholder;
the IHSG/sector benchmark comparison lands in the cross-sectional scoring
layer (docs/scoring.md §2) — see the ``ponytail`` note below.
"""

from __future__ import annotations

from dataclasses import dataclass

import polars as pl

from app.domain.technical.indicators import historical_volatility
from app.domain.technical.structure import detect_structure

_WINDOW = 20
_RS_LOOKBACK = 50
_RS_NEUTRAL = 1.0
_RS_SPREAD = 0.05
_VOL_ANCHOR = 0.6
_ACCUMULATE_MIN = 55.0
_DISTRIBUTE_MIN = 55.0

_REQUIRED_COLUMNS = ["trade_date", "open", "high", "low", "close", "volume"]

_PROXY_COLUMNS = [
    "accumulation_proxy",
    "volume_proxy",
    "structure_proxy",
    "rs_proxy",
    "liquidity_proxy",
    "vol_behavior_proxy",
]


def _rolling_percentile_expr(col: str, window: int, n_rows: int) -> pl.Expr:
    """Rolling percentile rank of the trailing value: fraction of the trailing
    ``window`` rows that are *lower* than the current row (0-1). Higher values
    score closer to 1.0. ``window`` rows of warm-up are null.

    Pure vectorized alternative to ``rolling_map`` (avoids polars callback
    typing). ``n_rows`` is the group length.
    ponytail: expression tree is O(window) terms; revisit if histories grow
    past ~10k rows/ticker (use ``rolling_rank`` in a future polars release).
    """
    win = min(window, n_rows - 1)

    def _higher_than_lag(lag: int) -> pl.Expr:
        cmp = pl.col(col) > pl.col(col).shift(lag)
        return cmp.fill_null(False).cast(pl.Float64)

    acc = _higher_than_lag(1)
    for lag in range(2, win + 1):
        acc = acc + _higher_than_lag(lag)
    total = float(win)
    return acc / total


@dataclass(frozen=True)
class SmartMoneyConfig:
    """Weights for the six smart-money proxy components (docs §7)."""

    accumulation: float = 0.25
    volume_behavior: float = 0.20
    price_structure: float = 0.20
    relative_strength: float = 0.10
    liquidity: float = 0.10
    volatility_behavior: float = 0.15

    def __post_init__(self) -> None:
        weights = [
            self.accumulation,
            self.volume_behavior,
            self.price_structure,
            self.relative_strength,
            self.liquidity,
            self.volatility_behavior,
        ]
        if any(w < 0 for w in weights):
            raise ValueError("component weights must be non-negative")
        if sum(weights) <= 0:
            raise ValueError("component weights must sum to > 0")


def _proxies_for_ticker(grp: pl.DataFrame) -> pl.DataFrame:
    n_rows = grp.height
    grp = grp.sort("trade_date")
    close = grp["close"]
    grp = grp.with_columns((close > close.shift(1)).fill_null(False).alias("up_day"))

    range_ = grp["high"].rolling_max(_WINDOW, min_samples=_WINDOW) - grp[
        "low"
    ].rolling_min(_WINDOW, min_samples=_WINDOW)
    compression = 100.0 * (
        1.0 - (range_ / close.rolling_mean(_WINDOW, min_samples=_WINDOW))
    )

    agreement = grp.select(
        pl.rolling_corr("volume", "up_day", window_size=_WINDOW, min_samples=_WINDOW)
    ).to_series()
    agreement_proxy = 50.0 * (agreement.clip(-1.0, 1.0) + 1.0)

    range_position = (
        (close - grp["low"].rolling_min(_WINDOW, min_samples=_WINDOW))
        / (
            grp["high"].rolling_max(_WINDOW, min_samples=_WINDOW)
            - grp["low"].rolling_min(_WINDOW, min_samples=_WINDOW)
        )
    ).rolling_mean(_WINDOW, min_samples=_WINDOW)
    range_position_proxy = 100.0 * range_position

    accumulation_proxy = pl.lit(
        (compression + agreement_proxy + range_position_proxy) / 3.0
    )

    turnover = (
        grp.get_column("turnover")
        if "turnover" in grp.columns
        else close * grp["volume"]
    )
    ret_20 = close / close.shift(_WINDOW) - 1.0
    rel_volume = grp["volume"] / grp["volume"].rolling_mean(
        _WINDOW, min_samples=_WINDOW
    )

    grp = grp.with_columns(
        pl.Series("_rel_volume", rel_volume),
        pl.Series("_turnover", turnover),
        pl.Series("_ret_20", ret_20),
    )

    rel_volume_rank = 100.0 * _rolling_percentile_expr(
        "_rel_volume", _WINDOW, n_rows
    )
    volume_proxy = 0.3 * rel_volume_rank + 0.7 * pl.lit(agreement_proxy)

    structure = detect_structure(grp)
    structure_proxy = (
        100.0 * structure["hh"].fill_null(False)
        + 100.0 * structure["hl"].fill_null(False)
        + 100.0 * structure["breakout"].fill_null(False)
    ) / 3.0

    rs_ratio = close / close.rolling_mean(_RS_LOOKBACK, min_samples=_RS_LOOKBACK)
    rs_proxy = 50.0 * ((rs_ratio - _RS_NEUTRAL) / _RS_SPREAD).clip(0.0, 2.0)

    liquidity_proxy = 100.0 * _rolling_percentile_expr(
        "_turnover", _WINDOW, n_rows
    )

    vol = historical_volatility(close, _WINDOW)
    vol_component = 100.0 * ((_VOL_ANCHOR - vol) / _VOL_ANCHOR).clip(0.0, 1.0)
    ret_rank = 100.0 * _rolling_percentile_expr(
        "_ret_20", _WINDOW, n_rows
    )
    vol_behavior_proxy = 0.5 * vol_component + 0.5 * ret_rank

    proxies = [
        accumulation_proxy,
        volume_proxy,
        structure_proxy,
        rs_proxy,
        liquidity_proxy,
        vol_behavior_proxy,
    ]

    proxied = grp.with_columns(
        *[
            name_expr.alias(name)
            for name, name_expr in zip(_PROXY_COLUMNS, proxies, strict=True)
        ]
    )
    return proxied.with_columns(pl.struct(*_PROXY_COLUMNS).alias("sm_components"))


def _finalize(df: pl.DataFrame, config: SmartMoneyConfig) -> pl.DataFrame:
    acc = pl.col("accumulation_proxy")
    vol = pl.col("volume_proxy")
    weighted = (
        config.accumulation * acc
        + config.volume_behavior * vol
        + config.price_structure * pl.col("structure_proxy")
        + config.relative_strength * pl.col("rs_proxy")
        + config.liquidity * pl.col("liquidity_proxy")
        + config.volatility_behavior * pl.col("vol_behavior_proxy")
    ).clip(0.0, 100.0)

    label = pl.when(acc >= _ACCUMULATE_MIN).then(pl.lit("proxy:accumulation")).when(
        vol >= _DISTRIBUTE_MIN
    ).then(pl.lit("proxy:distribution")).otherwise(pl.lit("proxy:neutral"))

    return df.with_columns(
        weighted.alias("smart_money_score"),
        label.alias("sm_label"),
    )


def smart_money_score(
    df: pl.DataFrame,
    config: SmartMoneyConfig | None = None,
) -> pl.DataFrame:
    """Add smart-money proxy columns (each 0-100, ``sm_components`` struct,
    ``smart_money_score`` 0-100, ``sm_label`` prefixed ``proxy``).

    Input columns: ``trade_date, open, high, low, close, volume`` and optional
    ``turnover`` (falls back to ``close * volume``). If a ``ticker`` column is
    present, metrics are computed per ticker. Explainability ships in the
    ``sm_components`` struct column (Polars-native, pyright-friendly choice).
    """
    if config is None:
        config = SmartMoneyConfig()
    missing = [c for c in _REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"missing required columns: {missing}")

    if "turnover" not in df.columns:
        df = df.with_columns((pl.col("close") * pl.col("volume")).alias("turnover"))

    if "ticker" in df.columns:
        scored = df.group_by("ticker", maintain_order=True).map_groups(
            _proxies_for_ticker
        )
    else:
        scored = _proxies_for_ticker(df)

    return _finalize(scored, config)
