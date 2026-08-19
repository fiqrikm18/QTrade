"""Repository for economic_indicators / economic_events (docs/data-model.md §7-8)."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import cast

import polars as pl
from sqlalchemy import Row, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import EconomicEvent, EconomicIndicator

_TREND_KEY = {"bi_rate", "fed_funds", "idn_10y", "us_10y", "us_2y", "dxy"}


def _trend(value: float, indicator: str) -> str:
    if value == 0:
        return "neutral"
    if indicator in _TREND_KEY:
        return "up" if value < 0 else "down"
    return "up" if value > 0 else "down"


class MacroRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert_indicators(self, df: pl.DataFrame) -> int:
        if df.is_empty():
            return 0
        now = datetime.now(UTC)
        records = [
            {
                "indicator": r["indicator"],
                "asof_date": r["asof_date"],
                "value": Decimal(str(r["value"])),
                "unit": r["unit"],
                "source": r["source"],
                "available_at": now,
            }
            for r in df.to_dicts()
        ]
        stmt = pg_insert(EconomicIndicator).values(records)
        stmt = stmt.on_conflict_do_update(
            index_elements=["indicator", "asof_date", "source"],
            set_={
                "value": stmt.excluded["value"],
                "unit": stmt.excluded["unit"],
                "available_at": stmt.excluded["available_at"],
            },
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        rc = cast("int | None", getattr(result, "rowcount", None))
        return rc or 0

    async def upsert_events(self, df: pl.DataFrame) -> int:
        if df.is_empty():
            return 0
        records = [
            {
                "event": r["event"],
                "country": r["country"],
                "scheduled_at": r["scheduled_at"],
                "importance": int(r["importance"]),
                "category": r["category"],
                "previous": (
                    Decimal(str(r["previous"])) if r["previous"] is not None else None
                ),
                "consensus": (
                    Decimal(str(r["consensus"])) if r["consensus"] is not None else None
                ),
                "actual": (
                    Decimal(str(r["actual"])) if r["actual"] is not None else None
                ),
                "status": r["status"],
                "source": r["source"],
            }
            for r in df.to_dicts()
        ]
        stmt = pg_insert(EconomicEvent).values(records)
        stmt = stmt.on_conflict_do_update(
            index_elements=["event", "scheduled_at", "source"],
            set_={
                "previous": stmt.excluded["previous"],
                "consensus": stmt.excluded["consensus"],
                "actual": stmt.excluded["actual"],
                "status": stmt.excluded["status"],
                "importance": stmt.excluded["importance"],
            },
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        rc = cast("int | None", getattr(result, "rowcount", None))
        return rc or 0

    async def latest_indicators(self) -> list[dict[str, object]]:
        rows = (
            await self._session.execute(
                select(
                    EconomicIndicator.indicator,
                    EconomicIndicator.asof_date,
                    EconomicIndicator.value,
                    EconomicIndicator.unit,
                    EconomicIndicator.source,
                ).order_by(
                    EconomicIndicator.indicator, EconomicIndicator.asof_date.desc()
                )
            )
        ).fetchall()
        latest: dict[str, list[Row[tuple[str, date, Decimal, str, str]]]] = {}
        for r in rows:
            latest.setdefault(r.indicator, []).append(r)
        out: list[dict[str, object]] = []
        for indicator, entries in latest.items():
            if len(entries) == 1:
                cur = float(entries[0].value)
                out.append(
                    {
                        "indicator": indicator,
                        "current": cur,
                        "previous": cur,
                        "change": 0.0,
                        "unit": entries[0].unit,
                        "trend": "neutral",
                        "source": entries[0].source,
                    }
                )
                continue
            newest, older = entries[0], entries[1]
            cur, prev = float(newest.value), float(older.value)
            out.append(
                {
                    "indicator": indicator,
                    "current": cur,
                    "previous": prev,
                    "change": round(cur - prev, 4),
                    "unit": newest.unit,
                    "trend": _trend(cur - prev, indicator),
                    "source": newest.source,
                }
            )
        return out

    async def upcoming_events(self, limit: int = 10) -> list[dict[str, object]]:
        now = datetime.now(UTC)
        rows = (
            await self._session.execute(
                select(
                    EconomicEvent.event,
                    EconomicEvent.country,
                    EconomicEvent.scheduled_at,
                    EconomicEvent.importance,
                    EconomicEvent.category,
                    EconomicEvent.previous,
                    EconomicEvent.consensus,
                    EconomicEvent.actual,
                )
                .where(EconomicEvent.scheduled_at >= now)
                .order_by(EconomicEvent.scheduled_at.asc())
                .limit(limit)
            )
        ).fetchall()
        out: list[dict[str, object]] = []
        for r in rows:
            scheduled = r.scheduled_at.astimezone(UTC)
            out.append(
                {
                    "date": scheduled.date().isoformat(),
                    "time": scheduled.strftime("%H:%M"),
                    "country": r.country,
                    "event": r.event,
                    "impact": {3: "HIGH", 2: "MEDIUM", 1: "LOW"}.get(
                        r.importance, "MEDIUM"
                    ),
                    "category": r.category,
                    "prev": float(r.previous) if r.previous is not None else None,
                    "consensus": (
                        float(r.consensus) if r.consensus is not None else None
                    ),
                    "actual": float(r.actual) if r.actual is not None else None,
                }
            )
        return out

    async def indicator_series(
        self, indicator: str, days: int = 30
    ) -> list[dict[str, object]]:
        cutoff = date.today() - timedelta(days=days)
        rows = (
            await self._session.execute(
                select(EconomicIndicator.asof_date, EconomicIndicator.value)
                .where(
                    EconomicIndicator.indicator == indicator,
                    EconomicIndicator.asof_date >= cutoff,
                )
                .order_by(EconomicIndicator.asof_date.asc())
            )
        ).fetchall()
        return [{"asof_date": r.asof_date, "value": float(r.value)} for r in rows]
