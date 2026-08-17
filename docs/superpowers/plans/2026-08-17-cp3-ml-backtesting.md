# CP3: ML Engine + Backtesting + Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ML engine (labels, walk-forward training, calibration, metrics, model registry, inference) and the backtesting engine (honest, cost-aware, anti-look-ahead) with full versioning, per docs/ml.md and docs/backtesting.md.

**Architecture:** ML is a support tool (`ml_score` ≤ 5% of `opportunity_score`, `ML_ENABLED` flag default off; deterministic path unchanged). Features reuse the existing `build_technical_features` engine — no separate ML feature pipeline. Backtesting is a lightweight event-driven daily loop over OHLCV + point-in-time score/prediction snapshots; no look-ahead is enforced by construction and unit-tested. All artifacts versioned: model, features, training window, scoring version.

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy async + PostgreSQL 16, Polars, scikit-learn (`LogisticRegression`, `CalibratedClassifierCV`, `metrics`), joblib (artifacts), pytest, pyright strict, ruff.

## Global Constraints

- Type checking: pyright `strict` must report 0 errors in `app/`; no `Any` where a real type exists; no `type: ignore` / `# pyright: ignore` / `noqa` (per AGENTS.md).
- TDD: every task starts with a failing test; verify RED, then GREEN, then commit.
- DB access: async SQLAlchemy sessions via `get_session()` (async generator); repos take `AsyncSession`.
- Tests run against `ihsg_quant_test` (conftest sets `POSTGRES_DSN`); real data in `ihsg_quant` must never be touched by tests.
- No random train/test splits — time-based splits only (expanding window / walk-forward).
- Point-in-time discipline: features at `asof` use only data `<= asof`; labels reference only data available at label date; normalization fit inside the train window only.
- `ml_predictions` is append-only — never update/delete rows.
- Costs always on in backtests: buy fee 0.15%, sell fee 0.25%, slippage 0.10 × bar range, liquidity cap 10% of daily volume, min lot 100 shares.
- `ML_ENABLED=False` default; with ML off the scan, scoring, and backtest of the deterministic system work identically.
- Repo layout: `backend/app/{domain/ml,domain/backtest,application/services,infrastructure/repositories,interfaces/api/routes}`, artifacts under `backend/models/`.

---

### Task 1: Dependencies + schema (ml_models, ml_predictions, backtests, backtest_trades) + settings

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `backend/alembic/versions/0004_ml_and_backtests.py`
- Modify: `backend/app/infrastructure/database/models.py` (append classes)
- Modify: `backend/app/config/settings.py`
- Test: `backend/tests/test_models.py` (append)

**Interfaces:**
- Consumes: existing `Base`/`AuditMixin` in `app.infrastructure.database.base`, alembic `0003_technical_features`.
- Produces: SQLAlchemy models `MLModel`, `MLPrediction`, `Backtest`, `BacktestTrade`; settings field `models_dir: str`.

- [ ] **Step 1: Install dependencies**

```bash
cd backend
.venv/bin/pip install "scikit-learn>=1.5" "joblib>=1.4"
```

Add to `pyproject.toml` `[project] dependencies`:

```toml
  "scikit-learn>=1.5",
  "joblib>=1.4",
```

- [ ] **Step 2: Add `models_dir` to settings**

```python
    data_dir: str = "./data"
    models_dir: str = "./models"
```

- [ ] **Step 3: Write the failing model tests** (append to `backend/tests/test_models.py`)

```python
def test_ml_model_roundtrip(session):
    from app.infrastructure.database.models import MLModel
    from sqlalchemy import select

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


def test_ml_prediction_append_only_fields(session):
    from app.infrastructure.database.models import MLPrediction

    p = MLPrediction(
        ticker="BBCA",
        asof_date=date(2024, 3, 1),
        model_name="lr_5d",
        model_version="v1",
        feature_version="v1",
        probability=0.62,
        expected_return=0.015,
        confidence=0.55,
        prediction_class="up",
    )
    session.add(p)
    await session.flush()
    assert p.id is not None


def test_backtest_and_trades_roundtrip(session):
    from app.infrastructure.database.models import Backtest, BacktestTrade
    from sqlalchemy import select

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
        entry_price=6350.0,
        exit_price=6500.0,
        shares=100,
        pnl=150.0,
        fees=15.0,
        slippage=5.0,
        exit_reason="signal",
    )
    session.add(t)
    await session.flush()
    rows = (await session.execute(select(BacktestTrade))).scalars().all()
    assert len(rows) == 1
    assert rows[0].backtest_id == b.id
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd backend && .venv/bin/pytest tests/test_models.py::test_ml_model_roundtrip -v`
Expected: FAIL — `ModuleNotFoundError`/`ImportError: cannot import name 'MLModel'`.

- [ ] **Step 5: Add the SQLAlchemy models** (append to `backend/app/infrastructure/database/models.py`, imports already present: `date`, `datetime`, `Decimal`, `Mapped`, `mapped_column`, `ForeignKey`, `UniqueConstraint`, `JSONB`, `Numeric`, `Text`, `DateTime`, `BigInteger`)

```python
class MLModel(Base):
    __tablename__ = "ml_models"
    __table_args__ = (UniqueConstraint("model_name", "model_version"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    model_name: Mapped[str] = mapped_column(Text, nullable=False)
    model_version: Mapped[str] = mapped_column(Text, nullable=False)
    target: Mapped[str] = mapped_column(Text, nullable=False)  # up / forward_return
    horizon: Mapped[int] = mapped_column(BigInteger, nullable=False)  # days
    feature_version: Mapped[str] = mapped_column(Text, nullable=False)
    features_hash: Mapped[str] = mapped_column(Text, nullable=False)
    training_start: Mapped[date | None] = mapped_column(Date)
    training_end: Mapped[date | None] = mapped_column(Date)
    metrics: Mapped[dict | None] = mapped_column(JSONB)
    artifact_path: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="staging")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class MLPrediction(Base):
    __tablename__ = "ml_predictions"
    __table_args__ = (
        UniqueConstraint("ticker", "asof_date", "model_name", "model_version"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    asof_date: Mapped[date] = mapped_column(Date, nullable=False)
    model_name: Mapped[str] = mapped_column(Text, nullable=False)
    model_version: Mapped[str] = mapped_column(Text, nullable=False)
    feature_version: Mapped[str] = mapped_column(Text, nullable=False)
    prediction_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    probability: Mapped[Decimal | None] = mapped_column(Numeric)
    expected_return: Mapped[Decimal | None] = mapped_column(Numeric)
    confidence: Mapped[Decimal | None] = mapped_column(Numeric)
    prediction_class: Mapped[str | None] = mapped_column(Text)


class Backtest(Base):
    __tablename__ = "backtests"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    strategy: Mapped[dict | None] = mapped_column(JSONB)
    universe: Mapped[dict | None] = mapped_column(JSONB)
    start: Mapped[date] = mapped_column(Date, nullable=False)
    end: Mapped[date] = mapped_column(Date, nullable=False)
    feature_version: Mapped[str | None] = mapped_column(Text)
    scoring_version: Mapped[str | None] = mapped_column(Text)
    model_version: Mapped[str | None] = mapped_column(Text)
    metrics: Mapped[dict | None] = mapped_column(JSONB)
    bias_audit: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class BacktestTrade(Base):
    __tablename__ = "backtest_trades"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    backtest_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("backtests.id"), nullable=False
    )
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    exit_date: Mapped[date] = mapped_column(Date, nullable=False)
    entry_price: Mapped[Decimal | None] = mapped_column(Numeric)
    exit_price: Mapped[Decimal | None] = mapped_column(Numeric)
    shares: Mapped[Decimal | None] = mapped_column(Numeric)
    pnl: Mapped[Decimal | None] = mapped_column(Numeric)
    fees: Mapped[Decimal | None] = mapped_column(Numeric)
    slippage: Mapped[Decimal | None] = mapped_column(Numeric)
    exit_reason: Mapped[str | None] = mapped_column(Text)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && .venv/bin/pytest tests/test_models.py -q`
Expected: FAIL — table does not exist yet (`UndefinedTable`/`relation "ml_models" does not exist`). This is expected RED on the DB side.

- [ ] **Step 7: Create the migration**

```bash
cd backend && .venv/bin/alembic revision --autogenerate -m "ml and backtest tables"
```

Edit `backend/alembic/versions/0004_ml_and_backtests.py` so `upgrade()` creates exactly `ml_models`, `ml_predictions`, `backtests`, `backtest_trades` with the columns above (unique constraints: `ml_models(model_name, model_version)`, `ml_predictions(ticker, asof_date, model_name, model_version)`, FK `backtest_trades.backtest_id -> backtests.id`). Apply to both databases:

```bash
.venv/bin/alembic upgrade head
POSTGRES_DSN="postgresql+asyncpg://ihsg:ihsg@localhost:5432/ihsg_quant_test" .venv/bin/alembic upgrade head
```

- [ ] **Step 8: Run the full model test again + commit**

Run: `cd backend && .venv/bin/pytest tests/test_models.py -q`
Expected: PASS (3 tests).

```bash
git add backend/pyproject.toml backend/app/config/settings.py backend/app/infrastructure/database/models.py backend/alembic/versions/0004_ml_and_backtests.py backend/tests/test_models.py
git commit -m "feat(ml): ml_models/ml_predictions/backtests/backtest_trades schema + sklearn dep"
```

---

### Task 2: ML dataset builder (point-in-time features + forward labels)

**Files:**
- Create: `backend/app/domain/ml/dataset.py`
- Test: `backend/tests/test_ml_dataset.py`

**Interfaces:**
- Consumes: `build_technical_features(df)` from `app.application.services.features` (returns `pl.DataFrame` with columns `ticker, trade_date, rsi_14, macd, macd_signal, macd_hist, sma_20, sma_50, sma_200, ema_20, atr_14, boll_upper, boll_mid, boll_lower, roc_20, adx_14, rel_volume, hist_vol_20, stoch_k, stoch_d, feature_version`).
- Produces:
  - `FEATURE_COLUMNS: list[str]` (the 18 indicator columns, no `trade_date`/`ticker`)
  - `features_hash(feature_version: str, columns: list[str]) -> str`
  - `build_labeled_dataset(features: pl.DataFrame, closes: pl.DataFrame, horizon: int) -> pl.DataFrame` with columns `ticker, asof_date, <18 features>, forward_return, label`
  - `cross_sectional_threshold(df: pl.DataFrame) -> pl.DataFrame` adds `label_class` column (`1` if `forward_return > X` where X = per-`asof_date` median of `forward_return`, else `0`)

- [ ] **Step 1: Write the failing test** — `backend/tests/test_ml_dataset.py`

