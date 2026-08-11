# Architecture

Source of truth: `docs/PRD.md`. This document translates PRD requirements into
a concrete system architecture. Every decision here is binding unless marked
`ponytail:` (deliberate simplification with a named upgrade path).

## 1. Design philosophy

```
DATA
  ↓
DATA QUALITY
  ↓
QUANTITATIVE FEATURES
  ↓
TECHNICAL ANALYSIS
  ↓
FUNDAMENTAL ANALYSIS
  ↓
FLOW / SMART MONEY ANALYSIS
  ↓
MACRO / ECONOMIC CONTEXT
  ↓
MARKET REGIME
  ↓
QUANTITATIVE SCORING
  ↓
ML SUPPORT
  ↓
OPTIONAL LLM INTERPRETATION
  ↓
DECISION SUPPORT
```

Non-negotiables:

- LLM never generates numerical indicators, never overrides calculations,
  never hallucinates data. It is an interpretation layer.
- ML is supporting, not authoritative. Deterministic models stay usable with
  ML and LLM disabled.
- Every recommendation must be measurable, explainable, reproducible,
  timestamped, testable, backtestable, configurable.

## 2. Architecture style: modular monolith

Single deployable backend process containing cleanly separated modules.
**Not** microservices. Boundaries come from code structure, not process
isolation.

- One API process (FastAPI).
- One worker process (RQ) for background jobs.
- Shared PostgreSQL, Redis, shared filesystem for Parquet/models.
- Modules communicate through domain interfaces, never through shared mutable
  state or direct database cross-module access.

`ponytail:` If a module grows to need independent scaling, extract it behind
its existing domain interface as a separate service. Nothing else changes.

## 3. System diagram

```
                 ┌──────────────────────┐
                 │   DATA PROVIDERS     │   market / fundamental / corporate
                 └──────────┬───────────┘   action / news / macro / calendar / index
                            ▼
                 ┌──────────────────────┐
                 │   DATA INGESTION     │   RQ jobs → raw tables
                 └──────────┬───────────┘
                            ▼
                 ┌──────────────────────┐
                 │   DATA QUALITY       │   validation → reports
                 └──────────┬───────────┘
                            ▼
          ┌─────────────────────────────────┐
          │       FEATURE ENGINE           │   technical, fundamental, factor,
          │  (Polars, vectorized, versioned)│   smart money, macro, breadth, sector
          └────────────────┬────────────────┘
                           ▼
                 ┌──────────────────────┐
                 │  MARKET REGIME       │   deterministic only
                 └──────────┬───────────┘
                            ▼
                 ┌──────────────────────┐
                 │  QUANT SCORING       │   opportunity score + components
                 └──────────┬───────────┘
                    ┌───────┴───────┐
                    ▼               ▼
             ┌───────────┐   ┌───────────┐
             │ ML ENGINE │   │ RISK ENG  │   optional / parallel
             └─────┬─────┘   └─────┬─────┘
                   └───────┬───────┘
                           ▼
                 ┌──────────────────────┐
                 │ DECISION INTELLIGENCE│   recommendations, ranking, screener
                 └──────────┬───────────┘
                    ┌───────┴───────┐
                    ▼               ▼
             ┌───────────┐   ┌───────────┐
             │ LLM (opt) │   │ API + UI  │
             └───────────┘   └───────────┘
```

## 4. Module map

Python package: `backend/app/`. Clean architecture layers:

```
app/
  domain/        # entities, value objects, domain logic, interfaces
  application/   # use cases, application services, DTOs
  infrastructure/# db, providers, ml, llm, job queues, parquet
  interfaces/    # api (FastAPI routers), workers (RQ tasks)
  config/        # pydantic-settings, env loading
```

Domains (each is a folder under `domain/`):

| Domain | Responsibility | Key outputs |
|---|---|---|
| `market` | IHSG, breadth, indices, market state | `market_breadth_score`, market overview |
| `stock` | Universe, companies, sectors, boards | universe membership |
| `technical` | Indicator engine, price structure | technical features, signals |
| `fundamental` | Ratios, point-in-time data, quality | fundamental scores |
| `factor` | Value/Momentum/Quality/Growth/etc | `factor_score` |
| `smartmoney` | Accumulation/distribution proxies | `smart_money_score` |
| `sector` | Sector rotation, sector ranking | `sector_score`, rotation matrix |
| `macro` | Macro indicators, calendar, event impact | `macro_risk_score`, `macro_support_score` |
| `news` | News ingestion, sentiment | `news_sentiment_score` |
| `scoring` | Opportunity score, profiles, ranking | `opportunity_score` |
| `ml` | Models, features, predictions, registry | `ml_score`, probabilities |
| `risk` | Volatility, beta, VaR, drawdown | `risk_score` |
| `portfolio` | Portfolio analytics | portfolio metrics |
| `backtest` | Strategy evaluation | metrics, trades |
| `alerts` | Alert rules + events | alert triggers |

