"""MacroRepository upserts + latest_indicators shape."""

from datetime import UTC, date, datetime, timedelta

import polars as pl
import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import EconomicEvent, EconomicIndicator
from app.infrastructure.repositories.macro_repo import MacroRepository


def _indicator_frame() -> pl.DataFrame:
    today = date.today()
    return pl.DataFrame(
        {
            "indicator": ["usd_idr", "usd_idr", "bi_rate"],
            "asof_date": [
                today - timedelta(days=1),
                today - timedelta(days=2),
                today,
            ],
            "value": [17836.0, 17820.0, 5.75],
            "unit": ["", "", "%"],
            "source": ["BI", "BI", "BI"],
        }
    )


async def test_upsert_and_latest_indicators(session: AsyncSession):
    await session.execute(delete(EconomicIndicator))
    await session.commit()
    repo = MacroRepository(session)
    written = await repo.upsert_indicators(_indicator_frame())
    assert written == 3
    # idempotent re-upsert
    assert await repo.upsert_indicators(_indicator_frame()) == 3

    rows = await repo.latest_indicators()
    by_name = {r["indicator"]: r for r in rows}
    assert set(by_name) == {"usd_idr", "bi_rate"}
    usd = by_name["usd_idr"]
    assert usd["current"] == 17836.0
    assert usd["previous"] == 17820.0
    assert usd["change"] == pytest.approx(16.0)
    assert usd["trend"] == "up"
    assert usd["source"] == "BI"
    assert by_name["bi_rate"]["trend"] == "neutral"


async def test_latest_indicators_empty(session: AsyncSession):
    await session.execute(delete(EconomicIndicator))
    await session.commit()
    repo = MacroRepository(session)
    assert await repo.latest_indicators() == []


def _event_frame() -> pl.DataFrame:
    t0 = datetime.now(UTC) + timedelta(days=1)
    return pl.DataFrame(
        {
            "event": ["BI Rate Decision", "CPI Release"],
            "country": ["ID", "ID"],
            "scheduled_at": [t0, t0 + timedelta(days=1)],
            "importance": [3, 2],
            "category": ["CENTRAL_BANK", "ECONOMICS"],
            "previous": [5.75, 2.4],
            "consensus": [5.75, 2.3],
            "actual": [None, None],
            "status": ["scheduled", "scheduled"],
            "source": ["BI", "BI"],
        }
    )


async def test_upsert_events_and_upcoming(session: AsyncSession):
    await session.execute(delete(EconomicEvent))
    await session.commit()
    repo = MacroRepository(session)
    assert await repo.upsert_events(_event_frame()) == 2
    upcoming = await repo.upcoming_events(limit=5)
    assert len(upcoming) == 2
    first = upcoming[0]
    expected_first = datetime.now(UTC) + timedelta(days=1)
    assert first["event"] == "BI Rate Decision"
    assert first["impact"] == "HIGH"
    assert first["date"] == expected_first.date().isoformat()
    assert first["prev"] == 5.75
    assert first["consensus"] == 5.75
    assert first["actual"] is None
    assert first["time"] == expected_first.strftime("%H:%M")
    stored = await session.execute(
        select(EconomicEvent.available_at).where(
            EconomicEvent.event == "BI Rate Decision"
        )
    )
    assert stored.scalar_one() is not None


async def test_indicator_series(session: AsyncSession):
    await session.execute(delete(EconomicIndicator))
    await session.commit()
    repo = MacroRepository(session)
    await repo.upsert_indicators(_indicator_frame())
    series = await repo.indicator_series("usd_idr", days=30)
    assert len(series) == 2
    assert series[0]["asof_date"] == date.today() - timedelta(days=2)
