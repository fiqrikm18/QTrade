"""Fundamental scoring framework (docs/fundamental-analysis.md §3-4).

Percentile-rank sub-scores 0-100 vs sector + own-history benchmark; composite
per docs weights. Pure domain — no DB/network.
"""

import pytest

from app.domain.fundamental.ratios import RatioSet
from app.domain.fundamental.scoring import (
    FundamentalWeights,
    fundamental_score,
    percentile_rank,
)


def _rs(**kw) -> RatioSet:
    defaults = dict(
        per=15.0,
        pbv=1.5,
        psr=1.0,
        ev_ebitda=8.0,
        roe=0.1,
        roa=0.05,
        roic=0.08,
        npm=0.10,
        gpm=0.30,
        opm=0.15,
        debt_equity=0.5,
        current_ratio=1.5,
        interest_coverage=5.0,
        fcf_yield=0.05,
        dividend_yield=0.02,
    )
    defaults.update(kw)
    return RatioSet(**defaults)


def _peers() -> list[RatioSet]:
    return [
        _rs(roe=0.06, roic=0.04, npm=0.05, debt_equity=1.2, current_ratio=1.0,
            interest_coverage=2.0, per=12.0, pbv=1.3, fcf_yield=0.03),
        _rs(roe=0.08, roic=0.05, npm=0.07, debt_equity=1.0, current_ratio=1.1,
            interest_coverage=3.0, per=14.0, pbv=1.5, fcf_yield=0.04),
        _rs(roe=0.05, roic=0.03, npm=0.04, debt_equity=1.5, current_ratio=0.9,
            interest_coverage=1.5, per=11.0, pbv=1.2, fcf_yield=0.02),
        _rs(roe=0.09, roic=0.06, npm=0.08, debt_equity=0.8, current_ratio=1.3,
            interest_coverage=4.0, per=13.0, pbv=1.4, fcf_yield=0.05),
    ]


def test_high_quality_scores_high():
    good = _rs(
        roe=0.3, roic=0.2, npm=0.25, gpm=0.40, opm=0.25,
        debt_equity=0.2, current_ratio=2.0, interest_coverage=15.0,
        per=10.0, pbv=1.0, fcf_yield=0.08,
    )
    result = fundamental_score(good, _peers(), [])
    assert result["profitability_score"] > 70
    assert result["financial_health_score"] > 60
    assert result["quality_score"] > 60


def test_expensive_valuation_scores_low():
    good = _rs(
        roe=0.3, roic=0.2, npm=0.25, debt_equity=0.2, current_ratio=2.0,
        per=50.0, pbv=6.0, fcf_yield=0.01,
    )
    result = fundamental_score(good, _peers(), [])
    assert result["valuation_score"] < 40


def test_components_present():
    result = fundamental_score(_rs(), _peers(), [])
    for key in (
        "profitability_score", "growth_score", "financial_health_score",
        "valuation_score", "quality_score", "fundamental_score",
    ):
        assert key in result
    comps = result["score_components"]
    assert "profitability" in comps
    assert "growth" in comps
    assert "financial_health" in comps
    assert "valuation" in comps
    assert "quality" in comps


def test_composite_weighted():
    good = _rs(
        roe=0.3, roic=0.2, npm=0.25, debt_equity=0.2, current_ratio=2.0,
        per=10.0, pbv=1.0, fcf_yield=0.08,
    )
    result = fundamental_score(good, _peers(), [])
    expected = (
        0.30 * result["profitability_score"]
        + 0.25 * result["growth_score"]
        + 0.25 * result["financial_health_score"]
        + 0.20 * result["valuation_score"]
    )
    assert result["fundamental_score"] == pytest.approx(expected, abs=1e-6)
    subs = [
        result["profitability_score"], result["growth_score"],
        result["financial_health_score"], result["valuation_score"],
    ]
    assert min(subs) <= result["fundamental_score"] <= max(subs)


def test_none_handling():
    result = fundamental_score(RatioSet(), [RatioSet(), RatioSet(), RatioSet()], [])
    assert result["fundamental_score"] == 50.0
    for key in (
        "profitability_score", "growth_score", "financial_health_score",
        "valuation_score", "quality_score",
    ):
        assert result[key] == 50.0
    assert result["score_components"]["profitability"]["roe_pct"] is None


def test_configurable_weights():
    good = _rs(
        roe=0.3, roic=0.2, npm=0.25, debt_equity=0.2, current_ratio=2.0,
        per=50.0, pbv=6.0, fcf_yield=0.01,
    )
    base = fundamental_score(good, _peers(), [])
    value_tilt = fundamental_score(
        good, _peers(), [],
        weights=FundamentalWeights(profitability=0.15, growth=0.15,
                                   health=0.20, valuation=0.50),
    )
    assert value_tilt["fundamental_score"] < base["fundamental_score"]


def test_cheap_but_weak_quality_warns():
    cheap_weak = _rs(
        roe=0.02, roic=0.01, npm=-0.02, debt_equity=3.0, current_ratio=0.7,
        interest_coverage=0.5, per=8.0, pbv=0.5, fcf_yield=0.10,
    )
    peers = _peers()
    result = fundamental_score(cheap_weak, peers, [])
    note = result["score_components"]["valuation"]["note"]
    assert "value-trap" in str(note)
    assert result["quality_score"] < 30


def test_weights_must_sum_positive():
    with pytest.raises(ValueError):
        FundamentalWeights(0.0, 0.0, 0.0, 0.0)


def test_percentile_rank_extremes_and_ties():
    assert percentile_rank(1.0, [2.0, 3.0, 4.0]) == 0.0
    assert percentile_rank(4.0, [2.0, 3.0, 4.0]) == 100.0
    assert percentile_rank(2.5, [2.0, 3.0, 4.0]) == pytest.approx(100.0 / 3.0)
    assert percentile_rank(3.0, [3.0, 3.0, 3.0]) == 50.0
    assert percentile_rank(1.0, [None, None]) is None
    assert percentile_rank(None, [1.0, 2.0]) is None
    assert percentile_rank(1.0, []) is None
