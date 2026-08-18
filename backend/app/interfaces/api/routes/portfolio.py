"""Portfolio API routes.

``GET /api/v1/portfolio`` serves the curated seed portfolio
(``app/domain/reference_data``) until the portfolio account-linking feature
lands (``portfolios`` / ``portfolio_positions`` tables, docs/data-model.md §11).

Derived fields (market_value, pnl, weight) are computed server-side so the
payload is always internally consistent.
"""

from typing import Any

from fastapi import APIRouter

from app.domain.reference_data import PORTFOLIO_POSITIONS

router = APIRouter()


@router.get("", response_model=list[dict[str, Any]])
@router.get("/", response_model=list[dict[str, Any]], include_in_schema=False)
async def portfolio() -> list[dict[str, Any]]:
    """Get the user portfolio with derived pnl and weights (seed data)."""

    def as_float(position: dict[str, object], key: str) -> float:
        value = position[key]
        if isinstance(value, (int, float)):
            return float(value)
        raise TypeError(f"position field {key!r} must be numeric, got {type(value)}")

    rows: list[dict[str, Any]] = []
    total_value = 0.0
    for position in PORTFOLIO_POSITIONS:
        quantity = as_float(position, "quantity")
        avg_price = as_float(position, "avgPrice")
        current_price = as_float(position, "currentPrice")
        market_value = current_price * quantity
        cost_basis = avg_price * quantity
        pnl = market_value - cost_basis
        rows.append(
            {
                **position,
                "marketValue": round(market_value, 2),
                "pnl": round(pnl, 2),
                "pnlPct": round(pnl / cost_basis * 100, 2),
            }
        )
        total_value += market_value

    for row in rows:
        row["weight"] = round(float(row["marketValue"]) / total_value * 100, 2)
    return rows
