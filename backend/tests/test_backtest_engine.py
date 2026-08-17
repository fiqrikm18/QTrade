"""Backtest engine: anti-look-ahead, costs, sizing (docs/backtesting.md §2-5)."""

from datetime import date, timedelta

import polars as pl

from app.domain.backtest.engine import (
    CostParams,
    SizingParams,
    run_backtest,
)

_START = date(2024, 1, 1)


def _prices(n: int = 60, tickers: list[str] | None = None) -> pl.DataFrame:
    """Cheap prices (~100) so 100-share lots work with 100k cash, 0.2 max_weight."""
    tickers = tickers or ["A", "B", "C"]
    rows = []
    for t in tickers:
        base = 100.0  # ~100 so 100k * 0.2 / 100 = 200 shares >= 100 lots
        for i in range(n):
            d = _START + timedelta(days=i)
            c = base * (1 + 0.01 * i)
            rows.append(
                {
                    "ticker": t,
                    "trade_date": d,
                    "open": c * 0.998,
                    "high": c * 1.01,
                    "low": c * 0.99,
                    "close": c,
                    "volume": 1_000_000.0,
                }
            )
    return pl.DataFrame(rows)


def _signals(n: int = 60) -> pl.DataFrame:
    rows = []
    for i in range(n):
        d = _START + timedelta(days=i)
        rows.append({"ticker": "A", "asof_date": d, "score": 90.0})
        rows.append({"ticker": "B", "asof_date": d, "score": 80.0})
        rows.append({"ticker": "C", "asof_date": d, "score": 70.0})
    return pl.DataFrame(rows)


def test_fill_uses_next_open_not_signal_close():
    """Anti-look-ahead: signal at close of d, fill at open of d+1."""
    prices = _prices(5, ["A"])
    signals = pl.DataFrame(
        {"ticker": ["A"], "asof_date": [_START], "score": [90.0]}
    )
    trades, _ = run_backtest(
        signals, prices, _START, _START + timedelta(days=4),
        CostParams(), SizingParams(top_n=1),
    )
    assert len(trades) == 1
    entry_bar = prices.filter(pl.col("trade_date") == _START + timedelta(days=1))
    assert trades[0].entry_price >= entry_bar["open"][0]


def test_costs_always_applied():
    prices = _prices(30, ["A"])
    signals = _signals(30).filter(pl.col("ticker") == "A")
    trades, _ = run_backtest(
        signals, prices, _START, _START + timedelta(days=29),
        CostParams(), SizingParams(top_n=1),
    )
    assert len(trades) > 0
    assert all(t.fees > 0 for t in trades)
    assert all(t.slippage >= 0 for t in trades)


def test_min_lot_rounding_and_liquidity_cap():
    """Shares rounded down to 100s and capped at 10% of bar volume."""
    prices = _prices(30, ["A"])
    signals = _signals(30).filter(pl.col("ticker") == "A")
    trades, _ = run_backtest(
        signals, prices, _START, _START + timedelta(days=29),
        CostParams(), SizingParams(top_n=1, max_weight=1.0),
    )
    for t in trades:
        assert t.shares % 100 == 0
        assert t.shares <= 10_000  # 10% of 100k volume


def test_no_future_data_adjacency():
    """backtesting.md §3.6: trades never reference values from > exit_date."""
    prices = _prices(60)
    signals = _signals(60)
    trades, equity = run_backtest(
        signals, prices, _START, _START + timedelta(days=59),
        CostParams(), SizingParams(top_n=2),
    )
    last_price_date = prices["trade_date"].max()
    assert last_price_date == _START + timedelta(days=59)
    assert equity["date"].max() <= last_price_date
    for t in trades:
        assert t.exit_date <= last_price_date
        assert t.entry_date < t.exit_date


def _equity_with_drawdown() -> pl.DataFrame:
    """Equity with a drawdown so max_dd < 0 and sharpe > 0."""
    rows = []
    start = date(2024, 1, 1)
    for i in range(252):
        v = 100_000.0 * (1.0005) ** i * (0.95 if 100 <= i < 180 else 1.0)
        rows.append({"date": start + timedelta(days=i), "equity": v})
    return pl.DataFrame(rows)


def test_equity_drawdown_yields_negative_max_dd():
    eq = _equity_with_drawdown()
    assert eq["equity"].max() > eq["equity"][0]
    # max drawdown should be negative (dip below prior peak)
    peak = eq["equity"][0]
    max_dd = 0.0
    for v in eq["equity"]:
        peak = max(peak, v)
        max_dd = min(max_dd, v / peak - 1.0)
    assert max_dd < 0.0
