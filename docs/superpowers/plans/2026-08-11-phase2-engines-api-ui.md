# Phase 2 — Engines + API + Terminal UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working Phase 1 engines (technical, fundamental, breadth, sector, scoring, scanner), FastAPI routes (typed contracts), and terminal UI (Next.js + shadcn/ui) — all TDD, typed, SOLID, real data, checkpointed.

**Architecture:** Modular monolith (`app/{domain, application, infrastructure, interfaces}`). Engines are pure functions in `domain/` with Protocol interfaces; infrastructure implements (Postgres repos); application orchestrates (scan pipeline); interfaces exposes REST + RQ jobs. UI: Next.js App Router, TypeScript, Tailwind, shadcn/ui — dark terminal theme, dense tables, explainable scores (DESIGN.md §70).

**Tech Stack (additions to CP1):** FastAPI API routes, Pydantic response models, `httpx` for tests; Next.js 14 (App Router), `lightweight-charts` (price), `recharts` (dashboards), `tanstack/react-table` (screener), `zod` validation, `axios` + React Query.

## Phase Roadmap Checkpoints

| Checkpoint | Scope | Deliverable | Verify |
|---|---|---|---|
| CP2a | Technical engine | indicators, price structure, smart-money proxies, regime | indicator tests; real BBCA frame → scores |
| CP2b | Fundamental engine | ratios, quality/growth/health/valuation scoring, PIT | ratio tests; fundamental features for seeded stocks |
| CP2c | Breadth + Sector | market breadth, sector rotation, sector scores | breadth/sector tables populated |
| CP2d | Scoring + Scanner | opportunity score profiles, full-universe scan, rankings | scan job runs; Redis cache → API |
| CP2e | API routes | `/api/v1/market/*`, `/stocks/{ticker}/*`, `/screener`, `/recommendations` | contract tests; OpenAPI matches DESIGN.md pages |
| CP2f | Terminal UI shell | app shell, dashboard, screener, stock page, watchlist | real data renders; dark theme, density |
| CP2g | CP2 checkpoint | all green; live scan + UI shows real scores | `pytest` + UI loads real scores |

## Global Constraints (extends CP1)

- No mock data in runtime. All engines tested on real DB frames (seeded stocks + BBCA OHLCV).
- Strict typing: Pyright strict (backend), TypeScript strict (frontend). No `Any` without reason.
- SOLID: engine interfaces in `domain/` (pure Python/Polars); repos in `infrastructure`; services in `application`; routes in `interfaces/api`.
- Point-in-time: `available_at` gates fundamentals; `created_at`/`updated_at` on all tables; feature_version/scoring_version on derived artifacts.
- Versioning: every score stores `score_components` with drivers/risks/invalidation; deterministic path works with ML/LLM disabled.
- UI: DESIGN.md §70-72 binding (dark terminal, dense, explainable, data freshness, loading/error/stale/unavailable states).
- TDD: failing test first for each engine/route/component.
- Commit after each task with conventional messages.

---
## CP2a Tasks — Technical Engine

### Task 1: Indicator engine (pure domain functions)

**Files:**
- Create: `backend/app/domain/technical/indicators.py`
- Create: `backend/app/domain/technical/__init__.py`
- Test: `backend/tests/test_indicators.py`

**Interfaces:**
- Consumes: nothing (pure Polars/numpy)
- Produces (all typed):
  - `sma(close: pl.Series, n: int) -> pl.Series`
  - `ema(close: pl.Series, n: int) -> pl.Series`
  - `rsi(close: pl.Series, n: int = 14) -> pl.Series`
  - `macd(close: pl.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> tuple[pl.Series, pl.Series, pl.Series]`
  - `atr(df: pl.DataFrame, n: int = 14) -> pl.Series` (df has high/low/close)
  - `bollinger(close: pl.Series, n: int = 20, k: float = 2.0) -> tuple[pl.Series, pl.Series, pl.Series]`
  - `roc(close: pl.Series, n: int) -> pl.Series`
  - `adx(df: pl.DataFrame, n: int = 14) -> pl.Series`
  - `relative_volume(volume: pl.Series, n: int = 20) -> pl.Series`
  - `historical_volatility(close: pl.Series, n: int = 20) -> pl.Series` (annualized)
  - `stochastic(df: pl.DataFrame, k: int = 14, d: int = 3) -> tuple[pl.Series, pl.Series]`

