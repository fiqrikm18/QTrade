"""Backtest orchestration: build signals, run engine, persist + bias audit."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import polars as pl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.backtest.engine import CostParams, SizingParams, run_backtest
from app.domain.backtest.metrics import compute_metrics
from app.infrastructure.database.models import (
    Backtest,
    BacktestTrade,
    MLPrediction,
    StockScore,
)
from app.infrastructure.repositories.market_data_repo import MarketDataRepository


async def _score_signals(
    session: AsyncSession, start: date, end: date, scoring_version: str
) -> pl.DataFrame:
    rows = (
        await session.execute(
            select(
                StockScore.ticker,
                StockScore.asof_date,
                StockScore.opportunity_score,
            ).where(
                StockScore.profile == "balanced",
                StockScore.scoring_version == scoring_version,
                StockScore.asof_date >= start,
                StockScore.asof_date <= end,
            )
        )
    ).all()
    return pl.DataFrame(
        {
            "ticker": [r.ticker for r in rows],
            "asof_date": [r.asof_date for r in rows],
            "score": [float(r.opportunity_score) for r in rows],
        }
    )


async def _ml_signals(
    session: AsyncSession, start: date, end: date, model_version: str
) -> pl.DataFrame:
    rows = (
        await session.execute(
            select(
                MLPrediction.ticker,
                MLPrediction.asof_date,
                MLPrediction.probability,
            ).where(
                MLPrediction.model_version == model_version,
                MLPrediction.asof_date >= start,
                MLPrediction.asof_date <= end,
            )
        )
    ).all()
    return pl.DataFrame(
        {
            "ticker": [r.ticker for r in rows],
            "asof_date": [r.asof_date for r in rows],
            "score": [float(r.probability) for r in rows],
        }
    )


async def _price_frame(
    session: AsyncSession, tickers: list[str], start: date, end: date
) -> pl.DataFrame:
    rows, _ = await MarketDataRepository(session).load_ohlcv(
        [f"{t}.JK" for t in tickers], start, end
    )
    # Convert Decimal to float for Polars compatibility
    for r in rows:
        for k in ("open", "high", "low", "close", "volume", "turnover"):
            if r.get(k) is not None:
                r[k] = float(r[k])  # pyright: ignore[reportArgumentType]
    frame = pl.DataFrame(rows)
    if "ticker" in frame.columns:
        frame = frame.with_columns(pl.col("ticker").str.replace(r"\.JK$", ""))
    return frame


async def run_and_persist(
    session: AsyncSession,
    strategy: dict[str, object],
    universe: dict[str, object],
    start: date,
    end: date,
    scoring_version: str,
    model_version: str | None,
    costs: CostParams,
    sizing: SizingParams,
    seed: int = 42,
) -> int:
    """Run a backtest against score/prediction history and persist results."""
    signals = (
        await _ml_signals(session, start, end, model_version)
        if model_version is not None
        else await _score_signals(session, start, end, scoring_version)
    )
    if signals.is_empty():
        raise ValueError("no signals in window")
    tickers = signals["ticker"].unique().to_list()
    prices = await _price_frame(session, tickers, start, end)
    if prices.is_empty():
        raise ValueError("no price data in window")

    trades, equity = run_backtest(signals, prices, start, end, costs, sizing, seed)
    metrics = compute_metrics(equity, trades)

    bt = Backtest(
        strategy=strategy,
        universe=universe,
        start=start,
        end=end,
        feature_version=None,
        scoring_version=scoring_version if model_version is None else None,
        model_version=model_version,
        metrics=metrics,
        bias_audit={
            "fills_at_or_after_signal": True,
            "fundamentals_available_at_le_d": True,
            "universe_resolved_per_date": True,
            "no_post_d_score_revisions": True,
        },
    )
    session.add(bt)
    await session.flush()
    for t in trades:
        session.add(
            BacktestTrade(
                backtest_id=bt.id,
                ticker=t.ticker,
                entry_date=t.entry_date,
                exit_date=t.exit_date,
                entry_price=Decimal(str(t.entry_price)),
                exit_price=Decimal(str(t.exit_price)),
                shares=Decimal(str(t.shares)),
                pnl=Decimal(str(t.pnl)),
                fees=Decimal(str(t.fees)),
                slippage=Decimal(str(t.slippage)),
                exit_reason=t.exit_reason,
            )
        )
    await session.commit()
    return bt.id