Rules:

- `domain/` has **zero** infrastructure imports. It depends on Python stdlib
  and Polars/NumPy only.
- `application/` orchestrates domain use cases; owns DTOs and orchestration.
- `infrastructure/` implements domain interfaces (DB repositories, providers).
- `interfaces/` adapts HTTP/jobs to application layer.
- Business logic, DB queries, API handlers, and ML code never share a file.

## 5. Technology choices

| Concern | Choice | Why |
|---|---|---|
| API | FastAPI + Pydantic v2 | async, typed, OpenAPI out of the box |
| OLTP | PostgreSQL 16 | transactions, indexes, relational integrity |
| OLAP | DuckDB | analytical queries, joins over Parquet, no server |
| Vectorized compute | Polars | fast full-universe scans; lazy evaluation |
| Fallback compute | pandas | only where ecosystem requires (e.g. some libs) |
| Cache | Redis | API response cache, temp calc, rate limits, RQ broker |
| Job queue | RQ | lightweight; Redis already present |
| Scheduling | APScheduler (`CronTrigger`) | scheduler process enqueues RQ jobs + chains scan DAG |
| ML | scikit-learn → LightGBM/XGBoost | simple first, boosting when justified |
| Feature store | Postgres + Parquet | small scale; Parquet for history |
| Migrations | Alembic | schema versioning |
| Frontend | Next.js + TS + Tailwind + shadcn/ui | DESIGN.md §50 (terminal-first) |
| Charts | lightweight-charts (price) + recharts (dashboards) | density without clutter |
| Lint/type/test | Ruff, Pyright, Pytest | PRD §50 |

Avoided until scale demands: Kubernetes, Kafka, Spark, Celery+RabbitMQ,
service mesh, distributed ML.

## 6. Data flow

Batch-oriented with incremental updates:

1. **Ingestion** (RQ jobs, scheduled): pull from providers → validate →
   upsert into raw/target Postgres tables. Parquet for large history.
2. **Feature calculation** (job): read latest market + fundamentals →
   vectorized feature computation in Polars → write versioned features.
3. **Market scan** (job): full-universe pipeline (PRD §38) → scores → rank →
   cache results in Redis + Postgres.
4. **ML inference** (job/on-demand): versioned features → model predict →
   store predictions. Never blocks the scan.
5. **API**: reads cached scan results + stored features. Heavy computation is
   never done in the request path.
6. **LLM (optional)**: on-demand only, for top candidates, selected stocks,
   or reports. Asynchronous; never in the critical path.

Full scan pipeline (PRD §38):

```
load universe → load latest market data → validate → features → technical →
fundamental → smart money → sector → macro → ML inference → quant score →
rank → cache → API
```

## 7. Versioning & reproducibility

Global version strings, stored on every artifact:

- `feature_version` — version of feature definitions/calculations.
- `scoring_version` — version of scoring formulas/weights.
- `model_version` — model name + version + training window.
- `data_last_updated` — freshness per table.
- `calculation_version` — per calculation.

Every DB row carries `created_at` (row write time) + `updated_at`; business
time (`effective_timestamp`, `asof_date`, `available_at`) records when the
fact became true. `created_at` is set by the DB on insert and never touched.
See `docs/data-model.md` §1 and §14.

Audit contract (PRD §55): given `(ticker, timestamp, scoring_profile,
feature_version)` the system must reconstruct score, factors, model
prediction, and supporting data. This requires append-only prediction tables
and immutable feature snapshots — `created_at` + business-time columns make
every reconstruction point-in-time exact.

### Low latency

The terminal reads **cached results, never live computation** (PRD §38, §65):
Redis holds prebuilt scan/regime/breadth/sector payloads (TTL tied to
`data_freshness`), PostgreSQL serves indexed latest-state tables, Parquet +
DuckDB is analytics-only. API request paths are index lookups + Redis reads.
See `docs/data-model.md` §15 and `docs/deployment.md` §3.

## 8. Configuration

- Environment: secrets via env vars (`.env`), typed via `pydantic-settings`.
- Tunable parameters (weights, thresholds): `ScoringProfile` rows in Postgres
  + YAML defaults in `backend/app/config/`. UI never hardcodes business logic.
- AI feature flags (PRD §33): `AI_ENABLED`, `LLM_*_ENABLED`, `ML_*_ENABLED`,
  plus `LLM_ENABLED`, `ML_ENABLED`. Supports modes: Pure Quant / Quant+ML /
  Quant+LLM / Quant+ML+LLM.

## 9. Security