- All functions return Series aligned to input length with `null` for warm-up rows (no look-ahead: all rolling windows use `shift`/rolling, never `shift(-n)`).

- [ ] **Step 1: Write failing tests** — `tests/test_indicators.py`: `test_sma` (5-window on [1,2,3,4,5,6] → [null,null,null,null,3,4]), `test_rsi_bounds` (rsi in [0,100], nulls warm-up), `test_macd_shapes`, `test_atr_positive`, `test_bollinger_band_order` (upper≥mid≥lower), `test_roc`, `test_relative_volume` (constant volume → 1.0), `test_hist_vol_nonnegative`. Use `pl.Series`/`pl.DataFrame` construction, no file IO.

- [ ] **Step 2: Run to verify fail** — `cd backend && .venv/bin/pytest tests/test_indicators.py -v` → FAIL `ModuleNotFoundError`.

- [ ] **Step 3: Implement** `indicators.py` — each function as pure Polars expression (`close.rolling_mean(n)`, `close.ewm_mean(alpha=2/(n+1), min_samples=n)`, Wilder RSI via recursive `ewm_mean(alpha=1/n)`, etc.). ATR via `max(high-low, abs(high-prev_close), abs(low-prev_close))` → `rolling_mean(n)` or Wilder. No pandas. Type hints `-> pl.Series` on all.

- [ ] **Step 4: Verify pass** — `pytest tests/test_indicators.py -v` PASS; `ruff check app tests` clean; `pyright app` clean.

- [ ] **Step 5: Commit** — `git add backend && git commit -m "feat: technical indicator engine (pure polars functions)"`

### Task 2: Feature builder (vectorized, versioned)

**Files:**
- Create: `backend/app/application/services/features.py`
- Test: `backend/tests/test_feature_builder.py`

**Interfaces:**
- Consumes: `indicators.py` Task 1
- Produces:
  - `FEATURE_VERSION = "v1"`
  - `build_technical_features(df: pl.DataFrame) -> pl.DataFrame` — input: ticker, trade_date, open/high/low/close/volume; output: all indicators from Task 1 as columns (`rsi_14`, `macd`, `macd_signal`, `macd_hist`, `sma_20`, `sma_50`, `sma_200`, `ema_20`, `atr_14`, `boll_upper/mid/lower`, `roc_20`, `adx_14`, `rel_volume`, `hist_vol_20`, `stoch_k`, `stoch_d`) + `feature_version` column.
  - Grouped by `ticker` (group_by in Polars) so indicators are per-stock.

- [ ] **Step 1: Failing test** — `test_build_technical_features_has_expected_columns` (small frame 2 tickers, 60 rows each → output has 18+ indicator columns + feature_version='v1', no nulls after warm-up in a mature region, group_by preserved). RED.

- [ ] **Step 2-3: Implement** — `features.py` builds a lazy frame, `group_by("ticker")`, applies indicator functions, writes `feature_version` literal.

- [ ] **Step 4: Verify** — PASS; ruff+pyright clean.
- [ ] **Step 5: Commit** — `feat: vectorized technical feature builder`

### Task 3: Price structure detection

**Files:**
- Create: `backend/app/domain/technical/structure.py`
- Test: `backend/tests/test_structure.py`

**Interfaces:**
- Produces:
  - `detect_structure(df: pl.DataFrame, swing_k: int = 5) -> pl.DataFrame` — adds columns: `swing_high`, `swing_low` (booleans), `hh`, `hl`, `lh`, `ll` (booleans), `support_levels` (list of floats), `resistance_levels` (list of floats), `breakout` (bool, close > resistance), `breakdown` (bool, close < support), `consolidation` (bool, range within 1.5*ATR for ≥10 sessions), `gap_up`, `gap_down`.

- [ ] **Step 1: Failing test** — synthetic uptrend then consolidation then breakout; assert HH/HL present in uptrend, breakout True at the breakout bar, no `null`/NaN. RED.
- [ ] **Step 2-3: Implement** — swing detection via Polars shift windows, level clustering (recent swings within 1.5×ATR merged), breakout/consolidation rules per docs/technical-analysis.md §6.
- [ ] **Step 4-5: Verify + Commit** — `feat: price structure detection`