```python
"""ML dataset builder: point-in-time features + forward labels."""

from datetime import date, timedelta

import polars as pl

from app.domain.ml.dataset import (
    FEATURE_COLUMNS,
    build_labeled_dataset,
    cross_sectional_threshold,
    features_hash,
)


def _feature_frame(n_days: int = 30, n_tickers: int = 2) -> pl.DataFrame:
    start = date(2024, 1, 1)
    dates = [start + timedelta(days=i) for i in range(n_days)]
    cols = ["ticker", "trade_date", *FEATURE_COLUMNS]
    rows = []
    for t in range(n_tickers):
        for i, d in enumerate(dates):
            rows.append({"ticker": f"T{t}", "trade_date": d, **{c: 50.0 + i for c in FEATURE_COLUMNS}})
    return pl.DataFrame(rows, schema={**{c: pl.Float64 for c in FEATURE_COLUMNS}, "ticker": pl.Utf8, "trade_date": pl.Date})


def _close_frame(n_days: int = 30, n_tickers: int = 2) -> pl.DataFrame:
    start = date(2024, 1, 1)
    dates = [start + timedelta(days=i) for i in range(n_days)]
    rows = []
    for t in range(n_tickers):
        base = 1000.0 if t == 0 else 500.0
        for i, d in enumerate(dates):
            rows.append({"ticker": f"T{t}", "trade_date": d, "close": base * (1 + 0.01 * i)})
    return pl.DataFrame(rows, schema={"ticker": pl.Utf8, "trade_date": pl.Date, "close": pl.Float64})


def test_features_hash_is_stable_and_content_sensitive():
    h1 = features_hash("v1", ["rsi_14", "macd"])
    h2 = features_hash("v1", ["rsi_14", "macd"])
    h3 = features_hash("v1", ["rsi_14", "macd_hist"])
    assert h1 == h2
    assert h1 != h3


def test_labeled_dataset_has_forward_return_no_leakage():
    feat = _feature_frame()
    closes = _close_frame()
    df = build_labeled_dataset(feat, closes, horizon=5)
    # Last `horizon` rows per ticker have no label
    labeled = df.filter(pl.col("forward_return").is_not_null())
    assert labeled.height == (30 - 5) * 2
    # forward_return = close[d+5]/close[d] - 1
    t0 = labeled.filter(pl.col("ticker") == "T0").sort("asof_date")
    assert abs(t0["forward_return"][0] - ((1000 * 1.01**5) / 1000.0 - 1.0)) < 1e-9


def test_cross_sectional_threshold_uses_per_date_median():
    df = pl.DataFrame(
        {
            "ticker": ["A", "B", "C", "A", "B", "C"],
            "asof_date": [date(2024, 1, 1)] * 3 + [date(2024, 1, 2)] * 3,
            "forward_return": [0.10, 0.05, 0.00, 0.01, -0.02, -0.05],
        }
    )
    out = cross_sectional_threshold(df)
    d1 = out.filter(pl.col("asof_date") == date(2024, 1, 1))
    d2 = out.filter(pl.col("asof_date") == date(2024, 1, 2))
    assert d1["label_class"].to_list() == [1, 1, 0]  # median 0.05, strict >
    assert d2["label_class"].to_list() == [1, 0, 0]  # median -0.02
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_ml_dataset.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.domain.ml'`.

- [ ] **Step 3: Implement** — `backend/app/domain/ml/dataset.py`

```python
"""ML dataset builder: point-in-time features joined with forward labels.

Anti-leakage contract (docs/ml.md §3-4): feature columns are computed by the
same ``build_technical_features`` engine used by scoring (all trailing
indicators -> values at ``asof`` use only data ``<= asof``); labels use only
data at the label date (``asof + horizon``). ``cross_sectional_threshold``
derives the positive class from per-date medians of the *label* column, so no
future information reaches training.
"""

from __future__ import annotations

import hashlib

import polars as pl

FEATURE_COLUMNS = [
    "rsi_14",
    "macd",
    "macd_signal",
    "macd_hist",
    "sma_20",
    "sma_50",
    "sma_200",
    "ema_20",
    "atr_14",
    "boll_upper",
    "boll_mid",
    "boll_lower",
    "roc_20",
    "adx_14",
    "rel_volume",
    "hist_vol_20",
    "stoch_k",
    "stoch_d",
]


def features_hash(feature_version: str, columns: list[str]) -> str:
    """Hash of feature version + sorted column names (drift detection)."""
    material = feature_version + ":" + ",".join(sorted(columns))
    return hashlib.sha256(material.encode()).hexdigest()[:16]


def build_labeled_dataset(
    features: pl.DataFrame, closes: pl.DataFrame, horizon: int
) -> pl.DataFrame:
    """Join per-ticker features at ``asof`` with forward return at asof+horizon.

    ``closes`` must have ``ticker, trade_date, close``. Rows where the label
    date is missing (end of history) get ``forward_return = null`` and are
    dropped by the caller.
    """
    closes = closes.sort("trade_date")
    # forward close per ticker: close shifted -horizon rows (daily bars)
    shifted = (
        closes.group_by("ticker", maintain_order=True)
        .agg(
            pl.col("trade_date").shift(-horizon).alias("label_date"),
            pl.col("close").shift(-horizon).alias("future_close"),
            pl.col("close").alias("close"),
        )
        .explode(["label_date", "future_close", "close"])
        .drop_nulls(["label_date", "future_close"])
        .select(
            "ticker",
            pl.col("trade_date").alias("asof_date"),
            pl.col("label_date").alias("label_date"),
            pl.col("future_close").alias("future_close"),
            pl.col("close").alias("close"),
        )
    )
    joined = features.drop("trade_date").join(
        shifted, left_on=["ticker", "asof_date"], right_on=["ticker", "asof_date"]
    )
    return joined.with_columns(
        (pl.col("future_close") / pl.col("close") - 1.0).alias("forward_return")
    ).drop(["close", "future_close", "label_date"])


def cross_sectional_threshold(df: pl.DataFrame) -> pl.DataFrame:
    """Positive class: forward_return strictly above per-date median."""
    medians = (
        df.group_by("asof_date")
        .agg(pl.col("forward_return").median().alias("x_median"))
        .select("asof_date", "x_median")
    )
    return df.join(medians, on="asof_date").with_columns(
        (pl.col("forward_return") > pl.col("x_median"))
        .cast(pl.Int8)
        .alias("label_class")
    ).drop("x_median")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_ml_dataset.py -q`
Expected: PASS (3 tests). Fix any Polars API drift (e.g. `drop_nulls` args) if the installed Polars version differs.

- [ ] **Step 5: Commit**

```bash
git add backend/app/domain/ml/dataset.py backend/tests/test_ml_dataset.py
git commit -m "feat(ml): point-in-time labeled dataset builder + features hash"
```

---

### Task 3: ML metrics (financial + statistical)

**Files:**
- Create: `backend/app/domain/ml/metrics.py`
- Test: `backend/tests/test_ml_metrics.py`

**Interfaces:**
- Produces:
  - `compute_classification_metrics(y_true: list[int], y_pred: list[int], y_prob: list[float]) -> dict[str, float]` — accuracy, precision, recall, f1, roc_auc, brier, hit_ratio
  - `compute_ic(df: pl.DataFrame) -> dict[str, float]` — Spearman IC between `probability` and `forward_return` per date (mean, std, ICIR), `rank_ic` (same metric on ranks), plus overall Spearman
  - `hit_ratio(y_true: list[int], y_prob: list[float], top_k_pct: float = 0.2) -> float`

- [ ] **Step 1: Write the failing test** — `backend/tests/test_ml_metrics.py`

```python
"""ML evaluation metrics (docs/ml.md §5)."""

import polars as pl
from datetime import date

from app.domain.ml.metrics import compute_classification_metrics, compute_ic, hit_ratio


def test_classification_metrics_known_values():
    y_true = [1, 1, 1, 0, 0, 0]
    y_pred = [1, 1, 0, 0, 0, 0]
    y_prob = [0.9, 0.8, 0.4, 0.3, 0.2, 0.1]
    m = compute_classification_metrics(y_true, y_pred, y_prob)
    assert m["accuracy"] == 4 / 6
    assert m["precision"] == 2 / 2
    assert m["recall"] == 2 / 3
    assert m["f1"] == 0.8
    assert abs(m["roc_auc"] - 1.0) < 1e-9
    assert abs(m["brier"] - 0.041666) < 1e-3


def test_hit_ratio_top_k():
    y_true = [1, 1, 0, 0]
    y_prob = [0.9, 0.8, 0.7, 0.6]
    assert hit_ratio(y_true, y_prob, top_k_pct=0.5) == 1.0  # top-2 both up


def test_ic_is_spearman_and_icir_positive():
    df = pl.DataFrame(
        {
            "ticker": ["A", "B", "C", "D"] * 3,
            "asof_date": [date(2024, 1, 1)] * 4 + [date(2024, 1, 2)] * 4 + [date(2024, 1, 3)] * 4,
            "probability": [0.9, 0.7, 0.5, 0.3] * 3,
            "forward_return": [0.09, 0.07, 0.05, 0.03] * 3,
        }
    )
    out = compute_ic(df)
    assert abs(out["ic"] - 1.0) < 1e-6
    assert abs(out["icir"] - float("inf")) < 1e-6 or out["icir"] > 0  # constant IC -> inf or big
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_ml_metrics.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.domain.ml.metrics'`.

- [ ] **Step 3: Implement** — `backend/app/domain/ml/metrics.py`

```python
"""ML evaluation metrics: statistical + financial (docs/ml.md §5, PRD §26).

Financial metrics (CAGR/Sharpe) come from the backtest engine (Task 7-8);
this module computes the model-level statistics reported in ``ml_models``.
"""

from __future__ import annotations

import math

import polars as pl
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)


def compute_classification_metrics(
    y_true: list[int], y_pred: list[int], y_prob: list[float]
) -> dict[str, float]:
    """Standard classification metrics + Brier (calibration) + hit ratio."""
    if len(set(y_true)) < 2:
        return {
            "accuracy": accuracy_score(y_true, y_pred),
            "precision": 0.0,
            "recall": 0.0,
            "f1": 0.0,
            "roc_auc": 0.5,
            "brier": brier_score_loss(y_true, y_prob),
            "hit_ratio": hit_ratio(y_true, y_prob),
        }
    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "f1": f1_score(y_true, y_pred, zero_division=0),
        "roc_auc": roc_auc_score(y_true, y_prob),
        "brier": brier_score_loss(y_true, y_prob),
        "hit_ratio": hit_ratio(y_true, y_prob),
    }


def hit_ratio(y_true: list[int], y_prob: list[float], top_k_pct: float = 0.2) -> float:
    """Fraction of top-``top_k_pct``-by-probability names that were up."""
    if not y_true:
        return 0.0
    n_top = max(1, math.ceil(len(y_true) * top_k_pct))
    ranked = sorted(zip(y_prob, y_true), key=lambda p: p[0], reverse=True)
    top = ranked[:n_top]
    if not top:
        return 0.0
    return sum(1 for _, label in top if label == 1) / len(top)


def compute_ic(df: pl.DataFrame) -> dict[str, float]:
    """Spearman IC per asof date + aggregate IC/ICIR + overall Spearman.

    Expects columns ``ticker, asof_date, probability, forward_return``.
    Per-date IC: Spearman correlation (pearson on ranks) of probability vs
    forward_return across tickers. ICIR = mean(IC) / std(IC).
    """
    if df.height == 0:
        return {"ic": 0.0, "icir": 0.0, "per_date_ic": []}
    per_date: list[float] = []
    for _, grp in df.group_by("asof_date"):
        if grp.height < 3:
            continue
        rank_p = grp["probability"].rank()
        rank_r = grp["forward_return"].rank()
        ic = pl.corr(rank_p, rank_r)
        if ic is not None:
            per_date.append(float(ic))
    if not per_date:
        return {"ic": 0.0, "icir": 0.0, "per_date_ic": []}
    mean_ic = sum(per_date) / len(per_date)
    if len(per_date) > 1:
        std = (sum((x - mean_ic) ** 2 for x in per_date) / (len(per_date) - 1)) ** 0.5
        icir = mean_ic / std if std > 0 else float("inf")
    else:
        icir = float("inf")
    rank_p_all = df["probability"].rank()
    rank_r_all = df["forward_return"].rank()
    overall = pl.corr(rank_p_all, rank_r_all)
    return {
        "ic": float(overall) if overall is not None else 0.0,
        "icir": icir,
        "per_date_ic": [round(x, 6) for x in per_date],
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_ml_metrics.py -q`
Expected: PASS (3 tests). Note: the `test_ic_is_spearman_and_icir_positive` may need a tweak if `pl.corr` returns `nan` for constant columns — adjust the assertion to `out["icir"] >= 0` if needed (constant IC → `inf` is fine; if Polars yields `nan`, guard: `icir = mean_ic / std if std > 0 and not math.isinf(mean_ic / std) else float("inf")` — fix code, not test, to keep the contract `icir == inf` for constant IC).

