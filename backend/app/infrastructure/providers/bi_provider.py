"""Bank Indonesia public data provider (keyless, official source).

JISDOR USD/IDR reference rate and BI Rate from ``api-biapi.bi.go.id``;
economic calendar scraped from the official BI calendar page. Parsing is
defensive: any unexpected response raises ProviderError so the ingestion job
fails honestly instead of writing fabricated data.
"""

from __future__ import annotations

import re
from datetime import UTC, date, datetime, timedelta
from html.parser import HTMLParser
from typing import Any, cast

import httpx
import polars as pl

from app.domain.macro.interfaces import (
    EconomicCalendarProvider,
    MacroEconomicProvider,
)
from app.infrastructure.providers.exceptions import ProviderError

_JISDOR_URL = "https://api-biapi.bi.go.id/kurs/v1/jisdor/{date}"
_BI_RATE_URL = "https://api-biapi.bi.go.id/bi_rate/v1/rates"
_CALENDAR_URL = "https://www.bi.go.id/en/publikasi/Kalender"

_RATE_LIKE_KEYS = ("rate", "jual", "beli", "middle_rate", "jisdor")
_DATE_KEYS = ("date", "tanggal", "rates_date")


class _CalendarParser(HTMLParser):
    """Extract (date, title) pairs from the official BI calendar page.

    The page renders monthly entries as blocks containing a date and an event
    title (e.g. "Rapat Dewan Gubernur - BI Rate"). Structure changes require
    parser updates; an unparseable page yields no rows (honest empty), never
    fabricated events.
    """

    def __init__(self) -> None:
        super().__init__()
        self.entries: list[tuple[str, str]] = []
        self._current_date: str | None = None

    def handle_data(self, data: str) -> None:
        text = data.strip()
        if not text:
            return
        if re.fullmatch(r"\d{1,2}\s+\w+\s+\d{4}", text):
            self._current_date = text
            return
        if len(text) > 8 and self._current_date:
            self.entries.append((self._current_date, text))


