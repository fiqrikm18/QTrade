# Data Pipeline

Ingestion, validation, adjustment, and incremental update strategy.
Schema reference: `docs/data-model.md`.

## 1. Provider abstraction

The application never calls a vendor directly. All data access goes through
domain interfaces (PRD §4, §57). Interfaces are Python `Protocol`s in
`app/domain/*/interfaces.py`. Implementations live in
`app/infrastructure/<vendor>/`.

```python
class MarketDataProvider(Protocol):
    def get_universe(self) -> list[UniverseItem]: ...
    def get_ohlcv(self, ticker: str, start: date, end: date) -> DataFrame: ...
    def get_quote(self, ticker: str) -> Quote: ...
    def get_market_cap(self, ticker: str) -> Decimal: ...
    def get_intraday(self, ticker: str, interval: str,
                     start: datetime, end: datetime) -> DataFrame: ...

class FundamentalDataProvider(Protocol):
    def get_financial_statements(self, ticker: str) -> DataFrame: ...
    def get_ratios(self, ticker: str) -> DataFrame: ...

class CorporateActionProvider(Protocol):
    def get_actions(self, ticker: str, start: date, end: date) -> DataFrame: ...

class NewsProvider(Protocol):
    def get_news(self, tickers: list[str] | None, since: datetime) -> DataFrame: ...

class EconomicCalendarProvider(Protocol):
    def get_calendar(self, start: date, end: date) -> DataFrame: ...

class MacroEconomicProvider(Protocol):
    def get_indicators(self, codes: list[str], start: date, end: date) -> DataFrame: ...

class IndexDataProvider(Protocol):
    def get_index_ohlcv(self, index: str, start: date, end: date) -> DataFrame: ...
```

Factories resolve providers from config:
`MARKET_DATA_PROVIDER=yfinance|idxc|idnfinancials|mock`. A `MockProvider`
(deterministic synthetic data) ships for offline dev/test. A vendor is
swappable by changing one env var + one implementation — nothing else changes.

## 2. Ingestion jobs

RQ jobs, defined in `app/interfaces/workers/`, orchestrated by
`app/application/jobs/`, enqueued by the **scheduler process** (below).

| Job | Frequency | Writes |
|---|---|---|
| `ingest_universe` | daily | `stocks`, `universe_history` |
| `ingest_ohlcv_daily` | after close + on-demand | `ohlcv_daily`, `quotes` |
| `ingest_ohlcv_intraday` | as available | `ohlcv_intraday` |
| `ingest_fundamentals` | on report/quarterly | `financial_statements`, `financial_ratios` |
| `ingest_corporate_actions` | daily | `corporate_actions`; then rebuild adjustment factors |
| `ingest_macro` | daily | `economic_indicators` |
| `ingest_calendar` | daily | `economic_events` |
| `ingest_news` | every N minutes | `news`, `news_entities` |
| `calculate_features` | after market data | versioned feature tables |
| `run_market_scan` | after features | `stock_scores`, rankings, cache |
| `ml_inference` | after scan | `ml_predictions` |
| `train_model` | weekly/manual | `ml_models` + artifacts |
| `run_alerts` | after scan | `alert_events` |
| `refresh_parquet` | daily | Parquet + DuckDB views |

Job discipline:

- Idempotent. Upserts keyed on natural unique keys.
- Each job records a row in `job_runs` / `ingestion_runs`.
- Failures: retry with backoff (RQ default), then mark `failed` and alert via
  `run_alerts` watchdog. Never leave partial state that looks complete —
  `status=partial` + error details.
- Latest-run and freshness in `data_freshness`.

## 2.1 Scheduler & crawling engine

**Goal:** fetch the latest data automatically and keep it fresh — daily
market data after IDX close, fundamentals when reported, news intraday,
macro on release. Runs on a small VPS with no external orchestration.

### Architecture

```
SCHEDULER PROCESS (APScheduler, one container)
  ├─ cron triggers → enqueue RQ job → WORKER fetches via provider → validate → upsert
  ├─ DAG-style chaining: ingest_ohlcv → calculate_features → run_market_scan
  │        → ml_inference → run_alerts   (enqueue next when prev succeeds)
  └─ watchdog: staleness scan → alert on failed/stale ingestion
```

- **Scheduler:** a long-running process using APScheduler (`CronTrigger`) in
  the worker container. Each trigger enqueues an RQ job; jobs execute in
  workers. `ponytail:` split into a dedicated scheduler container only when
  jobs need distributed locking or persisted state beyond `job_runs`.
