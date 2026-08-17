"""ML inference + ml_score formula (docs/ml.md §6)."""

import polars as pl
import pytest_asyncio
from sqlalchemy import delete

from app.application.services.ml_inference import compute_ml_score, predict_frame
from app.domain.ml.dataset import FEATURE_COLUMNS
from app.infrastructure.database.models import MLPrediction, StockScore


@pytest_asyncio.fixture(loop_scope="session", autouse=True)
async def _clean(session):
    await session.execute(delete(StockScore))
    await session.execute(delete(MLPrediction))
    await session.commit()
    yield


def test_ml_score_formula_boundaries():
    assert compute_ml_score(0.5, 1.0) == 50.0
    assert compute_ml_score(0.75, 1.0) == 75.0
    assert compute_ml_score(0.25, 1.0) == 25.0
    assert compute_ml_score(1.0, 0.5) == 75.0  # 50+50*1 = 100 * (0.5+0.25=0.75) = 75
    assert compute_ml_score(0.9, 0.8) == 81.0  # base 50+50*0.8=90 * 0.9 = 81


def test_predict_frame_adds_columns():
    class _DummyCalibrator:
        def predict_proba(self, x):
            import numpy as np

            n = len(x)
            return np.column_stack([np.full(n, 0.4), np.full(n, 0.6)])

    blob = {
        "calibrator": _DummyCalibrator(),
        "feature_columns": FEATURE_COLUMNS,
        "features_hash": "abc",
    }
    frame = pl.DataFrame(
        {
            "ticker": ["A", "B"],
            "asof_date": ["2024-03-01", "2024-03-01"],
            **{c: [1.0, 2.0] for c in FEATURE_COLUMNS},
        }
    )
    out = predict_frame(blob, frame)
    assert out["probability"].to_list() == [0.6, 0.6]
    assert out["prediction_class"].to_list() == ["up", "up"]
    assert out["ml_score"].to_list() == [48.0, 48.0]  # 60 * 0.8 (confidence 0.6)


async def test_scanner_ml_disabled_leaves_ml_score_none(session):
    """With ML_ENABLED=False, scanner leaves ml_score NULL and writes no predictions."""
    from app.application.services.scanner import run_market_scan
    from app.config.settings import get_settings
    from app.domain.scoring.opportunity import BALANCED_PROFILE

    settings = get_settings()
    assert settings.ml_enabled is False
    await run_market_scan(session, BALANCED_PROFILE, tickers=["BBCA", "BBRI"])
    from sqlalchemy import select

    from app.infrastructure.database.models import StockScore, MLPrediction

    scores = (await session.execute(select(StockScore))).scalars().all()
    for s in scores:
        assert s.ml_score is None
    preds = (await session.execute(select(MLPrediction))).scalars().all()
    assert len(preds) == 0