### Task 4: Smart-money proxies

**Files:**
- Create: `backend/app/domain/technical/smart_money.py`
- Test: `backend/tests/test_smart_money.py`

**Interfaces:**
- Produces:
  - `smart_money_score(df: pl.DataFrame) -> pl.Series` — 0-100 proxy (accumulation: price compression + volume on up-moves; volume behavior; price structure from Task 3; relative strength placeholder; liquidity via turnover percentile; volatility behavior) — labeled `proxy` in column `sm_label`.
  - Components dict in `score_components` for explainability.

- [ ] **Step 1: Failing test** — synthetic accumulation pattern → score > 60; distribution pattern → score < 40; `sm_label` column contains `"proxy"` prefix. RED.
- [ ] **Step 2-3: Implement** — weighted blend of 6 components (docs/technical-analysis.md §7), each 0-100, configurable weights in a `SmartMoneyConfig` dataclass.
- [ ] **Step 4-5: Verify + Commit** — `feat: smart-money proxy scoring`

### Task 5: Market regime engine

**Files:**
- Create: `backend/app/domain/technical/regime.py`
- Test: `backend/tests/test_regime.py`

**Interfaces:**
- Produces:
  - `detect_regime(index_df: pl.DataFrame, breadth_score: float | None = None, volatility_regime: str | None = None) -> str` — one of `STRONG_BULLISH/BULLISH/NEUTRAL/WEAK_BEARISH/BEARISH/HIGH_VOLATILITY/RISK_ON/RISK_OFF` (docs/technical-analysis.md §9, PRD §14).
  - `regime_components(index_df) -> dict[str, float]` — trend score, momentum score, volatility score, breadth tilt, correlation tilt for explainability.

- [ ] **Step 1: Failing test** — synthetic rising index → BULLISH/STRONG_BULLISH; falling → BEARISH; sideways → NEUTRAL; high vol → HIGH_VOLATILITY. RED.
- [ ] **Step 2-3: Implement** — thresholded weighted rule set (IHSG trend = SMA50/200 alignment + slope; momentum = 20D/60D returns; vol = HV percentile; breadth/macro tilt optional params).
- [ ] **Step 4-5: Verify + Commit** — `feat: deterministic market regime engine`
- [ ] **Step 6: CP2a checkpoint** — `pytest` green; `ruff` + `pyright` clean; indicator smoke on real BBCA frame (from Task 7 CP1).

## CP2b Tasks — Fundamental Engine

### Task 6: Ratio calculation (PIT-aware)

**Files:**
- Create: `backend/app/domain/fundamental/ratios.py`
- Test: `backend/tests/test_ratios.py`

**Interfaces:**
- Produces:
  - `@dataclass FundamentalSnapshot: ticker, asof_date, available_at, period_end, is_annual, items (dict[str, float])`
  - `@dataclass RatioSet: per, pbv, roe, roa, roic, npm, gpm, opm, debt_equity, current_ratio, interest_coverage, fcf_yield, dividend_yield, ... (dict)` — each `float | None`
  - `calculate_ratios(snapshot: FundamentalSnapshot, price: float, shares_outstanding: float | None) -> RatioSet` — pure math, all `available_at`-aware.
  - `latest_snapshot(statements: list[FundamentalSnapshot], asof: date) -> FundamentalSnapshot | None` — point-in-time selection (`available_at <= asof`, latest `period_end`).

- [ ] **Step 1: Failing test** — known numbers → PER = price/eps, ROE = ni/equity, ROIC with invested capital; `latest_snapshot` picks latest available, never future; None when only future statements. RED.
- [ ] **Step 2-3: Implement** — pure functions, `available_at` gate, no division by zero (None instead).
- [ ] **Step 4-5: Verify + Commit** — `feat: fundamental ratio engine (point-in-time aware)`

### Task 7: Fundamental scoring

**Files:**
- Create: `backend/app/domain/fundamental/scoring.py`
- Test: `backend/tests/test_fundamental_scoring.py`

**Interfaces:**
- Produces:
  - `fundamental_score(ratios: RatioSet, sector_ratios: list[RatioSet], history_ratios: list[RatioSet]) -> dict[str, float | dict]` — `quality_score`, `growth_score`, `financial_health_score`, `valuation_score`, `profitability_score` (0-100 each) + `score_components` (percentile ranks vs sector + own history). Weights configurable via `FundamentalWeights` dataclass.

