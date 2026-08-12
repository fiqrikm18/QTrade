"""Pure technical indicators over Polars Series/DataFrames.

Formulas per docs/technical-analysis.md sections 2-5. No look-ahead:
rolling windows only look at current and past rows. Warm-up rows are null.
"""

from __future__ import annotations

import math
from typing import overload

import polars as pl

_TRADING_DAYS = 252


@overload
def sma(close: pl.Series, n: int) -> pl.Series: ...


@overload
def sma(close: pl.Expr, n: int) -> pl.Expr: ...


def sma(close: pl.Series | pl.Expr, n: int) -> pl.Series | pl.Expr:
    """Simple moving average of `close` over `n` rows."""
    return close.rolling_mean(n, min_samples=n)


@overload
def ema(close: pl.Series, n: int) -> pl.Series: ...


@overload
def ema(close: pl.Expr, n: int) -> pl.Expr: ...


def ema(close: pl.Series | pl.Expr, n: int) -> pl.Series | pl.Expr:
    """Exponential moving average, alpha=2/(n+1), seeded after `n` samples."""
    return close.ewm_mean(alpha=2 / (n + 1), min_samples=n)


def _wildered(expr: pl.Expr | pl.Series, n: int) -> pl.Series:
    s = expr if isinstance(expr, pl.Series) else pl.select([expr]).to_series()
    return s.ewm_mean(alpha=1 / n, min_samples=n, adjust=False, ignore_nulls=True)


def rsi(close: pl.Series, n: int = 14) -> pl.Series:
    """Relative Strength Index (Wilder smoothing)."""
    delta = close - close.shift(1)
    gain = delta.clip(lower_bound=0.0)
    loss = (-delta).clip(lower_bound=0.0)
    avg_gain = _wildered(gain, n)
    avg_loss = _wildered(loss, n)
    rs = avg_gain / avg_loss
    return (100.0 - 100.0 / (1.0 + rs)).fill_nan(100.0)


def macd(
    close: pl.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> tuple[pl.Series, pl.Series, pl.Series]:
    """MACD line, signal line, and histogram."""
    line = ema(close, fast) - ema(close, slow)
    signal_line = line.ewm_mean(alpha=2 / (signal + 1), min_samples=signal)
    histogram = line - signal_line
    return line, signal_line, histogram


def _true_range(df: pl.DataFrame) -> pl.Series:
    high = df["high"]
    low = df["low"]
    prev_close = df["close"].shift(1)
    return pl.select(
        pl.max_horizontal(
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        )
    ).to_series()


def atr(df: pl.DataFrame, n: int = 14) -> pl.Series:
    """Average True Range (Wilder smoothing)."""
    return _wildered(_true_range(df), n)


def bollinger(
    close: pl.Series,
    n: int = 20,
    k: float = 2.0,
) -> tuple[pl.Series, pl.Series, pl.Series]:
    """Bollinger bands: mid=SMA, upper=mid+k*std, lower=mid-k*std."""
    mid = sma(close, n)
    std = close.rolling_std(n, min_samples=n)
    upper = mid + k * std
    lower = mid - k * std
    return upper, mid, lower


@overload
def roc(close: pl.Series, n: int) -> pl.Series: ...


@overload
def roc(close: pl.Expr, n: int) -> pl.Expr: ...


def roc(close: pl.Series | pl.Expr, n: int) -> pl.Series | pl.Expr:
    """Rate of change: 100 * (C/C_{t-n} - 1)."""
    return 100.0 * (close / close.shift(n) - 1.0)


def adx(df: pl.DataFrame, n: int = 14) -> pl.Series:
    """Average Directional Index (Wilder smoothing)."""
    high = df["high"]
    low = df["low"]
    up_move = high - high.shift(1)
    down_move = low.shift(1) - low
    plus_dm = (
        pl.when((up_move > down_move) & (up_move > 0)).then(up_move).otherwise(0.0)
    )
    minus_dm = (
        pl.when((down_move > up_move) & (down_move > 0)).then(down_move).otherwise(0.0)
    )
    plus_dm = pl.select(plus_dm).to_series()
    minus_dm = pl.select(minus_dm).to_series()
    smoothed_tr = _wildered(_true_range(df), n)
    plus_di = 100.0 * _wildered(plus_dm, n) / smoothed_tr
    minus_di = 100.0 * _wildered(minus_dm, n) / smoothed_tr
    di_sum = plus_di + minus_di
    dx = (
        pl.when(di_sum == 0)
        .then(0.0)
        .otherwise(100.0 * (plus_di - minus_di).abs() / di_sum)
    )
    dx = pl.select(dx).to_series()
    return _wildered(dx, n)


def relative_volume(volume: pl.Series, n: int = 20) -> pl.Series:
    """Volume relative to its own SMA."""
    return volume / sma(volume, n)


def historical_volatility(close: pl.Series, n: int = 20) -> pl.Series:
    """Annualized volatility of log returns."""
    log_returns = close.log() - close.shift(1).log()
    return log_returns.rolling_std(n, min_samples=n) * math.sqrt(_TRADING_DAYS)


def stochastic(
    df: pl.DataFrame,
    k: int = 14,
    d: int = 3,
) -> tuple[pl.Series, pl.Series]:
    """Stochastic %K and %D lines."""
    close = df["close"]
    low_n = df["low"].rolling_min(k, min_samples=k)
    high_n = df["high"].rolling_max(k, min_samples=k)
    span = high_n - low_n
    k_line = pl.when(span == 0).then(100.0).otherwise(100.0 * (close - low_n) / span)
    k_line = pl.select(k_line).to_series()
    d_line = k_line.rolling_mean(d, min_samples=d)
    return k_line, d_line
