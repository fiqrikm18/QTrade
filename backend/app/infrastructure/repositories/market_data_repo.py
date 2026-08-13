"""Market-data repository: idempotent OHLCV upsert on the ohlcv_daily table."""

from datetime import date, datetime

import polars as pl
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import OhlcvDaily


class MarketDataRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert_ohlcv(
        self,
        ticker: str,
        df: pl.DataFrame,
        provider: str,
        source_ts: datetime,
    ) -> int:
        """Insert/update OHLCV rows. Upsert key = (ticker, trade_date, provider).

        created_at is left untouched (append-only); updated_at auto-advances.
        adjustment_factor defaults to 1.0. Returns affected row count.
        """
        if df.is_empty():
            return 0

        records: list[dict[str, object]] = [
            {
                "ticker": ticker,
                "trade_date": rec["trade_date"],
                "open": rec["open"],
                "high": rec["high"],
                "low": rec["low"],
                "close": rec["close"],
                "volume": rec["volume"],
                "turnover": rec["turnover"],
                "adjustment_factor": 1.0,
                "provider": provider,
                "source_timestamp": source_ts,
            }
            for rec in df.to_dicts()
        ]

        stmt = pg_insert(OhlcvDaily).values(records)
        set_ = {
            "open": stmt.excluded["open"],
            "high": stmt.excluded["high"],
            "low": stmt.excluded["low"],
            "close": stmt.excluded["close"],
            "volume": stmt.excluded["volume"],
            "turnover": stmt.excluded["turnover"],
            "updated_at": func.now(),
        }
        upsert = stmt.on_conflict_do_update(
            index_elements=["ticker", "trade_date", "provider"],
            set_=set_,
        )

        result = await self._session.execute(upsert)
        await self._session.commit()
        return int(result.rowcount)  # type: ignore[reportUnknownMemberType, reportUnknownArgumentType, reportAttributeAccessIssue]

    async def load_ohlcv(
        self, tickers: list[str], start: date, end: date
    ) -> tuple[list[dict[str, object]], list[str]]:
        """Read ``ohlcv_daily`` rows for ``tickers`` in [start, end].

        Returns (rows, tickers_with_data) so callers can skip tickers with no
        history (e.g. an index row absent in the fixture).
        """
        if not tickers:
            return [], []
        rows = (
            await self._session.execute(
                select(
                    OhlcvDaily.ticker,
                    OhlcvDaily.trade_date,
                    OhlcvDaily.open,
                    OhlcvDaily.high,
                    OhlcvDaily.low,
                    OhlcvDaily.close,
                    OhlcvDaily.volume,
                    OhlcvDaily.turnover,
                )
                .where(OhlcvDaily.ticker.in_(tickers))
                .where(OhlcvDaily.trade_date >= start)
                .where(OhlcvDaily.trade_date <= end)
                .order_by(OhlcvDaily.ticker, OhlcvDaily.trade_date)
            )
        ).fetchall()
        cols = [
            "ticker",
            "trade_date",
            "open",
            "high",
            "low",
            "close",
            "volume",
            "turnover",
        ]
        raw = [dict(zip(cols, r, strict=True)) for r in rows]
        present = sorted({r["ticker"] for r in raw})
        return raw, present

    async def latest_trade_date(self, tickers: list[str]) -> date | None:
        if not tickers:
            return None
        return await self._session.scalar(
            select(func.max(OhlcvDaily.trade_date)).where(
                OhlcvDaily.ticker.in_(tickers)
            )
        )
