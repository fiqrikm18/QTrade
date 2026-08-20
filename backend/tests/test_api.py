"""API contract tests (httpx TestClient)."""

import asyncio
import math
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
        """Seed stocks with scores for testing."""
        from app.infrastructure.database.models import (
            FinancialStatement,
            OhlcvDaily,
        )

        await session.execute(delete(StockScore).where(StockScore.ticker == "BBCA"))
        await session.execute(delete(Stock).where(Stock.ticker == "BBCA"))
        await session.execute(delete(Stock).where(Stock.ticker == "TLKM"))
        await session.execute(
            delete(FinancialStatement).where(FinancialStatement.ticker == "BBCA")
        )
        await session.execute(
            delete(OhlcvDaily).where(OhlcvDaily.ticker == "BBCA.JK")
        )
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

        session.add(
            Stock(
                ticker="TLKM",
                name="Telkom Indonesia",
                listing_date=date(1995, 11, 14),
                board="Utama",
                is_active=True,
            )
        )
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
        # No financial statements or OHLCV history seeded -> honest nulls
        assert data["valuation"] is None
        assert data["fundamental"] is None
        assert data["smart_money"]["score"] == 79.0
        assert data["smart_money"]["proxies"] is None
        assert data["risk_metrics"]["hist_vol_20"] is None
        assert data["risk_metrics"]["max_drawdown_250d"] is None
        assert data["risk_metrics"]["beta_vs_ihsg"] is None

    @pytest.fixture
    async def seed_financial_statement(self, session, seed_stock_with_score):
        """PIT financial statement for BBCA (available before score asof)."""
        from app.infrastructure.database.models import (
            FinancialStatement,
            OhlcvDaily,
        )

        await session.execute(
            delete(FinancialStatement).where(FinancialStatement.ticker == "BBCA")
        )
        await session.execute(
            delete(OhlcvDaily).where(OhlcvDaily.ticker == "BBCA.JK")
        )
        await session.flush()
        session.add(
            OhlcvDaily(
                ticker="BBCA.JK",
                trade_date=date(2024, 2, 28),
                open=10000.0,
                high=10100.0,
                low=9900.0,
                close=10000.0,
                volume=1_000_000,
                turnover=10_000_000_000.0,
                provider="test",
            )
        )
        session.add(
            FinancialStatement(
                ticker="BBCA",
                asof_date=date(2024, 2, 29),
                available_at=datetime(2024, 2, 28, 7, 0, tzinfo=UTC),
                period_end=date(2023, 12, 31),
                is_annual=True,
                items={
                    "eps": 500.0,
                    "bvps": 4000.0,
                    "revenue": 100_000_000_000.0,
                    "gross_profit": 60_000_000_000.0,
                    "ebitda": 25_000_000_000.0,
                    "ebit": 22_000_000_000.0,
                    "net_income": 20_000_000_000.0,
                    "total_assets": 300_000_000_000.0,
                    "equity": 150_000_000_000.0,
                    "debt": 30_000_000_000.0,
                    "cash": 10_000_000_000.0,
                    "interest_expense": 1_000_000_000.0,
                    "current_assets": 120_000_000_000.0,
                    "current_liabilities": 80_000_000_000.0,
                    "free_cash_flow": 8_000_000_000.0,
                    "dividend_per_share": 250.0,
                    "shares_outstanding": 1_924_688_333.0,
                },
            )
        )
        await session.flush()
        await session.commit()

    async def test_stock_analysis_valuation_from_financial_statement(
        self, client, seed_financial_statement
    ):
        """PIT-gated valuation ratios from financial_statements (price 10000)."""
        response = await client.get(f"{BASE_URL}/stocks/BBCA/analysis")
        assert response.status_code == 200
        data = response.json()
        val = data["valuation"]
        assert val is not None
        assert val["per"] == pytest.approx(20.0)
        assert val["pbv"] == pytest.approx(2.5)
        assert val["fcf_yield"] == pytest.approx(8e9 / 19_246_883_330_000.0)
        assert val["dividend_yield"] == pytest.approx(0.025)
        assert val["ev_ebitda"] is not None
        assert val["psr"] is not None

    async def test_stock_analysis_fundamental_ratios_from_financial_statement(
        self, client, seed_financial_statement
    ):
        """Fundamental ratios from the same PIT statement."""
        response = await client.get(f"{BASE_URL}/stocks/BBCA/analysis")
        assert response.status_code == 200
        data = response.json()
        fund = data["fundamental"]
        assert fund is not None
        assert fund["roe"] == pytest.approx(20e9 / 150e9)
        assert fund["roa"] == pytest.approx(20e9 / 300e9)
        assert fund["npm"] == pytest.approx(0.2)
        assert fund["gpm"] == pytest.approx(0.6)
        assert fund["opm"] == pytest.approx(0.22)
        assert fund["debt_equity"] == pytest.approx(0.2)
        assert fund["current_ratio"] == pytest.approx(1.5)
        assert fund["interest_coverage"] == pytest.approx(22.0)
        assert fund["roic"] is not None

    @pytest.fixture
    async def seed_ohlcv_history(self, session, seed_stock_with_score):
        """60 rows of OHLCV history (smart-money RS proxy window = 50)."""
        from app.infrastructure.database.models import OhlcvDaily

        await session.execute(
            delete(OhlcvDaily).where(OhlcvDaily.ticker == "BBCA.JK")
        )
        await session.execute(delete(OhlcvDaily).where(OhlcvDaily.ticker == "IHSG"))
        await session.flush()
        for i in range(60):
            close = 10000.0 + 100.0 * math.sin(i * 0.9) + i * 3.0
            volume = 1_000_000 + 50_000 * i + 200_000 * math.sin(i * 1.3)
            session.add(
                OhlcvDaily(
                    ticker="BBCA.JK",
                    trade_date=date(2024, 2, 1) + timedelta(days=i),
                    open=close,
                    high=close + 60.0,
                    low=close - 60.0,
                    close=close,
                    volume=volume,
                    turnover=close * volume,
                    provider="test",
                )
            )
        await session.flush()
        await session.commit()

    @pytest.fixture
    async def seed_ihsg_history(self, session):
        """IHSG index rows aligned to the 60-row OHLCV history dates."""
        from app.infrastructure.database.models import OhlcvDaily

        await session.execute(
            delete(OhlcvDaily).where(OhlcvDaily.ticker == "IHSG")
        )
        await session.flush()
        for i in range(60):
            close = 7000.0 + 10.0 * math.sin(i * 0.7) + i * 0.5
            session.add(
                OhlcvDaily(
                    ticker="IHSG",
                    trade_date=date(2024, 2, 1) + timedelta(days=i),
                    open=close,
                    high=close + 5.0,
                    low=close - 5.0,
                    close=close,
                    volume=0,
                    turnover=0,
                    provider="test",
                )
            )
        await session.flush()
        await session.commit()

    async def test_stock_analysis_beta_vs_ihsg_computed(
        self, client, seed_ohlcv_history, seed_ihsg_history
    ):
        """Beta vs IHSG computed from overlapping 60-day returns."""
        response = await client.get(f"{BASE_URL}/stocks/BBCA/analysis")
        assert response.status_code == 200
        rm = response.json()["risk_metrics"]
        assert rm["beta_vs_ihsg"] is not None
        assert abs(rm["beta_vs_ihsg"]) < 10.0

    async def test_stock_analysis_smart_money_proxies_from_ohlcv(
        self, client, seed_ohlcv_history
    ):
        """Smart-money proxies computed from OHLCV history when ≥ 20 rows."""
        response = await client.get(f"{BASE_URL}/stocks/BBCA/analysis")
        assert response.status_code == 200
        data = response.json()
        sm = data["smart_money"]
        assert sm["proxies"] is not None
        assert sm["score"] == 79.0
        for key in (
            "accumulation_proxy",
            "volume_proxy",
            "structure_proxy",
            "rs_proxy",
            "liquidity_proxy",
            "vol_behavior_proxy",
        ):
            assert sm["proxies"][key] is not None
            assert 0.0 <= sm["proxies"][key] <= 100.0

    async def test_stock_analysis_risk_metrics_from_ohlcv(
        self, client, seed_ohlcv_history
    ):
        """Risk metrics: avg turnover from history; drawdown/beta honest nulls."""
        response = await client.get(f"{BASE_URL}/stocks/BBCA/analysis")
        assert response.status_code == 200
        data = response.json()
        rm = data["risk_metrics"]
        expected_turnover = sum(
            (10000.0 + 100.0 * math.sin(i * 0.9) + i * 3.0)
            * (1_000_000 + 50_000 * i + 200_000 * math.sin(i * 1.3))
            for i in range(40, 60)
        ) / 20.0
        assert rm["avg_turnover_20d"] == pytest.approx(expected_turnover)
        # 60 rows < 250-day window -> honest null, not a fabricated number
        assert rm["max_drawdown_250d"] is None
        assert rm["beta_vs_ihsg"] is None

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
        # Stored feature hist_vol_20 surfaces in risk_metrics
        assert data["risk_metrics"]["hist_vol_20"] == 25.0

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

    async def test_stock_list_search_filters_by_ticker(
        self, client, seed_stock_with_score
    ):
        """GET /api/v1/stocks?search= filters by ticker from the DB."""
        response = await client.get(f"{BASE_URL}/stocks", params={"search": "bbc"})
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["ticker"] == "BBCA"

    async def test_stock_list_search_filters_by_name(
        self, client, seed_stock_with_score
    ):
        """GET /api/v1/stocks?search= filters by name from the DB."""
        response = await client.get(f"{BASE_URL}/stocks", params={"search": "telkom"})
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["ticker"] == "TLKM"

    async def test_stock_list_search_is_case_insensitive(
        self, client, seed_stock_with_score
    ):
        """GET /api/v1/stocks?search= matches names case-insensitively."""
        response = await client.get(f"{BASE_URL}/stocks", params={"search": "Central"})
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["ticker"] == "BBCA"

    async def test_stock_list_search_no_match_returns_empty(
        self, client, seed_stock_with_score
    ):
        """GET /api/v1/stocks?search= returns empty items when nothing matches."""
        response = await client.get(
            f"{BASE_URL}/stocks", params={"search": "zzz_no_match"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []


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

        # Isolate from the shared Redis scan cache: any newer dev scan key
        # (e.g. after a live_scan run) would override the fixture's ranking.
        from app.config.settings import get_settings

        import redis

        rc = redis.Redis.from_url(get_settings().redis_url)
        try:
            for key in rc.scan_iter("scan:*"):
                rc.delete(key)
        finally:
            rc.close()

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


async def test_screener_saved_not_implemented(client):
    response = await client.get("/api/v1/screener/saved")
    assert response.status_code == 200
    assert response.json() == []

    response = await client.post("/api/v1/screener/saved", json={"name": "x"})
    assert response.status_code == 501
    assert "not implemented" in response.json()["detail"].lower()
