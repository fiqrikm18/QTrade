"""Deterministic market regime engine (PRD §14, docs/technical-analysis.md §9).

Pure Polars. No LLM, no randomness, no external calls. Evaluates the LAST
bar of the input index OHLCV frame. No look-ahead: every window is trailing.

Classification is a thresholded rule set over a weighted confidence score.
``HIGH_VOLATILITY`` wins regardless of direction when the HV percentile is
extreme; ``RISK_ON``/``RISK_OFF`` are confidence+volatility combinations.
Macro is a small tilt only — it never overrides the price/breadth signal
(docs/macro.md).
"""

from __future__ import annotations

import polars as pl

from app.domain.technical.indicators import historical_volatility, roc, sma

STRONG_BULLISH = "STRONG_BULLISH"
BULLISH = "BULLISH"
NEUTRAL = "NEUTRAL"
WEAK_BEARISH = "WEAK_BEARISH"
BEARISH = "BEARISH"
HIGH_VOLATILITY = "HIGH_VOLATILITY"
RISK_ON = "RISK_ON"
RISK_OFF = "RISK_OFF"

_REGIME_CLASSES = (
    STRONG_BULLISH,
    BULLISH,
    NEUTRAL,
    WEAK_BEARISH,
    BEARISH,
    HIGH_VOLATILITY,
    RISK_ON,
    RISK_OFF,
)

# --- windows -----------------------------------------------------------------
_SMA_FAST = 50
_SMA_SLOW = 200
_SLOPE_LOOKBACK = 5
_HV_WINDOW = 20
_VOL_LOOKBACK = 252
_MOMENTUM_WINDOWS = (20, 60)

# --- score mapping ------------------------------------------------------------
_PRICE_GAIN = 800.0  # close-vs-SMA50 bias: % -> 0-100 points
_MA_GAIN = 800.0  # SMA50-vs-SMA200 bias: % -> 0-100 points
_SLOPE_GAIN = 10.0  # SMA50 5-bar slope: % -> 0-100 points
_MOMENTUM_GAIN = 3.0  # avg 20/60D return: % -> 0-100 points
_TILT_HALF_RANGE = 100.0  # breadth/macro inputs are in [-100, 100]

_W_TREND = 0.40
_W_MOMENTUM = 0.28
_W_BREADTH = 0.22
_W_MACRO = 0.10

# --- classification thresholds -------------------------------------------------
_VOL_HIGH_PCT = 80.0  # HV percentile at/above -> HIGH_VOLATILITY (any direction)
_VOL_CALM_PCT = 40.0  # HV percentile below -> RISK_ON eligible
_VOL_STRESS_PCT = 60.0  # HV percentile at/above -> RISK_OFF eligible
_CONF_STRONG = 75.0
_CONF_BULL = 60.0
_CONF_WEAK = 40.0
_CONF_BEAR = 25.0

_REQUIRED_COLUMNS = ["trade_date", "open", "high", "low", "close", "volume"]


def _require_columns(df: pl.DataFrame) -> None:
    missing = [c for c in _REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"index frame missing columns: {missing}")


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return min(max(x, lo), hi)


def _trend_component(close: pl.Series) -> float:
    """Trend score (0-100): SMA50/SMA200 alignment + SMA50 slope."""
    sma_fast = sma(close, _SMA_FAST)
    sma_slow = sma(close, _SMA_SLOW)
    if sma_fast[-1] is None or sma_slow[-1] is None:
        raise ValueError(
            f"insufficient history: need >= {_SMA_SLOW} bars for regime detection"
        )
    price_bias = 100.0 * (close[-1] / sma_fast[-1] - 1.0)
    ma_bias = 100.0 * (sma_fast[-1] / sma_slow[-1] - 1.0)
    slope = 100.0 * (sma_fast[-1] / sma_fast[-1 - _SLOPE_LOOKBACK] - 1.0)
    price_score = _clamp(50.0 + price_bias * _PRICE_GAIN / 100.0)
    ma_score = _clamp(50.0 + ma_bias * _MA_GAIN / 100.0)
    slope_score = _clamp(50.0 + slope * _SLOPE_GAIN)
    return 0.35 * price_score + 0.35 * ma_score + 0.30 * slope_score


def _momentum_component(close: pl.Series) -> float:
    """Momentum score (0-100) from 20D and 60D returns."""
    avg_ret = sum(roc(close, n)[-1] for n in _MOMENTUM_WINDOWS) / len(_MOMENTUM_WINDOWS)
    return _clamp(50.0 + avg_ret * _MOMENTUM_GAIN)


def _volatility_component(close: pl.Series) -> float:
    """Volatility score (0-100): percentile of current HV20 in trailing 252."""
    hv = historical_volatility(close, _HV_WINDOW)
    current = hv[-1]
    window = hv.slice(-_VOL_LOOKBACK).drop_nulls()
    return float((window < current).mean()) * 100.0


def _tilt_component(tilt: float | None) -> float:
    """Signed tilt ([-100, 100]) mapped to 0-100, centered at 50."""
    if tilt is None:
        return 50.0
    return 50.0 + min(max(tilt, -_TILT_HALF_RANGE), _TILT_HALF_RANGE) / 2.0


def _confidence(
    trend: float, momentum: float, breadth_score: float | None, macro_tilt: float | None
) -> float:
    """Weighted bull/bear confidence (0-100). Missing signals are neutral."""
    return (
        _W_TREND * trend
        + _W_MOMENTUM * momentum
        + _W_BREADTH * _tilt_component(breadth_score)
        + _W_MACRO * _tilt_component(macro_tilt)
    )


def _classify(conf: float, vol_pct: float) -> str:
    if vol_pct >= _VOL_HIGH_PCT:
        return HIGH_VOLATILITY
    if conf >= _CONF_STRONG:
        return RISK_ON if vol_pct < _VOL_CALM_PCT else STRONG_BULLISH
    if conf >= _CONF_BULL:
        return BULLISH
    if conf <= _CONF_BEAR:
        return BEARISH
    if conf <= _CONF_WEAK:
        return RISK_OFF if vol_pct >= _VOL_STRESS_PCT else WEAK_BEARISH
    return NEUTRAL


def regime_components(
    index_df: pl.DataFrame,
    breadth_score: float | None = None,
    macro_tilt: float | None = None,
) -> dict[str, float]:
    """Component scores (0-100) for explainability (docs/architecture.md §7).

    ``trend``/``momentum``/``volatility`` always present; ``breadth`` and
    ``macro`` only when the corresponding tilt input is provided.
    """
    _require_columns(index_df)
    close = index_df.sort("trade_date")["close"]
    components: dict[str, float] = {
        "trend": _trend_component(close),
        "momentum": _momentum_component(close),
        "volatility": _volatility_component(close),
    }
    if breadth_score is not None:
        components["breadth"] = _tilt_component(breadth_score)
    if macro_tilt is not None:
        components["macro"] = _tilt_component(macro_tilt)
    return components


def detect_regime(
    index_df: pl.DataFrame,
    breadth_score: float | None = None,
    macro_tilt: float | None = None,
) -> str:
    """Deterministic market regime for the last bar of ``index_df``."""
    _require_columns(index_df)
    close = index_df.sort("trade_date")["close"]
    trend = _trend_component(close)
    momentum = _momentum_component(close)
    vol_pct = _volatility_component(close)
    conf = _confidence(trend, momentum, breadth_score, macro_tilt)
    return _classify(conf, vol_pct)
