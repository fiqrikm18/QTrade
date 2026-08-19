# IHSG Quantitative Analytics & Decision Intelligence Platform

Quantitative decision-support platform for Indonesian stocks (IDX/IHSG).
Scans the full universe, scores stocks quantitatively, and exposes
deterministic analytics with optional ML support and optional LLM
interpretation — all in a dark, dense professional trading terminal.

**This is decision support, not financial advice. Not an autonomous trader.**
The LLM explains numbers; it never creates them.

## Core principles

- **Deterministic first.** Pure quant engine works with LLM and ML disabled,
  and with no internet access.
- **Data > everything.** Data quality precedes quantitative analysis.
- **No black box.** Every score is explainable down to its components.
- **No look-ahead.** Point-in-time data and timestamps everywhere; walk-forward
  validation only.
- **Small server, big ceiling.** Runs on 2-4 CPU / 4-8 GB RAM. Modular
  monolith. No K8s/Kafka/Spark until scale demands it.

## What's implemented

| Area | Status |
|---|---|
| **Universe & data** | 960+ IDX stocks seeded; OHLCV ingestion (yfinance), IHSG index, technical features persisted per scan |
| **Technical engine** | Indicators (RSI, MACD, SMA/EMA, ATR, ADX, Bollinger, ROC, stochastic, vol), market structure, smart money proxy, regime, breadth, sector rotation |
| **Fundamentals & scoring** | PIT fundamentals, 5 profiles (balanced/aggressive/conservative/income/growth), opportunity score with 10 explainable components, full-universe scanner |
| **Screener** | Multi-filter screening (score ranges, classification, board/sector, risk) with pagination |
| **Backtesting** | Next-open fills, costs, liquidity cap, min lot, stops; CAGR/Sharpe/Sortino/MaxDD/win rate/profit factor; bias audit |
| **ML (optional)** | Dataset builder (PIT + forward labels), walk-forward training with calibration, model/feature registry, `ml_score` (gated by `ML_ENABLED`) |
| **LLM (optional)** | OpenAI/Anthropic/Google/OpenRouter/Ollama adapters; score explanations, natural-language screener, news summaries, reports (gated by `LLM_ENABLED` + per-feature flags) |
| **Terminal UI** | 16 pages: dashboard, market, screener, stock universe + analysis, compare, sectors, macro, economic calendar, news, portfolio, alerts, backtest, research, data quality, settings |
| **Jobs** | APScheduler cron (`ingest_cron` daily, `watchdog_cron` 30-min) + RQ worker via `app.interfaces.workers.supervisor` |

## Architecture at a glance

```
yfinance ──▶ data pipeline (PIT, quality checks) ──▶ PostgreSQL 16 (OLTP)
                                                        │
                        scanner (run_market_scan) ◀─────┤
                          │  indicators · structure ·   │
                          │  smart money · regime ·     │
                          │  breadth · sectors ·        │
                          │  fundamentals · scoring     │
                          ▼                             │
              stock_scores (960+ rows / scan) ──▶ Redis ranking cache
                          │                             │
            FastAPI /api/v1 ◀───────────────────────────┘
                          │
              Next.js terminal UI (dark, dense, explainable)
```

Layers: `domain` (pure logic) → `application` (services) → `infrastructure`
(db, providers, ml, llm, jobs) → `interfaces` (FastAPI, RQ workers).
See `docs/architecture.md` for the authoritative spec.

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Python ≥3.12, FastAPI, Pydantic v2, Pydantic-Settings |
| Compute | Polars, NumPy, scipy |
| OLTP | PostgreSQL 16 (SQLAlchemy 2 async + asyncpg) |
| Migrations | Alembic |
| Cache / jobs | Redis, RQ, APScheduler |
| ML | scikit-learn, joblib |
| LLM | langchain-core + adapters (openai, anthropic, google-genai, ollama) |
| Data provider | yfinance |
| Frontend | Next.js 16 (App Router), React, TypeScript, Tailwind CSS v4, Radix UI, lucide-react |
| Quality | Ruff, Pyright, Pytest, ESLint, Vitest |
| Auth | PyJWT (reserved) |

