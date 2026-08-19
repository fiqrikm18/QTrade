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
from app.infrastructure.providers.fred_provider import FredProvider
from app.infrastructure.providers.news_provider import RSSNewsProvider
from app.infrastructure.providers.yfinance_provider import YFinanceProvider


class _FredOnlyMacroProvider(MacroEconomicProvider, EconomicCalendarProvider):
    """FRED-only macro + calendar (no calendar from FRED; returns empty)."""

    def __init__(self, fred: FredProvider) -> None:
        self._fred = fred

    def get_indicators(self, codes: list[str], start: date, end: date) -> pl.DataFrame:
        return self._fred.get_indicators(codes, start, end)

    def get_calendar(self, start: date, end: date) -> pl.DataFrame:
        return self._empty_frame()

    def _empty_frame(self) -> pl.DataFrame:
        return pl.DataFrame(
            schema={
                "date": pl.String,
                "time": pl.String,
                "country": pl.String,
                "event": pl.String,
                "impact": pl.String,
                "category": pl.String,
                "prev": pl.Float64,
                "consensus": pl.Float64,
                "actual": pl.Float64,
            }
        )


def build_macro_provider(
    settings: Settings | None = None,
) -> tuple[MacroEconomicProvider, EconomicCalendarProvider]:
    """Returns (macro provider, calendar provider) for the configured vendor."""
    from app.config.settings import get_settings

    s = settings or get_settings()
    if s.macro_provider != "fred":
        raise ValueError(f"unsupported macro provider: {s.macro_provider}")
    provider = _FredOnlyMacroProvider(FredProvider())
    return provider, provider


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
