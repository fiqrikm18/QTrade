"""Portfolio CRUD API against real tables + real price data."""

from datetime import date, timedelta

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import (
    OhlcvDaily,
    Portfolio,
    PortfolioPosition,
    Stock,
)

BASE_URL = "/api/v1/portfolio"


@pytest.fixture
async def seed_stock_with_price(session: AsyncSession):
    await session.execute(delete(PortfolioPosition))
    await session.execute(delete(Portfolio))
    await session.execute(delete(OhlcvDaily).where(OhlcvDaily.ticker == "BBCA.JK"))
    await session.execute(delete(Stock).where(Stock.ticker == "BBCA"))
    await session.commit()
    stock = Stock(
        ticker="BBCA",
        name="Bank Central Asia",
        listing_date=date(1997, 12, 9),
        board="Utama",
        is_active=True,
    )
    session.add(stock)
    await session.flush()
    for i, close in enumerate((9800.0, 9900.0)):
        session.add(
            OhlcvDaily(
                ticker="BBCA.JK",
                trade_date=date(2026, 8, 18) - timedelta(days=i),
                open=close,
                high=close,
                low=close,
                close=close,
                volume=1000,
                turnover=close * 1000,
                adjustment_factor=1.0,
                provider="test",
            )
        )
    await session.commit()
    return stock


async def test_portfolio_empty_returns_list(client, session: AsyncSession):
    await session.execute(delete(PortfolioPosition))
    await session.execute(delete(Portfolio))
    await session.commit()
    response = await client.get(f"{BASE_URL}")
    assert response.status_code == 200
    assert response.json() == []


async def test_add_position_and_derive_pnl(client, seed_stock_with_price):
    response = await client.post(
        f"{BASE_URL}/positions",
        json={"ticker": "BBCA", "quantity": 100, "avg_price": 9500.0},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "BBCA"
    assert data["name"] == "Bank Central Asia"
    assert data["quantity"] == 100
    assert data["avgPrice"] == 9500.0
    assert data["currentPrice"] == 9800.0  # latest close from ohlcv_daily
    assert data["marketValue"] == pytest.approx(9800.0 * 100)
    assert data["pnl"] == pytest.approx(300.0 * 100)
    assert data["pnlPct"] == pytest.approx(round(300.0 / 9500.0 * 100, 2))

    listing = (await client.get(f"{BASE_URL}")).json()
    assert len(listing) == 1
    assert listing[0]["weight"] == pytest.approx(100.0)


async def test_add_duplicate_position_returns_409(client, seed_stock_with_price):
    payload = {"ticker": "BBCA", "quantity": 100, "avg_price": 9500.0}
    assert (await client.post(f"{BASE_URL}/positions", json=payload)).status_code == 200
    assert (await client.post(f"{BASE_URL}/positions", json=payload)).status_code == 409


async def test_update_and_remove_position(client, seed_stock_with_price):
    await client.post(
        f"{BASE_URL}/positions",
        json={"ticker": "BBCA", "quantity": 100, "avg_price": 9500.0},
    )
    response = await client.put(
        f"{BASE_URL}/positions/BBCA",
        json={"quantity": 200, "avg_price": 9600.0},
    )
    assert response.status_code == 200
    assert response.json()["quantity"] == 200
    assert response.json()["avgPrice"] == 9600.0

    response = await client.delete(f"{BASE_URL}/positions/BBCA")
    assert response.status_code == 200
    assert (await client.get(f"{BASE_URL}")).json() == []


async def test_unknown_ticker_rejected(client, session: AsyncSession):
    await session.execute(delete(Stock).where(Stock.ticker == "NOPE"))
    await session.commit()
    response = await client.post(
        f"{BASE_URL}/positions",
        json={"ticker": "NOPE", "quantity": 1, "avg_price": 100.0},
    )
    assert response.status_code == 400
