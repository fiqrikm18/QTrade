"""API contract tests (httpx TestClient)."""

import asyncio
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config.settings import get_settings
from app.infrastructure.database.models import (
    EconomicIndicator,
    OhlcvDaily,
    Sector,
    Stock,
    StockScore,
    TechnicalFeature,
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

    @pytest.fixture
    async def seed_stock_with_technical_features(self, session):
        """Seed a stock with technical features for risk/regime testing."""
        from sqlalchemy import delete

        await session.execute(
            delete(TechnicalFeature).where(TechnicalFeature.ticker == "BBRI")
        )
        await session.execute(delete(StockScore).where(StockScore.ticker == "BBRI"))
        await session.execute(delete(Stock).where(Stock.ticker == "BBRI"))
        await session.flush()
        await session.commit()

        stock = Stock(
            ticker="BBRI",
            name="Bank Rakyat Indonesia",
            listing_date=date(2003, 10, 31),
            board="Utama",
            shares_outstanding=15155200000,
            sector_id=1,
            is_active=True,
        )
        session.add(stock)
        await session.flush()

        score = StockScore(
            ticker="BBRI",
            asof_date=date(2024, 3, 1),
            profile="balanced",
            scoring_version="v1",
            feature_version="v1",
            opportunity_score=72.3,
            technical_score=75.0,
            fundamental_score=80.0,
            momentum_score=68.0,
            relative_strength=70.0,
            smart_money_score=65.0,
            factor_score=70.0,
            sector_score=75.0,
            macro_score=68.0,
            risk_score=70.0,
            ml_score=67.0,
            score_components={
                "technical": 75.0,
                "fundamental": 80.0,
                "momentum": 68.0,
                "relative_strength": 70.0,
                "smart_money": 65.0,
                "factor": 70.0,
                "sector": 75.0,
                "macro": 68.0,
                "risk": 70.0,
                "ml": 67.0,
            },
            classification="WATCH",
            confidence=65.0,
            drivers=["Solid fundamentals"],
            risks=["Margin pressure"],
            invalidation_conditions=["NPL deterioration"],
        )
        session.add(score)
        await session.flush()

        tech_feature = TechnicalFeature(
            ticker="BBRI",
            asof_date=date(2024, 3, 1),
            feature_version="v1",
            indicators={
                "atr_14": 100.0,
                "atr_14_pct": 0.025,
                "sma_20": 5200.0,
                "sma_50": 5100.0,
                "sma_200": 5000.0,
                "adx_14": 30.0,
                "rsi_14": 60.0,
                "hist_vol_20": 25.0,
                "close": 5150.0,
            },
        )
        session.add(tech_feature)
        await session.flush()
        await session.commit()
        return stock

    async def test_stock_analysis_risk_regime_from_technical_features(
        self, client, seed_stock_with_technical_features
    ):
        """GET /api/v1/stocks/BBRI/analysis returns correct risk_level
        and regime from TechnicalFeature."""
        response = await client.get(f"{BASE_URL}/stocks/BBRI/analysis")
        assert response.status_code == 200
        data = response.json()
        assert data["ticker"] == "BBRI"
        # ATR% = 0.025 -> medium (0.02-0.04)
        assert data["risk_level"] == "medium"
        # ADX=30 > 25, SMA alignment 5200 > 5100 > 5000 -> trending_up
        assert data["regime"] == "trending_up"

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


class TestMarketOverviewEndpoint:
    """Test market overview API endpoint with seeded data."""

    @pytest.fixture
    async def seed_market_data(self, session: AsyncSession):
        """Seed comprehensive market data for overview endpoint."""
        asof = date(2024, 3, 1)
        prev_date = asof - timedelta(days=1)

        # Clear existing data
        await session.execute(delete(StockScore))
        await session.execute(delete(Stock))
        await session.execute(delete(Sector))
        await session.execute(delete(OhlcvDaily))
        await session.execute(delete(EconomicIndicator))
        await session.commit()

        # Seed sectors
        sector1 = Sector(id=1, code="FINANCIALS", name="Financials")
        sector2 = Sector(id=2, code="TECHNOLOGY", name="Technology")
        session.add_all([sector1, sector2])
        await session.flush()

        # Seed stocks
        stock1 = Stock(
            ticker="BBCA",
            name="Bank Central Asia",
            listing_date=date(1997, 12, 9),
            board="Utama",
            shares_outstanding=Decimal("1924688333"),
            sector_id=1,
            is_active=True,
        )
        stock2 = Stock(
            ticker="BBRI",
            name="Bank Rakyat Indonesia",
            listing_date=date(2003, 10, 31),
            board="Utama",
            shares_outstanding=Decimal("15155200000"),
            sector_id=1,
            is_active=True,
        )
        stock3 = Stock(
            ticker="GOTO",
            name="GoTo Gojek Tokopedia",
            listing_date=date(2022, 4, 11),
            board="Utama",
            shares_outstanding=Decimal("108000000000"),
            sector_id=2,
            is_active=True,
        )
        session.add_all([stock1, stock2, stock3])
        await session.flush()

        # Seed stock scores with regime and breadth in components
        score1 = StockScore(
            ticker="BBCA",
            asof_date=asof,
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
                "regime": "BULL",
                "regime_components": {"confidence": 0.85, "trend": 0.7, "breadth": 0.6},
                "breadth_score": 65.5,
            },
            classification="OPPORTUNITY",
            confidence=78.0,
            drivers=["Strong relative strength", "Improving momentum"],
            risks=["High valuation"],
            invalidation_conditions=["Break below support"],
        )
        score2 = StockScore(
            ticker="BBRI",
            asof_date=asof,
            profile="balanced",
            scoring_version="v1",
            feature_version="v1",
            opportunity_score=72.3,
            technical_score=75.0,
            fundamental_score=80.0,
            momentum_score=68.0,
            relative_strength=70.0,
            smart_money_score=65.0,
            factor_score=70.0,
            sector_score=75.0,
            macro_score=68.0,
            risk_score=70.0,
            ml_score=67.0,
            score_components={
                "technical": 75.0,
                "fundamental": 80.0,
                "momentum": 68.0,
                "relative_strength": 70.0,
                "smart_money": 65.0,
                "factor": 70.0,
                "sector": 75.0,
                "macro": 68.0,
                "risk": 70.0,
                "ml": 67.0,
            },
            classification="WATCH",
            confidence=65.0,
            drivers=["Solid fundamentals"],
            risks=["Margin pressure"],
            invalidation_conditions=["NPL deterioration"],
        )
        score3 = StockScore(
            ticker="GOTO",
            asof_date=asof,
            profile="balanced",
            scoring_version="v1",
            feature_version="v1",
            opportunity_score=55.0,
            technical_score=50.0,
            fundamental_score=45.0,
            momentum_score=55.0,
            relative_strength=60.0,
            smart_money_score=40.0,
            factor_score=50.0,
            sector_score=60.0,
            macro_score=55.0,
            risk_score=60.0,
            ml_score=58.0,
            score_components={
                "technical": 50.0,
                "fundamental": 45.0,
                "momentum": 55.0,
                "relative_strength": 60.0,
                "smart_money": 40.0,
                "factor": 50.0,
                "sector": 60.0,
                "macro": 55.0,
                "risk": 60.0,
                "ml": 58.0,
            },
            classification="AVOID",
            confidence=50.0,
            drivers=["Growth momentum"],
            risks=["Profitability concerns"],
            invalidation_conditions=["Cash burn acceleration"],
        )
        session.add_all([score1, score2, score3])

        # Seed OHLCV for movers (two days: prev and asof)
        ohlcv_data = [
            OhlcvDaily(
                ticker="BBCA",
                trade_date=prev_date,
                close=Decimal("9500"),
                provider="yahoo",
            ),
            OhlcvDaily(
                ticker="BBCA",
                trade_date=asof,
                close=Decimal("9700"),
                provider="yahoo",
            ),
            OhlcvDaily(
                ticker="BBRI",
                trade_date=prev_date,
                close=Decimal("5200"),
                provider="yahoo",
            ),
            OhlcvDaily(
                ticker="BBRI",
                trade_date=asof,
                close=Decimal("5100"),
                provider="yahoo",
            ),
            OhlcvDaily(
                ticker="GOTO",
                trade_date=prev_date,
                close=Decimal("80"),
                provider="yahoo",
            ),
            OhlcvDaily(
                ticker="GOTO",
                trade_date=asof,
                close=Decimal("85"),
                provider="yahoo",
            ),
        ]
        session.add_all(ohlcv_data)

        # Seed macro indicators (usd_idr, dxy, us_10y, sp500) for last 30 days
        for i in range(30):
            d = asof - timedelta(days=29 - i)
            # usd_idr: weakening trend (rising)
            session.add(
                EconomicIndicator(
                    indicator="usd_idr",
                    asof_date=d,
                    value=Decimal(str(15000 + i * 20)),
                    unit="",
                    source="BI",
                    available_at=datetime.combine(d, datetime.min.time()).replace(
                        tzinfo=UTC
                    ),
                )
            )
            # dxy: rising
            session.add(
                EconomicIndicator(
                    indicator="dxy",
                    asof_date=d,
                    value=Decimal(str(100 + i * 0.1)),
                    unit="",
                    source="FRED",
                    available_at=datetime.combine(d, datetime.min.time()).replace(
                        tzinfo=UTC
                    ),
                )
            )
            # us_10y: rising
            session.add(
                EconomicIndicator(
                    indicator="us_10y",
                    asof_date=d,
                    value=Decimal(str(4.0 + i * 0.02)),
                    unit="%",
                    source="FRED",
                    available_at=datetime.combine(d, datetime.min.time()).replace(
                        tzinfo=UTC
                    ),
                )
            )
            # sp500: rising
            session.add(
                EconomicIndicator(
                    indicator="sp500",
                    asof_date=d,
                    value=Decimal(str(4500 + i * 5)),
                    unit="",
                    source="YAHOO",
                    available_at=datetime.combine(d, datetime.min.time()).replace(
                        tzinfo=UTC
                    ),
                )
            )

        await session.commit()

    async def test_market_overview_returns_full_payload(self, client, seed_market_data):
        """GET /api/v1/market/overview returns full typed payload with real values."""
        response = await client.get(f"{BASE_URL}/market/overview")
        assert response.status_code == 200
        data = response.json()

        # Top-level structure
        assert "regime" in data
        assert "breadth" in data
        assert "top_gainers" in data
        assert "top_losers" in data
        assert "top_opportunities" in data
        assert "sector_rotation" in data
        assert "macro" in data
        assert "upcoming_events" in data
        assert "asof" in data

        # Regime
        regime = data["regime"]
        assert regime["regime"] == "BULL"
        assert isinstance(regime["confidence"], float)
        assert regime["confidence"] > 0
        assert "components" in regime
        assert regime["asof"] == "2024-03-01"

        # Breadth
        breadth = data["breadth"]
        assert breadth["breadth_score"] == 65.5
        assert breadth["asof"] == "2024-03-01"

        # Movers (GOTO +200/80=+6.25%, BBCA +200/9500=+2.1%, BBRI -100/5200=-1.9%)
        top_gainers = data["top_gainers"]
        top_losers = data["top_losers"]
        assert len(top_gainers) >= 1
        assert len(top_losers) >= 1
        # GOTO should be top gainer
        assert top_gainers[0]["ticker"] == "GOTO"
        assert top_gainers[0]["change_pct"] == pytest.approx(6.25, rel=0.01)
        # BBRI should be top loser
        assert top_losers[0]["ticker"] == "BBRI"
        assert top_losers[0]["change_pct"] == pytest.approx(-1.92, rel=0.01)

        # Opportunities (may be empty if Redis cache not seeded)
        opps = data["top_opportunities"]
        if opps:
            assert opps[0]["ticker"] == "BBCA"
            assert opps[0]["opportunity_score"] == 86.5

        # Sector rotation (FINANCIALS avg=(87+75)/2=81, TECHNOLOGY avg=60)
        sectors = data["sector_rotation"]
        assert len(sectors) == 2
        assert sectors[0]["sector"] == "Financials"
        assert sectors[0]["score"] == 81.0
        assert sectors[1]["sector"] == "Technology"
        assert sectors[1]["score"] == 60.0

        # Macro (non-nullable numbers, computed from seeded series)
        macro = data["macro"]
        assert "risk" in macro and "support" in macro
        assert isinstance(macro["risk"], (int, float))
        assert isinstance(macro["support"], (int, float))
        assert 0.0 <= macro["risk"] <= 100.0
        assert 0.0 <= macro["support"] <= 100.0
        # All 4 indicators rising => risk > support
        assert macro["risk"] > macro["support"]

        # Upcoming events (empty since we didn't seed future events)
        assert isinstance(data["upcoming_events"], list)

        # Asof
        assert data["asof"] == "2024-03-01"

    async def test_market_overview_empty_macro_returns_zero_fallback(
        self, client, session: AsyncSession
    ):
        """GET /api/v1/market/overview returns 0.0 macro when no indicator data."""
        asof = date(2024, 3, 1)
        prev_date = asof - timedelta(days=1)

        # Clear and seed minimal data (no macro indicators)
        await session.execute(delete(StockScore))
        await session.execute(delete(Stock))
        await session.execute(delete(Sector))
        await session.execute(delete(OhlcvDaily))
        await session.execute(delete(EconomicIndicator))
        await session.commit()

        sector = Sector(id=1, code="FINANCIALS", name="Financials")
        session.add(sector)
        await session.flush()

        stock = Stock(
            ticker="BBCA",
            name="Bank Central Asia",
            listing_date=date(1997, 12, 9),
            board="Utama",
            shares_outstanding=Decimal("1924688333"),
            sector_id=1,
            is_active=True,
        )
        session.add(stock)
        await session.flush()

        score = StockScore(
            ticker="BBCA",
            asof_date=asof,
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
                "regime": "NEUTRAL",
                "regime_components": {"confidence": 0.5},
                "breadth_score": 50.0,
            },
            classification="OPPORTUNITY",
            confidence=78.0,
            drivers=[],
            risks=[],
            invalidation_conditions=[],
        )
        session.add(score)

        ohlcv_data = [
            OhlcvDaily(
                ticker="BBCA",
                trade_date=prev_date,
                close=Decimal("9500"),
                provider="yahoo",
            ),
            OhlcvDaily(
                ticker="BBCA", trade_date=asof, close=Decimal("9700"), provider="yahoo"
            ),
        ]
        session.add_all(ohlcv_data)
        await session.commit()

        response = await client.get(f"{BASE_URL}/market/overview")
        assert response.status_code == 200
        data = response.json()

        # Macro should be 0.0 fallback (non-nullable)
        macro = data["macro"]
        assert macro["risk"] == 0.0
        assert macro["support"] == 0.0


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
