"""Portfolio metrics for backtest runs (docs/backtesting.md §6, PRD §27)."""

from __future__ import annotations

import math

import polars as pl

from app.domain.backtest.engine import TradeRecord

_TRADING_DAYS = 252


def _annualized_sharpe(returns: list[float], rf: float) -> float:
    if len(returns) < 2:
        return 0.0
    mean = sum(returns) / len(returns)
    var = sum((r - mean) ** 2 for r in returns) / (len(returns) - 1)
    std = math.sqrt(var)
    if std == 0:
        return 0.0
    return (mean - rf / _TRADING_DAYS) / std * math.sqrt(_TRADING_DAYS)


def compute_metrics(
    equity: pl.DataFrame, trades: list[TradeRecord], rf: float = 0.05
) -> dict[str, float]:
    """Compute the standard backtest metric set from equity + trades."""
    if equity.is_empty():
        return {
            k: 0.0
            for k in (
                "cagr",
                "sharpe",
                "sortino",
                "max_drawdown",
                "calmar",
                "win_rate",
                "profit_factor",
                "expectancy",
                "avg_holding_days",
                "turnover",
                "total_return",
            )
        }
    eq = equity.sort("date")["equity"].to_list()
    n = len(eq)
    days = (equity["date"][-1] - equity["date"][0]).days
    total_return = eq[-1] / eq[0] - 1.0
    years = max(days / 365.0, 1e-9)
    cagr = (eq[-1] / eq[0]) ** (1 / years) - 1.0

    returns = [eq[i] / eq[i - 1] - 1.0 for i in range(1, n)]
    sharpe = _annualized_sharpe(returns, rf)

    downside = [min(0.0, r) for r in returns]
    if len(downside) >= 2:
        dmean = sum(downside) / len(downside)
        dvar = sum((r - dmean) ** 2 for r in downside) / (len(downside) - 1)
        dstd = math.sqrt(dvar)
        sortino = (
            (sum(returns) / len(returns) - rf / _TRADING_DAYS)
            / dstd
            * math.sqrt(_TRADING_DAYS)
            if dstd > 0
            else 0.0
        )
    else:
        sortino = 0.0

    peak = eq[0]
    max_dd = 0.0
    for v in eq:
        peak = max(peak, v)
        max_dd = min(max_dd, v / peak - 1.0)

    wins = [t for t in trades if t.pnl > 0]
    losses = [t for t in trades if t.pnl <= 0]
    win_rate = len(wins) / len(trades) if trades else 0.0
    gross_win = sum(t.pnl for t in wins)
    gross_loss = abs(sum(t.pnl for t in losses))
    profit_factor = (
        gross_win / gross_loss if gross_loss > 0 else (1e9 if gross_win > 0 else 0.0)
    )
    expectancy = sum(t.pnl for t in trades) / len(trades) if trades else 0.0
    avg_holding = (
        sum((t.exit_date - t.entry_date).days for t in trades) / len(trades)
        if trades
        else 0.0
    )

    buys = sum(t.shares * t.entry_price for t in trades)
    turnover = buys / eq[0] if eq[0] else 0.0

    return {
        "cagr": round(cagr, 6),
        "sharpe": round(sharpe, 6),
        "sortino": round(sortino, 6),
        "max_drawdown": round(max_dd, 6),
        "calmar": round(cagr / abs(max_dd), 6) if max_dd != 0 else 0.0,
        "win_rate": round(win_rate, 6),
        "profit_factor": round(profit_factor, 6),
        "expectancy": round(expectancy, 6),
        "avg_holding_days": round(avg_holding, 6),
        "turnover": round(turnover, 6),
        "total_return": round(total_return, 6),
    }
