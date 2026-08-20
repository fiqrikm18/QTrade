SHELL := /bin/sh
.DEFAULT_GOAL := help

BACKEND_DIR := backend
FRONTEND_DIR := frontend
BACKEND_PYTHON ?= .venv/bin/python
DB_NAME ?= ihsg_quant
TICKER ?= BBCA
DAYS ?= 730

.PHONY: help install install-backend install-frontend env db-create db-migrate \
	seed seed-universe seed-sectors ingest-ohlcv ingest-ohlcv-all \
	backfill-ohlcv-all ingest-ohlcv-2y \
	ingest-fundamentals ingest-fundamentals-all ingest-macro ingest-news \
	ingest-all live-scan scan api scheduler frontend-dev backend-check \
	frontend-check check

help: ## Show available targets and configurable variables
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <target> [TICKER=BBCA] [DAYS=730]\n\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-27s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: install-backend install-frontend ## Install backend and frontend dependencies

install-backend: ## Create/update backend .venv from uv.lock
	cd $(BACKEND_DIR) && uv sync --extra dev

install-frontend: ## Install frontend dependencies from package-lock.json
	cd $(FRONTEND_DIR) && npm ci

env: ## Create backend/.env from the example if it does not exist
	@if [ -f $(BACKEND_DIR)/.env ]; then \
		echo "$(BACKEND_DIR)/.env already exists"; \
	else \
		cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; \
		echo "Created $(BACKEND_DIR)/.env; review its PostgreSQL and Redis settings"; \
	fi

db-create: ## Create the configured PostgreSQL database (DB_NAME=ihsg_quant)
	createdb $(DB_NAME)

db-migrate: ## Apply all Alembic database migrations
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -m alembic upgrade head

seed: seed-universe seed-sectors ## Seed stocks first, then assign their sectors

seed-universe: ## Upsert the IDX universe from stock-list.xlsx
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -m scripts.seed_universe

seed-sectors: ## Seed board-based sectors and assign stocks to them
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -m scripts.seed_sectors

ingest-ohlcv: ## Backfill OHLCV for one ticker (TICKER=BBCA DAYS=730)
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -m scripts.ingest_smoke $(TICKER) $(DAYS)

ingest-ohlcv-all: ## Ingest the latest OHLCV window for every seeded stock
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -c 'from app.interfaces.workers.jobs import ingest_ohlcv_daily; print("rows_written=", ingest_ohlcv_daily())'

backfill-ohlcv-all: ## Backfill all active stocks plus IHSG (DAYS=730)
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -m scripts.backfill_ohlcv $(DAYS)

ingest-ohlcv-2y: ## Backfill two years for all active stocks plus IHSG
	$(MAKE) backfill-ohlcv-all DAYS=730

ingest-fundamentals: ## Ingest fundamentals for one ticker (TICKER=BBCA)
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -m scripts.ingest_fundamentals $(TICKER)

ingest-fundamentals-all: ## Ingest fundamentals for every seeded stock
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -c 'from app.interfaces.workers.jobs import ingest_fundamentals; print("rows_written=", ingest_fundamentals())'

ingest-macro: ## Ingest macroeconomic series from the configured provider
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -c 'from app.interfaces.workers.jobs import ingest_macro; print("rows_written=", ingest_macro())'

ingest-news: ## Ingest current news from the configured provider
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -c 'from app.interfaces.workers.jobs import ingest_news; print("rows_written=", ingest_news())'

ingest-all: ## Backfill all sources (OHLCV defaults to 2 years), then scan
	$(MAKE) backfill-ohlcv-all DAYS=$(DAYS)
	$(MAKE) ingest-fundamentals-all
	$(MAKE) ingest-macro
	$(MAKE) ingest-news
	$(MAKE) scan

live-scan: ## Ingest one ticker plus IHSG and immediately scan (TICKER=BBCA DAYS=730)
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -m scripts.live_scan $(TICKER) $(DAYS)

scan: ## Generate technical features, stock scores, and Redis rankings
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -m scripts.run_scan

api: ## Start the FastAPI development server on port 8000
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -m uvicorn app.main:create_app --factory --reload --host 0.0.0.0 --port 8000

scheduler: ## Start the APScheduler and RQ ingestion worker
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -m app.interfaces.workers.supervisor

frontend-dev: ## Start the Next.js development server on port 3000
	cd $(FRONTEND_DIR) && npm run dev

backend-check: ## Run backend type checking, linting, formatting, and tests
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -m pyright
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -m ruff check .
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -m ruff format --check .
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -m pytest

frontend-check: ## Run frontend TypeScript, lint, and tests
	cd $(FRONTEND_DIR) && npx tsc --noEmit
	cd $(FRONTEND_DIR) && npm run lint
	cd $(FRONTEND_DIR) && npm test

check: backend-check frontend-check ## Run all backend and frontend validation
