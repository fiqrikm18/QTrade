"""Fundamental scoring framework (docs/fundamental-analysis.md §3-4).

Pure domain: percentile-rank sub-scores (0-100) vs sector + own-history
benchmark, composite per configurable weights. No DB/network. Every sub-score
carries ``score_components`` for explainability (docs/scoring.md §6).

Growth: ``RatioSet`` (docs §2) carries no revenue/EPS/FCF absolute values, so
period-over-period growth cannot be computed from it; the score defaults to
neutral 50 with a note. Feed growth-ready history (raw statement items or a
growth-extended ratio set) at the application layer to activate.
ponytail: growth inputs are a pipeline-layer concern; wire real YoY growth once
a statement store exists.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from app.domain.fundamental.ratios import RatioSet


@dataclass(frozen=True)
class FundamentalWeights:
    """Composite weights (docs §3); must sum to > 0."""

    profitability: float = 0.30
    growth: float = 0.25
    health: float = 0.25
    valuation: float = 0.20

    def __post_init__(self) -> None:
        if self.profitability + self.growth + self.health + self.valuation <= 0:
            raise ValueError("fundamental weights must sum to > 0")


DEFAULT_WEIGHTS = FundamentalWeights()

# Benchmark percentiles + rationale per sub-score (explainability, docs §4).
ComponentMap = dict[str, float | None | str]


def percentile_rank(
    value: float | None, population: Iterable[float | None]
) -> float | None:
    """Percentile of ``value`` within ``population``, 0-100.

    None values in the population are skipped; None ``value`` or empty
    population returns None. Ties score neutral 50.
    """
    if value is None:
        return None
    pop = [p for p in population if p is not None]
    if not pop:
        return None
    less = sum(1 for p in pop if p < value)
    greater = sum(1 for p in pop if p > value)
    if less + greater == 0:
        return 50.0
    return 100.0 * less / (less + greater)


def _pct(rs: RatioSet, attr: str, benchmark: list[RatioSet]) -> float | None:
    """Percentile rank of ``attr`` on ``rs`` vs the benchmark population."""
    return percentile_rank(getattr(rs, attr), (getattr(p, attr) for p in benchmark))


def _blend(parts: list[tuple[float | None, float]]) -> float | None:
    """Weighted mean of the non-None parts, renormalized; None if none present."""
    total = sum(w for v, w in parts if v is not None)
    if total == 0:
        return None
    return sum(v * w for v, w in parts if v is not None) / total


def _clamp(x: float) -> float:
    return max(0.0, min(100.0, x))


def fundamental_score(
    ratios: RatioSet,
    sector_ratios: list[RatioSet],
    history_ratios: list[RatioSet],
    weights: FundamentalWeights = DEFAULT_WEIGHTS,
) -> dict[str, object]:
    """Score one company's fundamentals vs sector + own history (docs §3).

    Returns the 5 sub-scores (0-100), the weighted composite
    ``fundamental_score``, and ``score_components`` with benchmark percentiles
    and per-sub-score rationale (docs §4, docs/scoring.md §6).
    """
    benchmark = list(sector_ratios) + list(history_ratios)

    profitability, profit_comps = _profitability(ratios, benchmark)
    growth, growth_comps = _growth(history_ratios)
    health, health_comps = _health(ratios, benchmark)
    valuation, valuation_comps = _valuation(
        ratios, benchmark, profitability, health
    )

    quality_raw = _blend([(profitability, 0.5), (health, 0.5)])
    quality = _clamp(quality_raw if quality_raw is not None else 50.0)

    total_w = (
        weights.profitability + weights.growth + weights.health + weights.valuation
    )
    fundamental = (
        weights.profitability * profitability
        + weights.growth * growth
        + weights.health * health
        + weights.valuation * valuation
    ) / total_w

    return {
        "profitability_score": profitability,
        "growth_score": growth,
        "financial_health_score": health,
        "valuation_score": valuation,
        "quality_score": quality,
        "fundamental_score": fundamental,
        "score_components": {
            "profitability": profit_comps,
            "growth": growth_comps,
            "financial_health": health_comps,
            "valuation": valuation_comps,
            "quality": {
                "score": quality,
                "note": (
                    "blend of profitability and financial_health "
                    "(earnings quality OCF/NI not in RatioSet)"
                ),
            },
        },
    }


def _profitability(
    ratios: RatioSet, benchmark: list[RatioSet]
) -> tuple[float, ComponentMap]:
    metrics: dict[str, float] = {
        "roe": 0.30, "roic": 0.25, "npm": 0.25, "gpm": 0.10, "opm": 0.10,
    }
    pcts: dict[str, float | None] = {
        name: _pct(ratios, name, benchmark) for name in metrics
    }
    blended = _blend([(pcts[n], w) for n, w in metrics.items()])
    score = _clamp(blended) if blended is not None else 50.0

    penalties = sum(
        1 for m in (ratios.npm, ratios.opm) if m is not None and m < 0
    )
    if penalties:
        score = _clamp(score - 25.0 * penalties)
    note = (
        f"negative margin penalty applied ({penalties})" if penalties
        else "percentile vs sector+history; positive margins"
    )
    comps: ComponentMap = {f"{n}_pct": pcts[n] for n in metrics}
    comps["note"] = note
    return score, comps


def _growth(history_ratios: list[RatioSet]) -> tuple[float, ComponentMap]:
    """Neutral 50: revenue/EPS/FCF growth inputs are absent from RatioSet."""
    comps: ComponentMap = {
        "periods": len(history_ratios),
        "note": (
            "no growth inputs (revenue/EPS/FCF) in RatioSet; neutral 50 "
            f"({len(history_ratios)} history periods supplied)"
        ),
    }
    return 50.0, comps


def _health(
    ratios: RatioSet, benchmark: list[RatioSet]
) -> tuple[float, ComponentMap]:
    de_pct = _pct(ratios, "debt_equity", benchmark)
    cr_pct = _pct(ratios, "current_ratio", benchmark)
    ic_pct = _pct(ratios, "interest_coverage", benchmark)
    blended = _blend(
        [
            (100.0 - de_pct if de_pct is not None else None, 0.4),
            (cr_pct, 0.3),
            (ic_pct, 0.3),
        ]
    )
    score = _clamp(blended) if blended is not None else 50.0

    notes: list[str] = []
    if ratios.debt_equity is not None and ratios.debt_equity > 2.0:
        score = _clamp(score - 30.0)
        notes.append("high leverage penalty (debt_equity > 2.0)")
    if ratios.interest_coverage is not None and ratios.interest_coverage < 1.0:
        score = _clamp(score - 20.0)
        notes.append("interest coverage < 1.0")
    if not notes:
        notes.append("percentile vs sector+history")
    comps: ComponentMap = {
        "debt_equity_pct": de_pct,
        "current_ratio_pct": cr_pct,
        "interest_coverage_pct": ic_pct,
        "note": "; ".join(notes),
    }
    return score, comps


def _valuation(
    ratios: RatioSet,
    benchmark: list[RatioSet],
    profitability: float,
    health: float,
) -> tuple[float, ComponentMap]:
    per_pct = _pct(ratios, "per", benchmark)
    pbv_pct = _pct(ratios, "pbv", benchmark)
    fcf_pct = _pct(ratios, "fcf_yield", benchmark)
    blended = _blend(
        [
            (100.0 - per_pct if per_pct is not None else None, 0.4),
            (100.0 - pbv_pct if pbv_pct is not None else None, 0.3),
            (fcf_pct, 0.3),
        ]
    )
    score = _clamp(blended) if blended is not None else 50.0

    quality = _clamp((profitability + health) / 2.0)
    note = (
        "cheap but deteriorating quality (value-trap risk)"
        if score > 60.0 and quality < 50.0
        else "cheaper = higher score (inverted percentiles)"
    )
    comps: ComponentMap = {
        "per_pct": per_pct,
        "pbv_pct": pbv_pct,
        "fcf_yield_pct": fcf_pct,
        "note": note,
    }
    return score, comps
