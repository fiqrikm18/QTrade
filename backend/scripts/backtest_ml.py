"""Backtest the deployed ML model's stored predictions.

Usage:
    python -m scripts.backtest_ml
        --start 2024-01-01 --end 2026-08-14
        --model lr_up --version v1

Uses only append-only ``ml_predictions`` (no retraining inside the window).
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import date

from app.application.services.backtest_service import run_and_persist
from app.domain.backtest.engine import CostParams, SizingParams
from app.infrastructure.database.session import get_session


async def main(start: date, end: date, model_name: str, version: str) -> None:
    async for session in get_session():
        bt_id = await run_and_persist(
            session,
            strategy={"kind": "top_n", "n": 5},
            universe={},
            start=start,
            end=end,
            scoring_version="v1",
            model_version=version,
            costs=CostParams(),
            sizing=SizingParams(top_n=5),
            seed=42,
        )
        print(f"backtest {bt_id} done (model {model_name} {version})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=date.fromisoformat, required=True)
    parser.add_argument("--end", type=date.fromisoformat, required=True)
    parser.add_argument("--model", default="lr_up")
    parser.add_argument("--version", default="v1")
    args = parser.parse_args()
    asyncio.run(main(args.start, args.end, args.model, args.version))
