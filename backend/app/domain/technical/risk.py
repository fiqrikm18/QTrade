"""Stock-level risk level and trend regime derived from technical features.

Pure function over the indicator dicts the scanner writes to
``technical_features.indicators`` (docs/data-model.md §9). Never returns
fabricated values: with missing features it reports None.
"""

from __future__ import annotations

from typing import Any


def _f(indicators: dict[str, Any], key: str) -> float | None:
    try:
        value = indicators.get(key)
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def compute_risk_level(atr_pct: float | None) -> str | None:
    """Compute risk level from ATR percentage.

    Args:
        atr_pct: ATR as percentage of price (e.g., 0.02 = 2%)

    Returns:
        "low" | "medium" | "high" | None
    """
    if atr_pct is None:
        return None
    if atr_pct < 0.02:
        return "low"
    if atr_pct <= 0.04:
        return "medium"
    return "high"


def compute_regime(
    sma_20: float | None,
    sma_50: float | None,
    sma_200: float | None,
    adx: float | None,
) -> str | None:
    """Compute trend regime from SMA alignment and ADX.

    Args:
        sma_20: 20-period SMA
        sma_50: 50-period SMA
        sma_200: 200-period SMA
        adx: ADX value (trend strength)

    Returns:
        "trending_up" | "trending_down" | "ranging" | "volatile" | None
    """
    if adx is None or sma_20 is None or sma_50 is None or sma_200 is None:
        return None

    if adx > 25:
        if sma_20 > sma_50 > sma_200:
            return "trending_up"
        if sma_20 < sma_50 < sma_200:
            return "trending_down"
        return "volatile"
    if adx < 20:
        return "ranging"
    return "volatile"


def derive_stock_risk_regime(
    indicators: dict[str, Any],
) -> tuple[str | None, str | None]:
    """Derive risk level and regime from technical indicators.

    Risk level uses ATR%: <2% low, 2-4% medium, >4% high.
    Regime uses SMA alignment + ADX: >25 with alignment = trending,
    <20 = ranging, else volatile.
    """
    atr = _f(indicators, "atr_14")
    atr_pct = _f(indicators, "atr_14_pct")
    if atr_pct is None and atr is not None:
        close = _f(indicators, "close")
        if close and close > 0:
            atr_pct = atr / close

    sma_20 = _f(indicators, "sma_20")
    sma_50 = _f(indicators, "sma_50")
    sma_200 = _f(indicators, "sma_200")
    adx = _f(indicators, "adx_14")

    risk_level = compute_risk_level(atr_pct)
    regime = compute_regime(sma_20, sma_50, sma_200, adx)

    return risk_level, regime
