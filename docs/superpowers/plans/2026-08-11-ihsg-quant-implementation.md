# IHSG Quant Platform — Checkpointed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, checkpointed) — this plan is executed inline in-session with review gates at every checkpoint. Steps use `- [ ]` checkbox syntax for resume tracking.

**Goal:** Implement all phases (P1-P4) of the IHSG quantitative analytics platform per `docs/PRD.md`, `docs/DESIGN.md`, and the supporting docs, with **checkpoints** so execution can pause and resume across sessions.

**Architecture:** Modular monolith. Python/FastAPI backend (`backend/app/{domain,application,infrastructure,interfaces}`), Polars vectorized engines, PostgreSQL + Redis, RQ+APScheduler jobs. Next.js/TS terminal frontend per DESIGN.md. Checkpointed by phase; each checkpoint = tests green + verified + committed + documented.

**Tech Stack:** Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, Polars, PostgreSQL 16, Redis, RQ, APScheduler, DuckDB, scikit-learn, LightGBM; Next.js 15, TypeScript, Tailwind, shadcn/ui, lightweight-charts, recharts.

## Global Constraints

- Deterministic quant engine works with `LLM_ENABLED=false`, `ML_ENABLED=false`, no internet (`docs/architecture.md` §1).
- Point-in-time data: `available_at` gate on fundamentals; `created_at`/`updated_at` on every DB row (`docs/data-model.md` §1).
- No look-ahead, no survivorship bias; walk-forward ML validation (`docs/quant-finance-rules`).
- Modular monolith; no K8s/Kafka/Spark/Celery (`docs/PRD.md` §68).
- Configurable weights everywhere; no magic numbers; `score_components` on every score.
- Smart-money signals labeled `proxy`; AI output labeled `AI_ENRICHED`.
- TDD: failing test first. Ruff + Pyright clean. Backend engines before UI.
- Repo layout per `docs/architecture.md` §69 (README).

---

## CHECKPOINT REGISTER

Resume here. A checkpoint is complete only when: tests pass, ruff/pyright clean, code committed, progress noted in this register.

- [x] **CP0 — Baseline.** Env verified (py3.13, node24, docker). Docs + skills complete. Initial commit of docs/skills.
- [ ] **CP1 — Phase 1 backend core.** Schema + models + migrations; universe seed; provider abstraction + MockProvider; OHLCV ingestion + data quality; technical engine (indicators, structure, momentum, RS); fundamental engine (ratios + scores); breadth + regime; scoring engine; full-market scanner; FastAPI (market/stocks/analysis/screener); job skeleton.
- [ ] **CP2 — Phase 1 frontend.** Terminal shell (topbar, left nav, status bar), dashboard, market overview, screener, stock analysis page, chart system, watchlist, data freshness, score visualization. DESIGN §69-P1.
- [ ] **CP3 — Phase 2.** Smart money engine, factor model, macro engine, economic calendar, news ingestion + sentiment, alerts. DESIGN §69-P2.
- [ ] **CP4 — Phase 3.** ML pipeline (walk-forward, registry, versioning), backtesting engine, risk engine, portfolio analyzer, model transparency. DESIGN §69-P3.
- [ ] **CP5 — Phase 4.** LLM provider layer, NL screener, research assistant, reports. DESIGN §69-P4.

---

## PHASE 1 PLAN (checkpoint CP1 + CP2)

### Backend (CP1)

**File structure:**

```
backend/
  pyproject.toml
  .env.example
  app/
    config/settings.py
    domain/
      stocks/           # Stock, Sector, Industry, Exchange entities + repo interfaces
      market/           # breadth, regime
      technical/        # indicators.py, structure.py, momentum.py, smartmoney.py
      fundamental/      # ratios.py, scoring.py
      scoring/          # opportunity.py, profiles.py
      screener/         # filters.py
    application/
      services/         # scanner.py, analysis.py, screener_service.py
      jobs/             # ingest.py, scan.py, scheduler.py
    infrastructure/
      db/               # base.py, session.py, models.py, repositories/
      providers/        # base.py, mock.py
      parquet/          # store.py
      cache/            # redis.py
    interfaces/
      api/              # app.py, deps.py, routers/market.py stocks.py screener.py system.py
      workers/          # rq.py, supervisor.py
  migrations/           # alembic
  scripts/              # seed_universe.py, ingest_all.py, run_market_scan.py
  tests/
```

