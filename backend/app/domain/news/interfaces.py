"""News provider protocol (docs/data-pipeline.md §1)."""

from datetime import datetime
from typing import Protocol, runtime_checkable

import polars as pl


@runtime_checkable
class NewsProvider(Protocol):
    """Fetch news items published since ``since``.

    Returned frame columns: title (str), source (str), published_at
    (datetime), url (str), summary (str), tickers (list[str]).
    """

    def get_news(self, tickers: list[str] | None, since: datetime) -> pl.DataFrame: ...
