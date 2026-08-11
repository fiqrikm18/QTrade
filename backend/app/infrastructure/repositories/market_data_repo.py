"""Market-data repository: idempotent OHLCV upsert on the ohlcv_daily table."""

from datetime import datetime

import polars as pl
from sqlalchemy import func
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
