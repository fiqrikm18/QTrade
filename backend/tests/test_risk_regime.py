"""Stock risk/regime derived from real technical features."""

from app.domain.technical.risk import derive_stock_risk_regime


def test_low_volatility_bullish():
    indicators = {
        "hist_vol_20": 12.0,
        "rsi_14": 60.0,
        "sma_50": 110.0,
        "sma_200": 100.0,
    }
    assert derive_stock_risk_regime(indicators) == ("LOW", "BULLISH")


def test_high_volatility_bearish():
    indicators = {
        "hist_vol_20": 55.0,
        "rsi_14": 30.0,
        "sma_50": 90.0,
        "sma_200": 100.0,
    }
    assert derive_stock_risk_regime(indicators) == ("HIGH", "BEARISH")


def test_mixed_signal_neutral():
    indicators = {
        "hist_vol_20": 30.0,
        "rsi_14": 55.0,
        "sma_50": 95.0,
        "sma_200": 100.0,
    }
    assert derive_stock_risk_regime(indicators) == ("MEDIUM", "NEUTRAL")


def test_missing_features_defaults_to_unknown():
    assert derive_stock_risk_regime({}) == ("UNKNOWN", "UNKNOWN")