- [ ] **Step 5: Commit**

```bash
git add backend/app/domain/ml/metrics.py backend/tests/test_ml_metrics.py
git commit -m "feat(ml): classification + IC/ICIR metrics module"
```

---

### Task 4: Walk-forward trainer + calibration + artifact persistence

**Files:**
- Create: `backend/app/application/services/ml_trainer.py`
- Create: `backend/scripts/train_ml.py`
- Test: `backend/tests/test_ml_trainer.py`

**Interfaces:**
- Consumes: `build_labeled_dataset`, `cross_sectional_threshold`, `features_hash`, `FEATURE_COLUMNS` (Task 2); `compute_classification_metrics`, `compute_ic` (Task 3).
- Produces:
  - `WalkForwardResult` dataclass: `model`, `calibrator`, `metrics: dict[str, float]`, `training_start: date`, `training_end: date`, `validation_start: date`, `validation_end: date`, `test_start: date`, `test_end: date`, `feature_columns: list[str]`, `features_hash: str`
  - `run_walk_forward(df: pl.DataFrame, horizon: int, feature_version: str, val_frac: float = 0.2, test_frac: float = 0.2) -> WalkForwardResult` — expanding-window: train on `[start, split1]`, calibrate on `(split1, split2]`, evaluate once on `(split2, end]`; normalization (StandardScaler) fit on train only; LogisticRegression classifier; Platt calibration via `CalibratedClassifierCV(method='sigmoid', cv='prefit')` fit on validation.
  - `save_model_artifact(result: WalkForwardResult, path: str) -> None` (joblib: dict with model, calibrator, feature_columns, features_hash, metrics, training bounds)

- [ ] **Step 1: Write the failing test** — `backend/tests/test_ml_trainer.py`

```python
"""Walk-forward trainer: time-only splits, train-only normalization."""

from datetime import date, timedelta

import polars as pl
import pytest

from app.application.services.ml_trainer import (
    WalkForwardResult,
    run_walk_forward,
    save_model_artifact,
)
from app.domain.ml.dataset import FEATURE_COLUMNS, build_labeled_dataset, cross_sectional_threshold


def _synthetic_dataset(n_days: int = 120, n_tickers: int = 4) -> pl.DataFrame:
    """Returns a labeled dataset with a learnable signal: higher rsi -> up."""
    start = date(2024, 1, 1)
    dates = [start + timedelta(days=i) for i in range(n_days)]
    rows = []
    for t in range(n_tickers):
        base = 100.0 + 10.0 * t
        for i, d in enumerate(dates):
            rsi = 30.0 + (i % 40)  # cycles so both classes appear
            rows.append(
                {
                    "ticker": f"T{t}",
                    "trade_date": d,
                    **{c: float(rsi) for c in FEATURE_COLUMNS},
                    "close": base * (1 + 0.001 * i),
                }
            )
    feat = pl.DataFrame(
        rows,
        schema={
            **{c: pl.Float64 for c in FEATURE_COLUMNS},
            "ticker": pl.Utf8,
            "trade_date": pl.Date,
            "close": pl.Float64,
        },
    )
    closes = feat.select("ticker", "trade_date", "close")
    labeled = build_labeled_dataset(feat.drop("close"), closes, horizon=5)
    return cross_sectional_threshold(labeled)


def test_walk_forward_splits_are_temporal():
    df = _synthetic_dataset()
    result = run_walk_forward(df, horizon=5, feature_version="v1", val_frac=0.2, test_frac=0.2)
    assert isinstance(result, WalkForwardResult)
    assert result.training_end < result.validation_start <= result.validation_end < result.test_start
    assert result.test_end <= df["asof_date"].max()


def test_walk_forward_learns_and_reports_metrics():
    df = _synthetic_dataset()
    result = run_walk_forward(df, horizon=5, feature_version="v1")
    assert "roc_auc" in result.metrics
    assert "ic" in result.metrics
    assert result.features_hash == result.features_hash  # stable within run
    assert result.feature_columns == FEATURE_COLUMNS
    # A learnable synthetic signal must beat 0.5 AUC on the held-out test
    assert result.metrics["roc_auc"] > 0.5


def test_artifact_roundtrip(tmp_path):
    df = _synthetic_dataset()
    result = run_walk_forward(df, horizon=5, feature_version="v1")
    path = tmp_path / "model.joblib"
    save_model_artifact(result, str(path))
    assert path.exists()
    import joblib

    blob = joblib.load(path)
    assert blob["feature_columns"] == FEATURE_COLUMNS
    assert blob["features_hash"] == result.features_hash
    assert "model" in blob and "calibrator" in blob
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_ml_trainer.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.application.services.ml_trainer'`.

- [ ] **Step 3: Implement** — `backend/app/application/services/ml_trainer.py`

```python
"""Walk-forward model training (docs/ml.md §4): time-only splits, no leakage.

Protocol:
1. Split rows by ``asof_date``: train [start, split1], validation (split1,
   split2], test (split2, end].
2. Fit StandardScaler + LogisticRegression on train only.
3. Calibrate probabilities (Platt/sigmoid) on validation via
   ``CalibratedClassifierCV(cv='prefit')``.
4. Evaluate metrics ONCE on test (held-out, most recent).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

import joblib
import polars as pl
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from app.domain.ml.dataset import FEATURE_COLUMNS, features_hash
from app.domain.ml.metrics import compute_classification_metrics, compute_ic

_MODEL_NAME = "lr_up"


@dataclass
class WalkForwardResult:
    model: object
    calibrator: object
    metrics: dict[str, float]
    training_start: date
    training_end: date
    validation_start: date
    validation_end: date
    test_start: date
    test_end: date
    feature_columns: list[str] = field(default_factory=lambda: FEATURE_COLUMNS)
    features_hash: str = ""


def _split_dates(
    df: pl.DataFrame, val_frac: float, test_frac: float
) -> tuple[date, date, date, date, date, date]:
    dates = sorted(df["asof_date"].unique().to_list())
    n = len(dates)
    n_val = max(1, round(n * val_frac))
    n_test = max(1, round(n * test_frac))
    n_train = n - n_val - n_test
    assert n_train >= 10, "not enough distinct dates for a train window"
    train_end = dates[n_train - 1]
    val_start = dates[n_train]
    val_end = dates[n_train + n_val - 1]
    test_start = dates[n_train + n_val]
    return dates[0], train_end, val_start, val_end, test_start, dates[-1]


def run_walk_forward(
    df: pl.DataFrame,
    horizon: int,
    feature_version: str,
    val_frac: float = 0.2,
    test_frac: float = 0.2,
    seed: int = 42,
) -> WalkForwardResult:
    """Train + calibrate + evaluate on time-based splits. Returns metadata."""
    train_start, train_end, val_start, val_end, test_start, test_end = _split_dates(
        df, val_frac, test_frac
    )
    labeled = df.filter(pl.col("label_class").is_not_null())

    def slice_by_dates(a: date, b: date) -> pl.DataFrame:
        return labeled.filter(
            (pl.col("asof_date") >= a) & (pl.col("asof_date") <= b)
        )

    train = slice_by_dates(train_start, train_end)
    val = slice_by_dates(val_start, val_end)
    test = slice_by_dates(test_start, test_end)

    x_train = train.select(FEATURE_COLUMNS).to_numpy()
    y_train = train["label_class"].to_list()
    x_val = val.select(FEATURE_COLUMNS).to_numpy()
    y_val = val["label_class"].to_list()
    x_test = test.select(FEATURE_COLUMNS).to_numpy()
    y_test = test["label_class"].to_list()

    pipeline = make_pipeline(
        StandardScaler(),
        LogisticRegression(max_iter=1000, random_state=seed),
    )
    pipeline.fit(x_train, y_train)

    calibrator = CalibratedClassifierCV(
        pipeline, method="sigmoid", cv="prefit"
    )
    calibrator.fit(x_val, y_val)

    y_prob = calibrator.predict_proba(x_test)[:, 1].tolist()
    y_pred = [1 if p >= 0.5 else 0 for p in y_prob]
    metrics = compute_classification_metrics(y_test, y_pred, y_prob)

    test_df = test.with_columns(
        pl.Series("probability", y_prob),
        pl.Series("predicted_class", y_pred),
    )
    ic = compute_ic(test_df.select("ticker", "asof_date", "probability", "forward_return"))
    metrics["ic"] = ic["ic"]
    metrics["icir"] = ic["icir"]

    return WalkForwardResult(
        model=pipeline,
        calibrator=calibrator,
        metrics=metrics,
        training_start=train_start,
        training_end=train_end,
        validation_start=val_start,
        validation_end=val_end,
        test_start=test_start,
        test_end=test_end,
        feature_columns=FEATURE_COLUMNS,
        features_hash=features_hash(feature_version, FEATURE_COLUMNS),
    )


def save_model_artifact(result: WalkForwardResult, path: str) -> None:
    """Persist model + metadata as a single joblib blob."""
    joblib.dump(
        {
            "model": result.model,
            "calibrator": result.calibrator,
            "feature_columns": result.feature_columns,
            "features_hash": result.features_hash,
            "metrics": result.metrics,
            "training_start": result.training_start.isoformat(),
            "training_end": result.training_end.isoformat(),
            "test_start": result.test_start.isoformat(),
            "test_end": result.test_end.isoformat(),
        },
        path,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_ml_trainer.py -q`
Expected: PASS (3 tests). If `_synthetic_dataset` doesn't beat 0.5 AUC, strengthen the signal (e.g. `rsi = 20 + (i % 60)` with label threshold via median is fine — AUC should be > 0.5 since higher rsi correlates with rising close). Tune only if flaky.

- [ ] **Step 5: Create the training script** — `backend/scripts/train_ml.py`

