"""API contract tests for reference-data + derived endpoints.

Covers the six endpoints the frontend calls that previously returned 404:

- ``GET /api/v1/macro/indicators``
- ``GET /api/v1/calendar/events``
- ``GET /api/v1/news``
- ``GET /api/v1/portfolio``
- ``GET /api/v1/alerts`` (derived from latest scan in ``stock_scores``)
- ``GET /api/v1/research/memos`` (derived from latest scan in ``stock_scores``)

The response shapes must match the TypeScript contracts in
``frontend/src/lib/api.ts`` (AGENTS.md §16).
"""

from datetime import UTC, date, datetime

import polars as pl
import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import (
    EconomicEvent,
    EconomicIndicator,
    NewsArticle,
    NewsEntity,
    Stock,
    StockScore,
)
from app.infrastructure.repositories.macro_repo import MacroRepository
from app.infrastructure.repositories.news_repo import NewsRepository

BASE_URL = "/api/v1"


@pytest.fixture
async def seed_stock_with_score(session: AsyncSession):
    """Seed a scored stock (same shape as test_api.py fixture)."""
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
        asof_date=date(2026, 8, 14),
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
        drivers=["Strong relative strength", "Strong fundamentals"],
        risks=["High valuation", "Macro sensitivity"],
        invalidation_conditions=["Break below defined support"],
    )
    session.add(score)
    await session.flush()
    await session.commit()
    return stock


@pytest.fixture
async def seed_macro(session: AsyncSession):
    from sqlalchemy import delete

    await session.execute(delete(EconomicEvent))
    await session.execute(delete(EconomicIndicator))
    await session.commit()
    repo = MacroRepository(session)
    await repo.upsert_indicators(
        pl.DataFrame(
            {
                "indicator": ["BI Rate", "USD/IDR"],
                "asof_date": [date(2026, 8, 19), date(2026, 8, 19)],
                "value": [5.75, 17836.0],
                "unit": ["%", ""],
                "source": ["BI", "BI"],
            }
        )
    )
    t0 = datetime(2026, 8, 20, 14, 0, tzinfo=UTC)
    await repo.upsert_events(
        pl.DataFrame(
            {
                "event": ["BI Rate Decision"],
                "country": ["ID"],
                "scheduled_at": [t0],
                "importance": [3],
                "category": ["CENTRAL_BANK"],
                "previous": [5.75],
                "consensus": [5.75],
                "actual": [None],
                "status": ["scheduled"],
                "source": ["BI"],
            }
        )
    )


@pytest.fixture
async def seed_news(session: AsyncSession):
    from sqlalchemy import delete

    await session.execute(delete(NewsEntity))
    await session.execute(delete(NewsArticle))
    await session.commit()
    repo = NewsRepository(session)
    await repo.upsert_news(
        pl.DataFrame(
            {
                "title": ["BBCA posts strong quarterly profit"],
                "source": ["news.google.com"],
                "published_at": [datetime(2026, 8, 19, 9, 0, tzinfo=UTC)],
                "url": ["https://example.com/1"],
                "summary": ["Bank Central Asia reported results."],
                "tickers": [["BBCA"]],
            }
        )
    )


class TestMacroEndpoints:
    async def test_macro_indicators_returns_typed_list(self, client, seed_macro):
        response = await client.get(f"{BASE_URL}/macro/indicators")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2
        item = next(i for i in data if i["indicator"] == "BI Rate")
        for key in (
            "indicator",
            "current",
            "previous",
            "change",
            "unit",
            "trend",
            "source",
        ):
            assert key in item, f"missing key {key}"
        assert item["trend"] in ("up", "down", "neutral")
        assert item["current"] == 5.75

    async def test_macro_indicators_empty_without_data(
        self, client, session: AsyncSession
    ):
        from sqlalchemy import delete

        await session.execute(delete(EconomicIndicator))
        await session.commit()
        response = await client.get(f"{BASE_URL}/macro/indicators")
        assert response.status_code == 200
        assert response.json() == []


