"""ML + backtest API contract tests."""

from datetime import date, timedelta

import pytest_asyncio
from sqlalchemy import delete

from app.infrastructure.database.models import OhlcvDaily, StockScore


@pytest_asyncio.fixture(loop_scope="session", autouse=True)
async def _seed(session):
    await session.execute(delete(StockScore))
    await session.execute(delete(OhlcvDaily))
    await session.commit()
    start = date(2024, 1, 1)
    for i in range(20):
        d = start + timedelta(days=i)
        for tk, score in (("BBCA", 80.0 + i), ("BBRI", 70.0 + i)):
            session.add(
                StockScore(
                    ticker=tk,
                    asof_date=d,
                    profile="balanced",
                    scoring_version="v1",
                    opportunity_score=score,
                    classification="neutral",
                    feature_version="v1",
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
    yield
    await session.execute(delete(StockScore))
    await session.execute(delete(OhlcvDaily))
    await session.commit()


async def test_backtest_run_endpoint(client):
    resp = await client.post(
        "/api/v1/backtests/run",
        json={
            "strategy": {"kind": "top_n", "n": 2},
            "universe": {"board": "MAIN_BOARD"},
            "start": "2024-01-02",
            "end": "2024-01-19",
            "scoring_version": "v1",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "backtest_id" in body
    assert body["metrics"]["sharpe"] is not None


async def test_backtest_get_endpoint(client):
    resp = await client.post(
        "/api/v1/backtests/run",
        json={
            "strategy": {"kind": "top_n", "n": 2},
            "universe": {"board": "MAIN_BOARD"},
            "start": "2024-01-02",
            "end": "2024-01-19",
            "scoring_version": "v1",
        },
    )
    bt_id = resp.json()["backtest_id"]
    resp = await client.get(f"/api/v1/backtests/{bt_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["metrics"]["cagr"] is not None
    assert "trades" in body


async def test_ml_models_list_empty(client):
    resp = await client.get("/api/v1/ml/models")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