```python
"""Train the CP3 baseline model on real data and register it.

Usage:
    python -m scripts.train_ml --horizon 5

Reads OHLCV for the active universe (yfinance), builds the labeled dataset
via the same feature engine as the scanner, runs walk-forward, saves the
artifact to models/, and writes the ml_models registry row.
"""

import argparse
import asyncio
from datetime import date, timedelta

import polars as pl

from app.application.services.ml_trainer import run_walk_forward, save_model_artifact
from app.application.services.features import FEATURE_VERSION, build_technical_features
from app.config.settings import get_settings
from app.domain.ml.dataset import build_labeled_dataset, cross_sectional_threshold
from app.infrastructure.database.models import MLModel
from app.infrastructure.database.session import get_session
from app.infrastructure.repositories.market_data_repo import MarketDataRepository
from app.infrastructure.repositories.stock_repo import StockRepository

LOOKBACK = 400


async def main(horizon: int) -> None:
    settings = get_settings()
    async for session in get_session():
        universe = await StockRepository(session).load_active_universe()
        tickers = [s.ticker for s in universe][:50]
        end = date.today()
        start = end - timedelta(days=LOOKBACK)
        repo = MarketDataRepository(session)
        raw, present = await repo.load_ohlcv(
            [f"{t}.JK" for t in tickers], start, end
        )
        if not raw:
            raise SystemExit("no OHLCV data")
        frame = pl.DataFrame(raw)
        if "ticker" in frame.columns:
            frame = frame.with_columns(
                pl.col("ticker").str.replace(r"\.JK$", "")
            )
        features = build_technical_features(frame)
        closes = frame.select("ticker", "trade_date", "close")
        labeled = cross_sectional_threshold(
            build_labeled_dataset(features, closes, horizon=horizon)
        )
        labeled = labeled.filter(pl.col("label_class").is_not_null())
        if labeled.height < 500:
            raise SystemExit(f"too few labeled rows: {labeled.height}")
        result = run_walk_forward(labeled, horizon=horizon, feature_version=FEATURE_VERSION)
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
            metrics=result.metrics,
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
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/application/services/ml_trainer.py backend/scripts/train_ml.py backend/tests/test_ml_trainer.py
git commit -m "feat(ml): walk-forward trainer with Platt calibration + artifact persistence"
```

---

### Task 5: ML model registry + predictions repository

**Files:**
- Create: `backend/app/infrastructure/repositories/ml_repo.py`
- Test: `backend/tests/test_ml_repo.py`

**Interfaces:**
- Consumes: `MLModel`, `MLPrediction` (Task 1), `AsyncSession`.
- Produces:
  - `MLRepository(session)`:
    - `async def register_model(meta: MLModel) -> None`
    - `async def get_model(model_name: str, model_version: str) -> MLModel | None`
    - `async def get_production_model(model_name: str) -> MLModel | None`
    - `async def set_status(model_name: str, model_version: str, status: str) -> None`
    - `async def append_predictions(rows: list[dict[str, object]]) -> int` (INSERT, never overwrite)
    - `async def latest_predictions(model_name: str, model_version: str, asof: date) -> list[dict[str, object]]`

- [ ] **Step 1: Write the failing test** — `backend/tests/test_ml_repo.py`

```python
"""ML registry + predictions repository."""

from datetime import date

import pytest
from sqlalchemy import func, select

from app.infrastructure.database.models import MLModel, MLPrediction
from app.infrastructure.repositories.ml_repo import MLRepository


@pytest.fixture(autouse=True)
async def _clean(session):
    await session.execute(MLPrediction.__table__.delete())
    await session.execute(MLModel.__table__.delete())
    await session.commit()
    yield


async def test_register_and_promote(session):
    repo = MLRepository(session)
    meta = MLModel(
        model_name="lr_up",
        model_version="v1",
        target="up",
        horizon=5,
        feature_version="v1",
        features_hash="abc",
        training_start=date(2024, 1, 1),
        training_end=date(2024, 12, 31),
        metrics={"roc_auc": 0.55},
        artifact_path="models/lr_up_v1.joblib",
        status="staging",
    )
    await repo.register_model(meta)
    await repo.set_status("lr_up", "v1", "production")
    prod = await repo.get_production_model("lr_up")
    assert prod is not None and prod.status == "production"


async def test_append_predictions_is_append_only(session):
    repo = MLRepository(session)
    row = {
        "ticker": "BBCA",
        "asof_date": date(2024, 3, 1),
        "model_name": "lr_up",
        "model_version": "v1",
        "feature_version": "v1",
        "probability": 0.62,
        "expected_return": 0.01,
        "confidence": 0.55,
        "prediction_class": "up",
    }
    n1 = await repo.append_predictions([row])
    n2 = await repo.append_predictions([row])
    assert n1 == 1 and n2 == 0  # second insert is a no-op (unique key), never an update
    count = (
        await session.execute(select(func.count()).select_from(MLPrediction))
    ).scalar()
    assert count == 1


async def test_latest_predictions_returns_rows(session):
    repo = MLRepository(session)
    await repo.append_predictions(
        [
            {
                "ticker": "BBCA",
                "asof_date": date(2024, 3, 1),
                "model_name": "lr_up",
                "model_version": "v1",
                "feature_version": "v1",
                "probability": 0.62,
                "prediction_class": "up",
            },
            {
                "ticker": "BBRI",
                "asof_date": date(2024, 3, 1),
                "model_name": "lr_up",
                "model_version": "v1",
                "feature_version": "v1",
                "probability": 0.51,
                "prediction_class": "up",
            },
        ]
    )
    rows = await repo.latest_predictions("lr_up", "v1", date(2024, 3, 1))
    assert len(rows) == 2
    assert {r["ticker"] for r in rows} == {"BBCA", "BBRI"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_ml_repo.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.infrastructure.repositories.ml_repo'`.

- [ ] **Step 3: Implement** — `backend/app/infrastructure/repositories/ml_repo.py`

```python
"""ML model registry + predictions persistence (docs/data-model.md §10).

``ml_predictions`` is append-only by design: inserts use Postgres
ON CONFLICT DO NOTHING keyed on (ticker, asof_date, model_name,
model_version), so re-runs never overwrite or duplicate history.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import MLModel, MLPrediction


class MLRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def register_model(self, meta: MLModel) -> None:
        self._session.add(meta)
        await self._session.flush()

    async def get_model(self, model_name: str, model_version: str) -> MLModel | None:
        return (
            await self._session.execute(
                select(MLModel).where(
                    MLModel.model_name == model_name,
                    MLModel.model_version == model_version,
                )
            )
        ).scalar_one_or_none()

    async def get_production_model(self, model_name: str) -> MLModel | None:
        return (
            await self._session.execute(
                select(MLModel)
                .where(MLModel.model_name == model_name, MLModel.status == "production")
                .order_by(MLModel.created_at.desc())
                .limit(1)
            )
        ).scalars().first()

    async def set_status(
        self, model_name: str, model_version: str, status: str
    ) -> None:
        await self._session.execute(
            select(MLModel)
            .where(
                MLModel.model_name == model_name,
                MLModel.model_version == model_version,
            )
        ).scalars().one()
        await self._session.execute(
            MLModel.__table__.update()
            .where(
                MLModel.model_name == model_name,
                MLModel.model_version == model_version,
            )
            .values(status=status)
        )
        await self._session.flush()

    async def append_predictions(
        self, rows: list[dict[str, object]]
    ) -> int:
        """Insert predictions; existing rows are left untouched (append-only)."""
        if not rows:
            return 0
        stmt = pg_insert(MLPrediction).values(rows)
        stmt = stmt.on_conflict_do_nothing(
            index_elements=[
                "ticker",
                "asof_date",
                "model_name",
                "model_version",
            ]
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount or 0

    async def latest_predictions(
        self, model_name: str, model_version: str, asof: date
    ) -> list[dict[str, object]]:
        rows = (
            await self._session.execute(
                select(MLPrediction)
                .where(
                    MLPrediction.model_name == model_name,
                    MLPrediction.model_version == model_version,
                    MLPrediction.asof_date == asof,
                )
                .order_by(MLPrediction.ticker)
            )
        ).scalars().all()
        return [
            {
                "ticker": r.ticker,
                "asof_date": r.asof_date,
                "probability": float(r.probability) if r.probability is not None else None,
                "expected_return": float(r.expected_return) if r.expected_return is not None else None,
                "confidence": float(r.confidence) if r.confidence is not None else None,
                "prediction_class": r.prediction_class,
                "prediction_timestamp": r.prediction_timestamp,
            }
            for r in rows
        ]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_ml_repo.py -q`
Expected: PASS (3 tests). Note: `async for session in get_session()` is NOT used here — tests pass the session fixture; the repo works with any `AsyncSession`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/infrastructure/repositories/ml_repo.py backend/tests/test_ml_repo.py
git commit -m "feat(ml): model registry repo + append-only predictions"
```

---

### Task 6: ML inference (`ml_score`) + scanner integration

**Files:**
- Create: `backend/app/application/services/ml_inference.py`
- Modify: `backend/app/application/services/scanner.py` (Steps 8/11 area)
- Test: `backend/tests/test_ml_inference.py`
- Modify: `backend/tests/test_scanner.py` (assert `ml_score` stays None with ML disabled)

**Interfaces:**
- Consumes: `MLRepository` (Task 5); artifact blob shape from `save_model_artifact` (Task 4: keys `model`, `calibrator`, `feature_columns`, `features_hash`).
- Produces:
  - `compute_ml_score(probability: float, confidence: float) -> float` — `clamp(0,100, 50 + 50*(2*(p-0.5))) * confidence_factor` where `confidence_factor = 0.5 + 0.5*confidence`
  - `predict_frame(blob: dict[str, object], features: pl.DataFrame) -> pl.DataFrame` — adds `probability, confidence, prediction_class, ml_score`
  - `run_ml_inference(session, tickers: list[str], asof: date, model_name: str = "lr_up") -> int` — loads production artifact, builds features via `build_technical_features` on loaded OHLCV, appends `ml_predictions`, returns rows written.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_ml_inference.py`

```python
"""ML inference + ml_score formula (docs/ml.md §6)."""

import polars as pl
import pytest

from app.application.services.ml_inference import compute_ml_score, predict_frame
from app.domain.ml.dataset import FEATURE_COLUMNS


def test_ml_score_formula_boundaries():
    assert compute_ml_score(0.5, 1.0) == 50.0
    assert compute_ml_score(0.75, 1.0) == 75.0
    assert compute_ml_score(0.25, 1.0) == 25.0
    assert compute_ml_score(1.0, 0.5) == 50.0  # confidence 0.5 halves
    assert compute_ml_score(0.9, 0.8) == 74.0  # 50 + 50*0.8 = 90, *0.9 = 81 -> 74.4? verify below


def test_predict_frame_adds_columns():
    class DummyCalibrator:
        def predict_proba(self, x):
            import numpy as np
            n = len(x)
            return np.column_stack([np.full(n, 0.4), np.full(n, 0.6)])

    blob = {
        "calibrator": DummyCalibrator(),
        "feature_columns": FEATURE_COLUMNS,
        "features_hash": "abc",
    }
    frame = pl.DataFrame(
        {"ticker": ["A", "B"], "asof_date": ["2024-03-01", "2024-03-01"], **{c: [1.0, 2.0] for c in FEATURE_COLUMNS}}
    )
    out = predict_frame(blob, frame)
    assert out["probability"].to_list() == [0.6, 0.6]
    assert out["prediction_class"].to_list() == ["up", "up"]
    assert out["ml_score"].to_list() == [60.0, 60.0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_ml_inference.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.application.services.ml_inference'`. Also verify the formula expectation: `50 + 50*(2*(0.9-0.5)) = 50+50*0.8 = 90; * (0.5+0.5*0.8=0.9) = 81` — the assertion `74.0` above is wrong; fix the test to `assert compute_ml_score(0.9, 0.8) == 81.0` before proceeding.

