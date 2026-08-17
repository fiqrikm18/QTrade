# SDD progress ledger
Task 1: complete (commits afa2c33..4344f29, review clean, approved)
Task 2: complete (commits 4344f29..caa8288, review clean after 1 fix, approved)
Task 3: complete (commits caa8288..c4135db, review clean, approved)
Task 4: complete (commits c4135db..dfb5100, review clean, approved; minor: ORM-onupdate vs DB-trigger per data-model.md §1, triage at final review)
Task 5: complete (commit 2b3130d after Important fix: Any→object; review approved with notes; ledger minor doc note: board enum)
Task 6: complete (commit 52b738f, review approved; deferred concern: DB shares lookup in get_quote — ponytail)
Task 7: complete (commit 944e3d4, review approved; live BBCA.JK 6 rows idempotent)
Task 8: complete (commit 49cab74, review pending)
CP1 checkpoint: PASSED
  - pytest 19 passed; ruff clean; pyright strict 0 errors
  - alembic upgrade head clean; stocks/ohlcv_daily have created_at+updated_at
  - seed_universe -> 960 unique stocks (962 rows, 2 dupes collapsed)
  - live ingest BBCA.JK -> 6 real rows in ohlcv_daily
  - supervisor boots; APScheduler + RQ worker; watchdog/ping processed by worker
=== CP2 plan ===
CP2 base: 49cab74 (plan docs/superpowers/plans/2026-08-11-phase2-engines-api-ui.md)
CP2 Task 1: complete (fb7bd85, 21 tests) | CP2 Task 2: complete (4828534, 30 tests)
CP2 Task 3: complete (786b375, 36 tests)
CP2 Task 4: complete (7d62fde, 44 tests)
CP2 Task 5: complete (c3bba2a, 53 tests) => CP2a checkpoint PASSED (technical engine: indicators/features/structure/smart-money/regime)
CP2 Task 6: complete (b9b4b17, 62 tests)
CP2 Task 7: complete (8e1ca02, 71 tests) => CP2b checkpoint PASSED (fundamental ratios + scoring)
CP2 Task 8: complete (25c403a, 77 tests)
CP2 Task 9: complete (815f316, 82 tests) => CP2c checkpoint PASSED (breadth + sector rotation)
CP2 Task 10: complete (719346a, 90 tests)
CP2 Task 11: complete (d8febfb, 91 tests) => CP2d checkpoint PASSED (opportunity score + full-universe scanner)
CP2 Task 12: complete (API routes: market, stocks, screener) => CP2e checkpoint PASSED (API routes)
=== CP2f (Terminal UI pages) ===
CP2 Task 13: IN PROGRESS (frontend rewrite)
  - `bun run build` GREEN (16 routes); `bunx tsc --noEmit` 0 errors; `bunx eslint .` 0 errors (278 unused-var warnings, non-blocking)
  - AppShell moved to src/app/layout.tsx; all pages return bare content (no AppShell import)
  - 12 pages deduped imports; news/page.tsx rewritten (was corrupted); 11 broken pages rewritten by parallel subagents, each 0 tsc
  - Fixed: button.tsx (rewritten, was truncated), badge.tsx, select.tsx (rewritten), input/textarea.tsx, table.tsx, sidebar.tsx (GitCompare/dup href/unused nav), topbar.tsx, appshell.tsx toggle wiring
  - Created src/components/ui/tabs.tsx (dependency-free) — used by data-quality/portfolio/research/stocks
  - Added deps: @radix-ui/react-label@2.1.15, react-separator@1.1.15, react-switch@1.3.7
  - Deleted 23 scratch src/test_* files + custom cva .d.ts files
  - DONE: vitest + testing-library setup (vitest.config.ts, vitest.setup.ts, `bun run test`)
  - DONE: ScoreBar + PriceChange components; semantic tokens --color-positive/negative/warning/info in globals.css (no hardcoded hex)
  - DONE: 9 component tests green (ScoreBar renders score/classification/confidence + token classes; PriceChange formats +/-%, token classes)
  - DONE: PriceChange wired into dashboard movers table
=== CP2g (backend validation + docs) ===
CP2g checkpoint: PASSED
  - pytest 96 passed (isolated to ihsg_quant_test DB via tests/conftest.py POSTGRES_DSN override; dev DB no longer wiped by tests)
  - ruff check app tests scripts PASS; ruff format --check PASS (69 files)
  - pyright app: 0 errors (scanner.py engine typing gaps fixed — the last 30)
  - Baseline at HEAD (56c2cfd) was 136 errors. API layer fully type-clean.
  - Fixed critical bug: schemas.py was missing `from pydantic import BaseModel, ConfigDict` (NameError at import, API would crash on startup)
  - Live scan verified on seeded dev DB: scripts/live_scan.py BBCA.JK 400 -> asof 2026-08-14, 960 rows, BBCA 44.70, Redis scan:balanced:2026-08-14
  - Fixed scanner production-mode bug (explicit_tickers flag; Step 1 reassigned tickers so prod mode was unreachable); LOOKBACK_DAYS 252->380 (200-bar SMA200 needs ~250 sessions)
  - Added get_index_ohlcv + _INDEX_SYMBOLS {"IHSG": "^JKSE"} to yfinance_provider; _idx_symbol handles ^ prefix
  - Real API routes (were stubs): market.py overview/regime/breadth/sectors from score_components + Redis + OHLCV movers; screener.py /run executes real query with filters (min/max opportunity, board via Sector.code, classification, min/max risk) + sector_code in response; stocks.py /technical from real technical_features, /analysis real price/change/volume/turnover/mcap
  - technical_features persisted by scanner Step 11 (TechnicalFeature model, alembic 0003, upsert_technical_features/latest_technical_features)
  - CORS for localhost:3000 in main.py; frontend Next.js rewrite /api/v1/* -> localhost:8000
  - Frontend wired to real API: lib/api.ts typed client; dashboard + screener pages render real data (loading/error/stale states, pagination, board/classification filters)
  - Live E2E verified: overview 200 regime NEUTRAL + BBCA 44.7; analysis 200 (price 6350, -0.39%, mcap 12.2T); screener 200 total 960; technical 200 (rsi 52.5, sma_20 6367.5)
  - Frontend: build GREEN (17 routes), tsc 0, eslint 0 errors (255 unused-var warnings), vitest 9 tests green
  - Docs updated: architecture.md §12 (implementation status), data-model.md §9 (technical_features status), README roadmap Phase 1 status
  - Dev DB state after checkpoint: 960 stock_scores (BBCA 44.70), 1 technical_features row, OHLCV BBCA.JK+IHSG 263 rows each
  - REMAINING: commit this checkpoint (frontend/backend/docs)
=== NEXT: CP3 ===
CP3: ML engine + walk-forward validation + backtesting + versioning (see docs/PRD.md) — write plan doc before starting

=== CP3 checkpoint ===
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
  - pytest 126 passed; ruff clean; pyright 0
