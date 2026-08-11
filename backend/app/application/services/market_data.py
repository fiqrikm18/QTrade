"""OHLCV ingestion service: validate -> upsert."""

from datetime import UTC, date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.factories import build_market_provider
from app.application.services.data_quality import QualityReport, validate_ohlcv
from app.config.settings import get_settings
from app.domain.market.interfaces import MarketDataProvider
from app.infrastructure.repositories.market_data_repo import MarketDataRepository


async def ingest_ohlcv(
    ticker: str,
    start: date,
    end: date,
    session: AsyncSession,
    provider: MarketDataProvider | None = None,
) -> tuple[int, QualityReport]:
    """Fetch OHLCV for ``ticker`` (sync provider) then validate + async upsert.

    Returns (rows_written, quality_report). Bad rows are dropped before write;
    duplicate (ticker, trade_date, provider) batches are idempotent.
    """
    provider_obj = provider or build_market_provider(get_settings())
    provider_name = get_settings().market_data_provider

    df = provider_obj.get_ohlcv(ticker, start, end)
    report, valid_df = validate_ohlcv(ticker, df)

    if valid_df.is_empty():
        return 0, report

    # representative source timestamp = newest bar the provider reported;
    # normalize to UTC-aware (DB column is timestamptz).
    source_ts = valid_df["source_timestamp"].max()
    if isinstance(source_ts, datetime):
        if source_ts.tzinfo is None:
            source_ts = source_ts.replace(tzinfo=UTC)
    else:
        source_ts = datetime.now(tz=UTC)

    repo = MarketDataRepository(session)
    rows = await repo.upsert_ohlcv(ticker, valid_df, provider_name, source_ts)
    return rows, report