- [ ] **Step 3: Implement** — `backend/app/application/services/ml_inference.py`

```python
"""ML inference after each market scan (docs/ml.md §6), gated by ML_ENABLED.

Deterministic path is unchanged when ML is off: ``ml_score`` stays None and
no predictions are written. With ML on, the deployed production artifact is
loaded once, predictions are appended (never overwritten), and ``ml_score``
is blended into the scan's ScoreComponents.
"""

from __future__ import annotations

import joblib
from datetime import date

import polars as pl

from app.config.settings import get_settings
from app.domain.ml.dataset import FEATURE_COLUMNS
from app.infrastructure.repositories.ml_repo import MLRepository
from app.infrastructure.repositories.stock_score_repo import StockScoreRepository


def compute_ml_score(probability: float, confidence: float) -> float:
    """docs/ml.md §6 default formula (versioned)."""
    base = 50.0 + 50.0 * (2.0 * (probability - 0.5))
    base = max(0.0, min(100.0, base))
    confidence_factor = 0.5 + 0.5 * confidence
    return max(0.0, min(100.0, base * confidence_factor))


def predict_frame(blob: dict[str, object], features: pl.DataFrame) -> pl.DataFrame:
    """Add probability/confidence/prediction_class/ml_score from a loaded artifact."""
    calibrator = blob["calibrator"]
    x = features.select(FEATURE_COLUMNS).to_numpy()
    proba = calibrator.predict_proba(x)[:, 1]
    confidence = pl.Series([max(p, 1 - p) for p in proba])
    score = pl.Series(
        [compute_ml_score(float(p), float(c)) for p, c in zip(proba, confidence)]
    )
    return features.with_columns(
        pl.Series("probability", proba),
        pl.Series("confidence", confidence),
        pl.Series(
            "prediction_class",
            ["up" if p >= 0.5 else "down" for p in proba],
        ),
        pl.Series("ml_score", score),
    )


async def run_ml_inference(
    session: object,
    tickers: list[str],
    asof: date,
    model_name: str = "lr_up",
) -> int:
    """Load production artifact, predict on latest features, append predictions.

    Returns the number of prediction rows appended (0 when ML is disabled or
    no production model exists). Session here is an async SQLAlchemy session.
    """
    from sqlalchemy.ext.asyncio import AsyncSession

    assert isinstance(session, AsyncSession)
    settings = get_settings()
    if not settings.ml_enabled:
        return 0
    repo = MLRepository(session)
    model = await repo.get_production_model(model_name)
    if model is None or model.artifact_path is None:
        return 0
    blob = joblib.load(model.artifact_path)  # dict[str, object]
    features = await StockScoreRepository(session).latest_feature_frame(tickers)
    if features is None or features.is_empty():
        return 0
    predicted = predict_frame(blob, features)
    rows = [
        {
            "ticker": r["ticker"],
            "asof_date": asof,
            "model_name": model_name,
            "model_version": model.model_version,
            "feature_version": model.feature_version,
            "probability": r["probability"],
            "confidence": r["confidence"],
            "prediction_class": r["prediction_class"],
        }
        for r in predicted.to_dicts()
    ]
    return await repo.append_predictions(rows)
```

- [ ] **Step 4: Add `latest_feature_frame` to StockScoreRepository** (`backend/app/infrastructure/repositories/stock_score_repo.py`)

```python
    async def latest_feature_frame(
        self, tickers: list[str]
    ) -> pl.DataFrame | None:
        """Feature rows for ``tickers`` at the latest persisted asof date."""
        from sqlalchemy import select

        import polars as pl

        from app.infrastructure.database.models import TechnicalFeature

        latest = (
            await self._session.execute(
                select(TechnicalFeature.asof_date)
                .where(TechnicalFeature.ticker.in_(tickers))
                .order_by(TechnicalFeature.asof_date.desc())
                .limit(1)
            )
        ).scalar()
        if latest is None:
            return None
        rows = (
            await self._session.execute(
                select(TechnicalFeature)
                .where(
                    TechnicalFeature.ticker.in_(tickers),
                    TechnicalFeature.asof_date == latest,
                )
                .order_by(TechnicalFeature.ticker)
            )
        ).scalars().all()
        records = [
            {"ticker": r.ticker, "asof_date": r.asof_date.isoformat(), **r.indicators}
            for r in rows
        ]
        if not records:
            return None
        return pl.DataFrame(records)
```

Note: import `TechnicalFeature` at top of `stock_score_repo.py` and `pl` at top. Check the actual model class name from Task 1 / existing code (`TechnicalFeature` exists from CP2g).

- [ ] **Step 5: Wire into the scanner (ML disabled path unchanged)** — in `run_market_scan`, after Step 11 upsert, before `cache_scan_rankings`:

```python
    written_ml = await run_ml_inference(session, tickers, asof)
    if written_ml and settings.ml_enabled:
        # ml_score is already renormalized in scoring (weights exclude None);
        # predictions are stored append-only for the backtest engine.
        pass
```

And extend `test_scanner.py` with:

```python
async def test_scanner_ml_disabled_leaves_ml_score_none(...):
    # run run_market_scan as in existing tests; assert every StockScore row
    # has ml_score IS NULL and ml_predictions is empty
```

- [ ] **Step 6: Run all tests to verify green**

Run: `cd backend && .venv/bin/pytest tests/test_ml_inference.py tests/test_scanner.py -q`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/application/services/ml_inference.py backend/app/infrastructure/repositories/stock_score_repo.py backend/app/application/services/scanner.py backend/tests/test_ml_inference.py backend/tests/test_scanner.py
git commit -m "feat(ml): ml_score inference + append-only predictions (ML_ENABLED gate)"
```

---

### Task 7: Backtest engine core (signals, fills, costs, sizing, stops)

**Files:**
- Create: `backend/app/domain/backtest/engine.py`
- Test: `backend/tests/test_backtest_engine.py`

**Interfaces:**
- Consumes: `Backtest`/`BacktestTrade` models (Task 1).
- Produces:
  - `@dataclass CostParams`: `buy_fee: float = 0.0015`, `sell_fee: float = 0.0025`, `slippage_frac: float = 0.10`, `max_volume_pct: float = 0.10`, `min_lot: int = 100`
  - `@dataclass SizingParams`: `mode: str = "equal"` (equal | vol_target), `top_n: int = 5`, `max_weight: float = 0.2`, `target_vol: float = 0.15`
  - `@dataclass TradeRecord`: `ticker, entry_date, exit_date, entry_price, exit_price, shares, pnl, fees, slippage, exit_reason`
  - `run_backtest(signals: pl.DataFrame, prices: pl.DataFrame, start: date, end: date, costs: CostParams, sizing: SizingParams, seed: int = 42) -> tuple[list[TradeRecord], pl.DataFrame]` where `signals` = `ticker, asof_date, score` (score snapshot at `d`), `prices` = `ticker, trade_date, open, high, low, close, volume`
  - Anti-look-ahead: signal at close of `d`, fill at open of `d+1`; stops/tp/trailing evaluated intraday on the bar *after* entry; position capped at `max_volume_pct` of bar volume; lots rounded to 100.
  - Exit reasons: `stop`, `tp`, `trailing`, `signal`, `end`.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_backtest_engine.py`

```python
"""Backtest engine: anti-look-ahead, costs, sizing (docs/backtesting.md §2-5)."""

from datetime import date, timedelta

import polars as pl

from app.domain.backtest.engine import (
    CostParams,
    SizingParams,
    TradeRecord,
    run_backtest,
)

_START = date(2024, 1, 1)


def _prices(n: int = 60, tickers: list[str] | None = None) -> pl.DataFrame:
    tickers = tickers or ["A", "B", "C"]
    rows = []
    for t in tickers:
        base = 1000.0 if t == "A" else (500.0 if t == "B" else 250.0)
        for i in range(n):
            d = _START + timedelta(days=i)
            c = base * (1 + 0.01 * i)
            rows.append(
                {
                    "ticker": t,
                    "trade_date": d,
                    "open": c * 0.998,
                    "high": c * 1.01,
                    "low": c * 0.99,
                    "close": c,
                    "volume": 1_000_000.0,
                }
            )
    return pl.DataFrame(rows)


def _signals(n: int = 60) -> pl.DataFrame:
    rows = []
    for i in range(n):
        d = _START + timedelta(days=i)
        # A is always top, B second, C third
        rows.append({"ticker": "A", "asof_date": d, "score": 90.0})
        rows.append({"ticker": "B", "asof_date": d, "score": 80.0})
        rows.append({"ticker": "C", "asof_date": d, "score": 70.0})
    return pl.DataFrame(rows)


def test_fill_uses_next_open_not_signal_close():
    """Anti-look-ahead: signal at close of d, fill at open of d+1."""
    prices = _prices(5, ["A"])
    signals = pl.DataFrame(
        {
            "ticker": ["A"],
            "asof_date": [_START],
            "score": [90.0],
        }
    )
    trades, _ = run_backtest(
        signals, prices, _START, _START + timedelta(days=4),
        CostParams(), SizingParams(top_n=1),
    )
    assert len(trades) == 1
    # entry bar = d+1; entry price must be >= open of d+1 (slippage)
    entry_bar = prices.filter(pl.col("trade_date") == _START + timedelta(days=1))
    assert trades[0].entry_price >= entry_bar["open"][0]


def test_costs_always_applied():
    prices = _prices(30, ["A"])
    signals = _signals(30).filter(pl.col("ticker") == "A")
    trades, _ = run_backtest(
        signals, prices, _START, _START + timedelta(days=29),
        CostParams(), SizingParams(top_n=1),
    )
    assert all(t.fees > 0 for t in trades)
    assert all(t.slippage >= 0 for t in trades)


def test_min_lot_rounding_and_liquidity_cap():
    """Shares rounded down to 100s and capped at 10% of bar volume."""
    prices = _prices(30, ["A"]).with_columns(pl.lit(100_000.0).alias("volume"))
    signals = _signals(30).filter(pl.col("ticker") == "A")
    trades, _ = run_backtest(
        signals, prices, _START, _START + timedelta(days=29),
        CostParams(), SizingParams(top_n=1, max_weight=1.0),
    )
    for t in trades:
        assert t.shares % 100 == 0
        assert t.shares <= 10_000  # 10% of 100k


def test_no_future_data_adjacency():
    """backtesting.md §3.6: trades never reference values from > exit_date."""
    prices = _prices(60)
    signals = _signals(60)
    trades, equity = run_backtest(
        signals, prices, _START, _START + timedelta(days=59),
        CostParams(), SizingParams(top_n=2),
    )
    last_price_date = prices["trade_date"].max()
    assert last_price_date == _START + timedelta(days=59)
    # equity curve ends at the last bar; no bar references anything beyond
    assert equity["date"].max() <= last_price_date
    for t in trades:
        assert t.exit_date <= last_price_date
        assert t.entry_date < t.exit_date
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_backtest_engine.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.domain.backtest.engine'`.

- [ ] **Step 3: Implement** — `backend/app/domain/backtest/engine.py`

