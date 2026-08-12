from __future__ import annotations

import pytest

from app.domain.scoring.opportunity import (
    BALANCED_PROFILE,
    ScoreComponents,
    ScoringProfile,
    classification,
    opportunity_score,
)

_COMPONENTS = (
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


def _components(**overrides: float | None) -> ScoreComponents:
    base: dict[str, float | None] = {k: 80.0 for k in _COMPONENTS}
    base.update(overrides)
    return ScoreComponents(**base)


def test_balanced_known_score() -> None:
    # PRD §19 balanced weights sum to 100; all 10 components at 80 -> 80.0.
    assert sum(BALANCED_PROFILE.weights.values()) == 100
    assert opportunity_score(_components(), BALANCED_PROFILE) == 80.0


def test_missing_ml_renormalizes() -> None:
    # ml=None (ml weight 5%) -> denominator renormalized over the other 95%.
    # All equal value 80 stays 80.0.
    assert opportunity_score(_components(ml=None), BALANCED_PROFILE) == 80.0


def test_all_none_score_0() -> None:
    # No component available -> denominator 0 -> 0.0 (not NaN).
    assert opportunity_score(ScoreComponents(), BALANCED_PROFILE) == 0.0


def test_clamps_to_unit_interval() -> None:
    # Weighted mean outside 0-100 is clamped to [0, 100].
    assert opportunity_score(_components(technical=1000.0), BALANCED_PROFILE) == 100.0
    assert opportunity_score(_components(technical=-1000.0), BALANCED_PROFILE) == 0.0


def test_classification_boundaries() -> None:
    # risk_score param is the risk PENALTY (high = risky); see inversion test.
    assert classification(80, 30) == "opportunity"  # >=75 & <=40
    assert classification(75, 40) == "opportunity"  # lower boundaries
    assert classification(65, 50) == "watchlist"  # >=60 & <=60
    assert classification(60, 60) == "watchlist"
    assert classification(50, 70) == "neutral"  # >=40 & <=80
    assert classification(40, 80) == "neutral"
    assert classification(80, 80) == "neutral"  # score>=40 & risk<=80
    assert classification(80, 81) == "high_risk"  # risk > 80 (safe score still risky)
    assert classification(30, 70) == "avoid"  # score<40 & risk<=80
    assert classification(30, 90) == "high_risk"  # risk>80 wins over avoid


def test_risk_score_inversion_documented() -> None:
    # ScoreComponents.risk is INVERTED (docs/scoring.md §5): high = SAFE,
    # low actual risk, and is blended directly into the composite (lifts score).
    # classification()'s risk_score param is the PENALTY (high = RISKY).
    # Conversion: penalty = 100 - components.risk  (the documented inversion).
    #
    # safe stock  (risk=95) -> penalty=5  -> low risk  -> opportunity (not high_risk)
    # risky stock (risk=5)  -> penalty=95 -> high risk -> high_risk
    safe = _components(risk=95.0)
    risky = _components(risk=5.0)
    score_safe = opportunity_score(safe, BALANCED_PROFILE)
    score_risky = opportunity_score(risky, BALANCED_PROFILE)
    assert classification(score_safe, 100 - 95) == "opportunity"
    assert classification(score_risky, 100 - 5) == "high_risk"
    # the safe stock's high risk component lifts its composite (>= a medium stock)
    assert score_safe > score_risky


def test_unknown_profile_key_rejected() -> None:
    with pytest.raises(ValueError):
        ScoringProfile("bad", {"technical": 100.0, "bogus": 5.0})


def test_nonpositive_weights_rejected() -> None:
    with pytest.raises(ValueError):
        ScoringProfile("zero", {"technical": 0.0, "ml": 0.0})
