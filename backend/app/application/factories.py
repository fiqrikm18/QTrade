"""Application factory for market data providers."""

from app.config.settings import Settings
from app.domain.market.interfaces import MarketDataProvider
from app.infrastructure.providers.yfinance_provider import YFinanceProvider


def build_market_provider(settings: Settings) -> MarketDataProvider:
    if settings.market_data_provider == "yfinance":
        return YFinanceProvider()
    raise NotImplementedError(
        f"unknown provider {settings.market_data_provider}"
    )
