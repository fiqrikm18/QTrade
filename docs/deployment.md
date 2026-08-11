# Deployment

Runs on a small VPS (target 2-4 CPU / 4-8 GB RAM / SSD, PRD §39, §65).
Docker Compose on a single host. No Kubernetes/Kafka/Spark
(PRD §68) until scale requires it.

## 1. Services

`docker-compose.yml`:

| Service | Image | Purpose | Exposed |
|---|---|---|---|
| `postgres` | postgres:16-alpine | system of record | 5432 (internal) |
| `redis` | redis:7-alpine | cache, RQ broker | 6379 (internal) |
| `backend` | build `docker/backend` | FastAPI app | 8000 |
| `worker` | same image, scheduler + `rq worker` | background jobs + job scheduling | — |
| `frontend` | build `docker/frontend` | Next.js | 3000 |
| `reverse-proxy` | nginx/caddy | TLS, routing /api→backend, /→frontend | 80/443 |

`ponytail:` Backend/worker share an image (thin, ~200MB). Split binaries only
if startup/latency demands it.

`ponytail:` `pgbouncer` is **not** in the baseline compose — add it as a
service (transaction pooling) only when API/worker concurrency makes idle
Postgres connections a bottleneck (§3 tuning).

### `docker-compose.yml` (skeleton)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ihsg_quant
      POSTGRES_USER: ihsg
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U ihsg"], interval: 10s, retries: 5 }

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes: [redis_data:/data]

  backend:
    build: ./docker/backend
    env_file: .env
    depends_on: [postgres, redis]
    ports: ["8000:8000"]

  worker:
    build: ./docker/backend
    command: python -m app.interfaces.workers.supervisor   # starts APScheduler + rq worker
    env_file: .env
    depends_on: [postgres, redis]

  frontend:
    build: ./docker/frontend
    env_file: .env
    depends_on: [backend]
    ports: ["3000:3000"]

volumes:
  pg_data: {}
  redis_data: {}
```

## 2. Environment variables (`.env.example`)

```
# app
APP_ENV=production
SECRET_KEY=<random>
POSTGRES_DSN=postgresql+psycopg://ihsg:PASS@postgres:5432/ihsg_quant
REDIS_URL=redis://redis:6379/0
DATA_DIR=/app/data

# data providers (vendor-specific, server-side only)
MARKET_DATA_PROVIDER=...
FUNDAMENTAL_DATA_PROVIDER=...
NEWS_PROVIDER=...
MACRO_PROVIDER=...
<PROVIDER_API_KEY>=...

# AI flags
AI_ENABLED=true
LLM_ENABLED=false
LLM_PROVIDER=openai|anthropic|google|openrouter|ollama
LLM_MODEL=...
LLM_TEMPERATURE=0.2
LLM_ANALYSIS_ENABLED=true
...
ML_ENABLED=true

# scoring
DEFAULT_SCORING_PROFILE=balanced

# jobs
SCAN_CRON=0 7 * * 1-5
INGEST_CRON=0 16 * * 1-5
ALERT_CRON=*/30 * * * *

