"""GET /api/v1/data-quality — real report computed from ohlcv_daily."""

from datetime import date, timedelta

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import OhlcvDaily

BASE_URL = "/api/v1/data-quality"


@pytest.fixture
async def seed_ohlcv(session: AsyncSession):
    await session.execute(delete(OhlcvDaily))
    await session.commit()
    for i in range(20):
        close = 100.0 + i
        session.add(
            OhlcvDaily(
                ticker="BBCA.JK",
                trade_date=date(2026, 7, 20) + timedelta(days=i),
                open=close,
                high=close + 1,
                low=close - 1,
                close=close,
                volume=1000,
                turnover=close * 1000,
                adjustment_factor=1.0,
                provider="test",
            )
        )
    await session.commit()


async def test_quality_report_shape(client, seed_ohlcv):
    response = await client.get(BASE_URL)
    assert response.status_code == 200
    data = response.json()
    assert data["total_tickers"] == 1
    assert data["overall_score"] is not None
    assert 0.0 <= data["overall_score"] <= 100.0
    assert len(data["tickers"]) == 1
    ticker = data["tickers"][0]
    assert ticker["ticker"] == "BBCA.JK"
    assert ticker["rows_valid"] == 20
    assert ticker["issues"] == {}
    assert ticker["latest_trade_date"] == "2026-08-08"
    assert data["freshness"]["ohlcv_daily"]["latest_trade_date"] == "2026-08-08"


async def test_quality_report_empty_db(client, session: AsyncSession):
    await session.execute(delete(OhlcvDaily))
    await session.commit()
    response = await client.get(BASE_URL)
    assert response.status_code == 200
    data = response.json()
    assert data["total_tickers"] == 0
    assert data["tickers"] == []
