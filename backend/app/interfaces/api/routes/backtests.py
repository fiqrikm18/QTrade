"""Backtest API routes."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.backtest_service import run_and_persist
from app.domain.backtest.engine import CostParams, SizingParams
from app.infrastructure.database.models import Backtest, BacktestTrade
from app.infrastructure.database.session import get_session

router = APIRouter()


class BacktestRunRequest(BaseModel):
    strategy: dict[str, object]
    universe: dict[str, object]
    start: date
    end: date
    scoring_version: str = "v1"
    model_version: str | None = None
    buy_fee: float = 0.0015
    sell_fee: float = 0.0025
    top_n: int = 5
    max_weight: float = 0.2
    seed: int = 42


@router.post("/run", response_model=dict[str, object])
async def run_backtest_route(
    req: BacktestRunRequest = Body(...),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Run a backtest against score/prediction history."""
    try:
        bt_id = await run_and_persist(
            session,
            strategy=req.strategy,
            universe=req.universe,
            start=req.start,
            end=req.end,
            scoring_version=req.scoring_version,
            model_version=req.model_version,
            costs=CostParams(buy_fee=req.buy_fee, sell_fee=req.sell_fee),
            sizing=SizingParams(top_n=req.top_n, max_weight=req.max_weight),
            seed=req.seed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    row = (
        await session.execute(select(Backtest).where(Backtest.id == bt_id))
    ).scalar_one()
    return {"backtest_id": bt_id, "metrics": row.metrics or {}}


@router.get("/{backtest_id}", response_model=dict[str, object])
async def get_backtest(
    backtest_id: int,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    row = (
        await session.execute(select(Backtest).where(Backtest.id == backtest_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="backtest not found")
    trades = (
        (
            await session.execute(
                select(BacktestTrade)
                .where(BacktestTrade.backtest_id == backtest_id)
                .order_by(BacktestTrade.entry_date)
            )
        )
        .scalars()
        .all()
    )
    return {
        "strategy": row.strategy or {},
        "universe": row.universe or {},
        "start": row.start.isoformat(),
        "end": row.end.isoformat(),
        "metrics": row.metrics or {},
        "bias_audit": row.bias_audit or {},
        "trades": [
            {
                "ticker": t.ticker,
                "entry_date": t.entry_date.isoformat(),
                "exit_date": t.exit_date.isoformat(),
                "entry_price": float(t.entry_price)
                if t.entry_price is not None
                else None,
                "exit_price": float(t.exit_price) if t.exit_price is not None else None,
                "shares": int(t.shares) if t.shares is not None else None,
                "pnl": float(t.pnl) if t.pnl is not None else None,
                "fees": float(t.fees) if t.fees is not None else None,
                "slippage": float(t.slippage) if t.slippage is not None else None,
                "exit_reason": t.exit_reason,
            }
            for t in trades
        ],
    }
