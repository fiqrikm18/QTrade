"""Stock-level risk level and trend regime derived from technical features.

Pure function over the indicator dicts the scanner writes to
``technical_features.indicators`` (docs/data-model.md §9). Never returns
fabricated values: with missing features it reports UNKNOWN.
"""

from __future__ import annotations

from typing import Any


def _f(indicators: dict[str, Any], key: str) -> float:
    try:
        value = float(indicators.get(key) or 0.0)
    except (TypeError, ValueError):
        return 0.0
    return value


def derive_stock_risk_regime(
    indicators: dict[str, Any],
) -> tuple[str, str]:
    vol = _f(indicators, "hist_vol_20")
    rsi = _f(indicators, "rsi_14")
    sma50 = _f(indicators, "sma_50")
    sma200 = _f(indicators, "sma_200")
    if sma50 <= 0 or sma200 <= 0 or vol <= 0:
        return "UNKNOWN", "UNKNOWN"
    risk = "HIGH" if vol >= 45 else "LOW" if vol <= 20 else "MEDIUM"
    if sma50 > sma200 and rsi >= 50:
        regime = "BULLISH"
    elif sma50 < sma200 and rsi < 50:
        regime = "BEARISH"
    else:
        regime = "NEUTRAL"
    return risk, regime
