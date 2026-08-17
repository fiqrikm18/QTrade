"""Event-driven daily backtest engine (docs/backtesting.md §2).

Honesty rules implemented by construction:
- Signals are consumed as a *snapshot at d* (already point-in-time).
- Fills happen at the OPEN of the first bar AFTER the signal bar.
- Stops/take-profit/trailing are evaluated on intraday high/low of bars
  AFTER entry (worst-case: stop on low, tp on high — conservative).
- Costs are always on: fees, slippage (fraction of bar range), liquidity
  cap (max_volume_pct of bar volume), min lot of 100 shares.
- No future universe: the caller passes the per-date signal table.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import polars as pl


@dataclass
class CostParams:
    buy_fee: float = 0.0015
    sell_fee: float = 0.0025
    slippage_frac: float = 0.10
    max_volume_pct: float = 0.10
    min_lot: int = 100


@dataclass
class SizingParams:
    mode: str = "equal"
    top_n: int = 5
    max_weight: float = 0.20
    target_vol: float = 0.15


@dataclass
class TradeRecord:
    ticker: str
    entry_date: date
    exit_date: date
    entry_price: float
    exit_price: float
    shares: int
    pnl: float
    fees: float
    slippage: float
    exit_reason: str


@dataclass
class _Position:
    ticker: str
    entry_date: date
    entry_price: float
    shares: int
    entry_fee: float
    entry_slippage: float


def _fill_price(
    bar: dict[str, object], direction: str, costs: CostParams
) -> tuple[float, float]:
    """Fill at bar open + slippage. Returns (fill_price, slippage_cost)."""
    open_p = float(bar["open"])  # pyright: ignore[reportArgumentType]
    high = float(bar["high"])  # pyright: ignore[reportArgumentType]
    low = float(bar["low"])  # pyright: ignore[reportArgumentType]
    slip = costs.slippage_frac * (high - low)
    if direction == "buy":
        return open_p + slip, slip
    return open_p - slip, slip


def _fee(notional: float, is_buy: bool, costs: CostParams) -> float:
    return notional * (costs.buy_fee if is_buy else costs.sell_fee)


def _stop_exit(
    pos: _Position,
    bar: dict[str, object],
    costs: CostParams,
    stop_pct: float | None,
    tp_pct: float | None,
) -> tuple[str, float] | None:
    """Evaluate worst-case exits on a single bar. Returns (reason, exit_price)."""
    high = float(bar["high"])  # pyright: ignore[reportArgumentType]
    low = float(bar["low"])  # pyright: ignore[reportArgumentType]
    if stop_pct is not None and low <= pos.entry_price * (1 - stop_pct):
        return "stop", pos.entry_price * (1 - stop_pct)
    if tp_pct is not None and high >= pos.entry_price * (1 + tp_pct):
        return "tp", pos.entry_price * (1 + tp_pct)
    return None


def run_backtest(
    signals: pl.DataFrame,
    prices: pl.DataFrame,
    start: date,
    end: date,
    costs: CostParams | None = None,
    sizing: SizingParams | None = None,
    seed: int = 42,
) -> tuple[list[TradeRecord], pl.DataFrame]:
    """Run the daily loop. Returns (trades, equity_curve).

    ``signals``: ticker, asof_date, score (point-in-time snapshot at d).
    ``prices``: ticker, trade_date, open, high, low, close, volume.
    """
    import random

    costs = costs or CostParams()
    sizing = sizing or SizingParams()
    random.seed(seed)

    bar_dates = sorted(prices["trade_date"].unique().to_list())
    trades: list[TradeRecord] = []
    positions: dict[str, _Position] = {}
    equity_rows: list[dict[str, object]] = []
    cash = 100_000.0

    signal_by_date: dict[date, pl.DataFrame] = {
        d: signals.filter(pl.col("asof_date") == d)
        for d in signals["asof_date"].unique().to_list()
    }
    prices_by_date: dict[date, pl.DataFrame] = {
        d: prices.filter(pl.col("trade_date") == d) for d in bar_dates
    }

    for i, d in enumerate(bar_dates):
        if d < start or d > end:
            continue
        bar_df = prices_by_date.get(d, pl.DataFrame())
        if bar_df.is_empty():
            continue
        bars = {r["ticker"]: r for r in bar_df.to_dicts()}

        # 1) Exit/stop logic on today's bar (positions opened before today)
        for ticker in list(positions):
            pos = positions[ticker]
            if ticker not in bars:
                continue
            bar = bars[ticker]
            exit_res = _stop_exit(pos, bar, costs, stop_pct=0.10, tp_pct=0.20)
            if exit_res is not None:
                reason, exit_price = exit_res
            else:
                # next-day signal table decides 'signal' exit
                today_sig = signal_by_date.get(d, pl.DataFrame())
                if (
                    not today_sig.is_empty()
                    and ticker in today_sig["ticker"].to_list()
                    and today_sig.filter(pl.col("ticker") == ticker)["score"][0] < 50.0
                ):
                    reason, exit_price = "signal", float(bar["close"])  # pyright: ignore[reportArgumentType]
                else:
                    continue
            high = float(bar["high"])  # pyright: ignore[reportArgumentType]
            low = float(bar["low"])  # pyright: ignore[reportArgumentType]
            sell_price = exit_price - costs.slippage_frac * (high - low)
            proceeds = pos.shares * sell_price
            sell_fee = _fee(proceeds, False, costs)
            net = proceeds - sell_fee
            pnl = net - (pos.shares * pos.entry_price + pos.entry_fee)
            trades.append(
                TradeRecord(
                    ticker=ticker,
                    entry_date=pos.entry_date,
                    exit_date=d,
                    entry_price=pos.entry_price,
                    exit_price=sell_price,
                    shares=pos.shares,
                    pnl=pnl,
                    fees=pos.entry_fee + sell_fee,
                    slippage=pos.entry_slippage,
                    exit_reason=reason,
                )
            )
            cash += net
            del positions[ticker]

        # 2) New entries: signal was computed at close of d-1 (fill at open of d)
        if i > 0:
            prev_d = bar_dates[i - 1]
            prev_sig = signal_by_date.get(prev_d, pl.DataFrame())
        else:
            prev_sig = pl.DataFrame()
        if not prev_sig.is_empty():
            ranked = prev_sig.sort("score", descending=True).head(sizing.top_n)
            for row in ranked.to_dicts():
                tk = row["ticker"]
                if tk in positions or tk not in bars:
                    continue
                bar = bars[tk]
                fill, slip = _fill_price(bar, "buy", costs)
                volume_cap = float(bar["volume"]) * costs.max_volume_pct  # pyright: ignore[reportArgumentType]
                notional = min(cash * sizing.max_weight, volume_cap * fill)
                shares = int(notional / fill // costs.min_lot * costs.min_lot)
                if shares <= 0:
                    continue
                fee = _fee(shares * fill, True, costs)
                cash -= shares * fill + fee
                positions[tk] = _Position(
                    ticker=tk,
                    entry_date=d,
                    entry_price=fill,
                    shares=shares,
                    entry_fee=fee,
                    entry_slippage=slip,
                )

        # 3) Mark to market + record equity
        mkt = sum(
            p.shares * float(bars[p.ticker]["close"])
            for p in positions.values()
            if p.ticker in bars
        )
        equity_rows.append({"date": d, "equity": cash + mkt})

    # Close remaining positions at final close (exit_reason='end')
    for ticker in list(positions):
        pos = positions[ticker]
        d = bar_dates[-1]
        bar = prices_by_date.get(d, pl.DataFrame()).filter(pl.col("ticker") == ticker)
        if bar.is_empty():
            continue
        b = bar.to_dicts()[0]
        close_p = float(b["close"])
        high_p = float(b["high"])
        low_p = float(b["low"])
        sell_price = close_p - costs.slippage_frac * (high_p - low_p)
        proceeds = pos.shares * sell_price
        sell_fee = _fee(proceeds, False, costs)
        net = proceeds - sell_fee
        pnl = net - (pos.shares * pos.entry_price + pos.entry_fee)
        trades.append(
            TradeRecord(
                ticker=ticker,
                entry_date=pos.entry_date,
                exit_date=d,
                entry_price=pos.entry_price,
                exit_price=sell_price,
                shares=pos.shares,
                pnl=pnl,
                fees=pos.entry_fee + sell_fee,
                slippage=pos.entry_slippage,
                exit_reason="end",
            )
        )

    equity = pl.DataFrame(equity_rows, schema={"date": pl.Date, "equity": pl.Float64})
    return trades, equity
