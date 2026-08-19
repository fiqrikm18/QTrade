"""Backtest service: build signals from score history, run, persist."""

from datetime import date, timedelta

import pytest_asyncio
from sqlalchemy import delete, func, select

from app.application.services.backtest_service import run_and_persist
from app.domain.backtest.engine import CostParams, SizingParams
from app.infrastructure.database.models import (
    Backtest,
    BacktestTrade,
    OhlcvDaily,
    StockScore,
)


@pytest_asyncio.fixture(loop_scope="session", autouse=True)
async def _clean(session):
    await session.execute(delete(StockScore))
    await session.execute(delete(OhlcvDaily))
    await session.commit()
    yield


async def _seed_scan_history(session) -> None:
    start = date(2024, 1, 1)
    for i in range(20):
        d = start + timedelta(days=i)
        for tk, score in (("BBCA", 80.0 + i), ("BBRI", 70.0 + i), ("TLKM", 60.0 + i)):
            session.add(
                StockScore(
                    ticker=tk,
                    asof_date=d,
                    profile="balanced",
                    scoring_version="v1",
                    feature_version="v1",
                    opportunity_score=score,
                    classification="neutral",
                    score_components={},
                )
            )
            session.add(
                OhlcvDaily(
                    ticker=f"{tk}.JK",
                    trade_date=d,
                    open=100.0 + i,
                    high=101.0 + i,
                    low=99.0 + i,
                    close=100.5 + i,
                    volume=1_000_000,
                    turnover=1e9,
                    provider="yfinance",
                )
            )
    await session.commit()


async def test_run_and_persist_writes_backtest_and_trades(session):
    await _seed_scan_history(session)
    bt_id = await run_and_persist(
        session,
        strategy={"kind": "top_n", "n": 2},
        universe={"board": "MAIN_BOARD"},
        start=date(2024, 1, 2),
        end=date(2024, 1, 19),
        scoring_version="v1",
        model_version=None,
        costs=CostParams(),
        sizing=SizingParams(top_n=2, max_weight=1.0),
        seed=42,
    )
    bt = (
        (await session.execute(select(Backtest).where(Backtest.id == bt_id)))
        .scalars()
        .one()
    )
    assert bt.metrics["sharpe"] is not None
    assert bt.bias_audit["fills_at_or_after_signal"] is True
    n_trades = (
        await session.execute(select(func.count()).select_from(BacktestTrade))
    ).scalar()
    assert n_trades > 0


def test_compute_bias_audit_real_checks():
    from datetime import date

    import polars as pl

    from app.application.services.backtest_service import _compute_bias_audit

    signals = pl.DataFrame(
        {
            "ticker": ["BBCA", "BBRI"],
            "asof_date": [date(2026, 1, 5), date(2026, 1, 6)],
        }
    )

    class _Trade:
        def __init__(self, ticker, entry_date):
            self.ticker = ticker
            self.entry_date = entry_date

    trades = [_Trade("BBCA", date(2026, 1, 6)), _Trade("BBRI", date(2026, 1, 8))]
    audit = _compute_bias_audit(signals, trades, {"tickers": ["BBCA", "BBRI", "BMRI"]})
    assert audit["fills_at_or_after_signal"] is True
    assert audit["no_post_d_score_revisions"] is True
    assert audit["universe_resolved_per_date"] is True


def test_compute_bias_audit_detects_lookahead():
    from datetime import date

    import polars as pl

    from app.application.services.backtest_service import _compute_bias_audit

    signals = pl.DataFrame(
        {
            "ticker": ["BBCA"],
            "asof_date": [date(2026, 1, 10)],
        }
    )

    class _Trade:
        def __init__(self, ticker, entry_date):
            self.ticker = ticker
            self.entry_date = entry_date

    trades = [_Trade("BBCA", date(2026, 1, 8))]  # filled BEFORE the signal
    audit = _compute_bias_audit(signals, trades, {"tickers": ["BBCA"]})
    assert audit["fills_at_or_after_signal"] is False