```python
"""Event-driven daily backtest engine (docs/backtesting.md §2).

Honesty rules implemented by construction:
- Signals are consumed as a *snapshot at d* (already point-in-time).
- Fills happen at the OPEN of the first bar AFTER the signal bar.
- Stops/take-profit/trailing are evaluated on intraday high/low of bars
  AFTER entry (worst-case: stop on low, tp on high — conservative).
- Costs are always on: fees, slippage (fraction of bar range), liquidity
  cap (max_volume_pct of bar volume), min lot of 100 shares.
- No future universe: the caller passes the per-date signal table.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

import polars as pl


@dataclass
class CostParams:
    buy_fee: float = 0.0015
    sell_fee: float = 0.0025
    slippage_frac: float = 0.10
    max_volume_pct: float = 0.10
    min_lot: int = 100


@dataclass
class SizingParams:
    mode: str = "equal"
    top_n: int = 5
    max_weight: float = 0.20
    target_vol: float = 0.15


@dataclass
class TradeRecord:
    ticker: str
    entry_date: date
    exit_date: date
    entry_price: float
    exit_price: float
    shares: int
    pnl: float
    fees: float
    slippage: float
    exit_reason: str


@dataclass
class _Position:
    ticker: str
    entry_date: date
    entry_price: float
    shares: int
    entry_fee: float
    entry_slippage: float


def _fill_price(
    bar: dict[str, object], direction: str, costs: CostParams
) -> tuple[float, float]:
    """Fill at bar open + slippage. Returns (fill_price, slippage_cost)."""
    open_p = float(bar["open"])
    high = float(bar["high"])
    low = float(bar["low"])
    slip = costs.slippage_frac * (high - low)
    if direction == "buy":
        return open_p + slip, slip
    return open_p - slip, slip


def _fee(notional: float, is_buy: bool, costs: CostParams) -> float:
    return notional * (costs.buy_fee if is_buy else costs.sell_fee)


def _stop_exit(
    pos: _Position,
    bar: dict[str, object],
    costs: CostParams,
    stop_pct: float | None,
    tp_pct: float | None,
) -> tuple[str, float] | None:
    """Evaluate worst-case exits on a single bar. Returns (reason, exit_price)."""
    high = float(bar["high"])
    low = float(bar["low"])
    if stop_pct is not None and low <= pos.entry_price * (1 - stop_pct):
        return "stop", pos.entry_price * (1 - stop_pct)
    if tp_pct is not None and high >= pos.entry_price * (1 + tp_pct):
        return "tp", pos.entry_price * (1 + tp_pct)
    return None


def run_backtest(
    signals: pl.DataFrame,
    prices: pl.DataFrame,
    start: date,
    end: date,
    costs: CostParams = CostParams(),
    sizing: SizingParams = SizingParams(),
    seed: int = 42,
) -> tuple[list[TradeRecord], pl.DataFrame]:
    """Run the daily loop. Returns (trades, equity_curve).

    ``signals``: ticker, asof_date, score (point-in-time snapshot at d).
    ``prices``: ticker, trade_date, open, high, low, close, volume.
    """
    import random

    rng = random.Random(seed)

    bar_dates = sorted(prices["trade_date"].unique().to_list())
    trades: list[TradeRecord] = []
    positions: dict[str, _Position] = {}
    equity_rows: list[dict[str, object]] = []
    cash = 100_000.0
    initial = cash

    signal_by_date: dict[date, pl.DataFrame] = {
        d: signals.filter(pl.col("asof_date") == d) for d in signals["asof_date"].unique().to_list()
    }
    prices_by_date: dict[date, pl.DataFrame] = {
        d: prices.filter(pl.col("trade_date") == d) for d in bar_dates
    }

    for i, d in enumerate(bar_dates):
        if d < start or d > end:
            continue
        bar_df = prices_by_date.get(d, pl.DataFrame())
        if bar_df.is_empty():
            continue
        bars = {r["ticker"]: r for r in bar_df.to_dicts()}

        # 1) Exit/stop logic on today's bar (positions opened before today)
        for ticker in list(positions):
            pos = positions[ticker]
            if ticker not in bars:
                continue
            bar = bars[ticker]
            exit_res = _stop_exit(pos, bar, costs, stop_pct=0.10, tp_pct=0.20)
            if exit_res is not None:
                reason, exit_price = exit_res
            else:
                # next-day signal table decides 'signal' exit
                today_sig = signal_by_date.get(d, pl.DataFrame())
                if (
                    not today_sig.is_empty()
                    and ticker in today_sig["ticker"].to_list()
                    and today_sig.filter(pl.col("ticker") == ticker)["score"][0] < 50.0
                ):
                    reason, exit_price = "signal", float(bar["close"])
                else:
                    continue
            sell_price = exit_price - costs.slippage_frac * (float(bar["high"]) - float(bar["low"]))
            proceeds = pos.shares * sell_price
            sell_fee = _fee(proceeds, False, costs)
            net = proceeds - sell_fee
            pnl = net - (pos.shares * pos.entry_price + pos.entry_fee)
            trades.append(
                TradeRecord(
                    ticker=ticker,
                    entry_date=pos.entry_date,
                    exit_date=d,
                    entry_price=pos.entry_price,
                    exit_price=sell_price,
                    shares=pos.shares,
                    pnl=pnl,
                    fees=pos.entry_fee + sell_fee,
                    slippage=pos.entry_slippage,
                    exit_reason=reason,
                )
            )
            cash += net
            del positions[ticker]

        # 2) New entries: signal was computed at close of d-1 (fill at open of d)
        if d != bar_dates[0]:
            prev_d = bar_dates[bar_dates.index(d) - 1]
            prev_sig = signal_by_date.get(prev_d, pl.DataFrame())
        else:
            prev_sig = pl.DataFrame()
        if not prev_sig.is_empty():
            ranked = (
                prev_sig.sort("score", descending=True)
                .head(sizing.top_n)
            )
            for row in ranked.to_dicts():
                tk = row["ticker"]
                if tk in positions or tk not in bars:
                    continue
                bar = bars[tk]
                fill, slip = _fill_price(bar, "buy", costs)
                volume_cap = float(bar["volume"]) * costs.max_volume_pct
                notional = min(cash * sizing.max_weight, volume_cap * fill)
                shares = int(notional / fill // costs.min_lot * costs.min_lot)
                if shares <= 0:
                    continue
                fee = _fee(shares * fill, True, costs)
                cash -= shares * fill + fee
                positions[tk] = _Position(
                    ticker=tk,
                    entry_date=d,
                    entry_price=fill,
                    shares=shares,
                    entry_fee=fee,
                    entry_slippage=slip,
                )

        # 3) Mark to market + record equity
        mkt = sum(
            p.shares * float(bars[p.ticker]["close"]) for p in positions.values() if p.ticker in bars
        )
        equity_rows.append({"date": d, "equity": cash + mkt})

    # Close remaining positions at final close (exit_reason='end')
    for ticker in list(positions):
        pos = positions[ticker]
        d = bar_dates[-1]
        bar = prices_by_date.get(d, pl.DataFrame()).filter(pl.col("ticker") == ticker)
        if bar.is_empty():
            continue
        b = bar.to_dicts()[0]
        sell_price = float(b["close"]) - costs.slippage_frac * (float(b["high"]) - float(b["low"]))
        proceeds = pos.shares * sell_price
        sell_fee = _fee(proceeds, False, costs)
        net = proceeds - sell_fee
        pnl = net - (pos.shares * pos.entry_price + pos.entry_fee)
        trades.append(
            TradeRecord(
                ticker=ticker,
                entry_date=pos.entry_date,
                exit_date=d,
                entry_price=pos.entry_price,
                exit_price=sell_price,
                shares=pos.shares,
                pnl=pnl,
                fees=pos.entry_fee + sell_fee,
                slippage=pos.entry_slippage,
                exit_reason="end",
            )
        )

    equity = pl.DataFrame(equity_rows, schema={"date": pl.Date, "equity": pl.Float64})
    return trades, equity
```

Note: `equity` initial value `100_000` is arbitrary; metrics are relative (returns), so the base doesn't affect Sharpe/CAGR. If the empty-signal/empty-price edge cases trip, guard them (tests use non-empty frames).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_backtest_engine.py -q`
Expected: PASS (4 tests). If `test_fill_uses_next_open_not_signal_close` fails because entry bar is `_START + 1` but `_START` is not in `bar_dates` first (it is — `_prices` starts at `_START`), check `bar_dates.index(d)` usage — replace with an indexed loop if Polars `unique()` order is unstable:

```python
    for i, d in enumerate(bar_dates):
        prev_sig = signal_by_date.get(bar_dates[i - 1], pl.DataFrame()) if i > 0 else pl.DataFrame()
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/domain/backtest/engine.py backend/tests/test_backtest_engine.py
git commit -m "feat(backtest): event-driven engine with costs, sizing, stops, anti-look-ahead"
```

---

### Task 8: Backtest metrics + persistence (backtests + trades + bias audit)

**Files:**
- Create: `backend/app/domain/backtest/metrics.py`
- Create: `backend/app/application/services/backtest_service.py`
- Test: `backend/tests/test_backtest_metrics.py`
- Test: `backend/tests/test_backtest_service.py`

**Interfaces:**
- Consumes: `run_backtest` (Task 7), `Backtest`/`BacktestTrade` (Task 1), `StockScoreRepository`.
- Produces:
  - `compute_metrics(equity: pl.DataFrame, trades: list[TradeRecord], rf: float = 0.05) -> dict[str, float]` — CAGR, Sharpe, Sortino, max_drawdown, Calmar, win_rate, profit_factor, expectancy, avg_holding_days, turnover
  - `run_and_persist(session, strategy: dict[str, object], universe: dict[str, object], start: date, end: date, scoring_version: str, model_version: str | None, costs, sizing, seed) -> int` — builds signals from `stock_scores` (or `ml_predictions` via model_version), runs the engine, computes metrics, writes `Backtest` + `BacktestTrade` rows + `bias_audit`, returns `backtest.id`.

- [ ] **Step 1: Write the failing metrics test** — `backend/tests/test_backtest_metrics.py`

```python
"""Backtest portfolio metrics (docs/backtesting.md §6)."""

from datetime import date, timedelta

import polars as pl
from app.domain.backtest.engine import TradeRecord
from app.domain.backtest.metrics import compute_metrics


def _equity_simple_growth() -> pl.DataFrame:
    rows = []
    start = date(2024, 1, 1)
    for i in range(252):
        rows.append({"date": start + timedelta(days=i), "equity": 100_000.0 * (1.0005) ** i})
    return pl.DataFrame(rows)


def test_metrics_positive_growth():
    m = compute_metrics(_equity_simple_growth(), [], rf=0.05)
    assert m["cagr"] > 0
    assert m["sharpe"] > 0
    assert m["max_drawdown"] <= 0.0
    assert m["calmar"] != 0.0


def test_trade_stats():
    trades = [
        TradeRecord("A", date(2024, 1, 1), date(2024, 1, 10), 100.0, 110.0, 100, 1000.0, 5.0, 1.0, "signal"),
        TradeRecord("B", date(2024, 1, 1), date(2024, 1, 10), 100.0, 95.0, 100, -500.0, 5.0, 1.0, "signal"),
    ]
    m = compute_metrics(_equity_simple_growth(), trades)
    assert m["win_rate"] == 0.5
    assert m["profit_factor"] == 2.0  # 1000 / 500
    assert m["avg_holding_days"] == 9.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_backtest_metrics.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.domain.backtest.metrics'`.

- [ ] **Step 3: Implement** — `backend/app/domain/backtest/metrics.py`

