"""Provider factories resolved from settings (docs/data-pipeline.md §1)."""

from __future__ import annotations

from datetime import date

import polars as pl

from app.config.settings import Settings
from app.domain.fundamental.interfaces import FundamentalDataProvider
from app.domain.macro.interfaces import (
    EconomicCalendarProvider,
    MacroEconomicProvider,
)
from app.domain.news.interfaces import NewsProvider
from app.infrastructure.providers.bi_provider import BiProvider
from app.infrastructure.providers.fred_provider import FredProvider
from app.infrastructure.providers.news_provider import RSSNewsProvider
from app.infrastructure.providers.yfinance_provider import YFinanceProvider


class _CombinedMacroProvider(MacroEconomicProvider, EconomicCalendarProvider):
    """Routes indicator codes to the right vendor; calendar from BI."""

    def __init__(self, bi: BiProvider, fred: FredProvider) -> None:
        self._bi = bi
        self._fred = fred

    def get_indicators(self, codes: list[str], start: date, end: date) -> pl.DataFrame:
        bi_codes = [c for c in codes if c in BiProvider.SUPPORTED_CODES]
        fred_codes = [c for c in codes if c not in BiProvider.SUPPORTED_CODES]
        frames: list[pl.DataFrame] = []
        if bi_codes:
            frames.append(self._bi.get_indicators(bi_codes, start, end))
        if fred_codes:
            frames.append(self._fred.get_indicators(fred_codes, start, end))
        if not frames:
            return pl.DataFrame(
                schema={
                    "indicator": pl.String,
                    "asof_date": pl.Date,
                    "value": pl.Float64,
                    "unit": pl.String,
                    "source": pl.String,
                }
            )
        return pl.concat(frames)

    def get_calendar(self, start: date, end: date) -> pl.DataFrame:
        return self._bi.get_calendar(start, end)


def build_macro_provider(
    settings: Settings | None = None,
) -> tuple[MacroEconomicProvider, EconomicCalendarProvider]:
    """Returns (macro provider, calendar provider) for the configured vendor."""
    from app.config.settings import get_settings

    s = settings or get_settings()
    if s.macro_provider != "bi_fred":
        raise ValueError(f"unsupported macro provider: {s.macro_provider}")
    combined = _CombinedMacroProvider(BiProvider(), FredProvider())
    return combined, combined


def build_news_provider(settings: Settings | None = None) -> NewsProvider:
    from app.config.settings import get_settings

    s = settings or get_settings()
    if s.news_provider != "rss":
        raise ValueError(f"unsupported news provider: {s.news_provider}")
    return RSSNewsProvider()


def build_fundamentals_provider(
    settings: Settings | None = None,
) -> FundamentalDataProvider:
    from app.config.settings import get_settings

    s = settings or get_settings()
    if s.fundamental_provider != "yfinance":
        raise ValueError(f"unsupported fundamental provider: {s.fundamental_provider}")
    return YFinanceProvider()
