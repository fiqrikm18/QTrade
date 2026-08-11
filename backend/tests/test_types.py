from datetime import date

from app.domain.common.types import Quote, UniverseItem
from app.domain.market.interfaces import MarketDataProvider


def test_universe_item_typed():
    u = UniverseItem(ticker="BBCA", name="Bank Central Asia",
                     listing_date=None, board="Utama", shares_outstanding=1_924_688_333)
    assert u.ticker == "BBCA"
    assert isinstance(u.shares_outstanding, int)


def test_quote_typed():
    q = Quote(ticker="BBCA", price=9125.0, change=128.0, volume=2_000_000,
              turnover=18_250_000_000.0, market_cap=1_176_000_000_000.0,
              asof=date(2026, 8, 11))
    assert q.price > 0


def test_provider_is_protocol():
    assert hasattr(MarketDataProvider, "get_ohlcv")
