"""Backtest portfolio metrics (docs/backtesting.md §6)."""

from datetime import date, timedelta

import polars as pl

from app.domain.backtest.engine import TradeRecord
from app.domain.backtest.metrics import compute_metrics


def _equity_with_drawdown() -> pl.DataFrame:
    """Equity with a drawdown so max_dd < 0, sharpe > 0, calmar != 0."""
    rows = []
    start = date(2024, 1, 1)
    for i in range(252):
        v = 100_000.0 * (1.0005) ** i * (0.95 if 100 <= i < 180 else 1.0)
        rows.append({"date": start + timedelta(days=i), "equity": v})
    return pl.DataFrame(rows)


def _equity_simple_growth() -> pl.DataFrame:
    """Monotonic growth for trade stats tests (no drawdown needed for those)."""
    rows = []
    start = date(2024, 1, 1)
    for i in range(252):
        rows.append(
            {"date": start + timedelta(days=i), "equity": 100_000.0 * (1.0005) ** i}
        )
    return pl.DataFrame(rows)


def test_metrics_positive_growth():
    m = compute_metrics(_equity_with_drawdown(), [], rf=0.05)
    assert m["cagr"] > 0
    assert m["sharpe"] > 0
    assert m["max_drawdown"] < 0.0
    assert m["calmar"] != 0.0


def test_trade_stats():
    trades = [
        TradeRecord(
            "A",
            date(2024, 1, 1),
            date(2024, 1, 10),
            100.0,
            110.0,
            100,
            1000.0,
            5.0,
            1.0,
            "signal",
        ),
        TradeRecord(
            "B",
            date(2024, 1, 1),
            date(2024, 1, 10),
            100.0,
            95.0,
            100,
            -500.0,
            5.0,
            1.0,
            "signal",
        ),
    ]
    m = compute_metrics(_equity_simple_growth(), trades)
    assert m["win_rate"] == 0.5
    assert m["profit_factor"] == 2.0  # 1000 / 500
    assert m["avg_holding_days"] == 9.0
