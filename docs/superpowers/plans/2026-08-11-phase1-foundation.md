# Phase 1 — Foundation & Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working Phase 1 foundation: Python backend scaffold, typed config, database schema with migrations, IDX universe seeding from `stock-list.xlsx`, real (non-mock) OHLCV ingestion via yfinance, and point-in-time validation — all TDD, typed, SOLID, checkpointed.

**Architecture:** Modular monolith (`app/{domain, application, infrastructure, interfaces}`). Domain owns types + interfaces (Protocols); infrastructure implements them (SQLAlchemy repos, yfinance provider); interfaces exposes API + workers. Every table carries `created_at`/`updated_at` (data-model.md §1, §14). Point-in-time gating via `available_at` (quant-finance-rules).

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2 + pydantic-settings, Polars, yfinance, Ruff, Pyright, Pytest, RQ + APScheduler (worker). Per-stack env files: `backend/.env`, `frontend/.env.local`, plus `.env.example` in each.

## Phase roadmap (all 4 phases, checkpointed)

Each phase is a separate plan document, written before execution. Pause/continue at every checkpoint.

| Checkpoint | Phase | Deliverable | Verify |
|---|---|---|---|
| CP1 | P1 foundation | scaffold, config, DB schema+migrations, universe seed, real OHLCV ingest | `pytest`, migrate + seed + ingest BBCA.JK, fresh data in PG |
| CP2 | P1 engines | technical indicators, breadth, sector, fundamentals, scoring, scanner | indicator tests, full-universe scan on real data |
| CP3 | P1 API + UI | FastAPI routes, terminal shell, dashboard, screener, stock page | API contract tests; UI renders real data |
| CP4 | P2 | smart money, factor model, macro, calendar, news, alerts | engine tests + dashboards |
| CP5 | P3 | ML, walk-forward, backtesting, versioning | no-leakage tests; Sharpe>0 eval |
| CP6 | P4 | LLM, NL screener, research assistant | LLM off critical path; fallback clean |

## Global Constraints

- No mock data in any runtime path. Real provider integration (yfinance for IDX OHLCV). Provider keys/config via env.
- Strict typing: Pyright `strict`, Pydantic models for all external boundaries, typed dataclasses/Pydantic for domain types. No `Any`, no `# type: ignore` without reason.
- SOLID: interfaces (Protocols) in domain, implementations in infrastructure, dependency injection for all providers/repos, single-responsibility files.
- TDD: failing test first, then minimal implementation.
- Point-in-time: `available_at` gates all fundamental reads; timestamp triplet on features.
- Versioning: `feature_version`, `scoring_version` strings on all derived artifacts.
- Every table has `created_at` + `updated_at` (DB default + trigger).
- Modular monolith: no microservices, no Celery/Kafka/K8s.
- Python ≥3.12 (3.13 on dev machine). Ruff + Pyright + Pytest required. PEP 8/484/257.
- Commit after each task with conventional messages.

## CP1 Tasks — Foundation & Data Layer

### Task 1: Python package scaffold + tooling

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/config/settings.py`
- Create: `backend/.env.example`
- Create: `backend/.env` (local, gitignored)
- Create: `backend/.gitignore`
- Test: `backend/tests/test_settings.py`

**Interfaces:**
- Consumes: nothing
- Produces: `app.config.settings.Settings` singleton; `app.config.settings.get_settings()` — loaded from env/`.env` with defaults; fields for `APP_ENV`, `POSTGRES_DSN`, `REDIS_URL`, `DATA_DIR`, `MARKET_DATA_PROVIDER`.

- [ ] **Step 1: Write failing test**

`backend/tests/test_settings.py`:
```python
from app.config.settings import get_settings

def test_settings_load_defaults():
    s = get_settings()
    assert s.app_env in {"development", "production", "test"}
    assert s.postgres_dsn.startswith("postgresql")
    assert s.market_data_provider != ""
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_settings.py -v`
Expected: FAIL — `ModuleNotFoundError: app.config.settings`

- [ ] **Step 3: Scaffold files**

`backend/pyproject.toml`:
```toml
[project]
name = "ihsg-quant-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.30",
  "pydantic>=2.8",
  "pydantic-settings>=2.4",
  "sqlalchemy[asyncio]>=2.0",
  "asyncpg>=0.29",
  "alembic>=1.13",
  "redis>=5.0",
  "rq>=1.16",
  "apscheduler>=3.10",
  "polars>=1.0",
  "yfinance>=0.2.40",
  "python-multipart>=0.0.9",
  "pyjwt>=2.8",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.0",
  "pytest-asyncio>=0.23",
  "ruff>=0.5",
  "pyright>=1.1",
  "httpx>=0.27",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.ruff]
