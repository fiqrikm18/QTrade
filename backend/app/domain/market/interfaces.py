from datetime import date
from typing import Protocol, runtime_checkable

import polars as pl

from app.domain.common.types import Quote, UniverseItem


@runtime_checkable
class MarketDataProvider(Protocol):
    def get_universe(self) -> list[UniverseItem]: ...
    def get_ohlcv(self, ticker: str, start: date, end: date) -> pl.DataFrame: ...
    def get_quote(self, ticker: str) -> Quote: ...
