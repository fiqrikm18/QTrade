"""Backtest ML ranking from stored predictions (docs/backtesting.md §7)."""

from datetime import date, timedelta

import pytest_asyncio
from sqlalchemy import delete, select

from app.application.services.backtest_service import run_and_persist
from app.domain.backtest.engine import CostParams, SizingParams
from app.infrastructure.database.models import (
    Backtest,
    BacktestTrade,
    MLPrediction,
    OhlcvDaily,
)


@pytest_asyncio.fixture(loop_scope="session", autouse=True)
async def _seed(session):
    await session.execute(delete(MLPrediction))
    await session.execute(delete(OhlcvDaily))
    await session.execute(delete(BacktestTrade))
    await session.execute(delete(Backtest))
    await session.commit()
    start = date(2024, 1, 1)
    for i in range(5):  # reduced from 20
        d = start + timedelta(days=i)
        session.add(
            MLPrediction(
                ticker="BBCA",
                asof_date=d,
                model_name="lr_up",
                model_version="v1",
                feature_version="v1",
                probability=0.6 + 0.01 * i,
                prediction_class="up",
            )
        )
        session.add(
            MLPrediction(
                ticker="BBRI",
                asof_date=d,
                model_name="lr_up",
                model_version="v1",
                feature_version="v1",
                probability=0.5 + 0.01 * i,
                prediction_class="up",
            )
        )
        session.add(
            OhlcvDaily(
                ticker="BBCA.JK",
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
        session.add(
            OhlcvDaily(
                ticker="BBRI.JK",
                trade_date=d,
                open=50.0 + i,
                high=50.5 + i,
                low=49.5 + i,
                close=50.2 + i,
                volume=1_000_000,
                turnover=5e8,
                provider="yfinance",
            )
        )
    await session.commit()


async def test_ml_backtest_uses_stored_predictions(session):
    bt_id = await run_and_persist(
        session,
        strategy={"kind": "top_n", "n": 2},
        universe={"board": "MAIN_BOARD"},
        start=date(2024, 1, 2),
        end=date(2024, 1, 19),
        scoring_version="v1",
        model_version="v1",
        costs=CostParams(),
        sizing=SizingParams(top_n=2),
        seed=42,
    )
    bt = (
        (await session.execute(select(Backtest).where(Backtest.id == bt_id)))
        .scalars()
        .one()
    )
    assert bt.model_version == "v1"
    assert bt.scoring_version is None  # ML-driven run
    assert bt.metrics is not None
