"""Ingestion jobs: watermark semantics + idempotency (providers mocked)."""

import logging
from datetime import UTC, datetime

import polars as pl
import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import (
    EconomicEvent,
    EconomicIndicator,
    IngestionCheckpoint,
    NewsArticle,
    NewsEntity,
)
from app.infrastructure.repositories.checkpoint_repo import CheckpointRepository


class _TickerResult:
    def __init__(self, tickers: list[str]) -> None:
        self._tickers = tickers

    def scalars(self) -> "_TickerResult":
        return self

    def all(self) -> list[str]:
        return self._tickers


class _TickerSession:
    def __init__(self, tickers: list[str]) -> None:
        self._tickers = tickers

    async def execute(self, _statement: object) -> _TickerResult:
        return _TickerResult(self._tickers)


def _sessions(tickers: list[str]):
    async def generate():
        yield _TickerSession(tickers)

    return generate


@pytest_asyncio.fixture(loop_scope="session", scope="function")
async def clean_tables(session: AsyncSession):
    for model in (
        NewsEntity,
        NewsArticle,
        EconomicEvent,
        EconomicIndicator,
        IngestionCheckpoint,
    ):
        await session.execute(delete(model))
    await session.commit()


def _indicator_rows() -> pl.DataFrame:
    from datetime import date

    return pl.DataFrame(
        {
            "indicator": ["us_10y"],
            "asof_date": [date(2026, 8, 18)],
            "value": [4.25],
            "unit": ["%"],
            "source": ["FRED"],
        }
    )


def _news_rows() -> pl.DataFrame:
    return pl.DataFrame(
        {
            "title": ["BBCA posts strong profit"],
            "source": ["test.example"],
            "published_at": [datetime(2026, 8, 19, 9, 0, tzinfo=UTC)],
            "url": ["https://test.example/1"],
            "summary": ["results"],
            "tickers": [["BBCA"]],
        }
    )


async def test_ingest_macro_writes_and_advances_watermark(
    session: AsyncSession, clean_tables, monkeypatch
):
    from app.interfaces.workers import jobs as jobs_module

    monkeypatch.setattr(
        jobs_module,
        "_macro_frame",
        lambda start, end: _indicator_rows(),
    )
    written = await jobs_module._ingest_macro()
    assert written == 1
    repo = CheckpointRepository(session)
    assert await repo.get("ingest_macro") is not None
    count = (await session.execute(select(EconomicIndicator))).scalars().all()
    assert len(count) == 1


async def test_ingest_news_writes_and_entities(
    session: AsyncSession, clean_tables, monkeypatch
):
    from app.interfaces.workers import jobs as jobs_module

    monkeypatch.setattr(
        jobs_module,
        "_news_frame",
        lambda since: _news_rows(),
    )
    assert await jobs_module._ingest_news() == 1
    articles = (await session.execute(select(NewsArticle))).scalars().all()
    assert len(articles) == 1
    entities = (await session.execute(select(NewsEntity))).scalars().all()
    assert len(entities) == 1
    assert entities[0].ticker == "BBCA"


async def test_ingest_ohlcv_skips_symbols_with_no_data(monkeypatch, caplog):
    from app.infrastructure.providers.exceptions import NoDataError
    from app.interfaces.workers import jobs as jobs_module

    async def ingest(ticker, _start, _end, _session, *, storage_ticker=None):
        del storage_ticker
        if ticker == "EMPTY.JK":
            raise NoDataError("empty history")
        return (2 if ticker == "^JKSE" else 3), object()

    monkeypatch.setattr(jobs_module, "get_session", _sessions(["GOOD", "EMPTY"]))
    monkeypatch.setattr(jobs_module, "ingest_ohlcv", ingest)
    caplog.set_level(logging.WARNING, logger="app.workers")

    assert await jobs_module.ingest_ohlcv_history() == 5
    assert "EMPTY.JK skipped" in caplog.text
    assert "fetched=2 skipped=1 failed=0 rows=5" in caplog.text
    assert "Traceback" not in caplog.text


async def test_ingest_ohlcv_fails_when_provider_returns_no_data(monkeypatch):
    from app.infrastructure.providers.exceptions import NoDataError, ProviderError
    from app.interfaces.workers import jobs as jobs_module

    async def ingest(_ticker, _start, _end, _session, *, storage_ticker=None):
        del storage_ticker
        raise NoDataError("empty history")

    monkeypatch.setattr(jobs_module, "get_session", _sessions(["EMPTY"]))
    monkeypatch.setattr(jobs_module, "ingest_ohlcv", ingest)

    with pytest.raises(ProviderError, match="fetched no data for any active symbol"):
        await jobs_module.ingest_ohlcv_history()
