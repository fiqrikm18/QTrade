"""Unit + integration tests for OHLCV ingestion validation and upsert."""

from datetime import date, datetime
from decimal import Decimal

import polars as pl
from sqlalchemy import delete, func, select

from app.application.services.data_quality import validate_ohlcv
from app.application.services.market_data import ingest_ohlcv
from app.domain.common.types import Quote, UniverseItem
from app.domain.market.interfaces import MarketDataProvider
from app.infrastructure.database.models import OhlcvDaily
from app.infrastructure.database.session import get_session

_TICKER = "TEST.FAKE"


def _bad_rows_frame() -> pl.DataFrame:
    """3 bars: row 0 good, row 1 has high<low + open<=0 + volume<=0,
    row 2 good but a duplicate trade_date of row 0."""
    return pl.DataFrame(
        {
            "trade_date": [
                date(2024, 1, 1),
                date(2024, 1, 2),
                date(2024, 1, 1),  # duplicate date
            ],
            "open": [100.0, 0.0, 105.0],  # row1 open<=0
            "high": [110.0, 1.0, 108.0],  # row1 high < low(2.0)
            "low": [95.0, 2.0, 100.0],
            "close": [108.0, 1.5, 107.0],
            "volume": [1000, -5, 1500],  # row1 volume<=0
            "turnover": [108000.0, 0.0, 160500.0],
            "source_timestamp": [
                datetime(2024, 1, 1),
                datetime(2024, 1, 2),
                datetime(2024, 1, 1),
            ],
        }
    )


class _FakeProvider(MarketDataProvider):
    """Test double: returns a fixed frame. Runtime always uses yfinance."""

    def __init__(self, frame: pl.DataFrame) -> None:
        self._frame = frame

    def get_universe(self) -> list[UniverseItem]:
        raise NotImplementedError

    def get_ohlcv(self, ticker: str, start: date, end: date) -> pl.DataFrame:
        return self._frame

    def get_quote(self, ticker: str) -> Quote:
        raise NotImplementedError


def test_validate_ohlcv_flags_bad_rows() -> None:
    df = _bad_rows_frame()
    report, valid_frame = validate_ohlcv(_TICKER, df)

    # bad row (index 1) + duplicate date (index 2) excluded; row 0 survives
    assert valid_frame["trade_date"].to_list() == [date(2024, 1, 1)]
    assert report.rows_in == 3
    assert report.rows_valid == 1
    assert report.quality_score < 100
    assert report.quality_score >= 0
    assert report.ticker == _TICKER
    # issues dict mentions each defect family
    assert report.issues
    issues = set(report.issues)
    for key in (
        "duplicates",
        "high_below_low",
        "non_positive_price",
        "non_positive_volume",
        "missing_days",
    ):
        assert key in issues
    assert report.issues["duplicates"] >= 1
    assert report.issues["high_below_low"] >= 1
    assert report.issues["non_positive_volume"] >= 1


def test_validate_ohlcv_clean_frame_full_score() -> None:
    df = pl.DataFrame(
        {
            "trade_date": [date(2024, 1, 1), date(2024, 1, 2)],
            "open": [100.0, 102.0],
            "high": [105.0, 107.0],
            "low": [99.0, 101.0],
            "close": [104.0, 106.0],
            "volume": [1000, 1200],
            "turnover": [104000.0, 127200.0],
            "source_timestamp": [datetime(2024, 1, 1), datetime(2024, 1, 2)],
        }
    )
    report, valid_frame = validate_ohlcv(_TICKER, df)
    assert report.quality_score == 100
    assert report.rows_valid == 2
    assert len(valid_frame) == 2


def test_validate_ohlcv_empty_frame() -> None:
    df = pl.DataFrame(
        schema={
            "trade_date": pl.Date,
            "open": pl.Float64,
            "high": pl.Float64,
            "low": pl.Float64,
            "close": pl.Float64,
            "volume": pl.Int64,
            "turnover": pl.Float64,
            "source_timestamp": pl.Datetime,
        }
    )
    report, valid_frame = validate_ohlcv(_TICKER, df)
    assert report.rows_in == 0
    assert report.rows_valid == 0
    assert report.quality_score == 100
    assert len(valid_frame) == 0


async def test_ingest_ohlcv_idempotent_and_drops_bad() -> None:
    frame = _bad_rows_frame()
    async with get_session() as session:
        try:
            # only the 1 good row should survive validation -> 1 DB row
            written, report = await ingest_ohlcv(
                _TICKER,
                date(2024, 1, 1),
                date(2024, 1, 31),
                session,
                provider=_FakeProvider(frame),
            )
            assert written == 1
            assert report.rows_valid == 1
            assert report.rows_in == 3

            first_count = await _ohlcv_count(session, _TICKER)
            assert first_count == 1

            row = (
                await session.execute(
                    select(OhlcvDaily).where(OhlcvDaily.ticker == _TICKER)
                )
            ).scalar_one()
            assert row.source_timestamp is not None
            assert row.adjustment_factor == Decimal("1.0")
            assert row.provider  # set from settings

            # second insert must not grow the row count (upsert idempotent)
            written2, _ = await ingest_ohlcv(
                _TICKER,
                date(2024, 1, 1),
                date(2024, 1, 31),
                session,
                provider=_FakeProvider(frame),
            )
            assert written2 == 1
            assert await _ohlcv_count(session, _TICKER) == 1
        finally:
            await session.execute(
                delete(OhlcvDaily).where(OhlcvDaily.ticker == _TICKER)
            )
            await session.commit()


async def _ohlcv_count(session, ticker: str) -> int:
    count = (
        await session.execute(
            select(func.count())
            .select_from(OhlcvDaily)
            .where(OhlcvDaily.ticker == ticker)
        )
    ).scalar_one()
    return count
