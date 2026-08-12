"""PIT-aware fundamental ratio engine (docs/fundamental-analysis.md §1-2).

Pure math over a statement snapshot — no DB, no network. Look-ahead is
impossible by construction:

- ``latest_snapshot`` only ever returns statements with
  ``available_at <= asof`` and ``asof_date <= asof`` (anti-look-ahead gate,
  docs/data-pipeline.md §6).
- ``calculate_ratios`` raises when ``available_at > asof_date``.

Units: statement values in IDR, ratios dimensionless/times. Percentages are
left 0-1 (the scoring layer formats). Values are NOT ttm-normalized here:
the caller must pass single-period items (see ``quarterly_from_cumulative``
for IDX cumulative-quarterly statements, docs/fundamental-analysis.md §1).
ponytail: ttm rollup belongs in the application/pipeline layer once a
statement store exists.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

TAX_EST = 0.22

# Items expected on FundamentalSnapshot.items (all floats).
# Revenue/cash-flow items are single-period; ratios assume they are on the
# same basis (single quarter OR annual) — never mixed (docs §1).
ITEM_KEYS = (
    "revenue",
    "gross_profit",
    "ebitda",
    "ebit",
    "net_income",
    "eps",
    "bvps",
    "operating_cash_flow",
    "free_cash_flow",
    "total_assets",
    "total_liabilities",
    "equity",
    "debt",
    "cash",
    "shares_outstanding",
    "interest_expense",
    "current_assets",
    "current_liabilities",
    "dividend_per_share",
)


@dataclass(frozen=True)
class FundamentalSnapshot:
    """A point-in-time financial statement as it looked at ``asof_date``.

    ``available_at`` is the gate (docs/quant-finance-rules §1): the statement
    becomes usable at that instant. ``asof_date`` is the trade date the
    snapshot is evaluated at in a backtest. ``is_annual`` distinguishes
    annual vs cumulative-quarterly IDX statements (docs §1).
    """

    ticker: str
    asof_date: date
    available_at: date
    period_end: date
    is_annual: bool
    items: dict[str, float] = field(default_factory=dict[str, float])


@dataclass(frozen=True)
class RatioSet:
    """Ratios per docs/fundamental-analysis.md §2. None = uncomputable."""

    per: float | None = None
    pbv: float | None = None
    psr: float | None = None
    ev_ebitda: float | None = None
    roe: float | None = None
    roa: float | None = None
    roic: float | None = None
    npm: float | None = None
    gpm: float | None = None
    opm: float | None = None
    debt_equity: float | None = None
    current_ratio: float | None = None
    interest_coverage: float | None = None
    fcf_yield: float | None = None
    dividend_yield: float | None = None


def _safe_div(numerator: float, denominator: float) -> float | None:
    if denominator == 0:
        return None
    return numerator / denominator


def _get(items: dict[str, float], key: str) -> float | None:
    return items.get(key)


def quarterly_from_cumulative(curr: float | None, prev: float | None) -> float | None:
    """Single-quarter value from cumulative IDX statements (docs §1).

    IDX issuers report year-to-date cumulative figures; the current period's
    value is ``curr - prev``. ``prev`` is None for the year's first report
    (nothing to subtract yet) and for annual statements (already single-period).
    """
    if curr is None or prev is None:
        return None
    return curr - prev


def _market_cap(
    items: dict[str, float], price: float, shares: float | None
) -> float | None:
    so = _get(items, "shares_outstanding")
    if so is None:
        so = shares
    if so is None:
        return None
    return price * so


def calculate_ratios(
    snapshot: FundamentalSnapshot,
    price: float,
    shares_outstanding: float | None = None,
) -> RatioSet:
    """Compute the docs §2 ratio set from a single statement snapshot.

    Pure math; never touches a store. Raises ``ValueError`` if the snapshot is
    not yet usable at its own ``asof_date`` (``available_at > asof_date``).
    Every denominator-zero or missing-item case yields None, never an exception.
    """
    if snapshot.available_at > snapshot.asof_date:
        raise ValueError(
            f"snapshot not available at asof_date {snapshot.asof_date}: "
            f"available_at {snapshot.available_at} > asof_date"
        )
    items = snapshot.items
    mcap = _market_cap(items, price, shares_outstanding)

    eps = _get(items, "eps")
    bvps = _get(items, "bvps")
    revenue = _get(items, "revenue")
    gross_profit = _get(items, "gross_profit")
    ebitda = _get(items, "ebitda")
    ebit = _get(items, "ebit")
    net_income = _get(items, "net_income")
    equity = _get(items, "equity")
    total_assets = _get(items, "total_assets")
    debt = _get(items, "debt")
    cash = _get(items, "cash")
    interest_expense = _get(items, "interest_expense")
    current_assets = _get(items, "current_assets")
    current_liabilities = _get(items, "current_liabilities")
    free_cash_flow = _get(items, "free_cash_flow")
    dividend_per_share = _get(items, "dividend_per_share")

    invested_capital = None
    if equity is not None and debt is not None and cash is not None:
        invested_capital = equity + debt - cash

    return RatioSet(
        per=_safe_div(price, eps) if eps is not None else None,
        pbv=_safe_div(price, bvps) if bvps is not None else None,
        psr=(
            _safe_div(mcap, revenue)
            if mcap is not None and revenue is not None
            else None
        ),
        ev_ebitda=(
            _safe_div(mcap + debt - cash, ebitda)
            if mcap is not None
            and debt is not None
            and cash is not None
            and ebitda is not None
            else None
        ),
        roe=(
            _safe_div(net_income, equity)
            if net_income is not None and equity is not None
            else None
        ),
        roa=_safe_div(net_income, total_assets)
        if net_income is not None and total_assets is not None
        else None,
        roic=_safe_div(ebit * (1.0 - TAX_EST), invested_capital)
        if ebit is not None and invested_capital is not None
        else None,
        npm=(
            _safe_div(net_income, revenue)
            if net_income is not None and revenue is not None
            else None
        ),
        gpm=(
            _safe_div(gross_profit, revenue)
            if gross_profit is not None and revenue is not None
            else None
        ),
        opm=(
            _safe_div(ebit, revenue)
            if ebit is not None and revenue is not None
            else None
        ),
        debt_equity=(
            _safe_div(debt, equity) if debt is not None and equity is not None else None
        ),
        current_ratio=_safe_div(current_assets, current_liabilities)
        if current_assets is not None and current_liabilities is not None
        else None,
        interest_coverage=_safe_div(ebit, interest_expense)
        if ebit is not None and interest_expense is not None
        else None,
        fcf_yield=(
            _safe_div(free_cash_flow, mcap)
            if free_cash_flow is not None and mcap is not None
            else None
        ),
        dividend_yield=(
            _safe_div(dividend_per_share, price)
            if dividend_per_share is not None
            else None
        ),
    )


def latest_snapshot(
    statements: list[FundamentalSnapshot], asof: date
) -> FundamentalSnapshot | None:
    """Anti-look-ahead selection (docs/fundamental-analysis.md §1).

    Among statements with ``available_at <= asof`` AND ``asof_date <= asof``,
    return the one with the latest ``available_at`` (tie-break: latest
    ``period_end``). Never returns a future statement; None when none qualify.
    """
    eligible = [s for s in statements if s.available_at <= asof and s.asof_date <= asof]
    if not eligible:
        return None
    return max(
        eligible,
        key=lambda s: (s.available_at, s.period_end, s.ticker),
    )
