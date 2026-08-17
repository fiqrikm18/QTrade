"""Train the CP3 baseline model on real data and register it.

Usage:
    python -m scripts.train_ml --horizon 5

Reads OHLCV for the active universe (yfinance), builds the labeled dataset
via the same feature engine as the scanner, runs walk-forward, saves the
artifact to models/, and writes the ml_models registry row.
"""

from __future__ import annotations

import argparse
import asyncio
import os
from datetime import date, timedelta

import polars as pl

from app.application.services.features import (
    FEATURE_VERSION,
    build_technical_features,
)
from app.application.services.ml_trainer import (
    run_walk_forward,
    save_model_artifact,
)
from app.config.settings import get_settings
from app.domain.ml.dataset import (
    build_labeled_dataset,
    cross_sectional_threshold,
)
from app.infrastructure.database.models import MLModel
from app.infrastructure.database.session import get_session
from app.infrastructure.repositories.market_data_repo import (
    MarketDataRepository,
)
from app.infrastructure.repositories.stock_repo import StockRepository

LOOKBACK = 400


async def main(horizon: int) -> None:
    settings = get_settings()
    os.makedirs(settings.models_dir, exist_ok=True)
    async for session in get_session():
        universe = await StockRepository(session).load_active_universe()
        tickers = [s.ticker for s in universe][:50]
        end = date.today()
        start = end - timedelta(days=LOOKBACK)
        repo = MarketDataRepository(session)
        raw, _present = await repo.load_ohlcv([f"{t}.JK" for t in tickers], start, end)
        if not raw:
            raise SystemExit("no OHLCV data")
        frame = pl.DataFrame(raw)
        if "ticker" in frame.columns:
            frame = frame.with_columns(pl.col("ticker").str.replace(r"\.JK$", ""))
        features = build_technical_features(frame)
        closes = frame.select("ticker", "trade_date", "close")
        labeled = cross_sectional_threshold(
            build_labeled_dataset(features, closes, horizon=horizon)
        )
        labeled = labeled.filter(pl.col("label_class").is_not_null())
        if labeled.height < 500:
            raise SystemExit(f"too few labeled rows: {labeled.height}")
        result = run_walk_forward(
            labeled, horizon=horizon, feature_version=FEATURE_VERSION
        )
        path = f"{settings.models_dir}/lr_up_h{horizon}_v1.joblib"
        save_model_artifact(result, path)
        row = MLModel(
            model_name="lr_up",
            model_version="v1",
            target="up",
            horizon=horizon,
            feature_version=FEATURE_VERSION,
            features_hash=result.features_hash,
            training_start=result.training_start,
            training_end=result.training_end,
            metrics=dict(result.metrics),
            artifact_path=path,
            status="staging",
        )
        session.add(row)
        await session.commit()
        print(f"trained lr_up_h{horizon}_v1 ic={result.metrics.get('ic')}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--horizon", type=int, default=5)
    args = parser.parse_args()
    asyncio.run(main(args.horizon))
