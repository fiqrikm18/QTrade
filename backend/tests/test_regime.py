import math
from datetime import date, timedelta

import polars as pl
import pytest

from app.domain.technical.regime import detect_regime, regime_components


def _frame(closes: pl.Series) -> pl.DataFrame:
    n = closes.len()
    start = date(2024, 1, 1)
    dates = pl.date_range(
        start,
        start + timedelta(days=n - 1),
        interval="1d",
        eager=True,
    )
    prev = closes.shift(1).fill_null(closes[0])
    high = pl.select(pl.max_horizontal(closes, prev) * 1.005).to_series()
    low = pl.select(pl.min_horizontal(closes, prev) * 0.995).to_series()
    return pl.DataFrame(
        {
            "trade_date": dates,
            "open": prev,
            "high": high,
            "low": low,
            "close": closes,
            "volume": pl.Series([1_000_000.0] * n),
        }
    )


def _rising(n: int = 260, daily: float = 0.0009, base: float = 1000.0) -> pl.Series:
    return pl.Series([base * (1 + daily) ** i + math.sin(i / 9.0) for i in range(n)])


def _falling(n: int = 260, daily: float = 0.0009, base: float = 1000.0) -> pl.Series:
    return pl.Series([base * (1 - daily) ** i + math.sin(i / 9.0) for i in range(n)])


def _sideways(n: int = 260, base: float = 1000.0) -> pl.Series:
    return pl.Series([base + 2.0 * math.sin(i / 14.0) for i in range(n)])


def _declining(n: int = 260, daily: float = 0.0005, base: float = 1000.0) -> pl.Series:
    return pl.Series([base * (1 - daily) ** i for i in range(n)])


def _high_vol(n: int = 300, base: float = 1000.0, max_amp: float = 0.05) -> pl.Series:
    return pl.Series(
        [base * (1 + max_amp * (i + 1) / n * math.sin(i / 2.0)) for i in range(n)]
    )


def test_rising_index_bullish():
    regime = detect_regime(_frame(_rising()))
    assert regime in {"BULLISH", "STRONG_BULLISH"}


def test_falling_index_bearish():
    regime = detect_regime(_frame(_falling()))
    assert regime in {"WEAK_BEARISH", "BEARISH"}


def test_sideways_neutral():
    regime = detect_regime(_frame(_sideways()))
    assert regime == "NEUTRAL"


def test_high_volatility():
    regime = detect_regime(_frame(_high_vol()))
    assert regime == "HIGH_VOLATILITY"


def test_breadth_tilt():
    df = _frame(_declining())
    positive = detect_regime(df, breadth_score=80)
    negative = detect_regime(df, breadth_score=-80)
    assert negative in {"WEAK_BEARISH", "BEARISH"}
    assert positive in {"NEUTRAL", "BULLISH", "STRONG_BULLISH"}
    assert positive != negative


def test_macro_tilt_does_not_override_direction():
    df = _frame(_falling())
    regime = detect_regime(df, breadth_score=0, macro_tilt=100)
    assert regime in {"WEAK_BEARISH", "BEARISH", "NEUTRAL"}


def test_components_dict():
    df = _frame(_rising())
    comps = regime_components(df)
    assert set(comps) == {"trend", "momentum", "volatility"}
    comps2 = regime_components(df, breadth_score=30, macro_tilt=-20)
    assert {"breadth", "macro"} <= set(comps2)
    for v in comps2.values():
        assert 0.0 <= v <= 100.0


def test_deterministic():
    df = _frame(_rising())
    assert detect_regime(df) == detect_regime(df)


def test_insufficient_history_raises():
    with pytest.raises(ValueError):
        detect_regime(_frame(_rising(n=150)))