- **Chaining:** `job_finished` hooks enqueue downstream jobs. The scan chain
  only runs if the upstream ingest succeeded — a failed ingest must not
  trigger a scan over stale data.
- **On-demand:** the API can enqueue any job via
  `POST /api/v1/system/jobs/{name}` (admin), e.g. one-off backfill or
  catch-up after an outage.

### Crawling engine

A crawler is an ingestion job that walks a provider incrementally. All
crawlers share this behavior:

- **Incremental crawling with watermark.** Each job reads its checkpoint from
  `ingestion_checkpoints` (last fetched boundary), fetches only
  `watermark → now`, then advances the watermark. Never refetch the whole
  history on a routine run.
- **Overlap window.** Always refetch the last N units (e.g. 2 sessions for
  OHLCV, 1 hour for news) beyond the watermark to absorb provider
  revisions/restatements; upsert overwrites the overlap.
- **Backfill.** Initial load (`backfill_ohlcv` script, `start`/`end` args)
  fetches full history using the same code path. Backfill writes to
  Parquet + PG rolling window.
- **Rate limiting & politeness.** Provider limits enforced in the provider
  adapter (requests/sec, per-minute caps). News crawlers respect
  `robots.txt`/ToS; PRD §17 source preference order is law — crawl only
  where legal and appropriate, prefer official APIs/RSS.
- **Retry policy.** Per-provider retry count with exponential backoff +
  jitter; 429/5xx → back off; repeated failure → job `failed`, watchdog
  alert, watermark NOT advanced.
- **Idempotent writes.** Upsert on natural keys (`(ticker, trade_date,
  provider)` etc.) so retries never duplicate rows.
- **Never clobber good data.** If a fetch validates badly, keep last good
  rows; record `status=partial` + error. Data is only replaced by newer
  validated data.
- **Concurrency.** Bounded workers (default 2-4). OHLCV fetched in provider
  batches (e.g. 50 tickers/request where the API allows); vectorized
  validation via Polars before upsert.

### Scheduler matrix (defaults, configurable via `system_settings`)

| Job | Cron (WIB) | Trigger note |
|---|---|---|
| `ingest_universe` | 00:30 daily | |
| `ingest_ohlcv_daily` | 16:15 Mon-Fri | after IDX close (15:50) + provider settle |
| `ingest_corporate_actions` | 16:30 Mon-Fri | then rebuild factors |
| `ingest_fundamentals` | 17:00 daily | |
| `ingest_macro` | 18:00 daily | |
| `ingest_calendar` | 06:00 daily | |
| `ingest_news` | every 15 min | |
| `calculate_features` | chain after ingest | |
| `run_market_scan` | chain after features | |
| `ml_inference` | chain after scan | |
| `run_alerts` | chain after scan | |
| `refresh_parquet` | 03:00 daily | |

### Freshness & watchdog

- `data_freshness` records `last_updated_at`, `max_trade_date`, expected
  cadence per table. The watchdog job (every 30 min) flags tables past their
  expected freshness as `stale` and raises a `run_alerts` entry —
  `DATA STALE` is surfaced in the UI per `docs/DESIGN.md` §37.
- Job runs tracked in `job_runs`/`ingestion_runs` for auditability
  (`docs/data-model.md` §13).

## 3. Ingestion → storage mapping

```text
provider raw frame
  → normalize columns to canonical names (ticker, trade_date, o,h,l,c,v...)
  → validate (below)
  → upsert into PG (dedupe on natural key)
  → append raw to Parquet for long history
```

Normalization keeps `provider` column so provenance survives.

## 4. Data quality checks

Every ingestion passes through a validator (PRD §37). Checks:

| Check | Rule |
|---|---|
| Missing OHLCV | no gaps inside exchange-trading windows; report count of missing days |
| Duplicate rows | dedupe on natural key; log count |
| Abnormal prices | high < low, open/close outside [low, high], price <= 0, extreme moves > configurable pct |
| Negative/zero volume | reject with flag |
| Stale data | `max(trade_date)` vs expected cadence; mark `stale` |
| Timestamp consistency | `source_timestamp` sanity; `effective <= source + tolerance` |
| Corporate action consistency | factor monotonicity; no missing ex-date adjustments |
| Fundamental sanity | negative debt, implausible ratios flagged (not dropped) |