- [ ] **Step 1: Failing test** — high-ROE/ROIC + low D/E → profitability/health high; expensive PER vs sector → valuation low; components present. RED.
- [ ] **Step 2-3: Implement** — percentile-based (docs/fundamental-analysis.md §3), never hardcoded weights.
- [ ] **Step 4-5: Verify + Commit** — `feat: fundamental scoring framework`

## CP2c Tasks — Breadth + Sector

### Task 8: Market breadth engine

**Files:**
- Create: `backend/app/domain/market/breadth.py`
- Test: `backend/tests/test_breadth.py`

**Interfaces:**
- Produces:
  - `market_breadth(stock_frames: list[pl.DataFrame], index_df: pl.DataFrame) -> pl.DataFrame` — per-trade_date: advance/decline, new highs/lows, pct_above_sma20/50/200, rsi_breadth, volume_breadth, breakout_breadth, momentum_breadth, `breadth_score` (weighted 0-100).

- [ ] **Step 1: Failing test** — 3 synthetic stocks (2 up, 1 down) → advance=2, decline=1; pct_above_sma20 correct; breadth_score present. RED.
- [ ] **Step 2-3: Implement** — vectorized per-date aggregation, weights configurable.
- [ ] **Step 4-5: Verify + Commit** — `feat: market breadth engine`

### Task 9: Sector rotation

**Files:**
- Create: `backend/app/domain/sector/rotation.py`
- Test: `backend/tests/test_sector_rotation.py`

**Interfaces:**
- Produces:
  - `sector_score(sector_frames: dict[str, pl.DataFrame], index_df: pl.DataFrame) -> pl.DataFrame` — per sector per date: performance (1M/3M), relative strength vs IHSG, momentum, volume trend, breadth (% members above SMA50), `rotation_class` (leading/improving/weakening/lagging from momentum×RS matrix), `sector_score` (0-100).
  - `sector_membership: dict[str, list[str]]` from `stocks.sector_id` (seeded — sectors seeded in Task CP1? if sector_id null, group by board as fallback and note).

- [ ] **Step 1: Failing test** — 2 synthetic sectors, one rising vs index (→ leading), one falling (→ lagging); classes correct. RED.
- [ ] **Step 2-3: Implement** — 2D momentum×RS matrix per docs/scoring.md §3.
- [ ] **Step 4-5: Verify + Commit** — `feat: sector rotation engine`

## CP2d Tasks — Scoring + Scanner

### Task 10: Opportunity score

**Files:**
- Create: `backend/app/domain/scoring/opportunity.py`
- Test: `backend/tests/test_opportunity.py`

**Interfaces:**
- Produces:
  - `@dataclass ScoringProfile: name, weights: dict[str, float]` — seeded profiles: balanced, aggressive, conservative, value, momentum, swing, long_term (docs/scoring.md §1).
  - `@dataclass ScoreComponents: technical, fundamental, momentum, relative_strength, smart_money, factor, sector, macro, risk, ml (float | None), drivers: list[str], risks: list[str], invalidation: list[str]`
  - `opportunity_score(components: ScoreComponents, profile: ScoringProfile) -> float` — weighted 0-100, renormalized when components None.
  - `classification(score: float, risk_score: float) -> str` — opportunity/watchlist/neutral/high_risk/avoid.

- [ ] **Step 1: Failing test** — balanced weights from PRD §19 → known score; missing ML component renormalizes (weights sum to 100 excluding None); classification boundaries. RED.
- [ ] **Step 2-3: Implement** — pure function + `ScoringProfile` seeded in DB (`scoring_profiles` table, default balanced).
- [ ] **Step 4-5: Verify + Commit** — `feat: opportunity score engine`

### Task 11: Full-universe scanner

**Files:**
- Create: `backend/app/application/services/scanner.py`
- Test: `backend/tests/test_scanner.py`

**Interfaces:**
- Consumes: all engines (Tasks 1-10), repos, `get_session`
- Produces:
  - `run_market_scan(session, profile: ScoringProfile = balanced) -> ScanResult` — loads all tickers' OHLCV (from `ohlcv_daily`), builds features (Task 2), computes technical (structure/smart-money/regime), breadth (Task 8), sector (Task 9), fundamentals (Task 6-7, PIT), opportunity score (Task 10), ranks, writes `stock_scores` rows (with score_components jsonb, scoring_version, feature_version), caches top-N in Redis.
  - `@dataclass ScanResult: asof, rows_written, ranking (list[tuple[str, float]])`

