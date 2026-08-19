from datetime import date

from app.domain.common.types import Quote, UniverseItem
from app.domain.market.interfaces import MarketDataProvider


def test_universe_item_typed():
    u = UniverseItem(
        ticker="BBCA",
        name="Bank Central Asia",
        listing_date=None,
        board="Utama",
        shares_outstanding=1_924_688_333,
    )
    assert u.ticker == "BBCA"
    assert isinstance(u.shares_outstanding, int)


def test_quote_typed():
    q = Quote(
        ticker="BBCA",
        price=9125.0,
        change=128.0,
        volume=2_000_000,
        turnover=18_250_000_000.0,
        market_cap=1_176_000_000_000.0,
        asof=date(2026, 8, 11),
    )
    assert q.price > 0


def test_provider_is_protocol():
    assert hasattr(MarketDataProvider, "get_ohlcv")


def test_provider_protocols_are_runtime_checkable():
    import polars as pl

    from app.domain.fundamental.interfaces import FundamentalDataProvider
    from app.domain.macro.interfaces import (
        EconomicCalendarProvider,
        MacroEconomicProvider,
    )
    from app.domain.news.interfaces import NewsProvider

    for protocol in (
        MacroEconomicProvider,
        EconomicCalendarProvider,
        NewsProvider,
        FundamentalDataProvider,
    ):
        assert hasattr(protocol, "__protocol_attrs__")

    class FakeMacro:
        def get_indicators(
            self, codes: list[str], start: object, end: object
        ) -> pl.DataFrame:
            return pl.DataFrame()

        def get_calendar(self, start: object, end: object) -> pl.DataFrame:
            return pl.DataFrame()

    assert isinstance(FakeMacro(), MacroEconomicProvider)
    assert isinstance(FakeMacro(), EconomicCalendarProvider)

    class FakeNews:
        def get_news(self, tickers: list[str] | None, since: object) -> pl.DataFrame:
            return pl.DataFrame()

    assert isinstance(FakeNews(), NewsProvider)
