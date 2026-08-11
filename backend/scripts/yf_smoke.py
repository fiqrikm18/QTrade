"""Live smoke test for the yfinance provider against BBCA.JK (real network)."""

import sys
from datetime import date, timedelta

import polars as pl

from app.application.factories import build_market_provider
from app.config.settings import get_settings


def main() -> None:
    symbol = sys.argv[1] if len(sys.argv) > 1 else "BBCA.JK"
    provider = build_market_provider(get_settings())

    today = date.today()
    start = today - timedelta(days=14)
    print(f"== OHLCV {symbol} {start.isoformat()} .. {today.isoformat()} ==")
    ohlcv = provider.get_ohlcv(symbol, start, today)
    print(f"rows={len(ohlcv)}")
    print(ohlcv.tail(5))

    assert len(ohlcv) >= 1, "no OHLCV bars returned"
    assert ohlcv["close"].tail(1).item() > 0, "non-positive close"
    null_total = sum(ohlcv.select(pl.all().is_null().sum()).row(0))
    assert null_total == 0, f"NaN rows present: {null_total}"

    quote = provider.get_quote(symbol)
    print("== Quote ==")
    print(quote)
    print(
        f"== smoke OK: price={quote.price} change={quote.change:.2f} "
        f"mc={quote.market_cap:,.0f} =="
    )


if __name__ == "__main__":
    main()
