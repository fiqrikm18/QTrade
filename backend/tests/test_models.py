from datetime import date
from decimal import Decimal

import pytest_asyncio
from sqlalchemy import delete

from app.infrastructure.database.base import AuditMixin  # noqa: F401
from app.infrastructure.database.models import (
    Backtest,
    BacktestTrade,
    MLModel,
    MLPrediction,
    OhlcvDaily,
    Stock,
)


@pytest_asyncio.fixture(loop_scope="session", autouse=True)
async def _clean(session):
    await session.execute(delete(BacktestTrade))
    await session.execute(delete(Backtest))
    await session.execute(delete(MLPrediction))
    await session.execute(delete(MLModel))
    await session.commit()
    yield


def test_audit_mixin_present():
    assert "created_at" in OhlcvDaily.__table__.columns
    assert "updated_at" in OhlcvDaily.__table__.columns


def test_ohlcv_unique_constraint():
    uq = {
        c.name
        for c in OhlcvDaily.__table__.constraints
        if getattr(c, "columns", None)
        and {col.name for col in c.columns} >= {"ticker", "trade_date"}
    }
    assert uq, "expected (ticker, trade_date) unique"


def test_stock_sector_fk():
    assert any(
        getattr(fk, "column", None) is not None and fk.parent.name == "sector_id"
        for fk in Stock.__table__.foreign_keys
    )


async def test_ml_model_roundtrip(session):
    from sqlalchemy import select

    from app.infrastructure.database.models import MLModel

    m = MLModel(
        model_name="lr_5d",
        model_version="v1",
        target="up",
        horizon=5,
        feature_version="v1",
        features_hash="abc123",
        training_start=date(2024, 1, 1),
        training_end=date(2024, 12, 31),
        metrics={"roc_auc": 0.55},
        artifact_path="models/lr_5d_v1.joblib",
        status="staging",
    )
    session.add(m)
    await session.flush()
    row = (await session.execute(select(MLModel))).scalars().one()
    assert row.model_name == "lr_5d"
    assert row.metrics == {"roc_auc": 0.55}


async def test_ml_prediction_append_only_fields(session):
    from app.infrastructure.database.models import MLPrediction

    p = MLPrediction(
        ticker="BBCA",
        asof_date=date(2024, 3, 1),
        model_name="lr_5d",
        model_version="v1",
        feature_version="v1",
        probability=Decimal("0.62"),
        expected_return=Decimal("0.015"),
        confidence=Decimal("0.55"),
        prediction_class="up",
    )
    session.add(p)
    await session.flush()
    assert p.id is not None


async def test_backtest_and_trades_roundtrip(session):
    from sqlalchemy import select

    from app.infrastructure.database.models import Backtest, BacktestTrade

    b = Backtest(
        strategy={"kind": "top_n", "n": 5},
        universe={"board": "MAIN_BOARD"},
        start=date(2024, 1, 1),
        end=date(2024, 12, 31),
        feature_version="v1",
        scoring_version="v1",
        model_version=None,
        metrics={"sharpe": 1.2},
        bias_audit={"fills_at_or_after_signal": True},
    )
    session.add(b)
    await session.flush()
    t = BacktestTrade(
        backtest_id=b.id,
        ticker="BBCA",
        entry_date=date(2024, 3, 1),
        exit_date=date(2024, 4, 1),
        entry_price=Decimal("6350.0"),
        exit_price=Decimal("6500.0"),
        shares=Decimal("100"),
        pnl=Decimal("150.0"),
        fees=Decimal("15.0"),
        slippage=Decimal("5.0"),
        exit_reason="signal",
    )
    session.add(t)
    await session.flush()
    rows = (await session.execute(select(BacktestTrade))).scalars().all()
    assert len(rows) == 1
    assert rows[0].backtest_id == b.id


def test_models_import_and_unique_constraints():
    from sqlalchemy import UniqueConstraint

    from app.infrastructure.database.models import (
        EconomicEvent,
        EconomicIndicator,
        IngestionCheckpoint,
        NewsArticle,
        NewsEntity,
        Portfolio,
        PortfolioPosition,
    )

    models = [
        EconomicIndicator,
        EconomicEvent,
        NewsArticle,
        NewsEntity,
        Portfolio,
        PortfolioPosition,
        IngestionCheckpoint,
    ]
    for model in models:
        assert model.__tablename__, f"{model.__name__} missing tablename"

    def uq_names(table) -> list[str]:
        return [c.name for c in table.constraints if isinstance(c, UniqueConstraint)]

    assert uq_names(EconomicIndicator.__table__) == ["uq_econ_indicator"]
    assert uq_names(EconomicEvent.__table__) == ["uq_econ_event"]
    assert uq_names(NewsArticle.__table__) == ["uq_news_source_url"]
    assert uq_names(PortfolioPosition.__table__) == ["uq_portfolio_position"]
    assert uq_names(IngestionCheckpoint.__table__) == ["uq_checkpoint_job"]