def _parse_date(text: str) -> date | None:
    for fmt in ("%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _find_rate(payload: Any) -> float | None:
    """Defensively locate a rate value inside the BI JSON payload.

    Rate-like dict keys (``rate``, ``jual``, ``beli``, ...) anywhere in the
    tree win; a bare numeric payload is accepted as a last resort. Envelope
    metadata (e.g. ``status.code``) is never treated as a rate.
    """
    if isinstance(payload, (int, float)) and not isinstance(payload, bool):
        return float(payload)
    return _find_rate_key(payload)


def _find_rate_key(payload: Any) -> float | None:
    """Search a dict/list tree for a rate-like key holding a number."""
    if isinstance(payload, list):
        for item in cast(list[Any], payload):
            if (rate := _find_rate_key(item)) is not None:
                return rate
        return None
    if not isinstance(payload, dict):
        return None
    for key, value in cast(dict[str, Any], payload).items():
        low = key.lower()
        if low in _RATE_LIKE_KEYS and isinstance(value, (int, float)):
            return float(value)
    for value in cast(dict[str, Any], payload).values():
        if (rate := _find_rate_key(value)) is not None:
            return rate
    return None


def _find_date(payload: Any) -> date | None:
    if isinstance(payload, list):
        for item in cast(list[Any], payload):
            if (d := _find_date(item)) is not None:
                return d
        return None
    if not isinstance(payload, dict):
        return None
    for key, value in cast(dict[str, Any], payload).items():
        if key.lower() in _DATE_KEYS and isinstance(value, str):
            try:
                return date.fromisoformat(value)
            except ValueError:
                continue
    for value in cast(dict[str, Any], payload).values():
        if (d := _find_date(value)) is not None:
            return d
    return None


class BiProvider(MacroEconomicProvider, EconomicCalendarProvider):
    """BI-sourced macro indicators + economic calendar (keyless)."""

    SUPPORTED_CODES = {"usd_idr", "bi_rate"}

    def __init__(self, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=30.0)

    def get_indicators(self, codes: list[str], start: date, end: date) -> pl.DataFrame:
        unknown = set(codes) - self.SUPPORTED_CODES
        if unknown:
            raise ProviderError(
                f"code(s) not supported by BiProvider: {sorted(unknown)}"
            )
        rows: list[dict[str, object]] = []
        for code in codes:
            if code == "usd_idr":
                rows.extend(self._fetch_jisdor(start, end))
            else:
                rows.extend(self._fetch_bi_rate(start, end))
        if not rows:
            return pl.DataFrame(
                schema={
                    "indicator": pl.String,
                    "asof_date": pl.Date,
                    "value": pl.Float64,
                    "unit": pl.String,
                    "source": pl.String,
                }
            )
        return pl.DataFrame(rows).with_columns(
            [pl.col("asof_date").cast(pl.Date), pl.col("value").cast(pl.Float64)]
        )

    def _fetch_jisdor(self, start: date, end: date) -> list[dict[str, object]]:
        out: list[dict[str, object]] = []
        for d in _weekdays(start, end):
            try:
                resp = self._client.get(_JISDOR_URL.format(date=d.isoformat()))
                resp.raise_for_status()
            except Exception as exc:
                raise ProviderError(f"JISDOR fetch failed for {d}: {exc}") from exc
            payload = resp.json()
            if not isinstance(payload, dict) or "data" not in payload:
                # HTTP 200 but not the expected envelope: parse failure.
                raise ProviderError(f"JISDOR unexpected payload for {d}")
            rate = _find_rate(payload)
            if rate is None:
                # Weekend/holiday: BI publishes no rate; skip, not fabricate.
                continue
            out.append(
                {
                    "indicator": "usd_idr",
                    "asof_date": d,
                    "value": rate,
                    "unit": "",
                    "source": "BI",
                }
            )
        return out

    def _fetch_bi_rate(self, start: date, end: date) -> list[dict[str, object]]:
        params = {
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
        }
        try:
            resp = self._client.get(_BI_RATE_URL, params=params)
            resp.raise_for_status()
        except Exception as exc:
            raise ProviderError(f"BI rate fetch failed: {exc}") from exc
        rows: list[dict[str, object]] = []
        for item in resp.json().get("rates", []):
            d = _find_date(item)
            rate = _find_rate(item)
            if d is None or rate is None:
                continue
            rows.append(
                {
                    "indicator": "bi_rate",
                    "asof_date": d,
                    "value": rate,
                    "unit": "%",
                    "source": "BI",
                }
            )
        return rows

    def get_calendar(self, start: date, end: date) -> pl.DataFrame:
        try:
            resp = self._client.get(_CALENDAR_URL)
            resp.raise_for_status()
        except Exception as exc:
            raise ProviderError(f"BI calendar fetch failed: {exc}") from exc
        parser = _CalendarParser()
        parser.feed(resp.text)
        rows: list[dict[str, object]] = []
        for date_text, title in parser.entries:
            d = _parse_date(date_text)
            if d is None or not (start <= d <= end):
                continue
            is_rate_decision = "BI Rate" in title or "Rapat Dewan Gubernur" in title
            rows.append(
                {
                    "event": title,
                    "country": "ID",
                    "scheduled_at": datetime(d.year, d.month, d.day, 14, 0, tzinfo=UTC),
                    "importance": 3 if is_rate_decision else 2,
                    "category": "CENTRAL_BANK" if is_rate_decision else "GENERAL",
                    "previous": None,
                    "consensus": None,
                    "actual": None,
                    "status": "scheduled",
                    "source": "BI",
                }
            )
        if not rows:
            return pl.DataFrame(
                schema={
                    "event": pl.String,
                    "country": pl.String,
                    "scheduled_at": pl.Datetime,
                    "importance": pl.Int64,
                    "category": pl.String,
                    "previous": pl.Float64,
                    "consensus": pl.Float64,
                    "actual": pl.Float64,
                    "status": pl.String,
                    "source": pl.String,
                }
            )
        return pl.DataFrame(rows)


def _weekdays(start: date, end: date) -> list[date]:
    out: list[date] = []
    d = start
    while d <= end:
        if d.weekday() < 5:
            out.append(d)
        d = d + timedelta(days=1)
    return out
