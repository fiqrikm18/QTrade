"""yfinance market data provider for IDX equities."""

from datetime import date
from typing import Any

import polars as pl
import yfinance as yf  # pyright: ignore[reportMissingTypeStubs]

from app.domain.common.types import Quote, UniverseItem
from app.domain.market.interfaces import MarketDataProvider

_OHLCV_RENAME: dict[str, str] = {
    "Open": "open",
    "High": "high",
    "Low": "low",
    "Close": "close",
    "Volume": "volume",
}


def _idx_symbol(ticker: str) -> str:
    """yfinance uses the ``ticker.JK`` form for IDX equities."""
    return ticker if "." in ticker else f"{ticker}.JK"


def normalize_to_polars(frame: Any) -> pl.DataFrame:
    """Convert a ``yfinance.Ticker.history`` frame into the canonical OHLCV
    Polars frame. Yfinance is untyped, so the pandas boundary is ``Any``; the
    returned frame is precisely typed.

    Columns produced: trade_date, open, high, low, close, volume, turnover,
    source_timestamp. NaN rows dropped; raises if nothing remains.
    """
    if frame.empty:
        raise ValueError("no OHLCV data: empty history frame")
    df = frame.reset_index()
    date_col = "Date" if "Date" in df.columns else df.columns[0]
    df = df.rename(columns={date_col: "trade_date", **_OHLCV_RENAME})
    for missing in ("trade_date", "open", "high", "low", "close", "volume"):
        if missing not in df.columns:
            raise ValueError(f"missing expected column: {missing}")
    df = df.dropna(subset=["trade_date", "open", "high", "low", "close", "volume"])
    if df.empty:
        raise ValueError("no OHLCV rows after dropping NaN")
    # Build native Python lists to avoid requiring pyarrow for pandas interop.
    data: dict[str, list[Any]] = {
        "trade_date": df["trade_date"].dt.date.tolist(),
        "open": [float(v) for v in df["open"].tolist()],
        "high": [float(v) for v in df["high"].tolist()],
        "low": [float(v) for v in df["low"].tolist()],
        "close": [float(v) for v in df["close"].tolist()],
        "volume": [int(v) for v in df["volume"].tolist()],
    }
    out = pl.DataFrame(data).with_columns(
        [
            pl.col("trade_date").cast(pl.Date),
            pl.col("open").cast(pl.Float64),
            pl.col("high").cast(pl.Float64),
            pl.col("low").cast(pl.Float64),
            pl.col("close").cast(pl.Float64),
            pl.col("volume").cast(pl.Int64),
        ]
    )
    out = out.with_columns(
        [
            (pl.col("close") * pl.col("volume")).cast(pl.Float64).alias("turnover"),
            pl.col("trade_date").cast(pl.Datetime).alias("source_timestamp"),
        ]
    )
    return out.select(
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "turnover",
        "source_timestamp",
    )


class YFinanceProvider(MarketDataProvider):
    """Market data provider backed by yfinance (real network data)."""

    def get_universe(self) -> list[UniverseItem]:
        # Universe is seeded from stock-list.xlsx, not from the provider.
        raise NotImplementedError("universe sourced from stock-list.xlsx seed")

    def get_ohlcv(self, ticker: str, start: date, end: date) -> pl.DataFrame:
        symbol = _idx_symbol(ticker)
        tk: Any = yf.Ticker(symbol)
        hist: Any = tk.history(
            start=start.isoformat(),
            end=end.isoformat(),
            interval="1d",
            auto_adjust=False,
        )
        return normalize_to_polars(hist)

    def get_quote(self, ticker: str) -> Quote:
        symbol = _idx_symbol(ticker)
        tk: Any = yf.Ticker(symbol)
        info: Any = dict(tk.fast_info)  # FastInfo is dict-like
        price = float(info.get("lastPrice") or 0.0)
        prev = float(
            info.get("previousClose")
            or info.get("regularMarketPreviousClose")
            or price
        )
        change = price - prev
        volume = int(info.get("lastVolume") or info.get("tenDayAverageVolume") or 0)
        shares = info.get("shares")
        shares_out = int(shares) if shares else 0
        # No sync psycopg driver is available to read shares_outstanding from the
        # stocks table; fall back to price * volume when yfinance lacks shares.
        market_cap = price * shares_out if shares_out else price * volume
        return Quote(
            ticker=ticker,
            price=price,
            change=change,
            volume=volume,
            turnover=price * volume,
            market_cap=market_cap,
            asof=date.today(),
        )
