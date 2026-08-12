"""Application service: versioned, per-ticker technical feature builder.

Pure vectorized orchestration over Polars; no DB/network access.
"""

from __future__ import annotations

import polars as pl

from app.domain.technical.indicators import (
    adx,
    atr,
    bollinger,
    ema,
    historical_volatility,
    macd,
    relative_volume,
    roc,
    rsi,
    sma,
    stochastic,
)

FEATURE_VERSION = "v1"

_REQUIRED_COLUMNS = ["ticker", "trade_date", "open", "high", "low", "close", "volume"]


def _features_for_ticker(grp: pl.DataFrame) -> pl.DataFrame:
    grp = grp.sort("trade_date")
    close = grp["close"]
    macd_line, macd_sig, macd_hist = macd(close)
    boll_up, boll_mid, boll_low = bollinger(close)
    stoch_k, stoch_d = stochastic(grp)
    return grp.with_columns(
        pl.Series("rsi_14", rsi(close)),
        pl.Series("macd", macd_line),
        pl.Series("macd_signal", macd_sig),
        pl.Series("macd_hist", macd_hist),
        pl.Series("sma_20", sma(close, 20)),
        pl.Series("sma_50", sma(close, 50)),
        pl.Series("sma_200", sma(close, 200)),
        pl.Series("ema_20", ema(close, 20)),
        pl.Series("atr_14", atr(grp)),
        pl.Series("boll_upper", boll_up),
        pl.Series("boll_mid", boll_mid),
        pl.Series("boll_lower", boll_low),
        pl.Series("roc_20", roc(close, 20)),
        pl.Series("adx_14", adx(grp)),
        pl.Series("rel_volume", relative_volume(grp["volume"])),
        pl.Series("hist_vol_20", historical_volatility(close)),
        pl.Series("stoch_k", stoch_k),
        pl.Series("stoch_d", stoch_d),
        pl.lit(FEATURE_VERSION).alias("feature_version"),
    )


def build_technical_features(df: pl.DataFrame) -> pl.DataFrame:
    """Compute all Task-1 indicators per ticker, tagged with ``FEATURE_VERSION``.

    Indicators never mix tickers: each ``ticker`` group is sorted by
    ``trade_date`` and processed independently. Output rows are grouped by
    ticker (first-appearance order), date-sorted within each ticker.
    """
    missing = [c for c in _REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"missing required columns: {missing}")

    return df.group_by("ticker", maintain_order=True).map_groups(_features_for_ticker)