Outcome: row-level flags + `data_quality_reports` row per ticker. Scores use
`quality_score` as a weighting/bias input — a stock with `quality_score < 60`
is excluded from ranking by default (configurable).

## 5. Corporate action handling

The correct adjustment chain (PRD §3) is critical.

1. Ingest corporate actions with `ex_date` and `ratio`.
2. For each action compute its factor on raw price series:
   - split `2:1` → factor 2 applied to prices **before** ex_date.
   - bonus/rights → factor = `(old_shares + bonus_shares)/old_shares`.
   - dividend → **not** a price factor for OHLC continuity by default; track
     separately in `dividends` for yield. (Total-return series optional.)
3. Build cumulative `adjustment_factor` per (ticker, trade_date): product of
   all future actions' factors. Stored per row in `ohlcv_daily`.
4. `adj_close = close * adjustment_factor`. Derived series are computed, never
   stored as a separate edited history.
5. Rebuild factors in a single vectorized Polars pass whenever new actions
   land. Validate: no factor jumps unexplained by a recorded action.

`ponytail:` Right-of-issue cash components and tax withholdings are ignored
for OHLC adjustment; add if backtests need total-return precision.

## 6. Point-in-time fundamentals

- Store every statement snapshot as delivered (`available_at` = when provider
  served it, or `reported_at + reporting_delay` if provider doesn't expose
  availability).
- Never backfill a restatement into the past as if it had always been known.
- Feature/ratio computation joins on `available_at <= asof`, taking the latest
  statement per (ticker, asof). This is the anti-look-ahead rule for
  fundamental data. Unit-tested explicitly.

## 7. Incremental update strategy

- Daily OHLCV: fetch from `last_trade_date + 1` to today (plus 1 extra day of
  overlap for provider revision). Upsert overwrites the overlap window.
- Fundamentals: fetch since last known `available_at`; upsert.
- Features: compute **only** the changed tail (`asof >= last_computed - lookback`).
  Lookback = maximum indicator window (e.g. 220 sessions) so warm-up is
  correct.
- Scores/regime: recompute from cached features for changed dates; regime is
  market-wide → recompute once per scan.
- ML: infer only for `asof >= last_prediction - horizon + 1` rows that need
  refreshing.

## 8. Full-market scan (the hot path)

Optimized for `~800 stocks × 5y daily`. Pipeline (PRD §38):

```
load universe → load latest market data → validate → features → technical →
fundamental → smart money → sector → macro → ML inference → quant score →
rank → cache → API
```

Implementation notes:

- Do everything in Polars: one long-frame of all tickers, grouped
  computations via `group_by("ticker")` + expression API. **No Python loops
  over stocks.**
- Indicator window functions are vectorized; avoid per-ticker Python.
- Sector/macro context computed once, joined in.
- Scores computed per ticker, then `rank` across universe.
- Cache result set in Redis (`scan:v1:{profile}:{asof}`) + persist to
  `stock_scores`.
- LLM is **never** invoked in the scan. ML inference runs in the same pass if
  `ML_ENABLED`, else skipped.

Target: full universe in well under 30 min on 2-4 CPU / 4-8 GB. If slower,
profile before scaling hardware (PRD §65: optimize before scaling vertically).

## 9. Parquet refresh

- Partition layout: `data/parquet/ohlcv/ticker={T}/year={Y}/part.parquet`.
- Daily job appends new rows; monthly compaction.
- DuckDB views over these partitions power notebooks, backtests, ML feature
  matrices, and research. PG holds a rolling window for live API reads.

## 10. Caching rules

- Cache **results**, not source-of-truth: scores, rankings, regime, breadth,
  computed indicators at API time.
- Redis keys namespaced `{domain}:{version}:{key}`; TTL = expected staleness
  (scan results survive until next scan, config).
- Provider responses cached short-TTL only for throttled endpoints.
- Invalidation: jobs bump `data_freshness`; API cache TTLs derived from it.

## 11. Error handling & backfills

- Per-job error lists in `job_runs.errors`.
- A failed provider fetch never clobbers existing good data — upsert only on
  successful validate.
- Backfill scripts (`backend/scripts/backfill_*.py`) take (start, end, ticker)
  and reuse the same ingestion paths so guarantees hold.
- Reproducibility: `feature_version` / `scoring_version` / `model_version`
  recorded on every derived artifact (see `docs/data-model.md` §9-10).
