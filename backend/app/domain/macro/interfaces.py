"""Provider protocols for macro data (docs/data-pipeline.md §1)."""

from datetime import date
from typing import Protocol, runtime_checkable

import polars as pl


@runtime_checkable
class MacroEconomicProvider(Protocol):
    """Fetch macro indicator time series.

    Returned frame columns: indicator (str), asof_date (date),
    value (float), unit (str), source (str).
    """

    def get_indicators(
        self, codes: list[str], start: date, end: date
    ) -> pl.DataFrame: ...


@runtime_checkable
class EconomicCalendarProvider(Protocol):
    """Fetch economic calendar events in [start, end].

    Returned frame columns: event (str), country (str), scheduled_at
    (datetime), importance (int), category (str), previous (float | None),
    consensus (float | None), actual (float | None), status (str),
    source (str).
    """

    def get_calendar(self, start: date, end: date) -> pl.DataFrame: ...