class TestCalendarEndpoints:
    async def test_calendar_events_returns_typed_list(self, client, seed_macro):
        response = await client.get(f"{BASE_URL}/calendar/events")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        item = data[0]
        for key in (
            "date",
            "time",
            "country",
            "event",
            "impact",
            "category",
            "prev",
            "consensus",
            "actual",
        ):
            assert key in item, f"missing key {key}"
        assert item["impact"] in ("HIGH", "MEDIUM", "LOW")
        assert item["actual"] is None  # honest: not released
        datetime.fromisoformat(item["date"])

    async def test_calendar_empty_without_data(self, client, session: AsyncSession):
        from sqlalchemy import delete

        await session.execute(delete(EconomicEvent))
        await session.commit()
        response = await client.get(f"{BASE_URL}/calendar/events")
        assert response.status_code == 200
        assert response.json() == []


class TestNewsEndpoints:
    async def test_news_returns_typed_list(self, client, seed_news):
        response = await client.get(f"{BASE_URL}/news")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        item = data[0]
        for key in (
            "id",
            "date",
            "time",
            "title",
            "source",
            "category",
            "impact",
            "sentiment",
            "tickers",
            "summary",
        ):
            assert key in item, f"missing key {key}"
        assert item["impact"] is None  # honest: no fabricated sentiment/impact
        assert item["sentiment"] is None
        assert item["tickers"] == ["BBCA"]

    async def test_news_empty_without_data(self, client, session: AsyncSession):
        from sqlalchemy import delete

        await session.execute(delete(NewsEntity))
        await session.execute(delete(NewsArticle))
        await session.commit()
        response = await client.get(f"{BASE_URL}/news")
        assert response.status_code == 200
        assert response.json() == []


class TestPortfolioEndpoints:
    """GET /api/v1/portfolio (seed reference data)."""

    async def test_portfolio_returns_typed_list(self, client):
        response = await client.get(f"{BASE_URL}/portfolio")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        item = data[0]
        for key in (
            "ticker",
            "name",
            "quantity",
            "avgPrice",
            "currentPrice",
            "pnl",
            "pnlPct",
            "weight",
            "marketValue",
        ):
            assert key in item, f"missing key {key}"
        # derived fields must be internally consistent
        assert item["marketValue"] == pytest.approx(
            item["currentPrice"] * item["quantity"]
        )


class TestAlertEndpoints:
    """GET /api/v1/alerts (derived from the latest scan)."""

    async def test_alerts_returns_typed_list(self, client, seed_stock_with_score):
        response = await client.get(f"{BASE_URL}/alerts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "seeded score should produce at least one alert"
        item = data[0]
        for key in (
            "id",
            "time",
            "type",
            "ticker",
            "message",
            "impact",
            "status",
            "trigger",
            "acknowledged",
        ):
            assert key in item, f"missing key {key}"
        assert item["type"] in ("technical", "fundamental", "news", "macro", "market")
        assert item["status"] in ("active", "triggered", "acknowledged", "resolved")

    async def test_alerts_empty_without_scan_data(self, client, session: AsyncSession):
        await session.execute(delete(StockScore))
        await session.execute(delete(Stock))
        await session.commit()
        response = await client.get(f"{BASE_URL}/alerts")
        assert response.status_code == 200
        assert response.json() == []


class TestResearchEndpoints:
    """GET /api/v1/research/memos (derived from the latest scan)."""

    async def test_memos_returns_typed_list(self, client, seed_stock_with_score):
        response = await client.get(f"{BASE_URL}/research/memos")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "seeded score should produce at least one memo"
        item = data[0]
        for key in ("id", "title", "tickers", "date", "thesis", "scores"):
            assert key in item, f"missing key {key}"
        assert isinstance(item["tickers"], list)
        assert item["tickers"][0] == "BBCA"
        for score_key in ("technical", "smartMoney", "fundamental"):
            assert score_key in item["scores"]

    async def test_memos_empty_without_scan_data(self, client, session: AsyncSession):
        await session.execute(delete(StockScore))
        await session.execute(delete(Stock))
        await session.commit()
        response = await client.get(f"{BASE_URL}/research/memos")
        assert response.status_code == 200
        assert response.json() == []