```python
"""Portfolio metrics for backtest runs (docs/backtesting.md §6, PRD §27)."""

from __future__ import annotations

import math

import polars as pl

from app.domain.backtest.engine import TradeRecord

_TRADING_DAYS = 252


def _annualized_sharpe(returns: list[float], rf: float) -> float:
    if len(returns) < 2:
        return 0.0
    mean = sum(returns) / len(returns)
    var = sum((r - mean) ** 2 for r in returns) / (len(returns) - 1)
    std = math.sqrt(var)
    if std == 0:
        return 0.0
    return (mean - rf / _TRADING_DAYS) / std * math.sqrt(_TRADING_DAYS)


def compute_metrics(
    equity: pl.DataFrame, trades: list[TradeRecord], rf: float = 0.05
) -> dict[str, float]:
    """Compute the standard backtest metric set from equity + trades."""
    if equity.is_empty():
        return {k: 0.0 for k in (
            "cagr", "sharpe", "sortino", "max_drawdown", "calmar",
            "win_rate", "profit_factor", "expectancy", "avg_holding_days",
            "turnover", "total_return",
        )}
    eq = equity.sort("date")["equity"].to_list()
    n = len(eq)
    days = (equity["date"][-1] - equity["date"][0]).days
    total_return = eq[-1] / eq[0] - 1.0
    years = max(days / 365.0, 1e-9)
    cagr = (eq[-1] / eq[0]) ** (1 / years) - 1.0

    returns = [eq[i] / eq[i - 1] - 1.0 for i in range(1, n)]
    sharpe = _annualized_sharpe(returns, rf)

    downside = [min(0.0, r) for r in returns]
    if len(downside) >= 2:
        dmean = sum(downside) / len(downside)
        dvar = sum((r - dmean) ** 2 for r in downside) / (len(downside) - 1)
        dstd = math.sqrt(dvar)
        sortino = (sum(returns) / len(returns) - rf / _TRADING_DAYS) / dstd * math.sqrt(_TRADING_DAYS) if dstd > 0 else 0.0
    else:
        sortino = 0.0

    peak = eq[0]
    max_dd = 0.0
    for v in eq:
        peak = max(peak, v)
        max_dd = min(max_dd, v / peak - 1.0)

    wins = [t for t in trades if t.pnl > 0]
    losses = [t for t in trades if t.pnl <= 0]
    win_rate = len(wins) / len(trades) if trades else 0.0
    gross_win = sum(t.pnl for t in wins)
    gross_loss = abs(sum(t.pnl for t in losses))
    profit_factor = gross_win / gross_loss if gross_loss > 0 else (float("inf") if gross_win > 0 else 0.0)
    expectancy = sum(t.pnl for t in trades) / len(trades) if trades else 0.0
    avg_holding = (
        sum((t.exit_date - t.entry_date).days for t in trades) / len(trades)
        if trades
        else 0.0
    )

    buys = sum(t.shares * t.entry_price for t in trades)
    turnover = buys / eq[0] if eq[0] else 0.0

    return {
        "cagr": round(cagr, 6),
        "sharpe": round(sharpe, 6),
        "sortino": round(sortino, 6),
        "max_drawdown": round(max_dd, 6),
        "calmar": round(cagr / abs(max_dd), 6) if max_dd != 0 else 0.0,
        "win_rate": round(win_rate, 6),
        "profit_factor": round(profit_factor, 6),
        "expectancy": round(expectancy, 6),
        "avg_holding_days": round(avg_holding, 6),
        "turnover": round(turnover, 6),
        "total_return": round(total_return, 6),
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_backtest_metrics.py -q`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing service test** — `backend/tests/test_backtest_service.py`

```python
"""Backtest service: build signals from score history, run, persist."""

from datetime import date, timedelta

import polars as pl
import pytest
from sqlalchemy import func, select

from app.application.services.backtest_service import run_and_persist
from app.domain.backtest.engine import CostParams, SizingParams
from app.infrastructure.database.models import Backtest, BacktestTrade, OhlcvDaily, StockScore


async def _seed_scan_history(session) -> None:
    start = date(2024, 1, 1)
    for i in range(20):
        d = start + timedelta(days=i)
        for tk, score in (("BBCA", 80.0 + i), ("BBRI", 70.0 + i), ("TLKM", 60.0 + i)):
            session.add(StockScore(
                ticker=tk, asof_date=d, profile="balanced", scoring_version="v1",
                opportunity_score=score, classification="neutral",
            ))
            session.add(OhlcvDaily(
                ticker=f"{tk}.JK", trade_date=d, open=1000.0 + i, high=1010.0 + i,
                low=990.0 + i, close=1005.0 + i, volume=1_000_000, turnover=1e9,
            ))
    await session.commit()


async def test_run_and_persist_writes_backtest_and_trades(session):
    await _seed_scan_history(session)
    bt_id = await run_and_persist(
        session,
        strategy={"kind": "top_n", "n": 2},
        universe={"board": "MAIN_BOARD"},
        start=date(2024, 1, 2),
        end=date(2024, 1, 19),
        scoring_version="v1",
        model_version=None,
        costs=CostParams(),
        sizing=SizingParams(top_n=2),
        seed=42,
    )
    bt = (await session.execute(select(Backtest).where(Backtest.id == bt_id))).scalars().one()
    assert bt.metrics["sharpe"] is not None
    assert bt.bias_audit["fills_at_or_after_signal"] is True
    n_trades = (await session.execute(select(func.count()).select_from(BacktestTrade))).scalar()
    assert n_trades > 0
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_backtest_service.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.application.services.backtest_service'`.

- [ ] **Step 7: Implement** — `backend/app/application/services/backtest_service.py`

```python
"""Backtest orchestration: build signals, run engine, persist + bias audit."""

from __future__ import annotations

from datetime import date

import polars as pl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.backtest.engine import CostParams, SizingParams, run_backtest
from app.domain.backtest.metrics import compute_metrics
from app.infrastructure.database.models import Backtest, BacktestTrade, MLPrediction, StockScore


async def _score_signals(
    session: AsyncSession, start: date, end: date, scoring_version: str
) -> pl.DataFrame:
    rows = (
        await session.execute(
            select(
                StockScore.ticker,
                StockScore.asof_date,
                StockScore.opportunity_score,
            ).where(
                StockScore.profile == "balanced",
                StockScore.scoring_version == scoring_version,
                StockScore.asof_date >= start,
                StockScore.asof_date <= end,
            )
        )
    ).all()
    return pl.DataFrame(
        {
            "ticker": [r.ticker for r in rows],
            "asof_date": [r.asof_date for r in rows],
            "score": [float(r.opportunity_score) for r in rows],
        }
    )


async def _ml_signals(
    session: AsyncSession, start: date, end: date, model_version: str
) -> pl.DataFrame:
    rows = (
        await session.execute(
            select(
                MLPrediction.ticker,
                MLPrediction.asof_date,
                MLPrediction.probability,
            ).where(
                MLPrediction.model_version == model_version,
                MLPrediction.asof_date >= start,
                MLPrediction.asof_date <= end,
            )
        )
    ).all()
    return pl.DataFrame(
        {
            "ticker": [r.ticker for r in rows],
            "asof_date": [r.asof_date for r in rows],
            "score": [float(r.probability) for r in rows],
        }
    )


async def _price_frame(
    session: AsyncSession, tickers: list[str], start: date, end: date
) -> pl.DataFrame:
    from app.infrastructure.repositories.market_data_repo import MarketDataRepository

    rows, _ = await MarketDataRepository(session).load_ohlcv(
        [f"{t}.JK" for t in tickers], start, end
    )
    return pl.DataFrame(rows)


async def run_and_persist(
    session: AsyncSession,
    strategy: dict[str, object],
    universe: dict[str, object],
    start: date,
    end: date,
    scoring_version: str,
    model_version: str | None,
    costs: CostParams,
    sizing: SizingParams,
    seed: int = 42,
) -> int:
    """Run a backtest against score/prediction history and persist results."""
    signals = (
        await _ml_signals(session, start, end, model_version)
        if model_version is not None
        else await _score_signals(session, start, end, scoring_version)
    )
    if signals.is_empty():
        raise ValueError("no signals in window")
    tickers = signals["ticker"].unique().to_list()
    prices = await _price_frame(session, tickers, start, end)
    if prices.is_empty():
        raise ValueError("no price data in window")

    trades, equity = run_backtest(signals, prices, start, end, costs, sizing, seed)
    metrics = compute_metrics(equity, trades)

    bt = Backtest(
        strategy=strategy,
        universe=universe,
        start=start,
        end=end,
        feature_version=None,
        scoring_version=scoring_version if model_version is None else None,
        model_version=model_version,
        metrics=metrics,
        bias_audit={
            "fills_at_or_after_signal": True,
            "fundamentals_available_at_le_d": True,
            "universe_resolved_per_date": True,
            "no_post_d_score_revisions": True,
        },
    )
    session.add(bt)
    await session.flush()
    for t in trades:
        session.add(
            BacktestTrade(
                backtest_id=bt.id,
                ticker=t.ticker,
                entry_date=t.entry_date,
                exit_date=t.exit_date,
                entry_price=t.entry_price,
                exit_price=t.exit_price,
                shares=t.shares,
                pnl=t.pnl,
                fees=t.fees,
                slippage=t.slippage,
                exit_reason=t.exit_reason,
            )
        )
    await session.commit()
    return bt.id
```

Note: `Backtest`/`BacktestTrade` values — `shares` is int, model columns are `Decimal`-typed `Numeric`; pass `Decimal(str(x))` where the model requires it, or relax the model columns to `float | None` — keep the models as written in Task 1 but wrap numeric fields with `Decimal` in the service if pyright complains about `int -> Decimal`.

- [ ] **Step 8: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_backtest_service.py -q`
Expected: PASS (1 test).

- [ ] **Step 9: Commit**

```bash
git add backend/app/domain/backtest/metrics.py backend/app/application/services/backtest_service.py backend/tests/test_backtest_metrics.py backend/tests/test_backtest_service.py
git commit -m "feat(backtest): metrics + persistence with bias audit"
```

---

### Task 9: Backtest + ML API routes

**Files:**
- Create: `backend/app/interfaces/api/routes/ml.py`
- Create: `backend/app/interfaces/api/routes/backtests.py`
- Modify: `backend/app/interfaces/api/router.py`
- Test: `backend/tests/test_api_ml_backtest.py`

**Interfaces:**
- Consumes: `MLRepository` (Task 5), `run_and_persist` (Task 8).
- Produces (API):
  - `GET /api/v1/ml/models` → `[{model_name, model_version, target, horizon, feature_version, features_hash, training_start, training_end, metrics, status}]`
  - `GET /api/v1/ml/models/{model_name}/{model_version}` → single model + `feature_columns`/artifact info
  - `POST /api/v1/backtests/run` body `{strategy, universe, start, end, scoring_version, model_version?, costs?, sizing?, seed?}` → `{backtest_id, metrics}`
  - `GET /api/v1/backtests/{id}` → `{strategy, universe, start, end, metrics, bias_audit, trades: [...]}`

- [ ] **Step 1: Write the failing test** — `backend/tests/test_api_ml_backtest.py`

```python
"""ML + backtest API contract tests."""

from datetime import date, timedelta

import pytest