**Task list (each task = TDD, commit):**

- T1.1 Scaffold: pyproject, ruff/pyright/pytest config, `.env.example`, `app/config/settings.py` (typed env). Test: settings load.
- T1.2 DB layer: SQLAlchemy Base, session, all P1 models (`stocks`, `sectors`, `industries`, `exchanges`, `universe_history`, `ohlcv_daily`, `quotes`, `index_data`, `financial_statements`, `financial_ratios`, `corporate_actions`, `technical_features`, `fundamental_features`, `stock_scores`, `scoring_profiles`, `market_regimes`, `market_breadth`, `sector_scores`, `data_quality_reports`, `ingestion_runs`, `job_runs`, `data_freshness`, `system_settings`), each with `created_at`/`updated_at`. Alembic init + baseline migration. Test: migration applies on scratch PG; models round-trip.
- T1.3 Universe seed: parse `stock-list.xlsx` → `stocks` + `sectors` + `universe_history`. Test: seeded count matches xlsx rows; Papan Pencatatan values.
- T1.4 Providers: `MarketDataProvider` Protocol + `MockProvider` (deterministic synthetic OHLCV), factory from env. Test: mock returns valid OHLCV.
- T1.5 OHLCV ingestion: job fetches via provider, validates, upserts `ohlcv_daily`, updates `quotes`. Test: upsert idempotent; data quality rows written.
- T1.6 Data quality: validator (missing/dup/abnormal/negative-volume/stale/timestamp) → `data_quality_reports`. Test per rule.
- T1.7 Technical engine (Polars): SMA/EMA/WMA, RSI, MACD, ATR, ADX, Bollinger, stochastic, supertrend, VWAP; returns Polars frame with null warm-up. Test vs known values.
- T1.8 Technical features + momentum + relative strength + structure flags (breakout, HH/HL, support/resistance, gap). Test.
- T1.9 Fundamental engine: ratios from statements (ROE, PER, growth, etc.) with `available_at` gating; profitability/growth/health/valuation/quality scores. Test: PIT (restated row not used before availability).
- T1.10 Scoring engine: `ScoringProfile` (balanced default per PRD §19 weights), `opportunity_score` with `score_components`, classification, confidence. Test: weights configurable, components recorded.
- T1.11 Breadth + regime: advance/decline, %above SMA20/50/200, `market_breadth_score`; regime classification (deterministic). Test.
- T1.12 Scanner: full-universe pipeline (features → scores → rank → cache). Test on mock universe.
- T1.13 API: FastAPI app; `/api/v1/system/health|status`, `/market/overview|breadth|regime|sectors`, `/stocks`, `/stocks/{t}/analysis`, `/screener/run`. Typed, paginated. Test via httpx.
- T1.14 Workers: RQ setup, APScheduler supervisor, job wiring. Test: job enqueued + executed.

### Frontend (CP2)

- T2.1 Scaffold: Next.js app, TS strict, Tailwind, design tokens (`globals.css`), shadcn/ui base, dark theme default.
- T2.2 Shell: topbar (logo, market status, search/`⌘K` placeholder, profile), collapsible left nav (page map), status bar (freshness, jobs).
- T2.3 Typed API client (`lib/api`), formatting (`lib/formatting`: price/%, T/B/M, ratio, score), data-freshness hooks.
- T2.4 Dashboard: market header (IHSG, change, regime, risk), regime card, breadth panel, top opportunities, sector rotation, gainers/losers, macro strip. DESIGN §10-11.
- T2.5 Market overview page. DESIGN §25.
- T2.6 Screener: filter panel + results table (virtualized, sortable, saved views). DESIGN §22-24.
- T2.7 Stock analysis: ticker header, opportunity score component, score bars, price chart (lightweight-charts), tabs (technical/fundamental/valuation). DESIGN §14-20.
- T2.8 Watchlist + score visualization primitives + data-freshness indicators. DESIGN §57, §37, §45.

Phases 2-4 plans are written when their checkpoint is reached (same granularity).