## Repository layout

```
quant-trade/
  backend/
    app/
      domain/              # pure business logic (indicators, scoring, ml metrics, reference data)
      application/         # use cases & services (scanner, market data, screener, backtests, data quality)
      infrastructure/      # database, providers, ml, llm, jobs
      interfaces/
        api/routes/        # FastAPI route modules (one file per domain)
        workers/           # RQ worker + APScheduler supervisor
      config/              # settings.py (env-driven)
    tests/                 # pytest (isolated to ihsg_quant_test DB via conftest)
    migrations/            # Alembic
    scripts/               # seed_universe, seed_sectors, live_scan, train_ml, backtest_ml, smoke scripts
    pyproject.toml         # deps, ruff, pyright, pytest config
  frontend/
    src/
      app/                 # 16 route pages (dark terminal UI)
      components/ui/       # design-system components (Button, Card, Table, Select, Tabs, TickerSelect…)
      lib/                 # typed API client (api.ts), utils, pure helpers
    vitest.config.ts       # vitest (jsdom, @ alias)
  docs/                    # PRD, DESIGN, architecture, data-model, ml, backtesting, llm, macro, deployment…
```

## Prerequisites

- Python ≥ 3.12
- Node.js ≥ 20 (npm)
- PostgreSQL 16 running locally
- Redis running locally

## Run locally (no Docker)

### 1. Backend

```bash
cd backend

# create and activate a virtualenv, then install (includes dev tools: pytest, ruff, pyright)
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# configure environment (edit if your services differ)
cp .env.example .env
#   POSTGRES_DSN=postgresql+asyncpg://ihsg:ihsg@localhost:5432/ihsg_quant
#   REDIS_URL=redis://localhost:6379/0
#   ML_ENABLED=false          # ML layer (train_ml, ml_score) — default OFF
#   LLM_ENABLED=false         # LLM layer — default OFF; llm_* flags enable per-feature
#   llm_provider=openai       # openai | anthropic | google | openrouter | ollama
#   llm_api_key=...           # optional (ollama needs none)

# create the databases (dev + isolated test DB used by pytest)
createdb ihsg_quant
createdb ihsg_quant_test

# apply schema migrations
alembic upgrade head

# seed reference data (sectors, then the 960+ stock universe from stock-list.xlsx)
python -m scripts.seed_sectors
python -m scripts.seed_universe

# run the API (the app is a factory — --factory is required)
uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000
```

Interactive API docs: http://localhost:8000/docs

### 2. Ingest real data + run a market scan

```bash
cd backend
source .venv/bin/activate

# ingest BBCA + IHSG index history, run the full-universe scan, verify rows + Redis cache
python -m scripts.live_scan BBCA 400

# or run only the scan against already-ingested data (no standalone script yet):
#   python -c "import asyncio; from app.application.services.scanner import run_market_scan; from app.infrastructure.database.session import get_session; async def _s(): async for s in get_session(): await run_market_scan(s); asyncio.run(_s())"
```

The scan writes `stock_scores` (one row per ticker per asof) with all
component scores, persists technical features, and caches the top-N ranking in
Redis (`scan:{profile}:{asof}`). The API reads only these scan artifacts —
no computation happens on the request path (`docs/architecture.md` §6).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

The dev server proxies `/api/v1/*` to the backend. To point at a different
backend:

```bash
API_UPSTREAM=http://192.168.1.10:8000 npm run dev
```

### 4. Optional: ML training and backtesting

```bash
cd backend && source .venv/bin/activate

python -m scripts.train_ml       # walk-forward training → model registry (ml_models)
python -m scripts.backtest_ml    # backtest using stored predictions (backtests)
```

