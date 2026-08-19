"""Fundamental data provider protocol (docs/data-pipeline.md §1)."""

from typing import Protocol, runtime_checkable


@runtime_checkable
class FundamentalDataProvider(Protocol):
    """Fetch the latest point-in-time fundamental snapshot for a ticker.

    Returns a dict with keys:
    - ``period_end``: date (ISO str)
    - ``reported_at``: date (ISO str)
    - ``items``: dict[str, float] using the canonical item keys consumed by
      ``app.domain.fundamental.ratios.calculate_ratios``
      (revenue, gross_profit, ebitda, ebit, net_income, eps, bvps,
      operating_cash_flow, free_cash_flow, total_assets, total_liabilities,
      equity, debt, cash, shares_outstanding, interest_expense,
      current_assets, current_liabilities, dividend_per_share).
    """

    def get_latest_fundamentals(self, ticker: str) -> dict[str, object]: ...
