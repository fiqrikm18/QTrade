"""API contract tests (httpx TestClient)."""

import asyncio
from datetime import date

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config.settings import get_settings
from app.infrastructure.database.models import (
    Stock,
    StockScore,
)
from app.main import create_app

settings = get_settings()

BASE_URL = "/api/v1"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def session():
    """Get a database session for testing."""
    engine = create_async_engine(settings.postgres_dsn)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session


# Override the app's get_session dependency

app = create_app()


@pytest.fixture(scope="function")
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


class TestStockEndpoints:
    """Test stock-related API endpoints."""

    @pytest.fixture
    async def seed_stock_with_score(self, session):
        """Seed a stock with scores for testing."""
        await session.execute(delete(StockScore).where(StockScore.ticker == "BBCA"))
        await session.execute(delete(Stock).where(Stock.ticker == "BBCA"))
        await session.flush()
        await session.commit()

        stock = Stock(
            ticker="BBCA",
            name="Bank Central Asia",
            listing_date=date(1997, 12, 9),
            board="Utama",
            shares_outstanding=1924688333,
            sector_id=1,
            is_active=True,
        )
        session.add(stock)
        await session.flush()

        score = StockScore(
            ticker="BBCA",
            asof_date=date(2024, 3, 1),
            profile="balanced",
            scoring_version="v1",
            feature_version="v1",
            opportunity_score=86.5,
            technical_score=88.0,
            fundamental_score=91.0,
            momentum_score=84.0,
            relative_strength=87.0,
            smart_money_score=79.0,
            factor_score=82.0,
            sector_score=87.0,
            macro_score=72.0,
            risk_score=76.0,
            ml_score=81.0,
            score_components={
                "technical": 88.0,
                "fundamental": 91.0,
                "momentum": 84.0,
                "relative_strength": 87.0,
                "smart_money": 79.0,
                "factor": 82.0,
                "sector": 87.0,
                "macro": 72.0,
                "risk": 76.0,
                "ml": 81.0,
            },
            classification="OPPORTUNITY",
            confidence=78.0,
            drivers=[
                "Strong relative strength",
                "Improving momentum",
                "Strong fundamentals",
            ],
            risks=["High valuation", "Macro sensitivity"],
            invalidation_conditions=[
                "Break below defined support",
                "Sector RS deterioration",
            ],
        )
        session.add(score)
        await session.flush()
        await session.commit()
        return stock

    async def test_stock_analysis_returns_200(self, client, seed_stock_with_score):
        """GET /api/v1/stocks/BBCA/analysis returns 200 with typed response."""
        response = await client.get(f"{BASE_URL}/stocks/BBCA/analysis")
        assert response.status_code == 200
        data = response.json()
        assert data["ticker"] == "BBCA"
        assert data["opportunity_score"] == 86.5
        assert "components" in data
        assert "classification" in data
        assert "confidence" in data
        assert "drivers" in data
        assert "risks" in data
        assert "invalidation_conditions" in data

    async def test_stock_list_returns_paginated(self, client, seed_stock_with_score):
        """GET /api/v1/stocks returns paginated universe."""
        response = await client.get(f"{BASE_URL}/stocks")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert len(data["items"]) >= 1


class TestScreenerEndpoints:
    """Test screener API endpoints."""

    async def test_screener_run_filters_by_min_opportunity(self, client):
        """POST /api/v1/screener/run filters by min_opportunity_score."""
        response = await client.post(
            f"{BASE_URL}/screener/run",
            json={
                "filters": {
                    "min_opportunity_score": 75,
                    "max_opportunity_score": 100,
                },
                "page": 1,
                "page_size": 20,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    async def test_screener_run_filters_by_sector(self, client):
        """POST /api/v1/screener/run filters by sector."""
        response = await client.post(
            f"{BASE_URL}/screener/run",
            json={
                "filters": {
                    "sector": ["FINANCIALS"],
                },
                "page": 1,
                "page_size": 20,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    async def test_screener_run_filters_by_rsi(self, client):
        """POST /api/v1/screener/run filters by RSI range."""
        response = await client.post(
            f"{BASE_URL}/screener/run",
            json={
                "filters": {
                    "rsi_min": 30,
                    "rsi_max": 70,
                },
                "page": 1,
                "page_size": 20,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data


# Need imports
from app.config.settings import get_settings
from app.main import create_app

# Override the settings fixture
settings = get_settings()


@pytest.fixture(scope="session")
def event_loop():
    import asyncio

    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def session():
    """Get a database session for testing."""
    engine = create_async_engine(settings.postgres_dsn)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session


# Override the app's get_session dependency

app = create_app()


# Override the app's get_session dependency


@pytest.fixture(autouse=True)
async def override_get_session():
    """Override get_session for tests."""
    engine = create_async_engine(settings.postgres_dsn)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session


# Create the test app
app = create_app()


# Need to import after app creation