Set `ML_ENABLED=true` in `.env` to include `ml_score` in scans. The LLM
endpoints work out of the box with `llm_enabled` flags and fall back to
deterministic explanations when disabled or unreachable (`docs/llm.md`).

## API reference

Base path `/api/v1`. Interactive docs: http://localhost:8000/docs

| Method | Path | Description | Source |
|---|---|---|---|
| GET | `/health` | Liveness | — |
| GET | `/market/overview` | Regime, breadth, movers, top opportunities | scan artifacts + Redis + OHLCV |
| GET | `/market/regime` | Current regime + confidence | scan artifacts |
| GET | `/market/breadth` | Breadth score | scan artifacts |
| GET | `/market/sectors` | Sector rotation by sector score | scan artifacts |
| GET | `/stocks?page=&page_size=` | Paginated universe (960+) | stocks table |
| GET | `/stocks/{ticker}/analysis` | Score, components, drivers, risks, invalidation | stock_scores |
| GET | `/stocks/{ticker}/technical` | Latest technical indicators (RSI, MACD, SMA…) | technical_features |
| GET | `/stocks/compare?tickers=A&tickers=B` | Multi-stock comparison (repeat the param per ticker) | scan artifacts |
| POST | `/screener/run` | Run screen with filters + pagination | stock_scores query |
| GET/POST | `/screener/saved` | Saved screens | in-memory seed |
| POST | `/backtests/run` | Run a backtest (returns `backtest_id`) | backtest engine |
| GET | `/backtests/{id}` | Backtest detail + metrics | backtests |
| GET | `/ml/models` · `/ml/models/{name}/{version}` | Trained models / detail | ml_models registry |
| POST | `/llm/explain` · `/llm/nl-screener` · `/llm/report` | LLM interpretations (gated) | LLM service |
| GET | `/macro/indicators` | Macro indicators (BI rate, CPI, USD/IDR…) | seed reference data |
| GET | `/calendar/events` | Upcoming economic events | seed reference data |
| GET | `/news` | Recent market news | seed reference data |
| GET | `/portfolio` | Portfolio with derived pnl/weights | seed reference data |
| GET | `/alerts` | Scan-derived alerts (threshold rules) | latest stock_scores |
| GET | `/research/memos` | Top-opportunity research memos | latest stock_scores |

> Macro / calendar / news / portfolio serve curated seed reference data
> (`backend/app/domain/reference_data.py`) until the ingestion jobs from
> PRD §40 land; alerts and research memos are derived from real scan data
> (never fabricated). See the module docstring for the swap-in contract.

## Configuration

Backend (`.env`, see `backend/app/config/settings.py`):

| Variable | Default | Meaning |
|---|---|---|
| `APP_ENV` | `development` | Runtime environment |
| `POSTGRES_DSN` | `postgresql+asyncpg://ihsg:ihsg@localhost:5432/ihsg_quant` | Async SQLAlchemy DSN |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis for ranking cache + RQ |
| `DATA_DIR` / `MODELS_DIR` | `./data` / `./models` | Parquet / model artifacts |
| `MARKET_DATA_PROVIDER` | `yfinance` | Data provider adapter |
| `INGEST_CRON` / `WATCHDOG_CRON` | `15 16 * * 1-5` / `*/30 * * * *` | Scheduler schedules |
| `ML_ENABLED` | `false` | Include ML score in scans (deterministic-first default) |
| `LLM_ENABLED` | `false` | Master LLM switch |
| `llm_analysis_enabled` … | `true` | Per-feature LLM gates |
| `llm_provider` / `llm_model` / `llm_api_key` | `openai` / `gpt-4o-mini` / — | LLM provider config |

Frontend (`frontend/.env.local` optional):

| Variable | Default | Meaning |
|---|---|---|
| `API_UPSTREAM` | `http://localhost:8000` | Backend base URL for the `/api/v1/*` proxy |

## Testing & quality gates

