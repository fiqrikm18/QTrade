"""Opportunity score engine (docs/scoring.md §1, §6; PRD §19, §35).

Pure domain: stdlib + dataclasses only (no DB, no Polars). Composes ten
sub-scores, each 0-100 and ``None`` when unavailable, into an
``opportunity_score`` (weighted, renormalized) and a coarse ``classification``
recommendation bucket.

Risk inversion (docs/scoring.md §5):

    The ``risk`` component stored on :class:`ScoreComponents` is the docs'
    ``risk_score`` = ``100 - risk_penalty`` -- *inverted*, so a high value
    means LOW actual risk (a safe stock) and is blended directly into the
    composite (it lifts the score, it does not lower it).

    :func:`classification` takes the risk PENALTY form as its ``risk_score``
    parameter -- *high = risky* (which is why ``risk_score > 80`` ->
    ``high_risk``). This is the opposite direction of the stored ``risk``
    component. To classify a stock from its components, pass
    ``100 - components.risk`` as ``risk_score``. The two share a name but are
    mirror images; that conversion is the inversion documented above.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# --- component field order (canonical keys, docs/scoring.md §1) -----------------
_COMPONENT_FIELDS: tuple[str, ...] = (
    "technical",
    "fundamental",
    "momentum",
    "relative_strength",
    "smart_money",
    "factor",
    "sector",
    "macro",
    "risk",
    "ml",
)

# --- classification thresholds (docs/scoring.md §1 / PRD §35) -------------------
_OPPORTUNITY_SCORE = 75.0
_WATCHLIST_SCORE = 60.0
_NEUTRAL_SCORE = 40.0
_OPPORTUNITY_RISK_PENALTY = 40.0
_WATCHLIST_RISK_PENALTY = 60.0
_NEUTRAL_RISK_PENALTY = 80.0
_HIGH_RISK_PENALTY = 80.0

# Classification buckets.
OPPORTUNITY = "opportunity"
WATCHLIST = "watchlist"
NEUTRAL = "neutral"
HIGH_RISK = "high_risk"
AVOID = "avoid"

# --- seeded profiles (docs/scoring.md §1; PRD §19) ------------------------------
# Weights are relative (renormalized at score time), so summing to 100 is a
# convention, not a requirement -- ``ScoringProfile`` only enforces sum > 0.
_BALANCED_WEIGHTS: dict[str, float] = {
    "technical": 20.0,
    "fundamental": 20.0,
    "momentum": 15.0,
    "relative_strength": 10.0,
    "smart_money": 10.0,
    "factor": 5.0,
    "sector": 5.0,
    "macro": 5.0,
    "risk": 5.0,
    "ml": 5.0,
}

SEED_PROFILES: dict[str, dict[str, float]] = {
    "balanced": dict(_BALANCED_WEIGHTS),
    "aggressive": {
        "technical": 25.0,
        "fundamental": 10.0,
        "momentum": 25.0,
        "relative_strength": 10.0,
        "smart_money": 15.0,
        "factor": 5.0,
        "sector": 3.0,
        "macro": 3.0,
        "risk": 2.0,
        "ml": 2.0,
    },
    "conservative": {
        "technical": 15.0,
        "fundamental": 35.0,
        "momentum": 10.0,
        "relative_strength": 5.0,
        "smart_money": 5.0,
        "factor": 5.0,
        "sector": 5.0,
        "macro": 10.0,
        "risk": 10.0,
        "ml": 5.0,
    },
    "value": {
        "technical": 10.0,
        "fundamental": 35.0,
        "momentum": 10.0,
        "relative_strength": 10.0,
        "smart_money": 5.0,
        "factor": 15.0,
        "sector": 5.0,
        "macro": 5.0,
        "risk": 5.0,
        "ml": 5.0,
    },
    "momentum": {
        "technical": 15.0,
        "fundamental": 10.0,
        "momentum": 30.0,
        "relative_strength": 20.0,
        "smart_money": 10.0,
        "factor": 5.0,
        "sector": 5.0,
        "macro": 5.0,
        "risk": 0.0,
        "ml": 0.0,
    },
    "swing": {
        "technical": 25.0,
        "fundamental": 10.0,
        "momentum": 15.0,
        "relative_strength": 10.0,
        "smart_money": 25.0,
        "factor": 5.0,
        "sector": 5.0,
        "macro": 5.0,
        "risk": 3.0,
        "ml": 2.0,
    },
    "long_term": {
        "technical": 10.0,
        "fundamental": 40.0,
        "momentum": 10.0,
        "relative_strength": 5.0,
        "smart_money": 5.0,
        "factor": 15.0,
        "sector": 5.0,
        "macro": 5.0,
        "risk": 3.0,
        "ml": 2.0,
    },
}


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return min(max(x, lo), hi)


@dataclass(frozen=True)
class ScoringProfile:
    """A named, weighted blend of component scores.

    ``weights`` keys are the canonical component names in
    :data:`_COMPONENT_FIELDS`. Missing keys are treated as 0 at score time
    (and the remaining weights are renormalized). Weights must sum to > 0.
    """

    name: str
    weights: dict[str, float]

    def __post_init__(self) -> None:
        unknown = [k for k in self.weights if k not in _COMPONENT_FIELDS]
        if unknown:
            raise ValueError(
                f"ScoringProfile '{self.name}' has unknown weight keys: {unknown}"
            )
        total = float(sum(self.weights.values()))
        if total <= 0.0:
            raise ValueError(
                f"ScoringProfile '{self.name}' weights must sum > 0, got {total}"
            )


@dataclass(frozen=True)
class ScoreComponents:
    """Ten sub-scores (0-100, ``None`` when unavailable) + explainability blobs.

    The ``risk`` field is the docs' *inverted* risk_score (high = safe); see
    the module docstring. ``drivers``/``risks``/``invalidation`` hold the
    human-readable reasons (docs/scoring.md §6).
    """

    technical: float | None = None
    fundamental: float | None = None
    momentum: float | None = None
    relative_strength: float | None = None
    smart_money: float | None = None
    factor: float | None = None
    sector: float | None = None
    macro: float | None = None
    risk: float | None = None
    ml: float | None = None
    drivers: list[str] = field(default_factory=list[str])
    risks: list[str] = field(default_factory=list[str])
    invalidation: list[str] = field(default_factory=list[str])


BALANCED_PROFILE = ScoringProfile("balanced", dict(_BALANCED_WEIGHTS))


def opportunity_score(components: ScoreComponents, profile: ScoringProfile) -> float:
    """Composite opportunity score (0-100).

    Weighted mean over the *available* (``non-None``) components; the
    denominator is renormalized over present components so a missing piece
    shifts weight proportionally instead of diluting the score. Returns 0.0
    when no component is available.
    """
    numerator = 0.0
    denominator = 0.0
    for field_name in _COMPONENT_FIELDS:
        value = getattr(components, field_name)
        if value is None:
            continue
        weight = profile.weights.get(field_name, 0.0)
        if weight <= 0.0:
            continue
        numerator += weight * value
        denominator += weight
    if denominator <= 0.0:
        return 0.0
    return _clamp(numerator / denominator)


def classification(score: float, risk_score: float) -> str:
    """Bucket a stock into a recommendation class (docs/scoring.md §7).

    ``risk_score`` here is the risk PENALTY (high = risky); it is the
    *inverse* of the ``risk`` component on :class:`ScoreComponents` (where high
    = safe). Pass ``100 - components.risk`` to classify a built score.
    """
    if score >= _OPPORTUNITY_SCORE and risk_score <= _OPPORTUNITY_RISK_PENALTY:
        return OPPORTUNITY
    if score >= _WATCHLIST_SCORE and risk_score <= _WATCHLIST_RISK_PENALTY:
        return WATCHLIST
    if score >= _NEUTRAL_SCORE and risk_score <= _NEUTRAL_RISK_PENALTY:
        return NEUTRAL
    if risk_score > _HIGH_RISK_PENALTY:
        return HIGH_RISK
    return AVOID
