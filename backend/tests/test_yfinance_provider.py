"""Unit tests for the yfinance OHLCV normalizer (constructed DataFrame)."""

from datetime import date, datetime

import pandas as pd
import polars as pl
import pytest

from app.infrastructure.providers.exceptions import NoDataError
from app.infrastructure.providers.yfinance_provider import normalize_to_polars


def _make_raw_frame() -> pd.DataFrame:
    idx = pd.DatetimeIndex(
        [
            datetime(2024, 1, 1),
            datetime(2024, 1, 2),
            datetime(2024, 1, 3),
        ],
        name="Date",
    )
    return pd.DataFrame(
        {
            "Open": [100.0, 101.0, 102.0],
            "High": [105.0, 106.0, 107.0],
            "Low": [99.0, 100.0, 101.0],
            "Close": [104.0, 105.0, 106.0],
            "Adj Close": [103.5, 104.5, 105.5],
            "Volume": [1000, 2000, 1500],
        },
        index=idx,
    )


def test_normalize_yfinance_frame():
    frame = normalize_to_polars(_make_raw_frame())
    assert frame.columns == [
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "turnover",
        "source_timestamp",
    ]
    assert len(frame) == 3
    assert frame["trade_date"].dtype == pl.Date
    assert frame["open"].dtype == pl.Float64
    assert frame["volume"].dtype == pl.Int64
    assert frame["source_timestamp"].dtype == pl.Datetime
    # no NaN anywhere
    assert sum(frame.select(pl.all().is_null().sum()).row(0)) == 0
    # turnover == close * volume
    expected = [104.0 * 1000, 105.0 * 2000, 106.0 * 1500]
    assert frame["turnover"].to_list() == expected
    # trade_date carries the row dates
    assert frame["trade_date"].to_list() == [
        date(2024, 1, 1),
        date(2024, 1, 2),
        date(2024, 1, 3),
    ]
    # source_timestamp == trade_date as datetime (EOD bar timestamp)
    assert frame["source_timestamp"].to_list() == [
        datetime(2024, 1, 1),
        datetime(2024, 1, 2),
        datetime(2024, 1, 3),
    ]


def test_normalize_drops_nan_rows_and_raises_when_empty():
    idx = pd.DatetimeIndex([datetime(2024, 2, 1), datetime(2024, 2, 2)], name="Date")
    raw = pd.DataFrame(
        {
            "Open": [None, 1.0],
            "High": [None, 1.0],
            "Low": [None, 1.0],
            "Close": [None, 1.0],
            "Adj Close": [None, 1.0],
            "Volume": [None, 10],
        },
        index=idx,
    )
    # first row is fully NaN -> dropped, leaving one clean row
    frame = normalize_to_polars(raw)
    assert len(frame) == 1
    assert frame["turnover"].to_list() == [1.0 * 10]
    # fully empty input raises
    empty = pd.DataFrame(
        columns=["Open", "High", "Low", "Close", "Adj Close", "Volume"],
        index=pd.DatetimeIndex([], name="Date"),
    )
    with pytest.raises(NoDataError):
        normalize_to_polars(empty)
