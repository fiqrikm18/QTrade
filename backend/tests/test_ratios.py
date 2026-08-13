"""PIT-aware fundamental ratio engine (docs/fundamental-analysis.md §1-2).

Anti-look-ahead is enforced twice: ``latest_snapshot`` only ever returns a
statement whose ``available_at <= asof``, and ``calculate_ratios`` raises when
a snapshot's ``available_at > asof_date`` so misuse is impossible.
"""

from datetime import date

import pytest

from app.domain.fundamental.ratios import (
    FundamentalSnapshot,
    calculate_ratios,
    latest_snapshot,
    quarterly_from_cumulative,
)

_TAX_EST = 0.22


def _snap(items: dict[str, float], **kw) -> FundamentalSnapshot:
    defaults = dict(
        ticker="BBRI",
        asof_date=date(2024, 6, 30),
        available_at=date(2024, 6, 30),
        period_end=date(2024, 6, 30),
        is_annual=True,
    )
    defaults.update(kw)
    return FundamentalSnapshot(items=items, **defaults)


def test_per_roe_roic():
    snap = _snap(
        {
            "net_income": 100.0,
            "eps": 10.0,
            "equity": 500.0,
            "ebit": 150.0,
            "debt": 200.0,
            "cash": 50.0,
        }
    )
    r = calculate_ratios(snap, price=100.0, shares_outstanding=10.0)
    assert r.per == 10.0
    assert r.roe == pytest.approx(0.2)
    assert r.roic == pytest.approx(150.0 * (1.0 - _TAX_EST) / (500.0 + 200.0 - 50.0))


def test_division_by_zero_returns_none():
    snap = _snap({"net_income": 100.0, "equity": 0.0, "eps": 10.0})
    r = calculate_ratios(snap, price=100.0, shares_outstanding=10.0)
    assert r.roe is None
    assert r.debt_equity is None

    no_eps = _snap({"net_income": 100.0, "equity": 500.0})
    r2 = calculate_ratios(no_eps, price=100.0, shares_outstanding=10.0)
    assert r2.per is None
    assert r2.roe == pytest.approx(0.2)


def test_latest_snapshot_pit():
    t = date(2024, 6, 30)
    old = _snap({"net_income": 1.0}, available_at=date(2024, 4, 30))
    latest = _snap({"net_income": 2.0}, available_at=date(2024, 6, 29))
    future = _snap({"net_income": 3.0}, available_at=date(2024, 7, 1))
    assert latest_snapshot([future, old, latest], t) is latest


def test_latest_snapshot_none_when_only_future():
    t = date(2024, 6, 30)
    future = _snap({"net_income": 3.0}, available_at=date(2024, 7, 1))
    assert latest_snapshot([future], t) is None
    assert latest_snapshot([], t) is None


def test_latest_snapshot_excludes_future_asof():
    t = date(2024, 6, 30)
    future_eval = _snap(
        {"net_income": 5.0},
        asof_date=date(2024, 7, 1),
        available_at=date(2024, 5, 1),
    )
    assert latest_snapshot([future_eval], t) is None
    past_eval = _snap(
        {"net_income": 1.0},
        asof_date=date(2024, 1, 1),
        available_at=date(2024, 5, 1),
    )
    assert latest_snapshot([past_eval], t) is past_eval


def test_latest_snapshot_tie_breaks_period_end():
    t = date(2024, 6, 30)
    q1 = _snap(
        {"net_income": 1.0},
        available_at=date(2024, 4, 30),
        period_end=date(2024, 3, 31),
    )
    q2 = _snap(
        {"net_income": 2.0},
        available_at=date(2024, 4, 30),
        period_end=date(2024, 6, 30),
    )
    assert latest_snapshot([q1, q2], t) is q2


def test_future_snapshot_raises():
    snap = _snap(
        {"net_income": 100.0, "eps": 10.0},
        asof_date=date(2024, 6, 30),
        available_at=date(2024, 7, 15),
    )
    with pytest.raises(ValueError, match="available_at"):
        calculate_ratios(snap, price=100.0, shares_outstanding=10.0)


def test_quarterly_from_cumulative():
    assert quarterly_from_cumulative(100.0, 40.0) == 60.0
    assert quarterly_from_cumulative(100.0, None) is None
    assert quarterly_from_cumulative(100.0, 100.0) == 0.0


def test_shares_outstanding_item_overrides_param():
    snap = _snap({"revenue": 1000.0})
    r = calculate_ratios(snap, price=10.0, shares_outstanding=1.0)
    assert r.psr == 10.0 / 1000.0
    override = _snap({"revenue": 1000.0, "shares_outstanding": 100.0})
    r2 = calculate_ratios(override, price=10.0, shares_outstanding=1.0)
    assert r2.psr == 1000.0 / 1000.0
