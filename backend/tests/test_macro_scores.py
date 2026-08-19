"""Macro risk/support heuristic: real series, 0.0 fallback when insufficient data."""

from datetime import date, timedelta

from app.domain.macro.scores import compute_macro_scores


def _series(days: int, start: float, daily: float) -> list[tuple[date, float]]:
    out = []
    d = date(2026, 8, 19) - timedelta(days=days - 1)
    value = start
    for _ in range(days):
        out.append((d, value))
        value *= 1 + daily
        d += timedelta(days=1)
    return out


def test_scores_computed_from_real_series():
    series = {
        "usd_idr": _series(30, 17500.0, 0.001),  # IDR weakening
        "dxy": _series(30, 104.0, 0.0005),  # dollar rising
        "us_10y": _series(30, 6.5, 0.002),  # yields rising
        "sp500": _series(30, 5000.0, 0.0005),  # equities rising
    }
    out = compute_macro_scores(series)
    assert 0.0 <= out["risk"] <= 100.0
    assert 0.0 <= out["support"] <= 100.0
    assert out["risk"] > out["support"]


def test_scores_missing_data_return_zero():
    out = compute_macro_scores({})
    assert out == {"risk": 0.0, "support": 0.0}
