"""Stock risk/regime derived from real technical features."""

from app.domain.technical.risk import (
    compute_regime,
    compute_risk_level,
    derive_stock_risk_regime,
)


def test_compute_risk_level_low():
    assert compute_risk_level(0.015) == "low"
    assert compute_risk_level(0.019) == "low"


def test_compute_risk_level_medium():
    assert compute_risk_level(0.02) == "medium"
    assert compute_risk_level(0.03) == "medium"
    assert compute_risk_level(0.04) == "medium"


def test_compute_risk_level_high():
    assert compute_risk_level(0.041) == "high"
    assert compute_risk_level(0.06) == "high"


def test_compute_risk_level_none():
    assert compute_risk_level(None) is None


def test_compute_regime_trending_up():
    assert compute_regime(110.0, 105.0, 100.0, 30.0) == "trending_up"
    assert compute_regime(101.0, 100.5, 100.0, 26.0) == "trending_up"


def test_compute_regime_trending_down():
    assert compute_regime(90.0, 95.0, 100.0, 30.0) == "trending_down"
    assert compute_regime(99.0, 99.5, 100.0, 26.0) == "trending_down"


def test_compute_regime_ranging():
    assert compute_regime(100.0, 100.0, 100.0, 15.0) == "ranging"
    assert compute_regime(101.0, 100.0, 99.0, 19.0) == "ranging"


def test_compute_regime_volatile():
    assert compute_regime(102.0, 100.0, 101.0, 30.0) == "volatile"
    assert compute_regime(100.0, 100.0, 100.0, 22.0) == "volatile"


def test_compute_regime_none_when_missing():
    assert compute_regime(None, 100.0, 100.0, 20.0) is None
    assert compute_regime(100.0, None, 100.0, 20.0) is None
    assert compute_regime(100.0, 100.0, None, 20.0) is None
    assert compute_regime(100.0, 100.0, 100.0, None) is None


def test_derive_stock_risk_regime_low_trending_up():
    indicators = {
        "atr_14": 100.0,
        "atr_14_pct": 0.015,
        "sma_20": 110.0,
        "sma_50": 105.0,
        "sma_200": 100.0,
        "adx_14": 30.0,
    }
    assert derive_stock_risk_regime(indicators) == ("low", "trending_up")


def test_derive_stock_risk_regime_high_trending_down():
    indicators = {
        "atr_14": 500.0,
        "atr_14_pct": 0.05,
        "sma_20": 90.0,
        "sma_50": 95.0,
        "sma_200": 100.0,
        "adx_14": 30.0,
    }
    assert derive_stock_risk_regime(indicators) == ("high", "trending_down")


def test_derive_stock_risk_regime_medium_ranging():
    indicators = {
        "atr_14": 200.0,
        "atr_14_pct": 0.03,
        "sma_20": 100.0,
        "sma_50": 100.0,
        "sma_200": 100.0,
        "adx_14": 15.0,
    }
    assert derive_stock_risk_regime(indicators) == ("medium", "ranging")


def test_derive_stock_risk_regime_medium_volatile():
    indicators = {
        "atr_14": 200.0,
        "atr_14_pct": 0.03,
        "sma_20": 102.0,
        "sma_50": 100.0,
        "sma_200": 101.0,
        "adx_14": 30.0,
    }
    assert derive_stock_risk_regime(indicators) == ("medium", "volatile")


def test_derive_stock_risk_regime_atr_fallback_from_close():
    indicators = {
        "atr_14": 150.0,
        "close": 10000.0,
        "sma_20": 100.0,
        "sma_50": 100.0,
        "sma_200": 100.0,
        "adx_14": 15.0,
    }
    risk, regime = derive_stock_risk_regime(indicators)
    assert risk == "low"  # 150/10000 = 0.015 -> low
    assert regime == "ranging"


def test_derive_stock_risk_regime_missing_features():
    assert derive_stock_risk_regime({}) == (None, None)
    # Only ATR -> risk computed, regime None
    assert derive_stock_risk_regime({"atr_14_pct": 0.03}) == ("medium", None)
    # Only SMAs -> risk None, regime None (ADX missing)
    indicators = {"sma_20": 100, "sma_50": 100, "sma_200": 100}
    assert derive_stock_risk_regime(indicators) == (None, None)