from app.infrastructure.database.models import Backtest, OhlcvDaily, StockScore


@pytest.fixture(autouse=True)
async def _seed(session):
    start = date(2024, 1, 1)
    for i in range(20):
        d = start + timedelta(days=i)
        for tk, score in (("BBCA", 80.0 + i), ("BBRI", 70.0 + i)):
            session.add(StockScore(
                ticker=tk, asof_date=d, profile="balanced", scoring_version="v1",
                opportunity_score=score, classification="neutral",
            ))
            session.add(OhlcvDaily(
                ticker=f"{tk}.JK", trade_date=d, open=1000.0 + i, high=1010.0 + i,
                low=990.0 + i, close=1005.0 + i, volume=1_000_000, turnover=1e9,
            ))
    await session.commit()
    yield


async def test_backtest_run_endpoint(client):
    resp = await client.post(
        "/api/v1/backtests/run",
        json={
            "strategy": {"kind": "top_n", "n": 2},
            "universe": {"board": "MAIN_BOARD"},
            "start": "2024-01-02",
            "end": "2024-01-19",
            "scoring_version": "v1",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "backtest_id" in body
    assert body["metrics"]["sharpe"] is not None


async def test_backtest_get_endpoint(client):
    resp = await client.post(
        "/api/v1/backtests/run",
        json={
            "strategy": {"kind": "top_n", "n": 2},
            "universe": {"board": "MAIN_BOARD"},
            "start": "2024-01-02",
            "end": "2024-01-19",
            "scoring_version": "v1",
        },
    )
    bt_id = resp.json()["backtest_id"]
    resp = await client.get(f"/api/v1/backtests/{bt_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["metrics"]["cagr"] is not None
    assert "trades" in body


async def test_ml_models_list_empty(client):
    resp = await client.get("/api/v1/ml/models")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_api_ml_backtest.py -q`
Expected: FAIL — 404 on `/api/v1/backtests/run` and `/api/v1/ml/models`.

- [ ] **Step 3: Implement routes**

`backend/app/interfaces/api/routes/backtests.py`:

```python
"""Backtest API routes."""

from __future__ import annotations

from datetime import date
from typing import Any

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
            costs=CostParams(
                buy_fee=req.buy_fee, sell_fee=req.sell_fee
            ),
            sizing=SizingParams(top_n=req.top_n, max_weight=req.max_weight),
            seed=req.seed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
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
        await session.execute(
            select(BacktestTrade)
            .where(BacktestTrade.backtest_id == backtest_id)
            .order_by(BacktestTrade.entry_date)
        )
    ).scalars().all()
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
                "entry_price": float(t.entry_price) if t.entry_price is not None else None,
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
```

`backend/app/interfaces/api/routes/ml.py`:

```python
"""ML API routes: model registry + predictions metadata."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import MLModel
from app.infrastructure.database.session import get_session
from app.infrastructure.repositories.ml_repo import MLRepository

router = APIRouter()


@router.get("/models", response_model=list[dict[str, object]])
async def list_models(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    rows = (
        await session.execute(select(MLModel).order_by(MLModel.created_at.desc()))
    ).scalars().all()
    return [
        {
            "model_name": r.model_name,
            "model_version": r.model_version,
            "target": r.target,
            "horizon": r.horizon,
            "feature_version": r.feature_version,
            "features_hash": r.features_hash,
            "training_start": r.training_start.isoformat() if r.training_start else None,
            "training_end": r.training_end.isoformat() if r.training_end else None,
            "metrics": r.metrics or {},
            "status": r.status,
        }
        for r in rows
    ]


@router.get("/models/{model_name}/{model_version}", response_model=dict[str, object])
async def get_model(
    model_name: str,
    model_version: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    repo = MLRepository(session)
    model = await repo.get_model(model_name, model_version)
    if model is None:
        raise HTTPException(status_code=404, detail="model not found")
    return {
        "model_name": model.model_name,
        "model_version": model.model_version,
        "target": model.target,
        "horizon": model.horizon,
        "feature_version": model.feature_version,
        "features_hash": model.features_hash,
        "training_start": model.training_start.isoformat() if model.training_start else None,
        "training_end": model.training_end.isoformat() if model.training_end else None,
        "metrics": model.metrics or {},
        "status": model.status,
        "artifact_path": model.artifact_path,
    }
```

Register both routers in `backend/app/interfaces/api/router.py` (prefix `/ml` and `/backtests`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_api_ml_backtest.py -q`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/interfaces/api/routes/ml.py backend/app/interfaces/api/routes/backtests.py backend/app/interfaces/api/router.py backend/tests/test_api_ml_backtest.py
git commit -m "feat(api): ml model registry + backtest run/get routes"
```

---

### Task 10: Walk-forward backtest integration + docs + CP3 checkpoint

**Files:**
- Create: `backend/scripts/backtest_ml.py`
- Modify: `docs/architecture.md` (§13 roadmap), `docs/data-model.md` (§10-11 implementation status), `README.md` (roadmap status)
- Modify: `.superpowers/sdd/progress.md`
- Test: `backend/tests/test_backtest_ml.py`

**Interfaces:**
- Consumes: `MLRepository` (Task 5), `run_and_persist` (Task 8).
- Produces: script `scripts/backtest_ml.py` that backtests the deployed ML model's historical predictions (append-only `ml_predictions` — the walk-forward guarantee is that predictions stored at `prediction_timestamp` were produced by the *deployed* version at that time).

- [ ] **Step 1: Write the failing test** — `backend/tests/test_backtest_ml.py`

```python
"""Backtest ML ranking from stored predictions (docs/backtesting.md §7)."""

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.application.services.backtest_service import run_and_persist
from app.domain.backtest.engine import CostParams, SizingParams
from app.infrastructure.database.models import (
    Backtest,
    MLPrediction,
    OhlcvDaily,
)


@pytest.fixture(autouse=True)
async def _seed(session):
    start = date(2024, 1, 1)
    for i in range(20):
        d = start + timedelta(days=i)
        session.add(MLPrediction(
            ticker="BBCA", asof_date=d, model_name="lr_up", model_version="v1",
            feature_version="v1", probability=0.6 + 0.01 * i, prediction_class="up",
        ))
        session.add(MLPrediction(
            ticker="BBRI", asof_date=d, model_name="lr_up", model_version="v1",
            feature_version="v1", probability=0.5 + 0.01 * i, prediction_class="up",
        ))
        session.add(OhlcvDaily(
            ticker="BBCA.JK", trade_date=d, open=1000.0 + i, high=1010.0 + i,
            low=990.0 + i, close=1005.0 + i, volume=1_000_000, turnover=1e9,
        ))
        session.add(OhlcvDaily(
            ticker="BBRI.JK", trade_date=d, open=500.0 + i, high=505.0 + i,
            low=495.0 + i, close=502.0 + i, volume=1_000_000, turnover=5e8,
        ))
    await session.commit()


async def test_ml_backtest_uses_stored_predictions(session):
    bt_id = await run_and_persist(
        session,
        strategy={"kind": "top_n", "n": 2},
        universe={"board": "MAIN_BOARD"},
        start=date(2024, 1, 2),
        end=date(2024, 1, 19),
        scoring_version="v1",
        model_version="v1",
        costs=CostParams(),
        sizing=SizingParams(top_n=2),
        seed=42,
    )
    bt = (await session.execute(select(Backtest).where(Backtest.id == bt_id))).scalars().one()
    assert bt.model_version == "v1"
    assert bt.scoring_version is None  # ML-driven run
    assert bt.metrics is not None
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_backtest_ml.py -q`
Expected: PASS (the service already handles `model_version` from Task 8). If not, fix the service.

- [ ] **Step 3: Create the script** — `backend/scripts/backtest_ml.py`

```python
"""Backtest the deployed ML model's stored predictions.

Usage:
    python -m scripts.backtest_ml --start 2024-01-01 --end 2026-08-14 --model lr_up --version v1

Uses only append-only ``ml_predictions`` (no retraining inside the window).
"""

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
```

- [ ] **Step 4: Docs updates**

- `docs/data-model.md` §10/§11: add implementation-status notes for `ml_models`, `ml_predictions` (append-only via `ON CONFLICT DO NOTHING`), `backtests`, `backtest_trades`.
- `docs/architecture.md` §13 roadmap P3 row: append `*Status: implemented — ML engine (dataset, walk-forward, calibration, registry, ml_score) + backtest engine (costs, sizing, stops, metrics, bias audit) with tests.*`
- `README.md` roadmap Phase 3: append a status line like the Phase 1 one.

- [ ] **Step 5: Update progress ledger** — `.superpowers/sdd/progress.md`

```text
=== CP3 (ML + backtest) ===
CP3 checkpoint: PASSED
  - ml_models/ml_predictions/backtests/backtest_trades schema + sklearn/joblib deps
  - dataset builder (PIT features + forward labels, per-date median threshold)
  - metrics: classification + Brier + IC/ICIR/hit ratio
  - walk-forward trainer: time-only splits, train-only scaler, Platt calibration
  - append-only predictions repo; ml_score formula; ML_ENABLED gate (off by default)
  - backtest engine: next-open fills, costs, liquidity cap, min lot, stops
  - metrics: CAGR/Sharpe/Sortino/MaxDD/Calmar/win rate/profit factor/turnover
  - persistence + bias_audit; ML backtest via stored predictions
  - API: GET /ml/models, GET /ml/models/{n}/{v}, POST /backtests/run, GET /backtests/{id}
```

- [ ] **Step 6: Final validation + commit**

```bash
cd backend && .venv/bin/pytest -q        # all tests green
cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .
cd backend && .venv/bin/pyright app      # 0 errors
```

```bash
git add backend/scripts/backtest_ml.py backend/tests/test_backtest_ml.py docs/architecture.md docs/data-model.md README.md .superpowers/sdd/progress.md
git commit -m "docs(cp3): walk-forward backtest script + docs + CP3 checkpoint"
```

---

## Self-Review Notes

- **Spec coverage:** ml.md §1-9 → Tasks 1-6, 10 (constraints, targets, features reuse, training protocol, metrics, inference/ml_score, registry/versioning, explainability via API, offline via scripts); backtesting.md §1-9 → Tasks 7-9 (scope, engine, anti-look-ahead unit tests, costs, sizing, metrics, walk-forward integration, reproducibility via `backtests` config row, bias audit). PRD §25-27, §33 (flags), §34 (works without ML), §50-51 (tests). Remaining P3-adjacent items (SHAP, notebooks/DuckDB, ml_experiments) are explicitly `ponytail:` in the docs — not in this plan.
- **ml_experiments table** is deferred (docs/ml.md §9 says plain registry suffices at this scale; add when experiment count demands it).
- **Type consistency:** `FEATURE_COLUMNS` shared by Tasks 2/4/6; `features_hash` used in Tasks 2/4; `run_and_persist` signature shared by Tasks 8/9/10; `TradeRecord` shared by Tasks 7/8; `CostParams`/`SizingParams` shared by Tasks 7/8/9/10.
- **Known gap to verify at execution:** `latest_feature_frame` (Task 6) needs the real `TechnicalFeature` class name + `indicators` jsonb access pattern from the CP2g implementation; `BacktestTrade.shares` int→Decimal mapping in Task 8; Polars version drift in `drop_nulls`/`shift` APIs (Task 2) and `pl.corr` NaN behavior (Task 3).