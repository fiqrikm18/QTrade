"""OHLCV data-quality validation (pure Polars, no IO).

validate_ohlcv never raises: it always returns a QualityReport plus the
filtered (valid-only) frame.
"""

from dataclasses import dataclass, field
from datetime import date

import polars as pl


@dataclass(frozen=True)
class QualityReport:
    ticker: str
    quality_score: int
    issues: dict[str, int]
    rows_in: int
    rows_valid: int
    source: str
    valid_frame: pl.DataFrame = field(repr=False)


def validate_ohlcv(
    ticker: str, df: pl.DataFrame
) -> tuple[QualityReport, pl.DataFrame]:
    if df.is_empty():
        empty = pl.DataFrame(
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
        report = QualityReport(
            ticker=ticker,
            quality_score=100,
            issues={},
            rows_in=0,
            rows_valid=0,
            source="polars",
            valid_frame=empty,
        )
        return report, empty

    duplicate_mask: pl.Expr = ~pl.col("trade_date").is_first_distinct()
    duplicates = df.filter(duplicate_mask).height

    high_below_low: pl.Expr = pl.col("high") < pl.col("low")
    non_positive_price: pl.Expr = (
        (pl.col("open") <= 0)
        | (pl.col("high") <= 0)
        | (pl.col("low") <= 0)
        | (pl.col("close") <= 0)
    )
    non_positive_volume: pl.Expr = pl.col("volume") <= 0
    outside_range: pl.Expr = (
        (pl.col("open") > pl.col("high"))
        | (pl.col("open") < pl.col("low"))
        | (pl.col("close") > pl.col("high"))
        | (pl.col("close") < pl.col("low"))
    )

    distinct_dates = df["trade_date"].unique().sort()
    missing_days = 0
    if len(distinct_dates) >= 2:
        dmin: date = distinct_dates[0]
        dmax: date = distinct_dates[-1]
        expected = (dmax - dmin).days + 1
        missing_days = max(0, expected - len(distinct_dates))

    value_mask: pl.Expr = (
        ~high_below_low & ~non_positive_price & ~non_positive_volume & ~outside_range
    )
    valid_mask: pl.Expr = value_mask & ~duplicate_mask

    valid_frame = df.filter(valid_mask)
    rows_valid = valid_frame.height

    issues = {
        "duplicates": duplicates,
        "high_below_low": df.filter(high_below_low).height,
        "non_positive_price": df.filter(non_positive_price).height,
        "non_positive_volume": df.filter(non_positive_volume).height,
        "open_close_outside_range": df.filter(outside_range).height,
        "missing_days": missing_days,
    }

    invalid = df.height - rows_valid
    defects = invalid + duplicates + missing_days
    score = max(0, min(100, 100 - 5 * defects))

    report = QualityReport(
        ticker=ticker,
        quality_score=score,
        issues=issues,
        rows_in=df.height,
        rows_valid=rows_valid,
        source="polars",
        valid_frame=valid_frame,
    )
    return report, valid_frame
