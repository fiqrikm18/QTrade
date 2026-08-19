"""Aggregated data-quality report from ohlcv_daily (docs/data-pipeline.md §4)."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import polars as pl
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.data_quality import validate_ohlcv
from app.infrastructure.database.models import OhlcvDaily

_LOOKBACK_DAYS = 380


async def build_quality_report(session: AsyncSession) -> dict[str, Any]:
    latest = await _latest_trade_date(session)
    if latest is None:
        return {
            "asof": None,
            "total_tickers": 0,
            "overall_score": None,
            "tickers": [],
            "issues": [],
            "freshness": {"ohlcv_daily": {"latest_trade_date": None, "row_count": 0}},
        }

    cutoff = latest - timedelta(days=_LOOKBACK_DAYS)
    rows = (
        await session.execute(
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
            .where(OhlcvDaily.trade_date >= cutoff)
            .order_by(OhlcvDaily.ticker, OhlcvDaily.trade_date)
        )
    ).fetchall()

    if not rows:
        return {
            "asof": latest.isoformat(),
            "total_tickers": 0,
            "overall_score": None,
            "tickers": [],
            "issues": [],
            "freshness": {
                "ohlcv_daily": {"latest_trade_date": latest.isoformat(), "row_count": 0}
            },
        }

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
    df = pl.DataFrame(raw)

    # Convert Decimal to float for polars processing
    for col in ["open", "high", "low", "close", "volume", "turnover"]:
        if col in df.columns:
            df = df.with_columns(pl.col(col).cast(pl.Float64))

    ticker_report: dict[str, dict[str, Any]] = {}
    for ticker in df["ticker"].unique().sort().to_list():
        frame = df.filter(pl.col("ticker") == ticker)
        report, _valid = validate_ohlcv(ticker, frame)
        ticker_report[ticker] = {
            "quality_score": report.quality_score,
            "issues": report.issues,
            "rows_in": report.rows_in,
            "rows_valid": report.rows_valid,
        }

    tickers_out: list[dict[str, Any]] = []
    issues_out: list[dict[str, Any]] = []
    for ticker, rep in ticker_report.items():
        filtered_issues = {k: v for k, v in rep["issues"].items() if v > 0}
        tickers_out.append(
            {
                "ticker": ticker,
                "quality_score": rep["quality_score"],
                "rows_valid": rep["rows_valid"],
                "issues": filtered_issues,
                "latest_trade_date": latest.isoformat(),
            }
        )
        for issue_type, count in rep["issues"].items():
            if count > 0:
                issues_out.append(
                    {"ticker": ticker, "type": issue_type, "count": count}
                )

    scores = [t["quality_score"] for t in tickers_out]
    return {
        "asof": latest.isoformat(),
        "total_tickers": len(tickers_out),
        "overall_score": round(sum(scores) / len(scores), 2) if scores else None,
        "tickers": tickers_out,
        "issues": issues_out,
        "freshness": {
            "ohlcv_daily": {
                "latest_trade_date": latest.isoformat(),
                "row_count": len(rows),
            }
        },
    }


async def _latest_trade_date(session: AsyncSession) -> date | None:
    return await session.scalar(select(func.max(OhlcvDaily.trade_date)))