- [ ] **Step 1: Failing test** — tiny DB fixture (2 tickers, 60 days synthetic but real-shaped OHLCV upserted) → scan writes 2 score rows with components, ranks by score, idempotent re-run. Uses real DB, fake-free. RED.
- [ ] **Step 2-3: Implement** — scan pipeline per docs/data-pipeline.md §8; write `stock_scores`, cache rankings in Redis.
- [ ] **Step 4-5: Verify + Commit** — `feat: full-universe market scanner`

## CP2e Tasks — API Routes

### Task 12: Market + stocks + screener API

**Files:**
- Create: `backend/app/interfaces/api/router.py` (mount `/api/v1`)
- Create: `backend/app/interfaces/api/routes/market.py`, `stocks.py`, `screener.py`
- Create: `backend/app/interfaces/api/schemas.py` (Pydantic response models)
- Test: `backend/tests/test_api.py` (httpx)

**Interfaces:**
- Produces (FastAPI, Pydantic v2 typed):
  - `GET /api/v1/market/overview` → regime, breadth, top gainers/losers, top opportunities
  - `GET /api/v1/market/regime` → regime + components
  - `GET /api/v1/stocks/{ticker}/analysis` → opportunity_score, components, drivers/risks/invalidation, freshness
  - `GET /api/v1/stocks/{ticker}/technical` → indicators latest values
  - `POST /api/v1/screener/run` → filter JSON → ranked results (typed filters: sector, min_opportunity, rsi_range, etc.)
  - `GET /api/v1/stocks` → paginated universe
- All read from DB/Redis; no computation on request path (docs/architecture.md §6).

- [ ] **Step 1: Failing test** — httpx `TestClient` on app; GET `/api/v1/market/overview` returns 200 + typed fields (uses seeded DB); screener run filters by min_opportunity. RED.
- [ ] **Step 2-3: Implement** — routes + schemas, DI `get_session`.
- [ ] **Step 4-5: Verify + Commit** — `feat: market, stocks, screener API routes`

## CP2f Tasks — Terminal UI

### Task 13: Next.js scaffold + design system

**Files:**
- Create: `frontend/{package.json, tsconfig.json, next.config.mjs, tailwind.config.ts, app/layout.tsx, app/globals.css, components/ui/*}` (shadcn/ui base)
- Create: `frontend/lib/api.ts` (typed fetch client)
- Create: `frontend/app/dashboard/page.tsx` (dashboard, DESIGN.md §10-11)
- Create: `frontend/app/screener/page.tsx` (screener, DESIGN §22-24)
- Create: `frontend/app/stocks/[ticker]/page.tsx` (stock terminal, DESIGN §14-18)

**Interfaces:**
- Consumes: API Task 12 (typed contracts via OpenAPI)
- Produces: dark theme tokens (DESIGN §3), app shell (topbar/nav/statusbar, DESIGN §6-9), dashboard/screener/stock pages rendering real data.

- [ ] **Step 1: Failing test** — component tests (vitest + testing-library): `ScoreBar` renders score/classification/confidence; `PriceChange` formats +1.42%; dark token classes applied (not hardcoded hex).
- [ ] **Step 2-3: Scaffold + Implement** — shadcn/ui init, tokens in globals.css, app shell, pages with loading/error/stale/unavailable states (DESIGN §39-41, §65).
- [ ] **Step 4-5: Verify + Commit** — `feat: terminal UI shell + dashboard/screener/stock pages` + `npm run build` passes, `npm run lint` clean, `npm run test` green.

## CP2g — Final Checkpoint

- [ ] Backend: `pytest` green, ruff+pyright clean; scan job real on seeded DB (BBCA real OHLCV → real score)
- [ ] API: contract tests pass; OpenAPI matches pages
- [ ] Frontend: build + lint + test green; renders real API data (screener table with real scores)
- [ ] Live: `run_market_scan` → `stock_scores` populated; dashboard shows real BBCA score
- [ ] Update docs: architecture.md §12, data-model.md §9 (feature tables), README roadmap

---
