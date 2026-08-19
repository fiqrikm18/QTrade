"""Macro risk/support scores — deterministic heuristic over real series.

Simple v1: directional 30-day changes drive a 0-100 score. Percentile-based
cross-time scoring (docs/macro.md §4) is a future refinement; this module
never invents values — with insufficient data both scores are None.
"""

from __future__ import annotations

from datetime import date, timedelta


def _change_pct(series: list[tuple[date, float]], days: int = 30) -> float | None:
    if len(series) < 2:
        return None
    cutoff = series[-1][0] - timedelta(days=days)
    recent = [v for d, v in series if d >= cutoff]
    if len(recent) < 2:
        return None
    first, last = recent[0], recent[-1]
    if first == 0:
        return None
    return (last - first) / first * 100.0


def compute_macro_scores(
    series: dict[str, list[tuple[date, float]]],
) -> dict[str, float | None]:
    """risk/support in 0-100; None when insufficient real data."""
    usd_idr = _change_pct(series.get("usd_idr", []))
    dxy = _change_pct(series.get("dxy", []))
    us_10y = _change_pct(series.get("us_10y", []))
    sp500 = _change_pct(series.get("sp500", []))
    inputs = [v for v in (usd_idr, dxy, us_10y, sp500) if v is not None]
    if len(inputs) < 2:
        return {"risk": None, "support": None}

    def _clip(value: float) -> float:
        return max(0.0, min(100.0, value))

    risk = 50.0
    if usd_idr is not None:
        risk += 3.0 * usd_idr
    if dxy is not None:
        risk += 1.5 * dxy
    if us_10y is not None:
        risk += 1.2 * us_10y
    if sp500 is not None:
        risk -= 0.5 * sp500
    support = 100.0 - risk
    return {"risk": round(_clip(risk), 2), "support": round(_clip(support), 2)}
