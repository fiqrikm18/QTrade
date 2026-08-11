import math

import polars as pl
import pytest

from app.domain.technical.indicators import (
    atr,
    bollinger,
    historical_volatility,
    macd,
    relative_volume,
    roc,
    rsi,
    sma,
    stochastic,
)


def _non_null(s: pl.Series) -> pl.Series:
    return s.drop_nulls()


def test_sma():
    s = pl.Series([1.0, 2.0, 3.0, 4.0, 5.0, 6.0])
    out = sma(s, 5)
    assert out.to_list()[:4] == [None, None, None, None]
    assert out.to_list()[4:] == pytest.approx([3.0, 4.0])


def test_rsi_bounds():
    close = pl.Series([float(i) for i in range(1, 40)]) + pl.Series(
        [math.sin(i) for i in range(39)]
    )
    out = rsi(close)
    assert out.null_count() > 0
    vals = _non_null(out)
    assert (vals >= 0).all() and (vals <= 100).all()


def test_macd_shapes():
    close = pl.Series([float(i) for i in range(1, 60)])
    line, signal, hist = macd(close)
    assert len(line) == len(close) == len(signal) == len(hist)
    assert hist.null_count() > 0


def test_atr_positive():
    rng = pl.Series([1.0, 2.0, 1.5, 2.5, 1.8, 3.0, 2.2, 3.5, 2.8, 4.0, 3.2])
    df = pl.DataFrame(
        {
            "high": rng + 0.5,
            "low": rng - 0.5,
            "close": rng,
        }
    )
    out = atr(df)
    assert (out.drop_nulls() >= 0).all()
    assert out.null_count() > 0


def test_bollinger_band_order():
    close = pl.Series([float(i) for i in range(1, 50)]) + pl.Series(
        [math.sin(i) for i in range(49)]
    )
    upper, mid, lower = bollinger(close, 20, 2.0)
    mask = upper.is_not_null()
    assert (upper.filter(mask) >= mid.filter(mask)).all()
    assert (mid.filter(mask) >= lower.filter(mask)).all()


def test_roc():
    close = pl.Series([1.0, 2.0, 4.0, 8.0, 16.0, 32.0])
    out = roc(close, 1)
    assert out.drop_nulls().min() > 0


def test_relative_volume():
    volume = pl.Series([100.0] * 30)
    out = relative_volume(volume, 20)
    assert (out.drop_nulls() - 1.0).abs().max() < 1e-9


def test_hist_vol_nonnegative():
    close = pl.Series([float(i) for i in range(1, 50)]) + pl.Series(
        [math.sin(i) for i in range(49)]
    )
    out = historical_volatility(close, 20)
    assert (out.drop_nulls() >= 0).all()
    assert out.null_count() > 0


def test_stochastic_bounds():
    base = pl.Series([float(i) for i in range(1, 40)]) + pl.Series(
        [math.sin(i) for i in range(39)]
    )
    df = pl.DataFrame({"high": base + 0.5, "low": base - 0.5, "close": base})
    k, d = stochastic(df)
    for s in (k, d):
        vals = s.drop_nulls()
        assert (vals >= 0).all() and (vals <= 100).all()
