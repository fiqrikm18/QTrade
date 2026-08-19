"""FRED (Federal Reserve Economic Data) CSV provider — keyless.

CSV endpoint: https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}
Rows are ``date,value`` with ``.`` for missing observations.
"""

from __future__ import annotations

from datetime import date

import httpx
import polars as pl

from app.domain.macro.interfaces import MacroEconomicProvider
from app.infrastructure.providers.exceptions import ProviderError

_FRED_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv"

_SERIES_MAP: dict[str, tuple[str, str]] = {
    "us_10y": ("DGS10", "%"),
    "us_2y": ("DGS2", "%"),
    "fed_funds": ("DFF", "%"),
    "dxy": ("DTWEXBGS", ""),
    "sp500": ("SP500", ""),
    "idn_usd_idr": ("DEXIDUS", "IDR"),
    "idn_policy_rate": ("INTDSBIDM193N", "%"),
}


class FredProvider(MacroEconomicProvider):
    """Macro indicators from FRED CSV (keyless, official)."""

    def __init__(self, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=30.0)

    def get_indicators(self, codes: list[str], start: date, end: date) -> pl.DataFrame:
        unknown = set(codes) - set(_SERIES_MAP)
        if unknown:
            raise ProviderError(
                f"code(s) not supported by FredProvider: {sorted(unknown)}"
            )
        frames: list[pl.DataFrame] = []
        for code in codes:
            frames.append(self._fetch_series(code, start, end))
        if not frames:
            return self._empty_frame()
        return pl.concat(frames).with_columns(pl.col("asof_date").cast(pl.Date))

    def _fetch_series(self, code: str, start: date, end: date) -> pl.DataFrame:
        series, unit = _SERIES_MAP[code]
        params: dict[str, str] = {
            "id": series,
            "cosd": start.isoformat(),
            "coed": end.isoformat(),
        }
        try:
            resp = self._client.get(_FRED_CSV_URL, params=params)
            resp.raise_for_status()
        except Exception as exc:
            raise ProviderError(f"FRED fetch failed for {code}: {exc}") from exc

        rows: list[dict[str, object]] = []
        lines = resp.text.strip().splitlines()
        if not lines or lines[0].strip() != "date,value":
            raise ProviderError(f"FRED response for {code} is not a CSV")
        for line in lines[1:]:
            parts = line.split(",")
            if len(parts) != 2:
                continue
            day, value = parts[0].strip(), parts[1].strip()
            if value == "." or not value:
                continue  # missing observation: skip, never fabricate
            try:
                rows.append(
                    {
                        "indicator": code,
                        "asof_date": date.fromisoformat(day),
                        "value": float(value),
                        "unit": unit,
                        "source": "FRED",
                    }
                )
            except ValueError:
                continue
        if not rows:
            raise ProviderError(f"FRED response for {code} had no parseable rows")
        return pl.DataFrame(rows)

    def _empty_frame(self) -> pl.DataFrame:
        return pl.DataFrame(
            schema={
                "indicator": pl.String,
                "asof_date": pl.Date,
                "value": pl.Float64,
                "unit": pl.String,
                "source": pl.String,
            }
        )