line-length = 88
target-version = "py312"
[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP", "B", "SIM"]

[tool.pyright]
strict = true
include = ["app"]
pythonVersion = "3.12"
```

`backend/app/config/settings.py`:
```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: str = "development"
    postgres_dsn: str = "postgresql+asyncpg://ihsg:ihsg@localhost:5432/ihsg_quant"
    redis_url: str = "redis://localhost:6379/0"
    data_dir: str = "./data"
    market_data_provider: str = "yfinance"

    # AI feature flags (PRD §33) — default OFF for deterministic-first
    ml_enabled: bool = False
    llm_enabled: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

`backend/.env.example`:
```
APP_ENV=development
POSTGRES_DSN=postgresql+asyncpg://ihsg:ihsg@localhost:5432/ihsg_quant
REDIS_URL=redis://localhost:6379/0
DATA_DIR=./data
MARKET_DATA_PROVIDER=yfinance
ML_ENABLED=false
LLM_ENABLED=false
```

Copy to `backend/.env` (real local values, gitignored). `backend/app/main.py`:
```python
from fastapi import FastAPI


def create_app() -> FastAPI:
    return FastAPI(title="IHSG Quant API", version="0.1.0")


app = create_app()
```

`backend/app/__init__.py`: empty. `backend/.gitignore`:
```
.env
__pycache__/
*.pyc
.pytest_cache/
.ruff_cache/
data/
.venv/
```

- [ ] **Step 4: Install deps + run tests**

Run: `cd backend && python -m venv .venv && .venv/bin/pip install -e ".[dev]" && .venv/bin/pytest tests/test_settings.py -v`
Expected: PASS

- [ ] **Step 5: Lint + typecheck**

Run: `cd backend && .venv/bin/ruff check app tests && .venv/bin/pyright app`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat: scaffold backend package, config, tooling"
```

### Task 2: Domain type foundation (SOLID interfaces)

**Files:**
- Create: `backend/app/domain/common/types.py`
- Create: `backend/app/domain/common/interfaces.py`
- Create: `backend/app/domain/market/interfaces.py`
- Test: `backend/tests/test_types.py`

**Interfaces:**
- Consumes: Task 1 settings
- Produces:
  - `Timestamped` dataclass (created_at, updated_at: `datetime`)
  - `class MarketDataProvider(Protocol)` with `get_ohlcv(ticker: str, start: date, end: date) -> pl.DataFrame`, `get_quote(ticker: str) -> Quote`, `get_universe() -> list[UniverseItem]`
  - `UniverseItem` dataclass: `ticker, name, listing_date, board, shares_outstanding`
  - `Quote` dataclass: `ticker, price, change, volume, turnover, market_cap, asof`

- [ ] **Step 1: Failing test**

`backend/tests/test_types.py`:
```python
from app.domain.common.types import UniverseItem, Quote
from app.domain.market.interfaces import MarketDataProvider


def test_universe_item_typed():
    u = UniverseItem(ticker="BBCA", name="Bank Central Asia",
                     listing_date=None, board="Utama", shares_outstanding=1_924_688_333)
    assert u.ticker == "BBCA"
    assert isinstance(u.shares_outstanding, int)


def test_quote_typed():
    q = Quote(ticker="BBCA", price=9125.0, change=128.0, volume=2_000_000,
              turnover=18_250_000_000.0, market_cap=1_176_000_000_000.0, asof="2026-08-11")
    assert q.price > 0


def test_provider_is_protocol():
    assert hasattr(MarketDataProvider, "get_ohlcv")
```

- [ ] **Step 2: Run to verify fail**

Expected: FAIL — imports missing.

- [ ] **Step 3: Implement**

`backend/app/domain/common/types.py`:
```python
from dataclasses import dataclass
from datetime import date, datetime


@dataclass(frozen=True, slots=True)
class Timestamped:
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class UniverseItem:
    ticker: str
    name: str
    listing_date: date | None
    board: str
    shares_outstanding: int | None


@dataclass(frozen=True, slots=True)
class Quote:
    ticker: str
    price: float
    change: float
    volume: int
    turnover: float
    market_cap: float
    asof: date
```

`backend/app/domain/common/interfaces.py`:
```python
from typing import Protocol, runtime_checkable


@runtime_checkable
class Repository(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...
```

`backend/app/domain/market/interfaces.py`:
```python
from datetime import date
from typing import Protocol, runtime_checkable
import polars as pl

from app.domain.common.types import Quote, UniverseItem


@runtime_checkable
class MarketDataProvider(Protocol):
    def get_universe(self) -> list[UniverseItem]: ...
    def get_ohlcv(self, ticker: str, start: date, end: date) -> pl.DataFrame: ...
    def get_quote(self, ticker: str) -> Quote: ...
```

- [ ] **Step 4: Verify pass + lint/typecheck**

Run: `pytest tests/test_types.py -v && ruff check app tests && pyright app`
Expected: PASS, clean

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: domain types and provider protocols"
```

### Task 3: Async DB engine, session, Alembic

**Files:**
- Create: `backend/app/infrastructure/database/session.py`
- Create: `backend/app/infrastructure/database/base.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`
- Test: `backend/tests/test_db_health.py`

**Interfaces:**
- Consumes: `get_settings()` (POSTGRES_DSN)
- Produces: `get_session()` async context manager yielding `AsyncSession`; `Base` (DeclarativeBase)

- [ ] **Step 1: Failing test**

`backend/tests/test_db_health.py`:
```python
import pytest
from sqlalchemy import text

from app.infrastructure.database.session import get_session


@pytest.mark.asyncio
async def test_db_roundtrip():
    async with get_session() as session:
        result = await session.execute(text("SELECT 1"))
        assert result.scalar_one() == 1
```

- [ ] **Step 2: Run to verify fail**

Requires Postgres. Run: `docker compose up -d postgres` (deployment.md §1) OR local PG. Then `pytest tests/test_db_health.py -v`. Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`backend/app/infrastructure/database/base.py`:
```python
from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AuditMixin:
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True),
                                                 server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True),
                                                 server_default=func.now(),
                                                 onupdate=func.now(), nullable=False)
```

`backend/app/infrastructure/database/session.py`:
```python
from collections.abc import AsyncIterator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config.settings import get_settings

_engine = create_async_engine(get_settings().postgres_dsn, pool_pre_ping=True)
_session_factory = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with _session_factory() as session:
        yield session
```

Alembic scaffold (standard): `alembic init alembic` equivalent files, `env.py` uses `app.infrastructure.database.base.Base.metadata` + settings DSN, `compare_type=True`.

- [ ] **Step 4: Verify pass + alembic upgrade head works**

Run: `pytest tests/test_db_health.py -v && alembic upgrade head`
Expected: PASS, empty migration ok

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: async db session and alembic scaffold"
```

### Task 4: P1 schema — reference + market tables

**Files:**
- Create: `backend/app/infrastructure/database/models.py`
- Create: `backend/alembic/versions/0001_phase1_schema.py`
- Test: `backend/tests/test_models.py`

**Interfaces:**
- Consumes: Base, AuditMixin
- Produces SQLAlchemy models: `Exchange, Sector, Industry, Stock, UniverseHistory, OhlcvDaily` matching data-model.md §3-4. Columns per data-model.md exactly (incl. `created_at`, `updated_at` via AuditMixin).

- [ ] **Step 1: Failing test**

`backend/tests/test_models.py`:
```python
from app.infrastructure.database.models import OhlcvDaily, Stock
from app.infrastructure.database.base import AuditMixin


def test_audit_mixin_present():
    assert "created_at" in OhlcvDaily.__table__.columns
    assert "updated_at" in OhlcvDaily.__table__.columns


def test_ohlcv_unique_constraint():
    uq = {c.name for c in OhlcvDaily.__table__.constraints
          if getattr(c, "columns", None) and
          {col.name for col in c.columns} >= {"ticker", "trade_date"}}
    assert uq, "expected (ticker, trade_date) unique"


def test_stock_sector_fk():
    assert any(getattr(fk, "column", None) is not None and
               fk.parent.name == "sector_id"
               for fk in Stock.__table__.foreign_keys)
```

- [ ] **Step 2: Run to verify fail**

Expected: FAIL — models missing.

- [ ] **Step 3: Implement models** (exact columns from data-model.md §3-4, AuditMixin on every table)

Key: `stocks` (ticker, name, listing_date, board, shares_outstanding, sector_id FK, industry_id FK, exchange_id FK, status, is_active, listed_at, delisted_at), `exchanges`, `sectors`, `industries`, `universe_history` (ticker, effective_from, effective_to, status), `ohlcv_daily` (ticker, trade_date, open/high/low/close numeric, volume, turnover, adjustment_factor, adj_close, split_factor, provider, source_timestamp). Alembic migration `0001` creates all with `created_at/updated_at server_default now()`.

- [ ] **Step 4: Verify**

Run: `pytest tests/test_models.py -v && alembic upgrade head`
Expected: PASS; schema created; `\d stocks` shows created_at/updated_at.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: phase1 schema models and migration"
```

### Task 5: Universe seeding from stock-list.xlsx

**Files:**
- Create: `backend/app/application/services/universe.py`
- Create: `backend/app/infrastructure/repositories/stock_repo.py`
- Create: `backend/scripts/seed_universe.py`
- Test: `backend/tests/test_seed_universe.py`

**Interfaces:**
- Consumes: Stock model, session, `data/../stock-list.xlsx`
- Produces: `seed_universe(session) -> int` (rows upserted); `StockRepository.upsert_stocks(items: list[UniverseItem])`

- [ ] **Step 1: Failing test** (reads a fixture xlsx with 2 rows → asserts 2 stocks + universe_history rows, idempotent on re-run)

- [ ] **Step 2-5:** implement repo upsert (ON CONFLICT on ticker), service parsing xlsx via `openpyxl` (add dependency), script entrypoint `python -m scripts.seed_universe`. Verify: idempotent, typed `UniverseItem`.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: seed universe from stock-list.xlsx"
```

### Task 6: yfinance market provider (real data)

**Files:**
- Create: `backend/app/infrastructure/providers/yfinance_provider.py`
- Create: `backend/app/application/factories.py`
- Test: `backend/tests/test_yfinance_provider.py`

**Interfaces:**
- Consumes: MarketDataProvider Protocol
- Produces: `YFinanceProvider.get_ohlcv` (IDX tickers `ticker.JK`), `get_quote`, `get_universe` (raises `NotImplementedError` — universe comes from stock-list.xlsx); `build_market_provider(settings) -> MarketDataProvider`

- [ ] **Step 1: Failing test** (records HTTP with `pytest-recording` for offline; live smoke test `get_ohlcv("BBCA", 5 sessions)` has ≥1 row, close>0, no NaN)

- [ ] **Step 2-4:** implement provider mapping yfinance columns → Polars frame `[trade_date, open, high, low, close, volume, turnover, source_timestamp]`; factory `build_market_provider` switching on `settings.market_data_provider`. Verify live test passes with network.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: yfinance market data provider"
```

### Task 7: OHLCV ingestion job (incremental, validated)

**Files:**
- Create: `backend/app/application/services/market_data.py`
- Create: `backend/app/application/services/data_quality.py`
- Create: `backend/app/interfaces/workers/jobs.py`
- Test: `backend/tests/test_market_data_ingest.py`

**Interfaces:**
- Consumes: YFinanceProvider, OhlcvDaily model, `get_session`
- Produces: `ingest_ohlcv(ticker, start, end, session) -> int` (rows written); `validate_ohlcv(df) -> QualityReport`; RQ job `ingest_ohlcv_daily()`

- [ ] **Step 1: Failing test**: validate rejects high<low and negative volume; ingest upserts idempotently (double-run → same row count), records `source_timestamp`, sets `adjustment_factor=1.0` default.

- [ ] **Step 2-4:** `validate_ohlcv` (Polars filter + count issues → `QualityReport(ticker, quality_score, issues)`), `ingest_ohlcv` (provider → validate → reject invalid rows → `insert().on_conflict_do_update` on `(ticker, trade_date, provider)`), job wrapper. Verify live ingest of BBCA.JK last 30 sessions writes rows; re-run idempotent.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: ohlcv ingestion with validation and idempotent upsert"
```

### Task 8: Worker + scheduler (checkpoint wiring)

**Files:**
- Create: `backend/app/interfaces/workers/supervisor.py`
- Create: `backend/app/interfaces/workers/__init__.py`

**Interfaces:**
- Consumes: jobs from Task 7
- Produces: `python -m app.interfaces.workers.supervisor` → starts APScheduler (cron per data-pipeline.md §2.1 matrix) + RQ worker in one process.

- [ ] **Steps:** failing test asserts supervisor module imports and exposes `main()`; implement scheduler wiring (CronTrigger `ingest_ohlcv_daily` Mon-Fri 16:15, watchdog 30min), RQ worker via `rq.Worker`. Verify import + `--help`. Commit.

### CP1 Checkpoint — verify before Phase 1 engines

- [ ] `pytest` green; `ruff` + `pyright` clean
- [ ] `alembic upgrade head` clean; `stocks`, `ohlcv_daily` show created_at/updated_at
- [ ] `python -m scripts.seed_universe` → ~900 stocks
- [ ] Live ingest BBCA.JK 30 sessions → real rows in `ohlcv_daily`, no mock
- [ ] supervisor starts; scheduler enqueues jobs

---