```bash
# backend (tests auto-isolate to ihsg_quant_test; dev DB stays untouched)
cd backend && source .venv/bin/activate
pytest                 # 170+ tests (API contracts, scanner, engines, ml, backtests, llm)
ruff check .           # lint
ruff format --check .  # formatting
pyright                # strict type checking

# frontend
cd frontend
npm run test           # vitest (component + page tests)
npx tsc --noEmit       # TypeScript
npx eslint .           # lint (0 errors expected; pre-existing unused-import warnings allowed)
npm run build          # production build (all routes compile)
```

Backend pytest config: `asyncio_mode=auto`, tests hit the real Postgres
`ihsg_quant_test` DB (created above) via `tests/conftest.py` DSN override.

## Docker / production

`docs/deployment.md` is the authoritative ops reference: compose topology
(backend, worker, postgres, redis, frontend), VPS sizing (2-4 CPU / 4-8 GB
RAM), observability, and backup strategy. Worker entrypoint:
`python -m app.interfaces.workers.supervisor` (starts APScheduler + RQ worker).

## Documentation

| Doc | Contents |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product requirements (source of truth) |
| [docs/DESIGN.md](docs/DESIGN.md) | UI/product design spec — terminal look, page map, frontend rules (authoritative for frontend) |
| [docs/architecture.md](docs/architecture.md) | System architecture, modules, tech decisions |
| [docs/data-model.md](docs/data-model.md) | Database schema, entities, timestamps, indexes |
| [docs/data-pipeline.md](docs/data-pipeline.md) | Providers, ingestion, quality, adjustments |
| [docs/technical-analysis.md](docs/technical-analysis.md) | Indicator engine, structure, smart money, breadth, regime |
| [docs/fundamental-analysis.md](docs/fundamental-analysis.md) | Ratios, point-in-time fundamentals, scoring |
| [docs/scoring.md](docs/scoring.md) | Opportunity score, profiles, ranking, screener |
| [docs/ml.md](docs/ml.md) | Targets, features, walk-forward, validation, registry |
| [docs/backtesting.md](docs/backtesting.md) | Backtest engine, costs, bias prevention, metrics |
| [docs/macro.md](docs/macro.md) | Macro engine, economic calendar, event impact |
| [docs/llm.md](docs/llm.md) | Optional LLM layer, providers, feature flags, NL screener |
| [docs/deployment.md](docs/deployment.md) | Docker, VPS sizing, operations, observability |

## Roadmap

- **Phase 1 — core engine + API + shell.** Universe, OHLCV, DB, technical
  engine, fundamentals, breadth, sector, scoring, full-market scanner, API.
  *Status: implemented — scanner runs on real data; API serves scan
  artifacts; terminal renders real data with typed contracts (vitest green).*
- **Phase 2 — smart money, macro, calendar, news, alerts.** *Status:
  partially implemented — smart money & macro scoring in the scan; macro
  indicators, economic calendar, news, portfolio, alerts and research memos
  are served by the API (seed reference data / scan-derived), with ingestion
  pipelines scheduled for PRD §40.*
- **Phase 3 — ML + backtesting.** *Status: implemented — ML engine
  (dataset, walk-forward, calibration, registry, `ml_score`) + backtest
  engine (costs, sizing, stops, metrics, bias audit), gated by `ML_ENABLED`.*
- **Phase 4 — LLM layer.** *Status: implemented — provider adapters,
  score explanations, NL screener, news summaries, reports; deterministic
  fallbacks; gated by `LLM_ENABLED`.*

Details in `docs/architecture.md` (§ Roadmap).

## Development rules

Before implementing each major component: explain purpose, explain design,
explain trade-offs, implement, add tests, validate, update docs. Never make
silent architectural decisions. Prefer modular monolith; avoid over-engineering.
Frontend work follows `docs/DESIGN.md` (dark terminal theme, dense tables,
explainable scores are non-negotiable design constraints).

## Disclaimer

This platform provides analytics and decision support only. Nothing here is
financial advice, and the system is not an autonomous trader. Verify all
outputs before acting; the LLM explains numbers, it never creates them.