- API auth (JWT) + role-based authorization; rate limiting via Redis.
- Secrets only in env; never in frontend; provider keys server-side.
- Input validation at API boundary (Pydantic); parameterized SQL (ORM).
- LLM prompts built from structured data only; treat LLM output as untrusted;
  no raw prompt injection surfaces to tool calls.

## 10. Observability

- Structured JSON logging, per-job execution logs, ingestion status,
  data freshness per table, model + feature + scoring versions.
- `GET /api/v1/system/health` + `GET /api/v1/system/status` expose job and
  freshness state.

## 11. API surface

All routes under `/api/v1`. Summary (full list in PRD §41, §61):

```
GET  /market/overview | /market/regime | /market/breadth | /market/sectors
GET  /stocks | /stocks/{ticker} | /stocks/{ticker}/analysis
GET  /stocks/{ticker}/technical | /fundamental | /risk | /ml
POST /screener/run | /stocks/compare | /backtest | /portfolio/analyze | /llm/explain
GET  /recommendations | /economic-calendar | /macro/overview
```

Responses are typed Pydantic models, paginated, with structured errors
(`RFC 7807` problem details).

## 12. Frontend architecture

Authoritative UI spec: **`docs/DESIGN.md`**. The frontend is a professional
quantitative trading **terminal**, not a generic SaaS dashboard.

- Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/ui primitives,
  design tokens (DESIGN §3-4, §48).
- Dark terminal theme primary; compact spacing, thin borders, dense tables,
  semantic colors paired with text/icons (never color-only).
- Feature-based structure (DESIGN §50):
  `frontend/{app, components/{shell,charts,tables,analytics,trading,ai},
  features/, lib/, hooks/, types/}`.
- Domain-specific UI logic lives in feature modules; business logic never in
  UI components (DESIGN §70).
- State split (DESIGN §51): server state (query/cache library), UI state
  (selected ticker, tab, panel size, density), URL state (shareable filters
  like `/screener?sector=banking&scoreMin=80`).
- Page map (DESIGN §68): dashboard, market (overview/breadth/regime/
  volatility), screener, stocks/[ticker] (overview, technical, fundamental,
  valuation, factors, smart-money, risk, ml, news, scenarios), compare,
  sectors, macro, economic-calendar, news, portfolio, backtest, alerts,
  research, data-quality, settings.
- Shell (DESIGN §6-9): top bar (logo, market session indicator, global
  search/command palette, notifications, profile), left nav (collapsible),
  stable status bar (data freshness, jobs, provider health).
- Charting (PRD §43 + DESIGN §43-45): `lightweight-charts` for price/candles,
  `recharts` for dashboards. Every chart answers an analytical question; no
  decorative charts. Score forms: horizontal bars, compact ring, heatmap —
  no oversized gauges.
- Terminal UX: command palette (`⌘K`), keyboard shortcuts, persistent
  watchlist, saved layouts/workspaces, resizable split panels, synchronized
  crosshair (DESIGN §34-35, §56-59).
- Explainability and transparency surfaced in UI: click-through
  `score_components`, model metadata (version, training window, validation
  metrics), data freshness + source, `AI_ENRICHED` labels (DESIGN §63-64, §67).
- Graceful degradation: ML/LLM panels show explicit "Unavailable" states;
  quantitative scoring always renders (DESIGN §65). Loading uses layout
  skeletons, not full-page spinners (DESIGN §39); scan progress streams
  pipeline stage state (DESIGN §66).
- Data consumed through typed API contracts (Pydantic → OpenAPI → TS types).
  Never hardcode scores/market data in components (DESIGN §70).

Pages (PRD §42) map 1:1 to the DESIGN.md page map; frontend MVP phases per
DESIGN §69 (see Roadmap below).

## 13. Roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| P1 | universe, OHLCV ingestion, PG+DuckDB+Polars, technical engine, basic fundamentals, breadth, sector, scoring, full scanner, FastAPI; UI: app shell, dashboard, market overview, screener, stock analysis, basic sector page, chart system, watchlist, data freshness, score visualization (DESIGN §69-P1) | full-universe daily scan on 2-4 CPU finishes in reasonable time; scores reproducible; terminal shell stable |
| P2 | smart money, factor model, macro engine, economic calendar, news ingestion, alerts; UI: smart money, factors, macro, calendar, news, alerts, compare (DESIGN §69-P2) | dashboards answer market + macro questions |
| P3 | ML, walk-forward validation, backtesting, model/feature versioning, feature importance; UI: ML, backtest, risk, portfolio, model transparency (DESIGN §69-P3) | strategy backtests honest (no leakage); ML evaluated by Sharpe not accuracy |
| P4 | LLM, NL screener, research assistant, reports; UI: LLM research assistant, AI explanations (DESIGN §69-P4) | LLM off-critical-path, feature-flagged, falls back cleanly |

Each phase: tests + validation + docs before the next. Never start with the UI.
