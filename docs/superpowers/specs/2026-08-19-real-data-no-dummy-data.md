# Real Data: Remove All Dummy Data + Data Crawlers

Date: 2026-08-19

## Problem

The project serves fabricated data in production code paths, on both backend
and frontend:

- **Backend**: `app/domain/reference_data.py` hardcodes macro indicators,
  economic calendar events, news items, and a demo portfolio — served by real
  API routes (`macro.py`, `calendar.py`, `news.py`, `portfolio.py`).
- **Backend**: fabricated `risk_level`/`regime` in `stocks.py`; placeholder
  fields in `market.py` overview; hardcoded `bias_audit` in
  `backtest_service.py`; a test-fixture `_ASOF` date and `assert len(tickers) == 2`
  inside the production scanner; placeholder `SecretStr("test")` LLM keys;
  deterministic template "analysis" text served when LLM is disabled;
  TODO-stub saved-screeners endpoints returning fake ids.
- **Frontend**: fabricated numbers on `stocks/[ticker]`, `research`,
  `data-quality`, `settings`, `dashboard`, `sectors`, `backtest`, `compare`,
  `market`, `macro`, `portfolio`, and static fake statuses in `topbar`,
  `sidebar`, `appshell`.

## Goal

Every page and endpoint shows **real data from a real source, or an honest
empty/loading/error/unavailable state**. No dummy data in production code
paths. Data not provided by yfinance (macro, calendar, news, fundamentals)
comes from real keyless sources via crawler jobs.

## Non-goals

- Auth/accounts for multi-user portfolios (single-user portfolio CRUD only).
- Paid data vendors or API keys.
- AI sentiment enrichment of news (optional, LLM-gated, marked `AI_ENRICHED`).

## Architecture

Follows `docs/data-pipeline.md` §1 and §2.1. Providers implement existing
`Protocol` interfaces in `app/domain/*/interfaces.py`; implementations live in
`app/infrastructure/providers/`.

```
app/domain/{macro,news,fundamental}/interfaces.py   ← Protocols
app/infrastructure/providers/
  ├─ bi_provider.py     (BI public API: JISDOR USD/IDR, BI rate, calendar)
  ├─ fred_provider.py   (FRED CSV: IDN 10Y, US 2Y/10Y, Fed funds, DXY, S&P)
  ├─ news_provider.py   (Google News RSS + Antara RSS, keyless)
  └─ yfinance_provider.py (extended: fundamentals via info/financials)
app/application/jobs/   ← ingest_macro, ingest_calendar, ingest_news,
                          ingest_fundamentals
app/interfaces/workers/ ← RQ wiring, watermark checkpoints
```

- Tables already defined in the schema (0001-0004): `economic_indicators`,
  `economic_events`, `news`, `news_entities`, `portfolios`,
  `portfolio_positions`, `ingestion_checkpoints`. New Alembic migration only
  if a column is genuinely missing.
- Jobs: incremental watermark + overlap window, idempotent upserts on natural
  keys, retry with backoff, `ingestion_runs` audit rows, watermark never
  advanced on failure (per docs §2).
- Scheduler: jobs wired into the existing RQ worker/supervisor (`jobs.py`).

## Crawler data sources

| Provider | Source | Frequency |
|---|---|---|
| Macro | BI public API (`api-biapi.bi.go.id`, keyless): JISDOR USD/IDR, BI rate; FRED CSV: IDN 10Y, US 2Y/10Y, Fed funds, DXY, S&P 500 | daily |
| Calendar | BI rate meeting calendar + major releases | daily |
| News | Google News RSS (per-ticker search), Antara official RSS | every 15 min |
| Fundamentals | yfinance `info` + financial statements → point-in-time `financial_statements`/`financial_ratios` | daily |

Derived values are computed, never hardcoded:

- `risk_level`, `regime` — from volatility/drawdown/momentum features.
- Sector rotation, macro risk/support scores, market breadth — existing
  engines (`sector/rotation.py`, etc.) fed by real macro/OHLCV data.
- Data-quality page — existing `data_quality.py` engine + real freshness.

## Backend changes

1. New providers (`bi_provider.py`, `fred_provider.py`, `news_provider.py`,
   yfinance fundamentals) + factory wiring in settings.
2. New ingestion jobs with watermark checkpoints; wired into `jobs.py` +
   supervisor.
3. Routes rewritten to read DB (empty list when no data):
   - `macro.py`, `calendar.py`, `news.py`
   - `market.py` overview — real sector rotation, macro risk/support, upcoming
     events
   - `stocks.py` — risk/regime derived from features
4. `portfolio.py` — full CRUD (`POST/PUT/DELETE positions`) against
   `portfolios`/`portfolio_positions`; market value / P&L computed from live
   quotes.
5. New routes:
   - `GET /api/v1/data-quality` — exposes existing engine + freshness.
   - `GET /api/v1/system/status` — market open/closed (IDX hours), provider,
     job count, LLM enabled, data freshness, alert count.
6. Fixes:
   - `scanner.py`: remove `_ASOF` fixture and ticker-count assert; scan real
     universe.
   - `backtest_service.py`: compute `bias_audit` for real.
   - `screener.py`: honest empty/404 for saved screeners (no fake ids).
   - `llm_service.py`: disabled → `{status: "unavailable"}`; template text
     removed.
   - `providers.py`: no placeholder keys; real env key or disabled state.

## Frontend changes

Principle: **real data from API, or honest loading/empty/error/unavailable
state** (docs/DESIGN.md §71-72). No fabricated fallback values.

- `stocks/[ticker]`: risk/regime from API; scenario analysis LLM-gated
  (unavailable state when disabled); fundamentals/smart-money/factor scores
  from real endpoints; real price chart (lightweight-charts); badges from
  universe data.
- `research`: Analyze button wired to real LLM endpoint; fake query history /
  saved reports removed; real memos rendered; dead template buttons removed.
- `data-quality`: real route + freshness; loading/error states.
- `settings`: read-only real config; masked real API key; real Redis cache
  stats or "unavailable"; dead buttons removed.
- `dashboard`: real index/scan data; BBCA stand-in removed.
- `sectors`: real rotation data; placeholder chart removed.
- `backtest`: dates/capital wired to state; dead hardcoded metric/trade/
  monthly blocks removed; real equity/drawdown charts from results.
- `compare`: universe API fetch; real defaults.
- `market`, `macro`: real data or empty state; fabricated fallbacks removed.
- `portfolio`: real CRUD UI; P&L from live quotes; honest empty state.
- `topbar`/`sidebar`/`appshell`: statuses from `/system/status`; fake
  "WS Connected"/"API Connected" removed; search wired or removed.

## Testing

- Backend: unit tests per provider (fixture responses), job tests (watermark
  advance, idempotency), route tests reading DB, scanner regression on real
  universe, backtest bias audit test.
- Frontend: component tests updated to assert empty/error states; API client
  tests for new endpoints.
- Validation: pyright, ruff, pytest (backend); tsc --noEmit, eslint, tests
  (frontend). Full-stack: both suites.

## Definition of done

- No dummy/fabricated data in any production code path (backend or frontend).
- Crawlers fetch macro/calendar/news/fundamentals from real keyless sources.
- All pages show real data or honest states.
- All validation passes.