# observability
LOG_LEVEL=INFO
```

**Never commit real secrets.** `.env` is gitignored; `.env.example` has
placeholders. Provider keys exist only in backend/worker env, never in the
frontend bundle.

## 3. VPS sizing

| Resource | Baseline | Notes |
|---|---|---|
| CPU | 2 (4 recommended once ML on) | scans are the heavy path |
| RAM | 4 GB (8 GB with ML training) | Polars frames + PG shared buffers + Redis |
| Disk | 40-80 GB SSD | Parquet history grows; monitor |
| Swap | 2 GB | safety margin |

Tuning:
- `shared_buffers = 1-2 GB`, `work_mem = 32-64 MB`, `effective_cache_size` =
  ~70% RAM.
- Parquet on the same SSD; back up separately.
- Redis: `maxmemory` + LRU eviction for cache keys.
- Enable `pg_stat_statements` to find slow queries; index per the hot paths
  in `docs/data-model.md` §17.
- Connection pooling: PgBouncer in front of Postgres (transaction pooling)
  for API + worker concurrency. Default pool ≤ ~50; monitor idle sessions —
  the API should be near-read-only, so pooled connections stay short-lived.

## 4. Bootstrapping

```bash
cp .env.example .env              # fill secrets + provider config
docker compose up -d postgres redis
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python -m app.scripts.seed_universe   # from stock-list.xlsx
docker compose run --rm backend python -m app.scripts.seed_profiles   # scoring profiles
docker compose up -d
docker compose run --rm backend python -m app.scripts.ingest_all      # first full ingest
docker compose run --rm backend python -m app.scripts.run_market_scan # first scan
```

First scan runs async (RQ job); monitor via
`GET /api/v1/system/status` and `job_runs`.

## 5. Job scheduling

A long-running **scheduler process** (APScheduler `CronTrigger`) runs inside
the worker container. It enqueues RQ jobs on cron schedules and chains
downstream jobs (ingest → features → scan → ML → alerts) only when the
upstream job succeeded. Full design + scheduler matrix in
`docs/data-pipeline.md` §2.1.

- Cadences configured via env (`SCAN_CRON`, `INGEST_CRON`, `ALERT_CRON`,
  `NEWS_INTERVAL_MIN`) with defaults in `system_settings`.
- Incremental crawlers persist a watermark in `ingestion_checkpoints`;
  a failed run does not advance the watermark (refetch from last good
  boundary next time).
- Watchdog job flags `stale` tables past expected freshness and alerts via
  `run_alerts`.

Cadence guidance:
- OHLCV ingest: weekday after market close (IDX 15:50 WIB) + on-demand.
- Universe + corporate actions: daily.
- Fundamentals: on report availability + daily check.
- Macro/calendar/news: daily / intraday (news every 15-30 min).
- Features + scan + ML inference + alerts: after each OHLCV ingest.
- Parquet refresh: daily; compaction monthly.
- Model training: weekly or on-demand, versioned.

## 6. Operations

### Health & freshness
- `GET /api/v1/system/health` — process, DB, Redis, provider reachability.
- `GET /api/v1/system/status` — per-job last run, per-table freshness
  (`data_freshness`), current model/feature/scoring versions.
- Alert operator when a critical job `failed` or data `stale` (use the
  platform's own `run_alerts` watchdog + email/webhook on failure).

### Logging
Structured JSON logs (request id, job id, version tags). Centralize later;
for now logs to stdout + `LOG_LEVEL`. `ingestion_runs`/`job_runs` hold the
business-level audit trail in PG.

### Backups
- `pg_dump` nightly (or WAL archiving for near-RTO); Parquet directory rsync /
  object-storage copy daily.
- Restore drill tested quarterly.

### Migrations
`alembic upgrade head` as a compose `run` step; backfills as separate scripts.
Roll forward, never roll back schema via destructive down migrations.

## 7. Security (PRD §56)

- TLS via reverse proxy (Let's Encrypt); HSTS; no plaintext HTTP.
- JWT auth on API; RBAC (`admin`/`user`); rate limiting via Redis.
- Input validation at the boundary (Pydantic); ORM parameterization;
  secret rotation policy.
- Provider/LLM API keys server-side only; frontend never receives them.
- DB/Redis not exposed publicly; reverse proxy only entrypoint.

## 8. Observability upgrades (post-v1)

`ponytail:` Add Prometheus + Grafana + Sentry once volume warrants. Baseline
logging + status endpoint is sufficient for v1 on a single host.

## 9. Scaling path

1. Optimize (vectorization, indexes, caching, Parquet) before scaling — PRD §65.
2. Then: bigger VPS (vertical) — one command in compose.
3. Only if still constrained: split worker pool (same code), move Parquet to
   object storage, then revisit the "no K8s" rule deliberately.
