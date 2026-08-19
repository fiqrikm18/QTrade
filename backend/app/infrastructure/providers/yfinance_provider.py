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
    return ticker if "." in ticker or ticker.startswith("^") else f"{ticker}.JK"


_INDEX_SYMBOLS: dict[str, str] = {"IHSG": "^JKSE"}


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

    def get_index_ohlcv(self, index: str, start: date, end: date) -> pl.DataFrame:
        symbol = _INDEX_SYMBOLS.get(index, index)
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
            info.get("previousClose") or info.get("regularMarketPreviousClose") or price
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

    def get_latest_fundamentals(self, ticker: str) -> dict[str, object]:
        """Latest point-in-time fundamental snapshot from yfinance.

        Returns ``{period_end, reported_at, items}`` where ``items`` uses the
        canonical keys consumed by ``calculate_ratios``. Statement values are
        preferred; ``info`` covers ``totalRevenue``/``netIncomeToCommon``,
        shares and dividend. Missing rows are omitted; if nothing usable is
        found, raises ``ValueError`` so the caller can fail honestly (no
        fabricated numbers). ``reported_at`` is taken from ``info``
        (``mostRecentQuarter``), never the fetch date.
        """
        symbol = _idx_symbol(ticker)
        tk: Any = yf.Ticker(symbol)
        info: dict[Any, Any] = dict(tk.info)
        items: dict[str, float] = {}

        def _stmt_value(stmt: Any, row: str) -> float | None:
            if stmt is None or getattr(stmt, "empty", True):
                return None
            try:
                value = stmt.loc[row]
            except (KeyError, IndexError, TypeError):
                return None
            if hasattr(value, "iloc") and len(value) > 0:
                value = value.iloc[0]
            try:
                num = float(value)
            except (TypeError, ValueError):
                return None
            return num if num == num else None  # drop NaN

        mapping: dict[str, tuple[str, str]] = {
            "revenue": ("income_stmt", "Total Revenue"),
            "gross_profit": ("income_stmt", "Gross Profit"),
            "ebitda": ("income_stmt", "EBITDA"),
            "ebit": ("income_stmt", "EBIT"),
            "net_income": ("income_stmt", "Net Income"),
            "eps": ("income_stmt", "Basic EPS"),
            "interest_expense": ("income_stmt", "Interest Expense"),
            "operating_cash_flow": ("cashflow", "Operating Cash Flow"),
            "free_cash_flow": ("cashflow", "Free Cash Flow"),
            "total_assets": ("balance_sheet", "Total Assets"),
            "total_liabilities": (
                "balance_sheet",
                "Total Liabilities Net Minority Interest",
            ),
            "equity": ("balance_sheet", "Stockholders Equity"),
            "debt": ("balance_sheet", "Total Debt"),
            "cash": ("balance_sheet", "Cash And Cash Equivalents"),
            "current_assets": ("balance_sheet", "Current Assets"),
            "current_liabilities": ("balance_sheet", "Current Liabilities"),
        }
        statements = {
            "income_stmt": getattr(tk, "income_stmt", None),
            "cashflow": getattr(tk, "cashflow", None),
            "balance_sheet": getattr(tk, "balance_sheet", None),
        }
        for key, (stmt_name, row) in mapping.items():
            value = _stmt_value(statements[stmt_name], row)
            if value is not None:
                items[key] = value

        # ``info`` also carries the latest-period figures; use them when the
        # statement frames lack the row (yfinance sometimes returns info
        # without statement frames).
        for key, info_key in (
            ("revenue", "totalRevenue"),
            ("net_income", "netIncomeToCommon"),
        ):
            if key in items:
                continue
            raw = info.get(info_key)
            if raw is None:
                continue
            try:
                num = float(raw)
            except (TypeError, ValueError):
                continue
            if num == num:  # drop NaN
                items[key] = num

        shares = info.get("sharesOutstanding")
        if shares and float(shares) > 0:
            items["shares_outstanding"] = float(shares)
        dividend = info.get("dividendRate")
        if dividend and float(dividend) > 0:
            items["dividend_per_share"] = float(dividend)
        if "equity" in items and items["equity"] > 0 and "shares_outstanding" in items:
            items["bvps"] = items["equity"] / items["shares_outstanding"]

        income_stmt = statements["income_stmt"]
        period_end: Any = None
        if income_stmt is not None and not income_stmt.empty:
            try:
                period_end = income_stmt.columns[0]
            except (IndexError, TypeError):
                period_end = None
        most_recent_quarter: Any = info.get("mostRecentQuarter")

        def _iso_date(value: Any) -> str | None:
            if hasattr(value, "date"):
                return value.date().isoformat()
            if isinstance(value, str):
                try:
                    return date.fromisoformat(value).isoformat()
                except ValueError:
                    return None
            return None

        period_end_iso = (
            _iso_date(period_end)
            or _iso_date(most_recent_quarter)
            or date.today().isoformat()
        )
        reported_at = _iso_date(most_recent_quarter) or period_end_iso

        if not items:
            raise ValueError(f"no fundamentals available for {ticker}")

        return {
            "period_end": period_end_iso,
            "reported_at": reported_at,
            "items": items,
        }
