# IHSG Quantitative Analytics & Decision Intelligence Platform

Quantitative decision-support platform for Indonesian stocks (IDX/IHSG).
Scans the full universe, scores stocks quantitatively, and exposes
deterministic analytics with optional ML support and optional LLM
interpretation.

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

## Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.12, FastAPI, Pydantic v2 |
| Compute | Polars, NumPy, scipy |
| OLTP | PostgreSQL 16 |
| OLAP | DuckDB + Parquet |
| Cache / jobs | Redis, RQ |
| ML | scikit-learn, LightGBM, XGBoost |
| Frontend | Next.js, TypeScript, Tailwind CSS, shadcn/ui — **professional trading terminal** (see `docs/DESIGN.md`) |
| Quality | Ruff, Pyright, Pytest |
| Infra | Docker, docker-compose |

## Repository layout

```
ihsg-quant/
  backend/
    app/
      domain/          # business logic, no infra deps
      application/     # use cases, services, DTOs
      infrastructure/  # db, providers, ml, llm, jobs
      interfaces/      # api (FastAPI), workers (RQ)
      config/
    tests/
    migrations/        # Alembic
    scripts/
    pyproject.toml
  frontend/
    app/               # routes: dashboard, market, screener, stocks, compare, ...
    components/        # shell/, charts/, tables/, analytics/, trading/, ai/
    features/          # domain modules (market, screener, stocks, portfolio, research)
    lib/ hooks/ types/
  data/
    raw/ processed/ parquet/
  models/              # trained model artifacts + registry metadata
  notebooks/
  docs/
  docker/
  docker-compose.yml
  .env.example
  stock-list.xlsx      # IDX universe reference (ticker, name, listing date, shares, board)
```

Frontend structure, page map, and terminal visual language are specified in
`docs/DESIGN.md` (authoritative UI spec). The dark terminal theme, dense
tables, and explainable scores are non-negotiable design constraints.

## Quickstart

```bash
cp .env.example .env           # fill data provider config
docker compose up -d           # postgres, redis, backend, frontend, worker
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python -m app.scripts.seed_universe
docker compose run --rm backend python -m app.scripts.ingest_all
docker compose run --rm backend python -m app.scripts.run_market_scan
```

See `docs/deployment.md` for full details.

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

- **Phase 1** — universe, OHLCV, DB, technical engine, fundamentals, breadth,
  sector, scoring, full-market scanner, API; UI: terminal shell, dashboard,
  market overview, screener, stock analysis, chart system, watchlist
  (DESIGN §69-P1). *Status: implemented — scanner runs on real data, API
  routes serve scan artifacts (market overview, screener, stock analysis,
  technical indicators), frontend renders real API data with typed contracts
  (vitest green).*
- **Phase 2** — smart money, factor model, macro engine, economic calendar,
  news ingestion, alerts; UI: smart money, factors, macro, calendar, news,
  alerts, compare.
- **Phase 3** — ML, walk-forward validation, backtesting, model/feature
  versioning, feature importance; UI: ML, backtest, risk, portfolio, model
  transparency.
- **Phase 4** — LLM, natural-language screener, research assistant, reports;
  UI: AI research assistant, AI explanations.

Details in `docs/architecture.md` (§ Roadmap).

## Development rules

Before implementing each major component: explain purpose, explain design,
explain trade-offs, implement, add tests, validate, update docs. Never make
silent architectural decisions. Prefer modular monolith; avoid over-engineering.
