"""Market API routes."""

from typing import Any

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


async def get_latest_regime(session: AsyncSession) -> dict[str, Any] | None:
    """Get latest market regime - returns None if table doesn't exist."""
    return None


async def get_latest_breadth(session: AsyncSession) -> dict[str, Any] | None:
    """Get latest market breadth - returns None if table doesn't exist."""
    return None


async def get_latest_sector_scores(session: AsyncSession) -> list[dict[str, Any]]:
    """Get latest sector scores - returns empty list if table doesn't exist."""
    return []


@router.get("/overview")
async def market_overview() -> dict[str, Any]:
    """Get market overview: regime, breadth, movers, rotation, macro."""
    return {
        "regime": {
            "regime": "NEUTRAL",
            "confidence": 0.0,
            "components": {},
            "asof": None,
        },
        "breadth": {
            "advance": 0,
            "decline": 0,
            "new_highs": 0,
            "new_lows": 0,
            "pct_above_sma20": 0,
            "pct_above_sma50": 0,
            "pct_above_sma200": 0,
            "rsi_breadth": 0,
            "volume_breadth": 0,
            "breakout_breadth": 0,
            "momentum_breadth": 0,
            "breadth_score": 0,
            "asof": None,
        },
        "top_gainers": [],
        "top_losers": [],
        "top_opportunities": [],
        "sector_rotation": [],
        "macro": {"risk": 0, "support": 0},
        "upcoming_events": [],
        "asof": None,
    }


@router.get("/regime")
async def market_regime() -> dict[str, Any]:
    """Get current market regime."""
    return {"regime": "NEUTRAL", "confidence": 0, "components": {}, "asof": None}


@router.get("/breadth")
async def market_breadth() -> dict[str, Any]:
    """Get market breadth indicators."""
    return {
        "advance": 0,
        "decline": 0,
        "new_highs": 0,
        "new_lows": 0,
        "pct_above_sma20": 0,
        "pct_above_sma50": 0,
        "pct_above_sma200": 0,
        "rsi_breadth": 0,
        "volume_breadth": 0,
        "breakout_breadth": 0,
        "momentum_breadth": 0,
        "breadth_score": 0,
        "asof": None,
    }


@router.get("/sectors")
async def sector_performance() -> list[dict[str, Any]]:
    """Get sector rotation data."""
    return []
