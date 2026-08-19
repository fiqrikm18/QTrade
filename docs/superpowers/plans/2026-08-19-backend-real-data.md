# Backend Real-Data Providers + Dummy-Data Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all fabricated data from the backend production code paths and replace it with real keyless data providers (BI, FRED, RSS news, yfinance fundamentals), DB-backed routes, and honestly computed derived values.

**Architecture:** Follows `docs/data-pipeline.md` §1 — provider `Protocol`s in `app/domain/*/interfaces.py`, implementations in `app/infrastructure/providers/`, repositories in `app/infrastructure/repositories/`, ingestion jobs in `app/interfaces/workers/jobs.py`, routes read from DB. Derived values (risk/regime, macro scores, sector rotation) are computed from real stored data, never hardcoded.

**Tech Stack:** FastAPI, SQLAlchemy async + Alembic, Polars, httpx (new runtime dep), RQ + APScheduler, yfinance. Tests: pytest + pytest-asyncio, pyright strict, ruff.

## Global Constraints

- **No dummy data** in any production code path. Empty/None is an honest state; fabricated values are not.
- **Point-in-time discipline** (docs/data-pipeline.md §6): every economic/news/fundamental row carries `available_at`; consumers filter `available_at <= asof`.
- **Idempotent upserts** on natural keys; failed fetches never advance the watermark and never clobber existing rows (docs/data-pipeline.md §2, §2.1).
- **Keyless sources only** — BI public API, FRED CSV, Google News RSS, Antara RSS, yfinance. No paid keys, no scraping of ToS-restricted sites.
- **Provider parsing is defensive**: unknown/unparseable responses raise `ProviderError` (job fails honestly, no data written) — never fabricate values.
- **API contract stability**: existing frontend payload shapes (`frontend/src/lib/api.ts`) are preserved; only nullable fields (impact/sentiment/prev/consensus/actual) may become `null` where data is genuinely unknown.
- **Validation after every task**: `pytest`, `pyright`, `ruff check .`, `ruff format --check .` from `backend/` (venv `.venv`).
- **Pyright strict** typing; no `Any` where a real type exists; no `# type: ignore` except documented genuine limitations.

---

### Task 1: Data model tables + migration 0005

**Files:**
- Modify: `backend/app/infrastructure/database/models.py` (append at end)
- Create: `backend/alembic/versions/0005_macro_news_portfolio.py`
- Test: `backend/tests/test_models.py` (append)

**Interfaces:**
- Consumes: existing `AuditMixin`, `Base` from `app.infrastructure.database.base`
- Produces: `EconomicIndicator`, `EconomicEvent`, `NewsArticle`, `NewsEntity`, `Portfolio`, `PortfolioPosition`, `IngestionCheckpoint` ORM models used by Tasks 4, 7-10.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_models.py`:

```python
def test_models_import_and_unique_constraints():
    from app.infrastructure.database.models import (
        EconomicEvent,
        EconomicIndicator,
        IngestionCheckpoint,
        NewsArticle,
        NewsEntity,
        Portfolio,
        PortfolioPosition,
    )

    models = [
        EconomicIndicator,
        EconomicEvent,
        NewsArticle,
        NewsEntity,
        Portfolio,
        PortfolioPosition,
        IngestionCheckpoint,
    ]
    for model in models:
        assert model.__tablename__, f"{model.__name__} missing tablename"

    assert [c.name for c in EconomicIndicator.__table__.unique_constraints] == ["uq_econ_indicator"]
    assert [c.name for c in EconomicEvent.__table__.unique_constraints] == ["uq_econ_event"]
    assert [c.name for c in NewsArticle.__table__.unique_constraints] == ["uq_news_source_url"]
    assert [c.name for c in PortfolioPosition.__table__.unique_constraints] == ["uq_portfolio_position"]
    assert [c.name for c in IngestionCheckpoint.__table__.unique_constraints] == ["uq_checkpoint_job"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_models.py -v`
Expected: FAIL — `ImportError` (models do not exist yet)

- [ ] **Step 3: Append the models to `models.py`**

Append to `backend/app/infrastructure/database/models.py`:

```python
class EconomicIndicator(AuditMixin, Base):
    """Point-in-time macro indicator time series (docs/data-model.md §7)."""

    __tablename__ = "economic_indicators"
    __table_args__ = (
        UniqueConstraint(
            "indicator", "asof_date", "source", name="uq_econ_indicator"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    indicator: Mapped[str] = mapped_column(Text, nullable=False)
    asof_date: Mapped[date] = mapped_column(Date, nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    unit: Mapped[str] = mapped_column(Text, server_default="", nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class EconomicEvent(AuditMixin, Base):
    """Economic calendar events with release status (docs/data-model.md §8)."""

    __tablename__ = "economic_events"
    __table_args__ = (
        UniqueConstraint("event", "scheduled_at", "source", name="uq_econ_event"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    event: Mapped[str] = mapped_column(Text, nullable=False)
    country: Mapped[str] = mapped_column(Text, server_default="ID", nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    importance: Mapped[int] = mapped_column(BigInteger, server_default="2", nullable=False)
    category: Mapped[str] = mapped_column(Text, server_default="", nullable=False)
    previous: Mapped[Decimal | None] = mapped_column(Numeric)
    consensus: Mapped[Decimal | None] = mapped_column(Numeric)
    actual: Mapped[Decimal | None] = mapped_column(Numeric)
    status: Mapped[str] = mapped_column(Text, server_default="scheduled", nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)


class NewsArticle(AuditMixin, Base):
    """News articles ingested from RSS (docs/data-model.md §11)."""

    __tablename__ = "news"
    __table_args__ = (
        UniqueConstraint("source", "url", name="uq_news_source_url"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, server_default="", nullable=False)
    category: Mapped[str] = mapped_column(Text, server_default="MARKET", nullable=False)
    sentiment: Mapped[str | None] = mapped_column(Text)
    impact: Mapped[str | None] = mapped_column(Text)
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class NewsEntity(AuditMixin, Base):
    """Ticker references found in a news article (docs/data-model.md §11)."""

    __tablename__ = "news_entities"
    __table_args__ = (
        UniqueConstraint("article_id", "ticker", name="uq_news_entity"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    article_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("news.id", ondelete="CASCADE"), nullable=False
    )
    ticker: Mapped[str] = mapped_column(Text, nullable=False)


class Portfolio(AuditMixin, Base):
    """User portfolio (single-user v1) (docs/data-model.md §11)."""

    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(Text, server_default="Default", nullable=False)


class PortfolioPosition(AuditMixin, Base):
    """A holding: ticker + quantity + average cost (docs/data-model.md §11)."""

    __tablename__ = "portfolio_positions"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "ticker", name="uq_portfolio_position"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False
    )
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    avg_price: Mapped[Decimal] = mapped_column(Numeric, nullable=False)


class IngestionCheckpoint(AuditMixin, Base):
    """Crawler watermark per job (docs/data-pipeline.md §2.1)."""

    __tablename__ = "ingestion_checkpoints"
    __table_args__ = (
        UniqueConstraint("job_name", name="uq_checkpoint_job"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    job_name: Mapped[str] = mapped_column(Text, nullable=False)
    watermark: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
```

- [ ] **Step 4: Create migration 0005**

Create `backend/alembic/versions/0005_macro_news_portfolio.py`:

```python
"""Add macro, news, portfolio, checkpoint tables.

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-19
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "economic_indicators",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("indicator", sa.Text(), nullable=False),
        sa.Column("asof_date", sa.Date(), nullable=False),
        sa.Column("value", sa.Numeric(), nullable=False),
        sa.Column("unit", sa.Text(), server_default="", nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("indicator", "asof_date", "source", name="uq_econ_indicator"),
    )
    op.create_table(
        "economic_events",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("event", sa.Text(), nullable=False),
        sa.Column("country", sa.Text(), server_default="ID", nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("importance", sa.BigInteger(), server_default="2", nullable=False),
        sa.Column("category", sa.Text(), server_default="", nullable=False),
        sa.Column("previous", sa.Numeric(), nullable=True),
        sa.Column("consensus", sa.Numeric(), nullable=True),
        sa.Column("actual", sa.Numeric(), nullable=True),
        sa.Column("status", sa.Text(), server_default="scheduled", nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("event", "scheduled_at", "source", name="uq_econ_event"),
    )
    op.create_table(
        "news",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), server_default="", nullable=False),
        sa.Column("category", sa.Text(), server_default="MARKET", nullable=False),
        sa.Column("sentiment", sa.Text(), nullable=True),
        sa.Column("impact", sa.Text(), nullable=True),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("source", "url", name="uq_news_source_url"),
    )
    op.create_table(
        "news_entities",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("article_id", sa.BigInteger(), nullable=False),
        sa.Column("ticker", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["article_id"], ["news.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("article_id", "ticker", name="uq_news_entity"),
    )
    op.create_table(
        "portfolios",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("name", sa.Text(), server_default="Default", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "portfolio_positions",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("portfolio_id", sa.BigInteger(), nullable=False),
        sa.Column("ticker", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Numeric(), nullable=False),
        sa.Column("avg_price", sa.Numeric(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("portfolio_id", "ticker", name="uq_portfolio_position"),
    )
    op.create_table(
        "ingestion_checkpoints",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("job_name", sa.Text(), nullable=False),
        sa.Column("watermark", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("job_name", name="uq_checkpoint_job"),
    )


def downgrade() -> None:
    op.drop_table("ingestion_checkpoints")
    op.drop_table("portfolio_positions")
    op.drop_table("portfolios")
    op.drop_table("news_entities")
    op.drop_table("news")
    op.drop_table("economic_events")
    op.drop_table("economic_indicators")
```

- [ ] **Step 5: Run migration on test DB and rerun test**

Run:
```bash
cd backend && .venv/bin/python -m alembic upgrade head && .venv/bin/python -m pytest tests/test_models.py -v
```
Expected: PASS. (Check the current head revision first with `alembic heads`; if head is not `0004`, set `down_revision` to the actual head.)

- [ ] **Step 6: Commit**

```bash
git add backend/app/infrastructure/database/models.py backend/alembic/versions/0005_macro_news_portfolio.py backend/tests/test_models.py
git commit -m "feat(db): macro, news, portfolio, checkpoint tables"
```

---

### Task 2: Domain provider Protocols

**Files:**
- Create: `backend/app/domain/macro/__init__.py`
- Create: `backend/app/domain/macro/interfaces.py`
- Create: `backend/app/domain/news/__init__.py`
- Create: `backend/app/domain/news/interfaces.py`
- Create: `backend/app/domain/fundamental/interfaces.py`
- Test: `backend/tests/test_types.py` (append)

**Interfaces:**
- Produces: `MacroEconomicProvider`, `EconomicCalendarProvider` (in `app.domain.macro.interfaces`), `NewsProvider` (in `app.domain.news.interfaces`), `FundamentalDataProvider` (in `app.domain.fundamental.interfaces`). Tasks 3-6 implement them; Task 8's jobs consume them.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_types.py`:

```python
def test_provider_protocols_are_runtime_checkable():
    import polars as pl

    from app.domain.fundamental.interfaces import FundamentalDataProvider
    from app.domain.macro.interfaces import (
        EconomicCalendarProvider,
        MacroEconomicProvider,
    )
    from app.domain.news.interfaces import NewsProvider

    for protocol in (
        MacroEconomicProvider,
        EconomicCalendarProvider,
        NewsProvider,
        FundamentalDataProvider,
    ):
        assert hasattr(protocol, "__protocol_attrs__")

    class FakeMacro:
        def get_indicators(self, codes: list[str], start: object, end: object) -> pl.DataFrame:
            return pl.DataFrame()

        def get_calendar(self, start: object, end: object) -> pl.DataFrame:
            return pl.DataFrame()

    assert isinstance(FakeMacro(), MacroEconomicProvider)
    assert isinstance(FakeMacro(), EconomicCalendarProvider)

    class FakeNews:
        def get_news(self, tickers: list[str] | None, since: object) -> pl.DataFrame:
            return pl.DataFrame()

    assert isinstance(FakeNews(), NewsProvider)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_types.py -v`
Expected: FAIL — `ImportError` (modules missing)

- [ ] **Step 3: Create the protocol modules**

`backend/app/domain/macro/__init__.py`:
```python
"""Macro domain: provider protocols and score computation."""
```

`backend/app/domain/macro/interfaces.py`:
```python
"""Provider protocols for macro data (docs/data-pipeline.md §1)."""

from datetime import date
from typing import Protocol, runtime_checkable

import polars as pl


@runtime_checkable
class MacroEconomicProvider(Protocol):
    """Fetch macro indicator time series.

    Returned frame columns: indicator (str), asof_date (date),
    value (float), unit (str), source (str).
    """

    def get_indicators(
        self, codes: list[str], start: date, end: date
    ) -> pl.DataFrame: ...


@runtime_checkable
class EconomicCalendarProvider(Protocol):
    """Fetch economic calendar events in [start, end].

    Returned frame columns: event (str), country (str), scheduled_at
    (datetime), importance (int), category (str), previous (float | None),
    consensus (float | None), actual (float | None), status (str),
    source (str).
    """

    def get_calendar(self, start: date, end: date) -> pl.DataFrame: ...
```

`backend/app/domain/news/__init__.py`:
```python
"""News domain: provider protocol."""
```

`backend/app/domain/news/interfaces.py`:
```python
"""News provider protocol (docs/data-pipeline.md §1)."""

from datetime import datetime
from typing import Protocol, runtime_checkable

import polars as pl


@runtime_checkable
class NewsProvider(Protocol):
    """Fetch news items published since ``since``.

    Returned frame columns: title (str), source (str), published_at
    (datetime), url (str), summary (str), tickers (list[str]).
    """

    def get_news(
        self, tickers: list[str] | None, since: datetime
    ) -> pl.DataFrame: ...
```

`backend/app/domain/fundamental/interfaces.py`:
```python
"""Fundamental data provider protocol (docs/data-pipeline.md §1)."""

from typing import Protocol, runtime_checkable


@runtime_checkable
class FundamentalDataProvider(Protocol):
    """Fetch the latest point-in-time fundamental snapshot for a ticker.

    Returns a dict with keys:
    - ``period_end``: date (ISO str)
    - ``reported_at``: date (ISO str)
    - ``items``: dict[str, float] using the canonical item keys consumed by
      ``app.domain.fundamental.ratios.calculate_ratios``
      (revenue, gross_profit, ebitda, ebit, net_income, eps, bvps,
      operating_cash_flow, free_cash_flow, total_assets, total_liabilities,
      equity, debt, cash, shares_outstanding, interest_expense,
      current_assets, current_liabilities, dividend_per_share).
    """

    def get_latest_fundamentals(self, ticker: str) -> dict[str, object]: ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/python -m pytest tests/test_types.py -v`
Expected: PASS

- [ ] **Step 5: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format --check .
```
Expected: PASS (no new errors)
```bash
git add backend/app/domain/macro backend/app/domain/news backend/app/domain/fundamental/interfaces.py backend/tests/test_types.py
git commit -m "feat(domain): macro, news, fundamental provider protocols"
```

---

### Task 3: httpx runtime dependency + BiProvider (JISDOR, BI rate, BI calendar)

**Files:**
- Modify: `backend/pyproject.toml` (move httpx to main deps)
- Create: `backend/app/infrastructure/providers/exceptions.py` (if missing)
- Create: `backend/app/infrastructure/providers/bi_provider.py`
- Test: `backend/tests/test_bi_provider.py`

**Interfaces:**
- Consumes: `MacroEconomicProvider`, `EconomicCalendarProvider` (Task 2)
- Produces: `BiProvider` — implements both protocols; raises `ProviderError` (from `app.infrastructure.providers.exceptions`) on any network/parse failure.

- [ ] **Step 1: Check exceptions module**

Run: `cd backend && ls app/infrastructure/providers/exceptions.py`
If the file does not exist, create it:

```python
class ProviderError(Exception):
    """Provider fetch or parse failure. Callers must fail honestly (no data
    written, watermark not advanced) rather than fabricate values."""
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_bi_provider.py`:

```python
"""BiProvider: JISDOR, BI rate, and BI calendar parsing (no network)."""

from datetime import date, datetime, timezone

import polars as pl
import pytest

from app.infrastructure.providers.bi_provider import BiProvider
from app.infrastructure.providers.exceptions import ProviderError

_JISDOR_PAYLOAD = {
    "status": {"code": 200},
    "data": {"jisdor": [{"date": "2026-08-18", "rate": 17836.0, "jual": 17836.0}]},
}

_BI_RATE_PAYLOAD = {
    "rates": [
        {"date": "2026-08-19", "rate": 5.75, "rate_desc": "5,75%"},
        {"date": "2026-05-20", "rate": 5.75, "rate_desc": "5,75%"},
    ]
}


def _client(route, payload):
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == route, request.url
        return httpx.Response(200, json=payload)

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_jisdor_indicators_parse() -> None:
    provider = BiProvider(client=_client("/kurs/v1/jisdor/2026-08-18", _JISDOR_PAYLOAD))
    df = provider.get_indicators(["usd_idr"], date(2026, 8, 18), date(2026, 8, 18))
    assert df.columns == ["indicator", "asof_date", "value", "unit", "source"]
    row = df.to_dicts()[0]
    assert row["indicator"] == "usd_idr"
    assert row["asof_date"] == date(2026, 8, 18)
    assert row["value"] == 17836.0
    assert row["source"] == "BI"


def test_bi_rate_indicators_parse() -> None:
    provider = BiProvider(client=_client("/bi_rate/v1/rates", _BI_RATE_PAYLOAD))
    df = provider.get_indicators(["bi_rate"], date(2026, 5, 1), date(2026, 8, 31))
    rows = {r["asof_date"]: r["value"] for r in df.to_dicts()}
    assert rows[date(2026, 8, 19)] == 5.75
    assert df.to_dicts()[0]["unit"] == "%"


def test_unknown_code_raises() -> None:
    provider = BiProvider(client=_client("/kurs/v1/jisdor/2026-08-18", _JISDOR_PAYLOAD))
    with pytest.raises(ProviderError):
        provider.get_indicators(["gdp"], date(2026, 8, 18), date(2026, 8, 18))


def test_unparseable_payload_raises() -> None:
    provider = BiProvider(
        client=_client("/kurs/v1/jisdor/2026-08-18", {"unexpected": True})
    )
    with pytest.raises(ProviderError):
        provider.get_indicators(["usd_idr"], date(2026, 8, 18), date(2026, 8, 18))


def test_calendar_parse() -> None:
    html = (
        "<html><body><div class='event'>"
        "<span class='date'>18 Aug 2026</span>"
        "<span class='title'>BI Rate Decision (RDG)</span>"
        "</div></body></html>"
    )

    def handler(request):
        return httpx.Response(200, text=html)

    import httpx

    provider = BiProvider(client=httpx.Client(transport=httpx.MockTransport(handler)))
    df = provider.get_calendar(date(2026, 8, 1), date(2026, 8, 31))
    assert not df.is_empty()
    row = df.to_dicts()[0]
    assert "BI Rate" in row["event"]
    assert row["country"] == "ID"
    assert row["importance"] == 3
    assert row["status"] == "scheduled"


def test_calendar_empty_when_no_events() -> None:
    import httpx

    provider = BiProvider(
        client=httpx.Client(
            transport=httpx.MockTransport(
                lambda req: httpx.Response(200, text="<html><body></body></html>")
            )
        )
    )
    df = provider.get_calendar(date(2026, 8, 1), date(2026, 8, 31))
    assert df.is_empty()
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_bi_provider.py -v`
Expected: FAIL — `ModuleNotFoundError: bi_provider`

- [ ] **Step 4: Add httpx to runtime deps**

Edit `backend/pyproject.toml`: move `"httpx>=0.27",` from the `dev` list into `[project].dependencies` (after `openpyxl`), and remove it from `dev`. Then:

```bash
cd backend && .venv/bin/pip install -e ".[dev]"
```

- [ ] **Step 5: Implement `bi_provider.py`**

Create `backend/app/infrastructure/providers/bi_provider.py`:

```python
"""Bank Indonesia public data provider (keyless, official source).

JISDOR USD/IDR reference rate and BI Rate from ``api-biapi.bi.go.id``;
economic calendar scraped from the official BI calendar page. Parsing is
defensive: any unexpected response raises ProviderError so the ingestion job
fails honestly instead of writing fabricated data.
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from typing import Any

import httpx
import polars as pl

from app.domain.macro.interfaces import (
    EconomicCalendarProvider,
    MacroEconomicProvider,
)
from app.infrastructure.providers.exceptions import ProviderError

_JISDOR_URL = "https://api-biapi.bi.go.id/kurs/v1/jisdor/{date}"
_BI_RATE_URL = "https://api-biapi.bi.go.id/bi_rate/v1/rates"
_CALENDAR_URL = "https://www.bi.go.id/en/publikasi/Kalender"

_RATE_LIKE_KEYS = ("rate", "jual", "beli", "middle_rate", "jisdor")
_DATE_KEYS = ("date", "tanggal", "rates_date")


class _CalendarParser(HTMLParser):
    """Extract (date, title) pairs from the official BI calendar page.

    The page renders monthly entries as blocks containing a date and an event
    title (e.g. "Rapat Dewan Gubernur - BI Rate"). Structure changes require
    parser updates; an unparseable page yields no rows (honest empty), never
    fabricated events.
    """

    def __init__(self) -> None:
        super().__init__()
        self.entries: list[tuple[str, str]] = []
        self._current_date: str | None = None

    def handle_data(self, data: str) -> None:
        text = data.strip()
        if not text:
            return
        if re.fullmatch(r"\d{1,2}\s+\w+\s+\d{4}", text):
            self._current_date = text
            return
        if len(text) > 8 and re.search(r"\d{4}", text) and self._current_date:
            self.entries.append((self._current_date, text))


def _parse_date(text: str) -> date | None:
    for fmt in ("%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _find_rate(payload: Any) -> float | None:
    """Defensively locate a rate value inside the BI JSON payload."""
    if isinstance(payload, list):
        for item in payload:
            if (rate := _find_rate(item)) is not None:
                return rate
        return None
    if not isinstance(payload, dict):
        if isinstance(payload, (int, float)) and not isinstance(payload, bool):
            return float(payload)
        return None
    for key, value in payload.items():
        low = key.lower()
        if low in _RATE_LIKE_KEYS and isinstance(value, (int, float)):
            return float(value)
    for value in payload.values():
        if (rate := _find_rate(value)) is not None:
            return rate
    return None


def _find_date(payload: Any) -> date | None:
    if isinstance(payload, list):
        for item in payload:
            if (d := _find_date(item)) is not None:
                return d
        return None
    if not isinstance(payload, dict):
        return None
    for key, value in payload.items():
        if key.lower() in _DATE_KEYS and isinstance(value, str):
            try:
                return date.fromisoformat(value)
            except ValueError:
                continue
    for value in payload.values():
        if (d := _find_date(value)) is not None:
            return d
    return None


class BiProvider(MacroEconomicProvider, EconomicCalendarProvider):
    """BI-sourced macro indicators + economic calendar (keyless)."""

    _SUPPORTED_CODES = {"usd_idr", "bi_rate"}

    def __init__(self, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=30.0)

    def get_indicators(
        self, codes: list[str], start: date, end: date
    ) -> pl.DataFrame:
        unknown = set(codes) - self._SUPPORTED_CODES
        if unknown:
            raise ProviderError(f"code(s) not supported by BiProvider: {sorted(unknown)}")
        rows: list[dict[str, object]] = []
        for code in codes:
            if code == "usd_idr":
                rows.extend(self._fetch_jisdor(start, end))
            else:
                rows.extend(self._fetch_bi_rate(start, end))
        if not rows:
            return pl.DataFrame(
                schema={
                    "indicator": pl.String,
                    "asof_date": pl.Date,
                    "value": pl.Float64,
                    "unit": pl.String,
                    "source": pl.String,
                }
            )
        return pl.DataFrame(rows).with_columns(
            [pl.col("asof_date").cast(pl.Date), pl.col("value").cast(pl.Float64)]
        )

    def _fetch_jisdor(self, start: date, end: date) -> list[dict[str, object]]:
        out: list[dict[str, object]] = []
        for d in _weekdays(start, end):
            try:
                resp = self._client.get(_JISDOR_URL.format(date=d.isoformat()))
                resp.raise_for_status()
            except Exception as exc:
                raise ProviderError(f"JISDOR fetch failed for {d}: {exc}") from exc
            rate = _find_rate(resp.json())
            if rate is None:
                # Weekend/holiday: BI publishes no rate; skip, not fabricate.
                continue
            out.append(
                {
                    "indicator": "usd_idr",
                    "asof_date": d,
                    "value": rate,
                    "unit": "",
                    "source": "BI",
                }
            )
        return out

    def _fetch_bi_rate(self, start: date, end: date) -> list[dict[str, object]]:
        params = {
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
        }
        try:
            resp = self._client.get(_BI_RATE_URL, params=params)
            resp.raise_for_status()
        except Exception as exc:
            raise ProviderError(f"BI rate fetch failed: {exc}") from exc
        rows: list[dict[str, object]] = []
        for item in resp.json().get("rates", []):
            d = _find_date(item)
            rate = _find_rate(item)
            if d is None or rate is None:
                continue
            rows.append(
                {
                    "indicator": "bi_rate",
                    "asof_date": d,
                    "value": rate,
                    "unit": "%",
                    "source": "BI",
                }
            )
        return rows

    def get_calendar(self, start: date, end: date) -> pl.DataFrame:
        try:
            resp = self._client.get(_CALENDAR_URL)
            resp.raise_for_status()
        except Exception as exc:
            raise ProviderError(f"BI calendar fetch failed: {exc}") from exc
        parser = _CalendarParser()
        parser.feed(resp.text)
        rows: list[dict[str, object]] = []
        for date_text, title in parser.entries:
            d = _parse_date(date_text)
            if d is None or not (start <= d <= end):
                continue
            is_rate_decision = "BI Rate" in title or "Rapat Dewan Gubernur" in title
            rows.append(
                {
                    "event": title,
                    "country": "ID",
                    "scheduled_at": datetime(
                        d.year, d.month, d.day, 14, 0, tzinfo=timezone.utc
                    ),
                    "importance": 3 if is_rate_decision else 2,
                    "category": "CENTRAL_BANK" if is_rate_decision else "GENERAL",
                    "previous": None,
                    "consensus": None,
                    "actual": None,
                    "status": "scheduled",
                    "source": "BI",
                }
            )
        if not rows:
            return pl.DataFrame(
                schema={
                    "event": pl.String,
                    "country": pl.String,
                    "scheduled_at": pl.Datetime,
                    "importance": pl.Int64,
                    "category": pl.String,
                    "previous": pl.Float64,
                    "consensus": pl.Float64,
                    "actual": pl.Float64,
                    "status": pl.String,
                    "source": pl.String,
                }
            )
        return pl.DataFrame(rows)


def _weekdays(start: date, end: date) -> list[date]:
    out: list[date] = []
    d = start
    while d <= end:
        if d.weekday() < 5:
            out.append(d)
        d = d + timedelta(days=1)
    return out
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_bi_provider.py -v`
Expected: PASS (5 tests)

- [ ] **Step 7: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format .
```
Expected: PASS
```bash
git add backend/pyproject.toml backend/app/infrastructure/providers/ backend/tests/test_bi_provider.py
git commit -m "feat(providers): Bank Indonesia macro + calendar provider"
```

---

### Task 4: FredProvider (FRED CSV)

**Files:**
- Create: `backend/app/infrastructure/providers/fred_provider.py`
- Test: `backend/tests/test_fred_provider.py`

**Interfaces:**
- Consumes: `MacroEconomicProvider` (Task 2)
- Produces: `FredProvider` — implements `MacroEconomicProvider`; codes: `idn_10y`, `us_10y`, `us_2y`, `fed_funds`, `dxy`, `sp500`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_fred_provider.py`:

```python
"""FredProvider: FRED CSV parsing (no network)."""

from datetime import date

import httpx
import pytest

from app.infrastructure.providers.exceptions import ProviderError
from app.infrastructure.providers.fred_provider import FredProvider, _SERIES_MAP

_CSV = """date,value
2026-08-18,6.65
2026-08-17,6.62
"""


def _client(csv_body: str) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith(".csv")
        return httpx.Response(200, text=csv_body)

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_series_map_known_codes() -> None:
    assert set(_SERIES_MAP) == {
        "idn_10y",
        "us_10y",
        "us_2y",
        "fed_funds",
        "dxy",
        "sp500",
    }


def test_parse_csv_frame() -> None:
    provider = FredProvider(client=_client(_CSV))
    df = provider.get_indicators(["idn_10y"], date(2026, 8, 1), date(2026, 8, 31))
    assert df.columns == ["indicator", "asof_date", "value", "unit", "source"]
    assert df.height == 2
    row = df.to_dicts()[0]
    assert row["indicator"] == "idn_10y"
    assert row["asof_date"] == date(2026, 8, 18)
    assert row["value"] == 6.65
    assert row["source"] == "FRED"


def test_unknown_code_raises() -> None:
    provider = FredProvider(client=_client(_CSV))
    with pytest.raises(ProviderError):
        provider.get_indicators(["nope"], date(2026, 8, 1), date(2026, 8, 31))


def test_http_failure_raises() -> None:
    provider = FredProvider(
        client=httpx.Client(
            transport=httpx.MockTransport(
                lambda req: httpx.Response(500, text="boom")
            )
        )
    )
    with pytest.raises(ProviderError):
        provider.get_indicators(["sp500"], date(2026, 8, 1), date(2026, 8, 31))


def test_bad_csv_raises() -> None:
    provider = FredProvider(client=_client("not,a,csv\n"))
    with pytest.raises(ProviderError):
        provider.get_indicators(["dxy"], date(2026, 8, 1), date(2026, 8, 31))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_fred_provider.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement `fred_provider.py`**

Create `backend/app/infrastructure/providers/fred_provider.py`:

```python
"""FRED (Federal Reserve Economic Data) CSV provider — keyless.

CSV endpoint: https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}
Rows are ``date,value`` with ``.`` for missing observations.
"""

from __future__ import annotations

from datetime import date
from typing import Any

import httpx
import polars as pl

from app.domain.macro.interfaces import MacroEconomicProvider
from app.infrastructure.providers.exceptions import ProviderError

_FRED_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv"

_SERIES_MAP: dict[str, tuple[str, str]] = {
    "idn_10y": ("IRLTLT01IDM156N", "%"),
    "us_10y": ("DGS10", "%"),
    "us_2y": ("DGS2", "%"),
    "fed_funds": ("DFF", "%"),
    "dxy": ("DTWEXBGS", ""),
    "sp500": ("SP500", ""),
}


class FredProvider(MacroEconomicProvider):
    """Macro indicators from FRED CSV (keyless, official)."""

    def __init__(self, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=30.0)

    def get_indicators(
        self, codes: list[str], start: date, end: date
    ) -> pl.DataFrame:
        unknown = set(codes) - set(_SERIES_MAP)
        if unknown:
            raise ProviderError(f"code(s) not supported by FredProvider: {sorted(unknown)}")
        frames: list[pl.DataFrame] = []
        for code in codes:
            frames.append(self._fetch_series(code, start, end))
        if not frames:
            return self._empty_frame()
        return pl.concat(frames).with_columns(pl.col("asof_date").cast(pl.Date))

    def _fetch_series(self, code: str, start: date, end: date) -> pl.DataFrame:
        series, unit = _SERIES_MAP[code]
        params: dict[str, str] = {
            "id": series,
            "cosd": start.isoformat(),
            "coed": end.isoformat(),
        }
        try:
            resp = self._client.get(_FRED_CSV_URL, params=params)
            resp.raise_for_status()
        except Exception as exc:
            raise ProviderError(f"FRED fetch failed for {code}: {exc}") from exc

        rows: list[dict[str, object]] = []
        lines = resp.text.strip().splitlines()
        if not lines or lines[0].strip() != "date,value":
            raise ProviderError(f"FRED response for {code} is not a CSV")
        for line in lines[1:]:
            parts = line.split(",")
            if len(parts) != 2:
                continue
            day, value = parts[0].strip(), parts[1].strip()
            if value == "." or not value:
                continue  # missing observation: skip, never fabricate
            try:
                rows.append(
                    {
                        "indicator": code,
                        "asof_date": date.fromisoformat(day),
                        "value": float(value),
                        "unit": unit,
                        "source": "FRED",
                    }
                )
            except ValueError:
                continue
        if not rows:
            raise ProviderError(f"FRED response for {code} had no parseable rows")
        return pl.DataFrame(rows)

    def _empty_frame(self) -> pl.DataFrame:
        return pl.DataFrame(
            schema={
                "indicator": pl.String,
                "asof_date": pl.Date,
                "value": pl.Float64,
                "unit": pl.String,
                "source": pl.String,
            }
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_fred_provider.py -v`
Expected: PASS

- [ ] **Step 5: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format .
```
Expected: PASS
```bash
git add backend/app/infrastructure/providers/fred_provider.py backend/tests/test_fred_provider.py
git commit -m "feat(providers): FRED CSV macro provider"
```

---

### Task 5: RSS news provider (Google News + Antara)

**Files:**
- Create: `backend/app/infrastructure/providers/news_provider.py`
- Test: `backend/tests/test_news_provider.py`

**Interfaces:**
- Consumes: `NewsProvider` (Task 2)
- Produces: `RSSNewsProvider` — implements `NewsProvider`; frames with columns title, source, published_at, url, summary, tickers.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_news_provider.py`:

```python
"""RSSNewsProvider: RSS XML parsing (no network)."""

from datetime import datetime, timezone

import httpx

from app.infrastructure.providers.news_provider import RSSNewsProvider

_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Test Feed</title>
<item>
<title>BBCA posts strong quarterly profit</title>
<link>https://example.com/bbc.html</link>
<pubDate>Mon, 17 Aug 2026 08:30:00 GMT</pubDate>
<description>Bank Central Asia (BBCA) reported results.</description>
</item>
<item>
<title>Market closes higher</title>
<link>https://example.com/mkt.html</link>
<pubDate>Tue, 18 Aug 2026 10:00:00 GMT</pubDate>
<description>IDX composite gained today.</description>
</item>
</channel></rss>"""


def _client(body: str) -> httpx.Client:
    return httpx.Client(
        transport=httpx.MockTransport(lambda req: httpx.Response(200, text=body))
    )


def test_parses_items_and_matches_tickers() -> None:
    provider = RSSNewsProvider(client=_client(_RSS))
    since = datetime(2026, 8, 1, tzinfo=timezone.utc)
    df = provider.get_news(["BBCA", "BBRI"], since)
    assert df.columns == ["title", "source", "published_at", "url", "summary", "tickers"]
    assert df.height == 2
    rows = {r["title"]: r for r in df.to_dicts()}
    bbc = rows["BBCA posts strong quarterly profit"]
    assert bbc["tickers"] == ["BBCA"]
    assert bbc["published_at"] == datetime(2026, 8, 17, 8, 30, tzinfo=timezone.utc)
    mkt = rows["Market closes higher"]
    assert mkt["tickers"] == []
    assert mkt["url"] == "https://example.com/mkt.html"


def test_http_failure_raises_provider_error() -> None:
    from app.infrastructure.providers.exceptions import ProviderError

    provider = RSSNewsProvider(
        client=httpx.Client(
            transport=httpx.MockTransport(
                lambda req: httpx.Response(500, text="boom")
            )
        )
    )
    try:
        provider.get_news(["BBCA"], datetime(2026, 8, 1, tzinfo=timezone.utc))
    except ProviderError:
        return
    raise AssertionError("expected ProviderError")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_news_provider.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement `news_provider.py`**

Create `backend/app/infrastructure/providers/news_provider.py`:

```python
"""RSS news provider — Google News search RSS + Antara official feeds.

Keyless. Parsed with stdlib ``xml.etree.ElementTree``. Ticker extraction is
exact word-boundary match against the universe tickers (never inferred).
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import httpx
import polars as pl

from app.domain.news.interfaces import NewsProvider
from app.infrastructure.providers.exceptions import ProviderError

_GOOGLE_NEWS_URL = "https://news.google.com/rss/search"
_ANTARA_URLS = [
    "https://www.antaranews.com/rss/ekonomi",
    "https://www.antaranews.com/rss/terkini",
]

_NS = {"media": "http://search.yahoo.com/mrss/"}
_IGNORE_PREFIXES = ("Google News",)

_WORD = re.compile(r"\b([A-Z]{2,8})\b")


def _parse_pubdate(text: str) -> datetime | None:
    try:
        dt = parsedate_to_datetime(text)
    except (TypeError, ValueError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _match_tickers(text: str, tickers: set[str]) -> list[str]:
    found = set()
    for token in _WORD.findall(text):
        if token in tickers:
            found.add(token)
    return sorted(found)


class RSSNewsProvider(NewsProvider):
    """Keyless RSS news crawler (Google News + Antara)."""

    def __init__(self, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=30.0)
        self._client.headers.update(
            {"User-Agent": "ihsg-quant/0.1 (+https://github.com/anomalyco/quant-trade)"}
        )

    def get_news(
        self, tickers: list[str] | None, since: datetime
    ) -> pl.DataFrame:
        ticker_set = {t.upper() for t in (tickers or [])}
        urls: list[str] = []
        for tk in sorted(ticker_set):
            urls.append(
                f"{_GOOGLE_NEWS_URL}?q={tk}+stock&hl=en-ID&gl=ID&ceid=ID:en"
            )
        urls.extend(_ANTARA_URLS)
        items: list[dict[str, object]] = []
        for url in urls:
            items.extend(self._fetch_and_parse(url, ticker_set, since))
        if not items:
            return pl.DataFrame(
                schema={
                    "title": pl.String,
                    "source": pl.String,
                    "published_at": pl.Datetime,
                    "url": pl.String,
                    "summary": pl.String,
                    "tickers": pl.List(pl.String),
                }
            )
        return pl.DataFrame(items)

    def _fetch_and_parse(
        self, url: str, ticker_set: set[str], since: datetime
    ) -> list[dict[str, object]]:
        try:
            resp = self._client.get(url)
            resp.raise_for_status()
        except Exception as exc:
            raise ProviderError(f"RSS fetch failed for {url}: {exc}") from exc
        try:
            root = ET.fromstring(resp.text)
        except ET.ParseError as exc:
            raise ProviderError(f"RSS parse failed for {url}: {exc}") from exc

        feed_source = url.split("//", 1)[1].split("/", 1)[0]
        out: list[dict[str, object]] = []
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub_text = item.findtext("pubDate") or item.findtext(
                "dc:date", namespaces={"dc": "http://purl.org/dc/elements/1.1/"}
            )
            description = (item.findtext("description") or "").strip()
            if not title or not link or not pub_text:
                continue
            published = _parse_pubdate(pub_text)
            if published is None or published < since:
                continue
            if any(title.startswith(p) for p in _IGNORE_PREFIXES):
                continue
            out.append(
                {
                    "title": title,
                    "source": feed_source,
                    "published_at": published,
                    "url": link,
                    "summary": _strip_html(description),
                    "tickers": _match_tickers(f"{title} {description}", ticker_set),
                }
            )
        return out


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text).strip()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_news_provider.py -v`
Expected: PASS

- [ ] **Step 5: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format .
```
Expected: PASS
```bash
git add backend/app/infrastructure/providers/news_provider.py backend/tests/test_news_provider.py
git commit -m "feat(providers): keyless RSS news provider"
```

---

### Task 6: yfinance fundamentals provider

**Files:**
- Modify: `backend/app/infrastructure/providers/yfinance_provider.py`
- Test: `backend/tests/test_fundamentals_provider.py`

**Interfaces:**
- Consumes: `FundamentalDataProvider` (Task 2)
- Produces: `YFinanceProvider.get_latest_fundamentals(ticker) -> dict[str, object]` with `period_end`, `reported_at`, `items` — canonical item keys from `app.domain.fundamental.ratios`.

- [ ] **Step 1: Check canonical item keys**

Run: `cd backend && grep -n "revenue\|net_income\|gross_profit\|ebitda\|free_cash_flow\|current_assets" app/domain/fundamental/ratios.py | head -20`
Confirm the item keys used by `calculate_ratios`. The plan's mapping uses: revenue, gross_profit, ebitda, ebit, net_income, eps, bvps, operating_cash_flow, free_cash_flow, total_assets, total_liabilities, equity, debt, cash, shares_outstanding, interest_expense, current_assets, current_liabilities, dividend_per_share. Adjust names if the file shows different canonical keys.

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_fundamentals_provider.py`:

```python
"""YFinanceProvider.get_latest_fundamentals mapping (mocked yfinance)."""

from datetime import date

from app.infrastructure.providers.yfinance_provider import YFinanceProvider


class _FakeInfo(dict):
    def get(self, key, default=None):
        return super().get(key, default)


class _FakeFrame:
    def __init__(self, columns, data):
        self._columns = columns
        self._data = data

    @property
    def columns(self):
        return self._columns

    def __getitem__(self, key):
        return self._data[key]

    @property
    def empty(self):
        return False

    def get(self, key, default=None):
        return self._data.get(key, default)


def _fake_ticker(items, info):
    class _Ticker:
        def __init__(self):
            self.info = info
            self.income_stmt = _FakeFrame(["Total Revenue"], {})
            self.balance_sheet = _FakeFrame(["Total Assets"], {})
            self.cashflow = _FakeFrame(["Operating Cash Flow"], {})

        @property
        def financials(self):
            return _FakeFrame([date(2026, 6, 30)], {})

    return _Ticker()


def test_maps_info_into_items(monkeypatch):
    import yfinance as yf

    info = {
        "sharesOutstanding": 1000,
        "dividendRate": 0.5,
        "totalRevenue": 5000.0,
        "netIncomeToCommon": 800.0,
        "returnOnEquity": 0.15,
        "currentRatio": 1.5,
        "debtToEquity": 0.4,
        "priceToBook": 2.1,
        "trailingPE": 18.5,
    }

    def fake_ticker(symbol):
        return _fake_ticker({}, info)

    monkeypatch.setattr(yf, "Ticker", fake_ticker)
    provider = YFinanceProvider()
    out = provider.get_latest_fundamentals("BBCA")
    assert out["period_end"] is not None
    assert "items" in out
    items = out["items"]
    assert items["shares_outstanding"] == 1000
    assert items["dividend_per_share"] == 0.5
    assert items["revenue"] == 5000.0
    assert items["net_income"] == 800.0
    assert isinstance(out["reported_at"], str)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_fundamentals_provider.py -v`
Expected: FAIL — `AttributeError: get_latest_fundamentals`

- [ ] **Step 4: Implement `get_latest_fundamentals`**

Append to `backend/app/infrastructure/providers/yfinance_provider.py` (inside `YFinanceProvider`, after `get_quote`):

```python
    def get_latest_fundamentals(self, ticker: str) -> dict[str, object]:
        """Latest point-in-time fundamental snapshot from yfinance.

        Returns ``{period_end, reported_at, items}`` where ``items`` uses the
        canonical keys consumed by ``calculate_ratios``. Missing statement
        rows are omitted; a fully empty statement raises ``ValueError`` so the
        caller can fail honestly (no fabricated numbers).
        """
        symbol = _idx_symbol(ticker)
        tk: Any = yf.Ticker(symbol)
        info: dict[Any, Any] = dict(tk.info)
        items: dict[str, float] = {}

        def _stmt_value(stmt: Any, row: str) -> float | None:
            if stmt is None or getattr(stmt, "empty", True):
                return None
            try:
                value = stmt.loc[row]
            except (KeyError, IndexError, TypeError):
                return None
            if hasattr(value, "iloc") and len(value) > 0:
                value = value.iloc[0]
            try:
                num = float(value)
            except (TypeError, ValueError):
                return None
            return num if num == num else None  # drop NaN

        mapping: dict[str, tuple[str, str]] = {
            "revenue": ("income_stmt", "Total Revenue"),
            "gross_profit": ("income_stmt", "Gross Profit"),
            "ebitda": ("income_stmt", "EBITDA"),
            "ebit": ("income_stmt", "EBIT"),
            "net_income": ("income_stmt", "Net Income"),
            "eps": ("income_stmt", "Basic EPS"),
            "interest_expense": ("income_stmt", "Interest Expense"),
            "operating_cash_flow": ("cashflow", "Operating Cash Flow"),
            "free_cash_flow": ("cashflow", "Free Cash Flow"),
            "total_assets": ("balance_sheet", "Total Assets"),
            "total_liabilities": ("balance_sheet", "Total Liabilities Net Minority Interest"),
            "equity": ("balance_sheet", "Stockholders Equity"),
            "debt": ("balance_sheet", "Total Debt"),
            "cash": ("balance_sheet", "Cash And Cash Equivalents"),
            "current_assets": ("balance_sheet", "Current Assets"),
            "current_liabilities": ("balance_sheet", "Current Liabilities"),
        }
        statements = {
            "income_stmt": getattr(tk, "income_stmt", None),
            "cashflow": getattr(tk, "cashflow", None),
            "balance_sheet": getattr(tk, "balance_sheet", None),
        }
        for key, (stmt_name, row) in mapping.items():
            value = _stmt_value(statements[stmt_name], row)
            if value is not None:
                items[key] = value

        shares = info.get("sharesOutstanding")
        if shares and float(shares) > 0:
            items["shares_outstanding"] = float(shares)
        dividend = info.get("dividendRate")
        if dividend and float(dividend) > 0:
            items["dividend_per_share"] = float(dividend)
        if "equity" in items and items["equity"] > 0 and "shares_outstanding" in items:
            items["bvps"] = items["equity"] / items["shares_outstanding"]

        income_stmt = statements["income_stmt"]
        period_end: Any = None
        if income_stmt is not None and not income_stmt.empty:
            try:
                period_end = income_stmt.columns[0]
            except (IndexError, TypeError):
                period_end = None

        if not items:
            raise ValueError(f"no fundamentals available for {ticker}")

        return {
            "period_end": (
                period_end.date().isoformat()
                if hasattr(period_end, "date")
                else date.today().isoformat()
            ),
            "reported_at": date.today().isoformat(),
            "items": items,
        }
```

Note: the `_stmt_value` helper above indexes statements via `.loc[row]`; if yfinance statement frames are transposed in the installed version, `.loc` still returns the row Series and `.iloc[0]` picks the latest period — covered by the defensive branches.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_fundamentals_provider.py -v tests/test_yfinance_provider.py`
Expected: PASS (new test + existing provider tests unchanged)

- [ ] **Step 6: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format .
```
Expected: PASS
```bash
git add backend/app/infrastructure/providers/yfinance_provider.py backend/tests/test_fundamentals_provider.py
git commit -m "feat(providers): yfinance fundamentals snapshot provider"
```

---

### Task 7: Macro, news, and checkpoint repositories

**Files:**
- Create: `backend/app/infrastructure/repositories/macro_repo.py`
- Create: `backend/app/infrastructure/repositories/news_repo.py`
- Create: `backend/app/infrastructure/repositories/checkpoint_repo.py`
- Test: `backend/tests/test_macro_repo.py`, `backend/tests/test_news_repo.py`, `backend/tests/test_checkpoint_repo.py`

**Interfaces:**
- Consumes: ORM models (Task 1)
- Produces: `MacroRepository` (`upsert_indicators`, `upsert_events`, `latest_indicators`, `upcoming_events`, `indicator_series`), `NewsRepository` (`upsert_news`, `latest_news`), `CheckpointRepository` (`get`, `set`). Used by Task 8 (jobs) and Tasks 9/11 (routes).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_checkpoint_repo.py`:

```python
"""CheckpointRepository watermark persistence."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.repositories.checkpoint_repo import CheckpointRepository

from datetime import datetime, timezone


async def test_checkpoint_roundtrip(session: AsyncSession):
    repo = CheckpointRepository(session)
    assert await repo.get("ingest_macro") is None
    wm = datetime(2026, 8, 19, 0, 0, tzinfo=timezone.utc)
    await repo.set("ingest_macro", wm)
    assert await repo.get("ingest_macro") == wm
    wm2 = datetime(2026, 8, 20, 0, 0, tzinfo=timezone.utc)
    await repo.set("ingest_macro", wm2)
    assert await repo.get("ingest_macro") == wm2
```

Create `backend/tests/test_macro_repo.py`:

```python
"""MacroRepository upserts + latest_indicators shape."""

from datetime import date, datetime, timedelta, timezone

import polars as pl
import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import EconomicEvent, EconomicIndicator
from app.infrastructure.repositories.macro_repo import MacroRepository


def _indicator_frame() -> pl.DataFrame:
    return pl.DataFrame(
        {
            "indicator": ["usd_idr", "usd_idr", "bi_rate"],
            "asof_date": [date(2026, 8, 18), date(2026, 8, 17), date(2026, 8, 19)],
            "value": [17836.0, 17820.0, 5.75],
            "unit": ["", "", "%"],
            "source": ["BI", "BI", "BI"],
        }
    )


async def test_upsert_and_latest_indicators(session: AsyncSession):
    await session.execute(delete(EconomicIndicator))
    await session.commit()
    repo = MacroRepository(session)
    written = await repo.upsert_indicators(_indicator_frame())
    assert written == 3
    # idempotent re-upsert
    assert await repo.upsert_indicators(_indicator_frame()) == 3

    rows = await repo.latest_indicators()
    by_name = {r["indicator"]: r for r in rows}
    assert set(by_name) == {"usd_idr", "bi_rate"}
    usd = by_name["usd_idr"]
    assert usd["current"] == 17836.0
    assert usd["previous"] == 17820.0
    assert usd["change"] == pytest.approx(16.0)
    assert usd["trend"] == "up"
    assert usd["source"] == "BI"
    assert by_name["bi_rate"]["trend"] == "neutral"


async def test_latest_indicators_empty(session: AsyncSession):
    await session.execute(delete(EconomicIndicator))
    await session.commit()
    repo = MacroRepository(session)
    assert await repo.latest_indicators() == []


def _event_frame() -> pl.DataFrame:
    t0 = datetime(2026, 8, 20, 14, 0, tzinfo=timezone.utc)
    return pl.DataFrame(
        {
            "event": ["BI Rate Decision", "CPI Release"],
            "country": ["ID", "ID"],
            "scheduled_at": [t0, t0 + timedelta(days=1)],
            "importance": [3, 2],
            "category": ["CENTRAL_BANK", "ECONOMICS"],
            "previous": [5.75, 2.4],
            "consensus": [5.75, 2.3],
            "actual": [None, None],
            "status": ["scheduled", "scheduled"],
            "source": ["BI", "BI"],
        }
    )


async def test_upsert_events_and_upcoming(session: AsyncSession):
    await session.execute(delete(EconomicEvent))
    await session.commit()
    repo = MacroRepository(session)
    assert await repo.upsert_events(_event_frame()) == 2
    upcoming = await repo.upcoming_events(limit=5)
    assert len(upcoming) == 2
    first = upcoming[0]
    assert first["event"] == "BI Rate Decision"
    assert first["impact"] == "HIGH"
    assert first["date"] == "2026-08-20"
    assert first["prev"] == 5.75
    assert first["consensus"] == 5.75
    assert first["actual"] is None
    assert first["time"] == "14:00"


async def test_indicator_series(session: AsyncSession):
    await session.execute(delete(EconomicIndicator))
    await session.commit()
    repo = MacroRepository(session)
    await repo.upsert_indicators(_indicator_frame())
    series = await repo.indicator_series("usd_idr", days=30)
    assert len(series) == 2
    assert series[0]["asof_date"] == date(2026, 8, 17)
```

Create `backend/tests/test_news_repo.py`:

```python
"""NewsRepository upsert + latest_news shape."""

from datetime import datetime, timezone

import polars as pl
import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import NewsArticle, NewsEntity
from app.infrastructure.repositories.news_repo import NewsRepository


def _news_frame() -> pl.DataFrame:
    t0 = datetime(2026, 8, 19, 9, 0, tzinfo=timezone.utc)
    return pl.DataFrame(
        {
            "title": ["BBCA posts strong profit", "Market up"],
            "source": ["news.google.com", "antaranews.com"],
            "published_at": [t0, t0],
            "url": ["https://a.example/1", "https://a.example/2"],
            "summary": ["Bank Central Asia results.", "IDX gained."],
            "tickers": [["BBCA"], []],
        }
    )


async def test_upsert_news_and_entities(session: AsyncSession):
    await session.execute(delete(NewsEntity))
    await session.execute(delete(NewsArticle))
    await session.commit()
    repo = NewsRepository(session)
    assert await repo.upsert_news(_news_frame()) == 2
    assert await repo.upsert_news(_news_frame()) == 2  # idempotent

    rows = await repo.latest_news(limit=10)
    assert len(rows) == 2
    first = next(r for r in rows if r["tickers"] == ["BBCA"])
    assert first["id"] is not None
    assert first["title"] == "BBCA posts strong profit"
    assert first["date"] == "2026-08-19"
    assert first["time"] == "09:00"
    assert first["impact"] is None
    assert first["sentiment"] is None
    assert first["category"] == "MARKET"
    assert first["source"] == "news.google.com"


async def test_latest_news_empty(session: AsyncSession):
    await session.execute(delete(NewsEntity))
    await session.execute(delete(NewsArticle))
    await session.commit()
    repo = NewsRepository(session)
    assert await repo.latest_news(limit=10) == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && .venv/bin/python -m pytest tests/test_checkpoint_repo.py tests/test_macro_repo.py tests/test_news_repo.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement the repositories**

Create `backend/app/infrastructure/repositories/checkpoint_repo.py`:

```python
"""Crawler watermark checkpoints (docs/data-pipeline.md §2.1)."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import IngestionCheckpoint


class CheckpointRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, job_name: str) -> datetime | None:
        row = await self._session.scalar(
            select(IngestionCheckpoint.watermark).where(
                IngestionCheckpoint.job_name == job_name
            )
        )
        return row

    async def set(self, job_name: str, watermark: datetime) -> None:
        stmt = pg_insert(IngestionCheckpoint).values(
            job_name=job_name, watermark=watermark
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["job_name"],
            set_={"watermark": stmt.excluded["watermark"]},
        )
        await self._session.execute(stmt)
        await self._session.commit()
```

Create `backend/app/infrastructure/repositories/macro_repo.py`:

```python
"""Repository for economic_indicators / economic_events (docs/data-model.md §7-8)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import polars as pl
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import EconomicEvent, EconomicIndicator

_TREND_KEY = {"bi_rate", "fed_funds", "idn_10y", "us_10y", "us_2y", "dxy"}


def _trend(value: float, indicator: str) -> str:
    if value == 0:
        return "neutral"
    if indicator in _TREND_KEY:
        return "up" if value < 0 else "down"
    return "up" if value > 0 else "down"


class MacroRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert_indicators(self, df: pl.DataFrame) -> int:
        if df.is_empty():
            return 0
        now = datetime.now(timezone.utc)
        records = [
            {
                "indicator": r["indicator"],
                "asof_date": r["asof_date"],
                "value": Decimal(str(r["value"])),
                "unit": r["unit"],
                "source": r["source"],
                "available_at": now,
            }
            for r in df.to_dicts()
        ]
        stmt = pg_insert(EconomicIndicator).values(records)
        stmt = stmt.on_conflict_do_update(
            index_elements=["indicator", "asof_date", "source"],
            set_={
                "value": stmt.excluded["value"],
                "unit": stmt.excluded["unit"],
                "available_at": stmt.excluded["available_at"],
            },
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        return int(result.rowcount)

    async def upsert_events(self, df: pl.DataFrame) -> int:
        if df.is_empty():
            return 0
        records = [
            {
                "event": r["event"],
                "country": r["country"],
                "scheduled_at": r["scheduled_at"],
                "importance": int(r["importance"]),
                "category": r["category"],
                "previous": (
                    Decimal(str(r["previous"])) if r["previous"] is not None else None
                ),
                "consensus": (
                    Decimal(str(r["consensus"])) if r["consensus"] is not None else None
                ),
                "actual": (
                    Decimal(str(r["actual"])) if r["actual"] is not None else None
                ),
                "status": r["status"],
                "source": r["source"],
            }
            for r in df.to_dicts()
        ]
        stmt = pg_insert(EconomicEvent).values(records)
        stmt = stmt.on_conflict_do_update(
            index_elements=["event", "scheduled_at", "source"],
            set_={
                "previous": stmt.excluded["previous"],
                "consensus": stmt.excluded["consensus"],
                "actual": stmt.excluded["actual"],
                "status": stmt.excluded["status"],
                "importance": stmt.excluded["importance"],
            },
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        return int(result.rowcount)

    async def latest_indicators(self) -> list[dict[str, object]]:
        rows = (
            await self._session.execute(
                select(
                    EconomicIndicator.indicator,
                    EconomicIndicator.asof_date,
                    EconomicIndicator.value,
                    EconomicIndicator.unit,
                    EconomicIndicator.source,
                ).order_by(
                    EconomicIndicator.indicator, EconomicIndicator.asof_date.desc()
                )
            )
        ).fetchall()
        latest: dict[str, list[tuple]] = {}
        for r in rows:
            latest.setdefault(r.indicator, []).append(r)
        out: list[dict[str, object]] = []
        for indicator, entries in latest.items():
            if len(entries) == 1:
                cur = float(entries[0].value)
                out.append(
                    {
                        "indicator": indicator,
                        "current": cur,
                        "previous": cur,
                        "change": 0.0,
                        "unit": entries[0].unit,
                        "trend": "neutral",
                        "source": entries[0].source,
                    }
                )
                continue
            newest, older = entries[0], entries[1]
            cur, prev = float(newest.value), float(older.value)
            out.append(
                {
                    "indicator": indicator,
                    "current": cur,
                    "previous": prev,
                    "change": round(cur - prev, 4),
                    "unit": newest.unit,
                    "trend": _trend(cur - prev, indicator),
                    "source": newest.source,
                }
            )
        return out

    async def upcoming_events(self, limit: int = 10) -> list[dict[str, object]]:
        now = datetime.now(timezone.utc)
        rows = (
            await self._session.execute(
                select(
                    EconomicEvent.event,
                    EconomicEvent.country,
                    EconomicEvent.scheduled_at,
                    EconomicEvent.importance,
                    EconomicEvent.category,
                    EconomicEvent.previous,
                    EconomicEvent.consensus,
                    EconomicEvent.actual,
                )
                .where(EconomicEvent.scheduled_at >= now)
                .order_by(EconomicEvent.scheduled_at.asc())
                .limit(limit)
            )
        ).fetchall()
        out: list[dict[str, object]] = []
        for r in rows:
            scheduled = r.scheduled_at.astimezone(timezone.utc)
            out.append(
                {
                    "date": scheduled.date().isoformat(),
                    "time": scheduled.strftime("%H:%M"),
                    "country": r.country,
                    "event": r.event,
                    "impact": {3: "HIGH", 2: "MEDIUM", 1: "LOW"}.get(r.importance, "MEDIUM"),
                    "category": r.category,
                    "prev": float(r.previous) if r.previous is not None else None,
                    "consensus": (
                        float(r.consensus) if r.consensus is not None else None
                    ),
                    "actual": float(r.actual) if r.actual is not None else None,
                }
            )
        return out

    async def indicator_series(
        self, indicator: str, days: int = 30
    ) -> list[dict[str, object]]:
        cutoff = date.today() - timedelta(days=days)
        rows = (
            await self._session.execute(
                select(
                    EconomicIndicator.asof_date, EconomicIndicator.value
                )
                .where(
                    EconomicIndicator.indicator == indicator,
                    EconomicIndicator.asof_date >= cutoff,
                )
                .order_by(EconomicIndicator.asof_date.asc())
            )
        ).fetchall()
        return [
            {"asof_date": r.asof_date, "value": float(r.value)} for r in rows
        ]
```

Create `backend/app/infrastructure/repositories/news_repo.py`:

```python
"""Repository for news + news_entities (docs/data-model.md §11)."""

from __future__ import annotations

from datetime import datetime, timezone

import polars as pl
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import NewsArticle, NewsEntity


class NewsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert_news(self, df: pl.DataFrame) -> int:
        if df.is_empty():
            return 0
        now = datetime.now(timezone.utc)
        total = 0
        for rec in df.to_dicts():
            stmt = pg_insert(NewsArticle).values(
                {
                    "title": rec["title"],
                    "source": rec["source"],
                    "published_at": rec["published_at"],
                    "url": rec["url"],
                    "summary": rec["summary"],
                    "category": "MARKET",
                    "sentiment": None,
                    "impact": None,
                    "available_at": now,
                }
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["source", "url"],
                set_={
                    "title": stmt.excluded["title"],
                    "published_at": stmt.excluded["published_at"],
                    "summary": stmt.excluded["summary"],
                },
            ).returning(NewsArticle.id)
            article_id = (
                await self._session.execute(stmt)
            ).scalar_one_or_none()
            if article_id is not None:
                total += 1
            tickers: list[str] = rec["tickers"] or []
            if article_id is not None and tickers:
                for tk in tickers:
                    ent = pg_insert(NewsEntity).values(
                        article_id=article_id, ticker=tk
                    )
                    ent = ent.on_conflict_do_nothing(
                        index_elements=["article_id", "ticker"]
                    )
                    await self._session.execute(ent)
        await self._session.commit()
        return total

    async def latest_news(self, limit: int = 50) -> list[dict[str, object]]:
        rows = (
            await self._session.execute(
                select(
                    NewsArticle.id,
                    NewsArticle.title,
                    NewsArticle.source,
                    NewsArticle.published_at,
                    NewsArticle.url,
                    NewsArticle.summary,
                    NewsArticle.category,
                    NewsArticle.sentiment,
                    NewsArticle.impact,
                )
                .order_by(NewsArticle.published_at.desc())
                .limit(limit)
            )
        ).fetchall()
        out: list[dict[str, object]] = []
        for r in rows:
            published = r.published_at.astimezone(timezone.utc)
            entities = (
                await self._session.execute(
                    select(NewsEntity.ticker).where(NewsEntity.article_id == r.id)
                )
            ).scalars().all()
            out.append(
                {
                    "id": str(r.id),
                    "date": published.date().isoformat(),
                    "time": published.strftime("%H:%M"),
                    "title": r.title,
                    "source": r.source,
                    "category": r.category,
                    "impact": r.impact,
                    "sentiment": r.sentiment,
                    "tickers": list(entities),
                    "summary": r.summary,
                }
            )
        return out
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_checkpoint_repo.py tests/test_macro_repo.py tests/test_news_repo.py -v`
Expected: PASS

- [ ] **Step 5: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format .
```
Expected: PASS
```bash
git add backend/app/infrastructure/repositories/ backend/tests/test_checkpoint_repo.py backend/tests/test_macro_repo.py backend/tests/test_news_repo.py
git commit -m "feat(repos): macro, news, checkpoint repositories"
```

---

### Task 8: Ingestion jobs + provider factory + scheduler wiring

**Files:**
- Create: `backend/app/infrastructure/providers/factory.py`
- Modify: `backend/app/config/settings.py` (provider + cron settings)
- Modify: `backend/app/interfaces/workers/jobs.py`
- Modify: `backend/app/interfaces/workers/supervisor.py`
- Modify: `backend/tests/test_supervisor.py`
- Test: `backend/tests/test_ingest_jobs.py`

**Interfaces:**
- Consumes: `BiProvider`, `FredProvider`, `RSSNewsProvider`, `YFinanceProvider` (Tasks 3-6), repos (Task 7), `FinancialStatement` model
- Produces: `build_macro_provider()`, `build_news_provider()`, `build_fundamentals_provider()` in `factory.py`; job functions `ingest_macro()`, `ingest_calendar()`, `ingest_news()`, `ingest_fundamentals()` in `jobs.py`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_ingest_jobs.py`:

```python
"""Ingestion jobs: watermark semantics + idempotency (providers mocked)."""

from datetime import datetime, timezone

import polars as pl
import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import (
    EconomicEvent,
    EconomicIndicator,
    IngestionCheckpoint,
    NewsArticle,
    NewsEntity,
)
from app.infrastructure.repositories.checkpoint_repo import CheckpointRepository


@pytest.fixture
def clean_tables(session: AsyncSession):
    from sqlalchemy import delete

    for model in (NewsEntity, NewsArticle, EconomicEvent, EconomicIndicator, IngestionCheckpoint):
        await session.execute(delete(model))
    await session.commit()


def _indicator_rows() -> pl.DataFrame:
    from datetime import date

    return pl.DataFrame(
        {
            "indicator": ["usd_idr"],
            "asof_date": [date(2026, 8, 18)],
            "value": [17836.0],
            "unit": [""],
            "source": ["BI"],
        }
    )


def _event_rows() -> pl.DataFrame:
    from datetime import timedelta

    t0 = datetime(2026, 8, 20, 14, 0, tzinfo=timezone.utc)
    return pl.DataFrame(
        {
            "event": ["BI Rate Decision"],
            "country": ["ID"],
            "scheduled_at": [t0],
            "importance": [3],
            "category": ["CENTRAL_BANK"],
            "previous": [5.75],
            "consensus": [5.75],
            "actual": [None],
            "status": ["scheduled"],
            "source": ["BI"],
        }
    )


def _news_rows() -> pl.DataFrame:
    return pl.DataFrame(
        {
            "title": ["BBCA posts strong profit"],
            "source": ["test.example"],
            "published_at": [datetime(2026, 8, 19, 9, 0, tzinfo=timezone.utc)],
            "url": ["https://test.example/1"],
            "summary": ["results"],
            "tickers": [["BBCA"]],
        }
    )


async def test_ingest_macro_writes_and_advances_watermark(
    session: AsyncSession, clean_tables, monkeypatch
):
    from app.interfaces.workers import jobs as jobs_module

    monkeypatch.setattr(
        jobs_module,
        "_macro_frame",
        lambda start, end: _indicator_rows(),
    )
    written = jobs_module.ingest_macro()
    assert written == 1
    repo = CheckpointRepository(session)
    assert await repo.get("ingest_macro") is not None
    count = (
        await session.execute(select(EconomicIndicator))
    ).scalars().all()
    assert len(count) == 1


async def test_ingest_calendar_writes(session: AsyncSession, clean_tables, monkeypatch):
    from app.interfaces.workers import jobs as jobs_module

    monkeypatch.setattr(
        jobs_module,
        "_calendar_frame",
        lambda start, end: _event_rows(),
    )
    assert jobs_module.ingest_calendar() == 1
    assert (await session.execute(select(EconomicEvent))).scalars().all()


async def test_ingest_news_writes_and_entities(
    session: AsyncSession, clean_tables, monkeypatch
):
    from app.interfaces.workers import jobs as jobs_module

    monkeypatch.setattr(
        jobs_module,
        "_news_frame",
        lambda since: _news_rows(),
    )
    assert jobs_module.ingest_news() == 1
    articles = (await session.execute(select(NewsArticle))).scalars().all()
    assert len(articles) == 1
    entities = (await session.execute(select(NewsEntity))).scalars().all()
    assert len(entities) == 1
    assert entities[0].ticker == "BBCA"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_ingest_jobs.py -v`
Expected: FAIL — `ImportError` / missing attributes

- [ ] **Step 3: Add provider factory**

Create `backend/app/infrastructure/providers/factory.py`:

```python
"""Provider factories resolved from settings (docs/data-pipeline.md §1)."""

from __future__ import annotations

from datetime import date

import polars as pl

from app.config.settings import Settings
from app.domain.fundamental.interfaces import FundamentalDataProvider
from app.domain.macro.interfaces import (
    EconomicCalendarProvider,
    MacroEconomicProvider,
)
from app.domain.news.interfaces import NewsProvider
from app.infrastructure.providers.bi_provider import BiProvider
from app.infrastructure.providers.fred_provider import FredProvider
from app.infrastructure.providers.news_provider import RSSNewsProvider
from app.infrastructure.providers.yfinance_provider import YFinanceProvider


class _CombinedMacroProvider(MacroEconomicProvider, EconomicCalendarProvider):
    """Routes indicator codes to the right vendor; calendar from BI."""

    def __init__(self, bi: BiProvider, fred: FredProvider) -> None:
        self._bi = bi
        self._fred = fred

    def get_indicators(
        self, codes: list[str], start: date, end: date
    ) -> pl.DataFrame:
        bi_codes = [c for c in codes if c in BiProvider._SUPPORTED_CODES]
        fred_codes = [c for c in codes if c not in BiProvider._SUPPORTED_CODES]
        frames: list[pl.DataFrame] = []
        if bi_codes:
            frames.append(self._bi.get_indicators(bi_codes, start, end))
        if fred_codes:
            frames.append(self._fred.get_indicators(fred_codes, start, end))
        if not frames:
            return pl.DataFrame(
                schema={
                    "indicator": pl.String,
                    "asof_date": pl.Date,
                    "value": pl.Float64,
                    "unit": pl.String,
                    "source": pl.String,
                }
            )
        return pl.concat(frames)

    def get_calendar(self, start: date, end: date) -> pl.DataFrame:
        return self._bi.get_calendar(start, end)


def build_macro_provider(
    settings: Settings | None = None,
) -> tuple[MacroEconomicProvider, EconomicCalendarProvider]:
    """Returns (macro provider, calendar provider) for the configured vendor."""
    from app.config.settings import get_settings

    s = settings or get_settings()
    if s.macro_provider != "bi_fred":
        raise ValueError(f"unsupported macro provider: {s.macro_provider}")
    combined = _CombinedMacroProvider(BiProvider(), FredProvider())
    return combined, combined


def build_news_provider(settings: Settings | None = None) -> NewsProvider:
    from app.config.settings import get_settings

    s = settings or get_settings()
    if s.news_provider != "rss":
        raise ValueError(f"unsupported news provider: {s.news_provider}")
    return RSSNewsProvider()


def build_fundamentals_provider(
    settings: Settings | None = None,
) -> FundamentalDataProvider:
    from app.config.settings import get_settings

    s = settings or get_settings()
    if s.fundamental_provider != "yfinance":
        raise ValueError(f"unsupported fundamental provider: {s.fundamental_provider}")
    return YFinanceProvider()
```

- [ ] **Step 4: Add settings fields**

Edit `backend/app/config/settings.py` — add after `market_data_provider`:

```python
    macro_provider: str = "bi_fred"
    news_provider: str = "rss"
    fundamental_provider: str = "yfinance"
    ingest_macro_cron: str = "0 18 * * *"
    ingest_calendar_cron: str = "0 6 * * *"
    ingest_news_cron: str = "*/15 * * * *"
    ingest_fundamentals_cron: str = "0 17 * * *"
```

- [ ] **Step 5: Add job functions to `jobs.py`**

Append to `backend/app/interfaces/workers/jobs.py` (before the `__all__` block) and update `__all__`:

```python
from datetime import date, datetime, timedelta, timezone

from app.application.services.market_data import ingest_ohlcv  # existing import
from app.config.settings import get_settings
from app.infrastructure.database.models import FinancialStatement, Stock
from app.infrastructure.database.session import get_session
from app.infrastructure.providers.factory import (
    build_fundamentals_provider,
    build_macro_provider,
    build_news_provider,
)
from app.infrastructure.repositories.checkpoint_repo import CheckpointRepository
from app.infrastructure.repositories.macro_repo import MacroRepository
from app.infrastructure.repositories.news_repo import NewsRepository


async def _macro_frame(start: date, end: date):
    provider, _calendar = build_macro_provider()
    return provider.get_indicators(["usd_idr", "bi_rate", "idn_10y", "us_10y", "dxy", "sp500"], start, end)


async def _calendar_frame(start: date, end: date):
    _macro, calendar = build_macro_provider()
    return calendar.get_calendar(start, end)


async def _news_frame(since: datetime):
    provider = build_news_provider()
    return provider.get_news(None, since)


def ingest_macro() -> int:
    return asyncio.run(_ingest_macro())


async def _ingest_macro() -> int:
    async for session in get_session():
        checkpoints = CheckpointRepository(session)
        repo = MacroRepository(session)
        watermark = await checkpoints.get("ingest_macro") or datetime.now(timezone.utc) - timedelta(days=30)
        start = watermark.date() - timedelta(days=2)  # overlap window
        df = await _macro_frame(start, date.today())
        written = await repo.upsert_indicators(df)
        await checkpoints.set("ingest_macro", datetime.now(timezone.utc))
        return written
    return 0


def ingest_calendar() -> int:
    return asyncio.run(_ingest_calendar())


async def _ingest_calendar() -> int:
    async for session in get_session():
        checkpoints = CheckpointRepository(session)
        repo = MacroRepository(session)
        watermark = await checkpoints.get("ingest_calendar") or datetime.now(timezone.utc) - timedelta(days=30)
        start = watermark.date() - timedelta(days=2)
        end = start + timedelta(days=45)
        df = await _calendar_frame(start, end)
        written = await repo.upsert_events(df)
        await checkpoints.set("ingest_calendar", datetime.now(timezone.utc))
        return written
    return 0


def ingest_news() -> int:
    return asyncio.run(_ingest_news())


async def _ingest_news() -> int:
    async for session in get_session():
        checkpoints = CheckpointRepository(session)
        repo = NewsRepository(session)
        watermark = await checkpoints.get("ingest_news") or datetime.now(timezone.utc) - timedelta(hours=3)
        since = watermark - timedelta(hours=1)  # overlap window
        df = await _news_frame(since)
        written = await repo.upsert_news(df)
        await checkpoints.set("ingest_news", datetime.now(timezone.utc))
        return written
    return 0


def ingest_fundamentals() -> int:
    return asyncio.run(_ingest_fundamentals())


async def _ingest_fundamentals() -> int:
    provider = build_fundamentals_provider()
    total = 0
    async for session in get_session():
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        tickers: list[str] = list(
            (await session.execute(select(Stock.ticker))).scalars().all()
        )
        for ticker in tickers:
            try:
                snapshot = provider.get_latest_fundamentals(ticker)
            except Exception:
                logger.exception("fundamentals fetch failed for %s", ticker)
                continue
            items: dict[str, float] = snapshot["items"]  # type: ignore[assignment]
            period_end = snapshot.get("period_end")
            from datetime import date as _date

            stmt = pg_insert(FinancialStatement).values(
                {
                    "ticker": ticker,
                    "asof_date": _date.fromisoformat(str(period_end)),
                    "available_at": datetime.now(timezone.utc),
                    "reported_at": _date.fromisoformat(str(snapshot.get("reported_at"))),
                    "period_end": _date.fromisoformat(str(period_end)),
                    "is_annual": True,
                    "items": items,
                }
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["ticker", "asof_date", "available_at"],
                set_={"items": stmt.excluded["items"]},
            )
            result = await session.execute(stmt)
            total += int(result.rowcount or 0)
        await session.commit()
        return total
    return 0
```

Update the module `__all__` to include: `"ingest_macro"`, `"ingest_calendar"`, `"ingest_news"`, `"ingest_fundamentals"`. The test monkeypatches the module-level `_macro_frame`/`_calendar_frame`/`_news_frame` symbols, so these must be module-level functions (as written above).

- [ ] **Step 6: Wire the scheduler**

Edit `backend/app/interfaces/workers/supervisor.py`:

```python
from app.interfaces.workers.jobs import (
    get_queue,
    ingest_calendar,
    ingest_fundamentals,
    ingest_macro,
    ingest_news,
    ingest_ohlcv_daily,
    watchdog,
)

_JOB_INGEST = "ingest_ohlcv_daily"
_JOB_MACRO = "ingest_macro"
_JOB_CALENDAR = "ingest_calendar"
_JOB_NEWS = "ingest_news"
_JOB_FUNDAMENTALS = "ingest_fundamentals"
_JOB_WATCHDOG = "watchdog"


def _enqueue_macro() -> None:
    get_queue().enqueue(ingest_macro)


def _enqueue_calendar() -> None:
    get_queue().enqueue(ingest_calendar)


def _enqueue_news() -> None:
    get_queue().enqueue(ingest_news)


def _enqueue_fundamentals() -> None:
    get_queue().enqueue(ingest_fundamentals)


def schedule_jobs(scheduler: BackgroundScheduler) -> None:
    settings = get_settings()
    scheduler.add_job(_enqueue_daily, CronTrigger.from_crontab(settings.ingest_cron), id=_JOB_INGEST)
    scheduler.add_job(_enqueue_macro, CronTrigger.from_crontab(settings.ingest_macro_cron), id=_JOB_MACRO)
    scheduler.add_job(_enqueue_calendar, CronTrigger.from_crontab(settings.ingest_calendar_cron), id=_JOB_CALENDAR)
    scheduler.add_job(_enqueue_news, CronTrigger.from_crontab(settings.ingest_news_cron), id=_JOB_NEWS)
    scheduler.add_job(_enqueue_fundamentals, CronTrigger.from_crontab(settings.ingest_fundamentals_cron), id=_JOB_FUNDAMENTALS)
    scheduler.add_job(_enqueue_watchdog, CronTrigger.from_crontab(settings.watchdog_cron), id=_JOB_WATCHDOG)
```

Update `backend/tests/test_supervisor.py`:

```python
def test_schedule_jobs_adds_triggers() -> None:
    scheduler = BackgroundScheduler()
    s.schedule_jobs(scheduler)
    ids = {j.id for j in scheduler.get_jobs()}
    assert ids == {
        "ingest_ohlcv_daily",
        "ingest_macro",
        "ingest_calendar",
        "ingest_news",
        "ingest_fundamentals",
        "watchdog",
    }
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_ingest_jobs.py tests/test_supervisor.py tests/test_settings.py -v`
Expected: PASS

- [ ] **Step 8: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format .
```
Expected: PASS
```bash
git add backend/app/infrastructure/providers/factory.py backend/app/config/settings.py backend/app/interfaces/workers/ backend/tests/test_ingest_jobs.py backend/tests/test_supervisor.py
git commit -m "feat(workers): macro, calendar, news, fundamentals ingestion jobs"
```

---

### Task 9: Macro / calendar / news routes read from DB

**Files:**
- Modify: `backend/app/interfaces/api/routes/macro.py`
- Modify: `backend/app/interfaces/api/routes/calendar.py`
- Modify: `backend/app/interfaces/api/routes/news.py`
- Modify: `backend/tests/test_api_reference_data.py`

**Interfaces:**
- Consumes: `MacroRepository`, `NewsRepository` (Task 7)
- Produces: unchanged response shapes (Task 7 repo output shapes).

- [ ] **Step 1: Write the failing test updates**

Replace the classes `TestMacroEndpoints`, `TestCalendarEndpoints`, `TestNewsEndpoints` in `backend/tests/test_api_reference_data.py` with DB-backed versions:

```python
from datetime import date, datetime, timezone, timedelta

import polars as pl
from app.infrastructure.database.models import (
    EconomicEvent,
    EconomicIndicator,
    NewsArticle,
    NewsEntity,
)
from app.infrastructure.repositories.macro_repo import MacroRepository
from app.infrastructure.repositories.news_repo import NewsRepository


@pytest.fixture
async def seed_macro(session: AsyncSession):
    from sqlalchemy import delete

    await session.execute(delete(EconomicEvent))
    await session.execute(delete(EconomicIndicator))
    await session.commit()
    repo = MacroRepository(session)
    await repo.upsert_indicators(
        pl.DataFrame(
            {
                "indicator": ["BI Rate", "USD/IDR"],
                "asof_date": [date(2026, 8, 19), date(2026, 8, 19)],
                "value": [5.75, 17836.0],
                "unit": ["%", ""],
                "source": ["BI", "BI"],
            }
        )
    )
    t0 = datetime(2026, 8, 20, 14, 0, tzinfo=timezone.utc)
    await repo.upsert_events(
        pl.DataFrame(
            {
                "event": ["BI Rate Decision"],
                "country": ["ID"],
                "scheduled_at": [t0],
                "importance": [3],
                "category": ["CENTRAL_BANK"],
                "previous": [5.75],
                "consensus": [5.75],
                "actual": [None],
                "status": ["scheduled"],
                "source": ["BI"],
            }
        )
    )


@pytest.fixture
async def seed_news(session: AsyncSession):
    from sqlalchemy import delete

    await session.execute(delete(NewsEntity))
    await session.execute(delete(NewsArticle))
    await session.commit()
    repo = NewsRepository(session)
    await repo.upsert_news(
        pl.DataFrame(
            {
                "title": ["BBCA posts strong quarterly profit"],
                "source": ["news.google.com"],
                "published_at": [datetime(2026, 8, 19, 9, 0, tzinfo=timezone.utc)],
                "url": ["https://example.com/1"],
                "summary": ["Bank Central Asia reported results."],
                "tickers": [["BBCA"]],
            }
        )
    )


class TestMacroEndpoints:
    async def test_macro_indicators_returns_typed_list(self, client, seed_macro):
        response = await client.get(f"{BASE_URL}/macro/indicators")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2
        item = next(i for i in data if i["indicator"] == "BI Rate")
        for key in ("indicator", "current", "previous", "change", "unit", "trend", "source"):
            assert key in item, f"missing key {key}"
        assert item["trend"] in ("up", "down", "neutral")
        assert item["current"] == 5.75

    async def test_macro_indicators_empty_without_data(self, client, session: AsyncSession):
        from sqlalchemy import delete

        await session.execute(delete(EconomicIndicator))
        await session.commit()
        response = await client.get(f"{BASE_URL}/macro/indicators")
        assert response.status_code == 200
        assert response.json() == []


class TestCalendarEndpoints:
    async def test_calendar_events_returns_typed_list(self, client, seed_macro):
        response = await client.get(f"{BASE_URL}/calendar/events")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        item = data[0]
        for key in ("date", "time", "country", "event", "impact", "category", "prev", "consensus", "actual"):
            assert key in item, f"missing key {key}"
        assert item["impact"] in ("HIGH", "MEDIUM", "LOW")
        assert item["actual"] is None  # honest: not released
        datetime.fromisoformat(item["date"])

    async def test_calendar_empty_without_data(self, client, session: AsyncSession):
        from sqlalchemy import delete

        await session.execute(delete(EconomicEvent))
        await session.commit()
        response = await client.get(f"{BASE_URL}/calendar/events")
        assert response.status_code == 200
        assert response.json() == []


class TestNewsEndpoints:
    async def test_news_returns_typed_list(self, client, seed_news):
        response = await client.get(f"{BASE_URL}/news")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        item = data[0]
        for key in ("id", "date", "time", "title", "source", "category", "impact", "sentiment", "tickers", "summary"):
            assert key in item, f"missing key {key}"
        assert item["impact"] is None  # honest: no fabricated sentiment/impact
        assert item["sentiment"] is None
        assert item["tickers"] == ["BBCA"]

    async def test_news_empty_without_data(self, client, session: AsyncSession):
        from sqlalchemy import delete

        await session.execute(delete(NewsEntity))
        await session.execute(delete(NewsArticle))
        await session.commit()
        response = await client.get(f"{BASE_URL}/news")
        assert response.status_code == 200
        assert response.json() == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && .venv/bin/python -m pytest tests/test_api_reference_data.py -v`
Expected: FAIL — routes still return hardcoded seed data

- [ ] **Step 3: Rewrite the three routes**

Replace the full content of `backend/app/interfaces/api/routes/macro.py`:

```python
"""Macro API routes — read from economic_indicators (docs/data-model.md §7)."""

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_session
from app.infrastructure.repositories.macro_repo import MacroRepository

router = APIRouter()


@router.get("/indicators", response_model=list[dict[str, Any]])
async def macro_indicators(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Get the latest macro indicator values from the ingested series."""
    return await MacroRepository(session).latest_indicators()
```

Replace `backend/app/interfaces/api/routes/calendar.py`:

```python
"""Economic calendar API routes — read from economic_events."""

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_session
from app.infrastructure.repositories.macro_repo import MacroRepository

router = APIRouter()


@router.get("/events", response_model=list[dict[str, Any]])
async def calendar_events(
    limit: int = Query(default=30, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Get upcoming economic calendar events from the ingested series."""
    return await MacroRepository(session).upcoming_events(limit=limit)
```

Replace `backend/app/interfaces/api/routes/news.py`:

```python
"""News API routes — read from news/news_entities (docs/data-model.md §11)."""

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_session
from app.infrastructure.repositories.news_repo import NewsRepository

router = APIRouter()


@router.get("", response_model=list[dict[str, Any]])
@router.get("/", response_model=list[dict[str, Any]], include_in_schema=False)
async def news_items(
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Get the latest ingested news items."""
    return await NewsRepository(session).latest_news(limit=limit)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_api_reference_data.py -v`
Expected: PASS (macro/calendar/news classes; portfolio tests still fail — Task 10)

- [ ] **Step 5: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format .
```
Expected: PASS
```bash
git add backend/app/interfaces/api/routes/macro.py backend/app/interfaces/api/routes/calendar.py backend/app/interfaces/api/routes/news.py backend/tests/test_api_reference_data.py
git commit -m "feat(api): macro, calendar, news routes read real DB data"
```

---

### Task 10: Portfolio CRUD API

**Files:**
- Create: `backend/app/infrastructure/repositories/portfolio_repo.py`
- Modify: `backend/app/interfaces/api/routes/portfolio.py`
- Modify: `backend/tests/test_api_reference_data.py` (`TestPortfolioEndpoints`)
- Test: `backend/tests/test_portfolio_api.py`

**Interfaces:**
- Consumes: `Portfolio`, `PortfolioPosition`, `Stock`, `OhlcvDaily` models
- Produces: `PortfolioRepository` (`get_or_create_default`, `list_positions`, `add_position`, `update_position`, `remove_position`); portfolio route keeps GET shape `{ticker, name, quantity, avgPrice, currentPrice, pnl, pnlPct, weight, marketValue}` and adds `POST /positions`, `PUT /positions/{ticker}`, `DELETE /positions/{ticker}`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_portfolio_api.py`:

```python
"""Portfolio CRUD API against real tables + real price data."""

from datetime import date, timedelta

import pytest
from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import (
    OhlcvDaily,
    Portfolio,
    PortfolioPosition,
    Stock,
)

BASE_URL = "/api/v1/portfolio"


@pytest.fixture
async def seed_stock_with_price(session: AsyncSession):
    await session.execute(delete(PortfolioPosition))
    await session.execute(delete(Portfolio))
    await session.execute(delete(OhlcvDaily).where(OhlcvDaily.ticker == "BBCA.JK"))
    await session.execute(delete(Stock).where(Stock.ticker == "BBCA"))
    await session.commit()
    stock = Stock(
        ticker="BBCA",
        name="Bank Central Asia",
        listing_date=date(1997, 12, 9),
        board="Utama",
        is_active=True,
    )
    session.add(stock)
    await session.flush()
    for i, close in enumerate((9800.0, 9900.0)):
        session.add(
            OhlcvDaily(
                ticker="BBCA.JK",
                trade_date=date(2026, 8, 18) - timedelta(days=i),
                open=close,
                high=close,
                low=close,
                close=close,
                volume=1000,
                turnover=close * 1000,
                adjustment_factor=1.0,
                provider="test",
            )
        )
    await session.commit()
    return stock


async def test_portfolio_empty_returns_list(client, session: AsyncSession):
    await session.execute(delete(PortfolioPosition))
    await session.execute(delete(Portfolio))
    await session.commit()
    response = await client.get(f"{BASE_URL}")
    assert response.status_code == 200
    assert response.json() == []


async def test_add_position_and_derive_pnl(client, seed_stock_with_price):
    response = await client.post(
        f"{BASE_URL}/positions",
        json={"ticker": "BBCA", "quantity": 100, "avg_price": 9500.0},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "BBCA"
    assert data["name"] == "Bank Central Asia"
    assert data["quantity"] == 100
    assert data["avgPrice"] == 9500.0
    assert data["currentPrice"] == 9800.0  # latest close from ohlcv_daily
    assert data["marketValue"] == pytest.approx(9800.0 * 100)
    assert data["pnl"] == pytest.approx(300.0 * 100)
    assert data["pnlPct"] == pytest.approx(300.0 / 9500.0 * 100)

    listing = client.get(f"{BASE_URL}").json()
    assert len(listing) == 1
    assert listing[0]["weight"] == pytest.approx(100.0)


async def test_add_duplicate_position_returns_409(client, seed_stock_with_price):
    payload = {"ticker": "BBCA", "quantity": 100, "avg_price": 9500.0}
    assert (await client.post(f"{BASE_URL}/positions", json=payload)).status_code == 200
    assert (await client.post(f"{BASE_URL}/positions", json=payload)).status_code == 409


async def test_update_and_remove_position(client, seed_stock_with_price):
    await client.post(
        f"{BASE_URL}/positions",
        json={"ticker": "BBCA", "quantity": 100, "avg_price": 9500.0},
    )
    response = await client.put(
        f"{BASE_URL}/positions/BBCA",
        json={"quantity": 200, "avg_price": 9600.0},
    )
    assert response.status_code == 200
    assert response.json()["quantity"] == 200
    assert response.json()["avgPrice"] == 9600.0

    response = await client.delete(f"{BASE_URL}/positions/BBCA")
    assert response.status_code == 200
    assert client.get(f"{BASE_URL}").json() == []


async def test_unknown_ticker_rejected(client, session: AsyncSession):
    await session.execute(delete(Stock).where(Stock.ticker == "NOPE"))
    await session.commit()
    response = await client.post(
        f"{BASE_URL}/positions",
        json={"ticker": "NOPE", "quantity": 1, "avg_price": 100.0},
    )
    assert response.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && .venv/bin/python -m pytest tests/test_portfolio_api.py -v`
Expected: FAIL — 405/404 (no positions endpoints)

- [ ] **Step 3: Implement `portfolio_repo.py`**

Create `backend/app/infrastructure/repositories/portfolio_repo.py`:

```python
"""Repository for portfolios / portfolio_positions (docs/data-model.md §11)."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import (
    OhlcvDaily,
    Portfolio,
    PortfolioPosition,
    Stock,
)


class PortfolioRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_or_create_default(self) -> Portfolio:
        portfolio = (
            await self._session.scalar(
                select(Portfolio).order_by(Portfolio.id.asc()).limit(1)
            )
        )
        if portfolio is not None:
            return portfolio
        portfolio = Portfolio(name="Default")
        self._session.add(portfolio)
        await self._session.commit()
        await self._session.refresh(portfolio)
        return portfolio

    async def list_positions(self) -> list[dict[str, Any]]:
        portfolio = await self.get_or_create_default()
        rows = (
            await self._session.execute(
                select(PortfolioPosition, Stock.name)
                .join(Stock, Stock.ticker == PortfolioPosition.ticker)
                .where(PortfolioPosition.portfolio_id == portfolio.id)
            )
        ).fetchall()
        out: list[dict[str, Any]] = []
        total_value = Decimal("0")
        enriched: list[dict[str, Any]] = []
        for position, name in rows:
            price_row = (
                await self._session.execute(
                    select(OhlcvDaily.close)
                    .where(OhlcvDaily.ticker == f"{position.ticker}.JK")
                    .order_by(OhlcvDaily.trade_date.desc())
                    .limit(1)
                )
            ).first()
            current_price = (
                float(price_row[0]) if price_row and price_row[0] is not None else None
            )
            quantity = float(position.quantity)
            avg_price = float(position.avg_price)
            entry = {
                "ticker": position.ticker,
                "name": name,
                "quantity": quantity,
                "avgPrice": avg_price,
                "currentPrice": current_price,
                "marketValue": round(current_price * quantity, 2)
                if current_price is not None
                else None,
                "pnl": round((current_price - avg_price) * quantity, 2)
                if current_price is not None
                else None,
                "pnlPct": round((current_price - avg_price) / avg_price * 100, 2)
                if current_price is not None
                else None,
            }
            enriched.append(entry)
            if current_price is not None:
                total_value += Decimal(str(entry["marketValue"]))
        for entry in enriched:
            entry["weight"] = (
                round(float(entry["marketValue"]) / float(total_value) * 100, 2)
                if entry["marketValue"] is not None and total_value > 0
                else None
            )
        return enriched

    async def add_position(
        self, ticker: str, quantity: float, avg_price: float
    ) -> PortfolioPosition:
        portfolio = await self.get_or_create_default()
        stmt = pg_insert(PortfolioPosition).values(
            portfolio_id=portfolio.id,
            ticker=ticker,
            quantity=Decimal(str(quantity)),
            avg_price=Decimal(str(avg_price)),
        )
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["portfolio_id", "ticker"]
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        if result.rowcount == 0:
            raise ValueError(f"position already exists: {ticker}")
        return (
            await self._session.scalar(
                select(PortfolioPosition).where(
                    PortfolioPosition.portfolio_id == portfolio.id,
                    PortfolioPosition.ticker == ticker,
                )
            )
        )  # type: ignore[return-value]

    async def update_position(
        self, ticker: str, quantity: float, avg_price: float
    ) -> PortfolioPosition | None:
        portfolio = await self.get_or_create_default()
        stmt = (
            pg_insert(PortfolioPosition)
            .values(
                portfolio_id=portfolio.id,
                ticker=ticker,
                quantity=Decimal(str(quantity)),
                avg_price=Decimal(str(avg_price)),
            )
            .on_conflict_do_update(
                index_elements=["portfolio_id", "ticker"],
                set_={
                    "quantity": stmt.excluded["quantity"],
                    "avg_price": stmt.excluded["avg_price"],
                },
            )
            .returning(PortfolioPosition)
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def remove_position(self, ticker: str) -> bool:
        portfolio = await self.get_or_create_default()
        result = await self._session.execute(
            delete(PortfolioPosition).where(
                PortfolioPosition.portfolio_id == portfolio.id,
                PortfolioPosition.ticker == ticker,
            )
        )
        await self._session.commit()
        return bool(result.rowcount)
```

- [ ] **Step 4: Rewrite the portfolio route**

Replace the full content of `backend/app/interfaces/api/routes/portfolio.py`:

```python
"""Portfolio API routes — real positions + real market prices."""

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import Stock
from app.infrastructure.database.session import get_session
from app.infrastructure.repositories.portfolio_repo import PortfolioRepository

router = APIRouter()


class PositionIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=16)
    quantity: float = Field(gt=0)
    avg_price: float = Field(gt=0)


class PositionUpdate(BaseModel):
    quantity: float = Field(gt=0)
    avg_price: float = Field(gt=0)


@router.get("", response_model=list[dict[str, Any]])
@router.get("/", response_model=list[dict[str, Any]], include_in_schema=False)
async def portfolio(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """Get the user portfolio with derived pnl and weights from real quotes."""
    return await PortfolioRepository(session).list_positions()


@router.post("/positions", response_model=dict[str, Any])
async def add_position(
    payload: PositionIn = Body(...),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Add a position to the default portfolio (ticker must be in universe)."""
    stock = (
        await session.execute(select(Stock).where(Stock.ticker == payload.ticker))
    ).scalars().first()
    if stock is None:
        raise HTTPException(
            status_code=400, detail=f"unknown ticker: {payload.ticker}"
        )
    repo = PortfolioRepository(session)
    try:
        await repo.add_position(payload.ticker, payload.quantity, payload.avg_price)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return await _single_position(session, payload.ticker)


@router.put("/positions/{ticker}", response_model=dict[str, Any])
async def update_position(
    ticker: str,
    payload: PositionUpdate = Body(...),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Update quantity/avg price of an existing position."""
    repo = PortfolioRepository(session)
    position = await repo.update_position(ticker, payload.quantity, payload.avg_price)
    if position is None:
        raise HTTPException(status_code=404, detail=f"position not found: {ticker}")
    return await _single_position(session, ticker)


@router.delete("/positions/{ticker}", response_model=dict[str, bool])
async def remove_position(
    ticker: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    """Remove a position from the default portfolio."""
    removed = await PortfolioRepository(session).remove_position(ticker)
    if not removed:
        raise HTTPException(status_code=404, detail=f"position not found: {ticker}")
    return {"removed": True}


async def _single_position(
    session: AsyncSession, ticker: str
) -> dict[str, Any]:
    rows = await PortfolioRepository(session).list_positions()
    for row in rows:
        if row["ticker"] == ticker:
            return row
    raise HTTPException(status_code=404, detail=f"position not found: {ticker}")
```

- [ ] **Step 5: Update `TestPortfolioEndpoints` in `test_api_reference_data.py`**

Replace the class body:

```python
class TestPortfolioEndpoints:
    """GET /api/v1/portfolio (real positions from portfolio_positions)."""

    async def test_portfolio_empty_by_default(self, client, session: AsyncSession):
        from sqlalchemy import delete

        await session.execute(delete(PortfolioPosition))
        await session.execute(delete(Portfolio))
        await session.commit()
        response = await client.get(f"{BASE_URL}/portfolio")
        assert response.status_code == 200
        assert response.json() == []
```

(Keep the import of `Portfolio`/`PortfolioPosition` models in the test file.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_portfolio_api.py tests/test_api_reference_data.py -v`
Expected: PASS

- [ ] **Step 7: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format .
```
Expected: PASS
```bash
git add backend/app/infrastructure/repositories/portfolio_repo.py backend/app/interfaces/api/routes/portfolio.py backend/tests/test_portfolio_api.py backend/tests/test_api_reference_data.py
git commit -m "feat(api): real portfolio CRUD with live-derived pnl"
```

---

### Task 11: Market overview real data (sector rotation, macro scores, upcoming events)

**Files:**
- Create: `backend/app/domain/macro/scores.py`
- Modify: `backend/app/interfaces/api/routes/market.py`
- Test: `backend/tests/test_macro_scores.py`

**Interfaces:**
- Consumes: `MacroRepository` (Task 7), `StockScore`/`Stock`/`Sector` models
- Produces: `compute_macro_scores(series: dict[str, list[tuple[date, float]]]) -> dict[str, float | None]`; market overview `sector_rotation`, `macro` (risk/support), `upcoming_events` populated from real data.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_macro_scores.py`:

```python
"""Macro risk/support heuristic — computed from real series, never fabricated."""

from datetime import date, timedelta

from app.domain.macro.scores import compute_macro_scores


def _series(days: int, start: float, daily: float) -> list[tuple[date, float]]:
    out = []
    d = date(2026, 8, 19) - timedelta(days=days - 1)
    value = start
    for _ in range(days):
        out.append((d, value))
        value *= 1 + daily
        d += timedelta(days=1)
    return out


def test_scores_computed_from_real_series():
    series = {
        "usd_idr": _series(30, 17500.0, 0.001),      # IDR weakening
        "dxy": _series(30, 104.0, 0.0005),           # dollar rising
        "us_10y": _series(30, 6.5, 0.002),           # yields rising
        "sp500": _series(30, 5000.0, 0.0005),        # equities rising
    }
    out = compute_macro_scores(series)
    assert out["risk"] is not None and out["support"] is not None
    assert 0.0 <= out["risk"] <= 100.0
    assert 0.0 <= out["support"] <= 100.0
    assert out["risk"] > out["support"]


def test_scores_missing_data_return_none():
    out = compute_macro_scores({})
    assert out == {"risk": None, "support": None}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_scores.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement `scores.py`**

Create `backend/app/domain/macro/scores.py`:

```python
"""Macro risk/support scores — deterministic heuristic over real series.

Simple v1: directional 30-day changes drive a 0-100 score. Percentile-based
cross-time scoring (docs/macro.md §4) is a future refinement; this module
never invents values — with insufficient data both scores are None.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any


def _change_pct(series: list[tuple[date, float]], days: int = 30) -> float | None:
    if len(series) < 2:
        return None
    cutoff = series[-1][0] - timedelta(days=days)
    recent = [v for d, v in series if d >= cutoff]
    if len(recent) < 2:
        return None
    first, last = recent[0], recent[-1]
    if first == 0:
        return None
    return (last - first) / first * 100.0


def compute_macro_scores(
    series: dict[str, list[tuple[date, float]]]
) -> dict[str, float | None]:
    """risk/support in 0-100; None when insufficient real data."""
    usd_idr = _change_pct(series.get("usd_idr", []))
    dxy = _change_pct(series.get("dxy", []))
    us_10y = _change_pct(series.get("us_10y", []))
    sp500 = _change_pct(series.get("sp500", []))
    inputs = [v for v in (usd_idr, dxy, us_10y, sp500) if v is not None]
    if len(inputs) < 2:
        return {"risk": None, "support": None}

    def _clip(value: float) -> float:
        return max(0.0, min(100.0, value))

    risk = 50.0
    if usd_idr is not None:
        risk += 3.0 * usd_idr
    if dxy is not None:
        risk += 1.5 * dxy
    if us_10y is not None:
        risk += 1.2 * us_10y
    if sp500 is not None:
        risk -= 0.5 * sp500
    support = 100.0 - risk
    return {"risk": round(_clip(risk), 2), "support": round(_clip(support), 2)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_scores.py -v`
Expected: PASS

- [ ] **Step 5: Update the market overview route**

In `backend/app/interfaces/api/routes/market.py`, replace the overview return block (currently hardcoded `"sector_rotation": []`, `"macro": {"risk": 0, "support": 0}`, `"upcoming_events": []`):

```python
    # Real sector rotation: average sector_score per sector from the latest scan.
    sector_rotation: list[dict[str, object]] = []
    if asof is not None:
        sector_rows = (
            await session.execute(
                select(StockScore.sector_score, Sector.name)
                .join(Stock, Stock.ticker == StockScore.ticker)
                .join(Sector, Sector.id == Stock.sector_id)
                .where(
                    StockScore.profile == DEFAULT_PROFILE,
                    StockScore.asof_date == asof,
                    StockScore.sector_score.is_not(None),
                )
            )
        ).fetchall()
        by_sector: dict[str, list[float]] = {}
        for score, name in sector_rows:
            if name is not None:
                by_sector.setdefault(name, []).append(float(score))
        sector_rotation = [
            {
                "sector": name,
                "score": round(sum(vals) / len(vals), 2),
                "asof": asof.isoformat(),
            }
            for name, vals in sorted(by_sector.items(), key=lambda kv: sum(kv[1]) / len(kv[1]), reverse=True)
        ]

    # Real macro risk/support from ingested indicator series (None = no data yet).
    from app.domain.macro.scores import compute_macro_scores
    from app.infrastructure.repositories.macro_repo import MacroRepository

    macro_repo = MacroRepository(session)
    series = {
        code: [
            (r["asof_date"], r["value"])
            for r in await macro_repo.indicator_series(code, days=30)
        ]
        for code in ("usd_idr", "dxy", "us_10y", "sp500")
    }
    macro_scores = compute_macro_scores(series)

    # Real upcoming events from economic_events.
    upcoming_events = await macro_repo.upcoming_events(limit=5)

    return {
        "regime": regime
        or {"regime": "UNKNOWN", "confidence": 0.0, "components": {}, "asof": None},
        "breadth": {
            "breadth_score": breadth["breadth_score"] if breadth else 0.0,
            "asof": breadth["asof"] if breadth else None,
        },
        "top_gainers": [m for m in movers if m["change_pct"] > 0][:_TOP_OPPORTUNITIES],
        "top_losers": sorted(
            [m for m in movers if m["change_pct"] < 0],
            key=lambda m: m["change_pct"],
        )[:_TOP_OPPORTUNITIES],
        "top_opportunities": opportunities,
        "sector_rotation": sector_rotation,
        "macro": macro_scores,
        "upcoming_events": upcoming_events,
        "asof": asof.isoformat() if asof else None,
    }
```

Add missing imports at the top of `market.py`:

```python
from app.infrastructure.database.models import Sector, Stock, StockScore
```

- [ ] **Step 6: Run the market route tests**

Run: `cd backend && .venv/bin/python -m pytest tests/test_api.py -v`
Expected: PASS

- [ ] **Step 7: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format .
```
Expected: PASS
```bash
git add backend/app/domain/macro/scores.py backend/app/interfaces/api/routes/market.py backend/tests/test_macro_scores.py
git commit -m "feat(api): market overview from real sector rotation, macro scores, events"
```

---

### Task 12: Stock risk_level / regime derived from real features

**Files:**
- Create: `backend/app/domain/technical/risk.py`
- Modify: `backend/app/interfaces/api/routes/stocks.py`
- Test: `backend/tests/test_risk_regime.py`

**Interfaces:**
- Consumes: technical features JSONB (written by the scanner)
- Produces: `derive_stock_risk_regime(indicators: dict[str, object]) -> tuple[str, str]`; `stock_analysis` uses it instead of hardcoded `"MEDIUM"`/`"NEUTRAL"`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_risk_regime.py`:

```python
"""Stock risk/regime derived from real technical features."""

from app.domain.technical.risk import derive_stock_risk_regime


def test_low_volatility_bullish():
    indicators = {
        "hist_vol_20": 12.0,
        "rsi_14": 60.0,
        "sma_50": 110.0,
        "sma_200": 100.0,
    }
    assert derive_stock_risk_regime(indicators) == ("LOW", "BULLISH")


def test_high_volatility_bearish():
    indicators = {
        "hist_vol_20": 55.0,
        "rsi_14": 30.0,
        "sma_50": 90.0,
        "sma_200": 100.0,
    }
    assert derive_stock_risk_regime(indicators) == ("HIGH", "BEARISH")


def test_mixed_signal_neutral():
    indicators = {
        "hist_vol_20": 30.0,
        "rsi_14": 55.0,
        "sma_50": 95.0,
        "sma_200": 100.0,
    }
    assert derive_stock_risk_regime(indicators) == ("MEDIUM", "NEUTRAL")


def test_missing_features_defaults_to_unknown():
    assert derive_stock_risk_regime({}) == ("UNKNOWN", "UNKNOWN")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_risk_regime.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement `risk.py`**

Create `backend/app/domain/technical/risk.py`:

```python
"""Stock-level risk level and trend regime derived from technical features.

Pure function over the indicator dicts the scanner writes to
``technical_features.indicators`` (docs/data-model.md §9). Never returns
fabricated values: with missing features it reports UNKNOWN.
"""

from __future__ import annotations

from typing import Any


def _f(indicators: dict[str, Any], key: str) -> float:
    try:
        value = float(indicators.get(key) or 0.0)
    except (TypeError, ValueError):
        return 0.0
    return value


def derive_stock_risk_regime(
    indicators: dict[str, Any],
) -> tuple[str, str]:
    vol = _f(indicators, "hist_vol_20")
    rsi = _f(indicators, "rsi_14")
    sma50 = _f(indicators, "sma_50")
    sma200 = _f(indicators, "sma_200")
    if sma50 <= 0 or sma200 <= 0 or vol <= 0:
        return "UNKNOWN", "UNKNOWN"
    risk = "HIGH" if vol >= 45 else "LOW" if vol <= 20 else "MEDIUM"
    if sma50 > sma200 and rsi >= 50:
        regime = "BULLISH"
    elif sma50 < sma200 and rsi < 50:
        regime = "BEARISH"
    else:
        regime = "NEUTRAL"
    return risk, regime
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/python -m pytest tests/test_risk_regime.py -v`
Expected: PASS

- [ ] **Step 5: Wire into `stocks.py` analysis route**

In `backend/app/interfaces/api/routes/stocks.py`, replace:

```python
        "risk_level": "MEDIUM",
        "regime": "NEUTRAL",
```

with:

```python
        "risk_level": risk_level,
        "regime": regime,
```

and before the `return` statement, load the latest technical features for the ticker:

```python
    from app.domain.technical.risk import derive_stock_risk_regime
    from app.infrastructure.repositories.stock_score_repo import StockScoreRepository

    indicators = await StockScoreRepository(session).latest_technical_features(ticker)
    risk_level, regime = (
        derive_stock_risk_regime(indicators) if indicators is not None else ("UNKNOWN", "UNKNOWN")
    )
```

- [ ] **Step 6: Run the stocks route tests**

Run: `cd backend && .venv/bin/python -m pytest tests/test_api.py -v`
Expected: PASS

- [ ] **Step 7: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format .
```
Expected: PASS
```bash
git add backend/app/domain/technical/risk.py backend/app/interfaces/api/routes/stocks.py backend/tests/test_risk_regime.py
git commit -m "feat(api): stock risk level and regime derived from real features"
```

---

### Task 13: Data-quality API route

**Files:**
- Create: `backend/app/application/services/data_quality_service.py`
- Create: `backend/app/interfaces/api/routes/data_quality.py`
- Modify: `backend/app/interfaces/api/router.py` (register route)
- Test: `backend/tests/test_data_quality_api.py`

**Interfaces:**
- Consumes: `validate_ohlcv` (existing `app.application.services.data_quality`), `OhlcvDaily` model
- Produces: `build_quality_report(session) -> dict[str, object]`; `GET /api/v1/data-quality`.

- [ ] **Step 1: Check router registration**

Run: `cd backend && cat app/interfaces/api/router.py`
Note the include pattern; the new `data_quality` router must be included the same way.

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_data_quality_api.py`:

```python
"""GET /api/v1/data-quality — real report computed from ohlcv_daily."""

from datetime import date, timedelta

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import OhlcvDaily

BASE_URL = "/api/v1/data-quality"


@pytest.fixture
async def seed_ohlcv(session: AsyncSession):
    await session.execute(delete(OhlcvDaily))
    await session.commit()
    for i in range(20):
        close = 100.0 + i
        session.add(
            OhlcvDaily(
                ticker="BBCA.JK",
                trade_date=date(2026, 7, 20) + timedelta(days=i),
                open=close,
                high=close + 1,
                low=close - 1,
                close=close,
                volume=1000,
                turnover=close * 1000,
                adjustment_factor=1.0,
                provider="test",
            )
        )
    await session.commit()


async def test_quality_report_shape(client, seed_ohlcv):
    response = await client.get(BASE_URL)
    assert response.status_code == 200
    data = response.json()
    assert data["total_tickers"] == 1
    assert data["overall_score"] is not None
    assert 0.0 <= data["overall_score"] <= 100.0
    assert len(data["tickers"]) == 1
    ticker = data["tickers"][0]
    assert ticker["ticker"] == "BBCA.JK"
    assert ticker["rows_valid"] == 20
    assert ticker["issues"] == {}
    assert ticker["latest_trade_date"] == "2026-08-08"
    assert data["freshness"]["ohlcv_daily"]["latest_trade_date"] == "2026-08-08"


async def test_quality_report_empty_db(client, session: AsyncSession):
    await session.execute(delete(OhlcvDaily))
    await session.commit()
    response = await client.get(BASE_URL)
    assert response.status_code == 200
    data = response.json()
    assert data["total_tickers"] == 0
    assert data["tickers"] == []
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_data_quality_api.py -v`
Expected: FAIL — 404

- [ ] **Step 4: Implement the service**

Create `backend/app/application/services/data_quality_service.py`:

```python
"""Aggregated data-quality report from ohlcv_daily (docs/data-pipeline.md §4)."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import polars as pl
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.data_quality import validate_ohlcv
from app.infrastructure.database.models import OhlcvDaily

_LOOKBACK_DAYS = 380


async def build_quality_report(session: AsyncSession) -> dict[str, Any]:
    cutoff = (await _latest_trade_date(session)) - timedelta(days=_LOOKBACK_DAYS)
    rows = (
        await session.execute(
            select(
                OhlcvDaily.ticker,
                OhlcvDaily.trade_date,
                OhlcvDaily.open,
                OhlcvDaily.high,
                OhlcvDaily.low,
                OhlcvDaily.close,
                OhlcvDaily.volume,
                OhlcvDaily.turnover,
            )
            .where(OhlcvDaily.trade_date >= cutoff)
            .order_by(OhlcvDaily.ticker, OhlcvDaily.trade_date)
        )
    ).fetchall()
    if not rows:
        return {
            "asof": None,
            "total_tickers": 0,
            "overall_score": None,
            "tickers": [],
            "issues": [],
            "freshness": {
                "ohlcv_daily": {"latest_trade_date": None, "row_count": 0}
            },
        }
    cols = [
        "ticker",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "turnover",
    ]
    raw = [dict(zip(cols, r, strict=True)) for r in rows]
    df = pl.DataFrame(raw)

    ticker_report: dict[str, Any] = {}
    for ticker in df["ticker"].unique().sort().to_list():
        frame = df.filter(pl.col("ticker") == ticker)
        report, _valid = validate_ohlcv(ticker, frame)
        ticker_report[ticker] = {
            "quality_score": report.quality_score,
            "issues": report.issues,
            "rows_in": report.rows_in,
            "rows_valid": report.rows_valid,
        }

    tickers_out: list[dict[str, Any]] = []
    issues_out: list[dict[str, Any]] = []
    latest = await _latest_trade_date(session)
    for ticker, rep in ticker_report.items():
        tickers_out.append(
            {
                "ticker": ticker,
                "quality_score": rep["quality_score"],
                "rows_valid": rep["rows_valid"],
                "issues": rep["issues"],
                "latest_trade_date": latest.isoformat() if latest else None,
            }
        )
        for issue_type, count in rep["issues"].items():
            if count > 0:
                issues_out.append(
                    {"ticker": ticker, "type": issue_type, "count": count}
                )

    scores = [t["quality_score"] for t in tickers_out]
    return {
        "asof": latest.isoformat() if latest else None,
        "total_tickers": len(tickers_out),
        "overall_score": round(sum(scores) / len(scores), 2) if scores else None,
        "tickers": tickers_out,
        "issues": issues_out,
        "freshness": {
            "ohlcv_daily": {
                "latest_trade_date": latest.isoformat() if latest else None,
                "row_count": len(rows),
            }
        },
    }


async def _latest_trade_date(session: AsyncSession) -> Any:
    return await session.scalar(select(func.max(OhlcvDaily.trade_date)))
```

- [ ] **Step 5: Implement the route**

Create `backend/app/interfaces/api/routes/data_quality.py`:

```python
"""Data-quality API route — real report from ohlcv_daily."""

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.data_quality_service import build_quality_report
from app.infrastructure.database.session import get_session

router = APIRouter()


@router.get("", response_model=dict[str, Any])
async def data_quality(
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Real OHLCV data-quality report (scores, issues, freshness)."""
    return await build_quality_report(session)
```

- [ ] **Step 6: Register the route**

Edit `backend/app/interfaces/api/router.py` — add:

```python
from app.interfaces.api.routes.data_quality import router as data_quality_router
```

and `data_quality_router` to the include list with prefix `/data-quality` (match the existing pattern used for other routers).

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_data_quality_api.py -v`
Expected: PASS

- [ ] **Step 8: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format .
```
Expected: PASS
```bash
git add backend/app/application/services/data_quality_service.py backend/app/interfaces/api/routes/data_quality.py backend/app/interfaces/api/router.py backend/tests/test_data_quality_api.py
git commit -m "feat(api): real data-quality report route"
```

---

### Task 14: System status API route

**Files:**
- Create: `backend/app/interfaces/api/routes/system.py`
- Modify: `backend/app/interfaces/api/router.py`
- Test: `backend/tests/test_system_status_api.py`

**Interfaces:**
- Produces: `GET /api/v1/system/status` → `{market_open: bool|None, provider, llm_enabled, jobs_running: int|None, data_freshness: {ohlcv, macro, news, fundamentals, latest_scan}}`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_system_status_api.py`:

```python
"""GET /api/v1/system/status — real runtime state, nothing fabricated."""

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import StockScore

BASE_URL = "/api/v1/system/status"


async def test_status_shape(client, session: AsyncSession):
    await session.execute(delete(StockScore))
    await session.commit()
    response = await client.get(BASE_URL)
    assert response.status_code == 200
    data = response.json()
    for key in (
        "market_open",
        "provider",
        "llm_enabled",
        "jobs_running",
        "data_freshness",
    ):
        assert key in data, f"missing key {key}"
    assert isinstance(data["market_open"], bool)
    assert data["provider"] in ("yfinance",)
    assert isinstance(data["llm_enabled"], bool)
    freshness = data["data_freshness"]
    assert "ohlcv" in freshness
    assert "macro" in freshness
    assert "news" in freshness
    assert "fundamentals" in freshness
    assert "latest_scan" in freshness
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_system_status_api.py -v`
Expected: FAIL — 404

- [ ] **Step 3: Implement the route**

Create `backend/app/interfaces/api/routes/system.py`:

```python
"""System status API route — honest runtime state."""

from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.infrastructure.database.models import (
    EconomicEvent,
    EconomicIndicator,
    FinancialStatement,
    NewsArticle,
    OhlcvDaily,
    StockScore,
)
from app.infrastructure.database.session import get_session
from app.interfaces.workers.jobs import get_queue

router = APIRouter()

_WIB = ZoneInfo("Asia/Jakarta")


def _market_open(now: datetime) -> bool:
    """IDX trading hours: Mon-Fri 09:00-15:50 WIB. Holidays not modelled —
    the value is derived from real time, never a static label."""
    if now.weekday() >= 5:
        return False
    return time(9, 0) <= now.time() <= time(15, 50)


@router.get("/status", response_model=dict[str, object])
async def system_status(
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    settings = get_settings()
    now = datetime.now(_WIB)
    jobs_running: int | None
    try:
        queue = get_queue()
        jobs_running = (
            queue.started_job_registry.count + queue.scheduled_job_registry.count
        )
    except Exception:
        jobs_running = None

    latest_ohlcv = await session.scalar(select(func.max(OhlcvDaily.trade_date)))
    latest_macro = await session.scalar(select(func.max(EconomicIndicator.asof_date)))
    latest_news = await session.scalar(select(func.max(NewsArticle.published_at)))
    latest_fund = await session.scalar(select(func.max(FinancialStatement.available_at)))
    latest_scan = await session.scalar(select(func.max(StockScore.asof_date)))
    latest_event = await session.scalar(select(func.max(EconomicEvent.scheduled_at)))

    return {
        "market_open": _market_open(now),
        "provider": settings.market_data_provider,
        "llm_enabled": settings.llm_enabled,
        "jobs_running": jobs_running,
        "data_freshness": {
            "ohlcv": latest_ohlcv.isoformat() if latest_ohlcv else None,
            "macro": latest_macro.isoformat() if latest_macro else None,
            "news": latest_news.isoformat() if latest_news else None,
            "fundamentals": latest_fund.isoformat() if latest_fund else None,
            "latest_scan": latest_scan.isoformat() if latest_scan else None,
            "latest_event": latest_event.isoformat() if latest_event else None,
        },
    }
```

- [ ] **Step 4: Register the route**

Edit `backend/app/interfaces/api/router.py` — import `system_router` and include with prefix `/system` (match the existing pattern).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && .venv/bin/python -m pytest tests/test_system_status_api.py -v`
Expected: PASS

- [ ] **Step 6: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format .
```
Expected: PASS
```bash
git add backend/app/interfaces/api/routes/system.py backend/app/interfaces/api/router.py backend/tests/test_system_status_api.py
git commit -m "feat(api): honest system status route"
```

---

### Task 15: Scanner test-fixture hack removal

**Files:**
- Modify: `backend/app/application/services/scanner.py`
- Modify: `backend/tests/test_scanner.py`

**Interfaces:**
- Consumes: existing scan internals
- Produces: `run_market_scan` explicit-tickers path resolves `asof` from real DB data (`latest_trade_date`), no fixture date, no ticker-count assert.

- [ ] **Step 1: Write the failing test**

Edit `backend/tests/test_scanner.py` — change the explicit-ticker scan calls to assert the new asof semantics:

```python
            # Step 1: scan writes 2 score rows with components, ranked.
            result = await run_market_scan(
                session, BALANCED_PROFILE, tickers=[TICKER_A, TICKER_B]
            )
            assert isinstance(result, ScanResult)
            assert result.asof == _ASOF  # asof resolved from real DB latest trade date
```

(Add this extra assertion; keep the existing `assert result.asof >= _ASOF` if desired.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_scanner.py -v`
Expected: FAIL — `result.asof` is the fixture `_ASOF` only by accident; after the change it is `latest_trade_date`. Run the test first to confirm it passes today, then proceed — the real gate is Step 4.

- [ ] **Step 3: Remove the fixture hack in `scanner.py`**

Edit `backend/app/application/services/scanner.py`:

1. Delete the block:

```python
# Test fixture asof date (matches test_scanner.py _ASOF)
_ASOF = date(2024, 3, 1)
```

2. In `run_market_scan`, replace the explicit-tickers branch:

```python
    if explicit_tickers:
        # Use provided tickers (for testing)
        tickers = list(tickers)
        assert len(tickers) == 2, f"Test mode expects 2 tickers, got {len(tickers)}"
        # Build minimal universe objects for the test
        from sqlalchemy import select

        universe: list[Stock] = []
        for t in tickers:
            u = await session.scalar(select(Stock).where(Stock.ticker == t))
            if u:
                universe.append(u)
        if not universe:
            return ScanResult(asof=date.today(), rows_written=0, ranking=[])
        sector_map = await repo_stock.load_sector_index()
    else:
```

with:

```python
    if tickers is not None:
        # Explicit tickers: resolve asof from the real DB data (latest trade
        # date), never a fixture date. Universe objects are loaded per ticker.
        tickers = list(tickers)
        from sqlalchemy import select

        universe: list[Stock] = []
        for t in tickers:
            u = await session.scalar(select(Stock).where(Stock.ticker == t))
            if u:
                universe.append(u)
        if not universe:
            return ScanResult(asof=date.today(), rows_written=0, ranking=[])
        sector_map = await repo_stock.load_sector_index()
    else:
```

3. Replace the asof/load step:

```python
    if explicit_tickers:
        # Test mode: tickers are internal format, DB stores them as-is
        # Use a fixed asof date for deterministic tests
        asof = _ASOF
        start = asof - timedelta(days=lookback)
        scan_tickers = list(tickers)
        if index_ticker not in scan_tickers:
            scan_tickers.append(index_ticker)
        raw, present = await repo_market.load_ohlcv(scan_tickers, start, asof)
        ohlcv = _ohlcv_to_frame(raw)
        has_index = index_ticker in present
    else:
```

with:

```python
    if explicit_tickers:
        # Explicit tickers: DB stores them as-is; asof = latest trade date.
        scan_tickers = list(tickers)
        if index_ticker not in scan_tickers:
            scan_tickers.append(index_ticker)
        asof = await repo_market.latest_trade_date(scan_tickers)
        if asof is None:
            return ScanResult(asof=date.today(), rows_written=0, ranking=[])
        start = asof - timedelta(days=lookback)
        raw, present = await repo_market.load_ohlcv(scan_tickers, start, asof)
        ohlcv = _ohlcv_to_frame(raw)
        has_index = index_ticker in present
    else:
```

4. Remove the `from datetime import date` unused import only if it becomes unused; otherwise keep. Run ruff to verify.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_scanner.py -v`
Expected: PASS — the seeded data's latest trade date is `_ASOF` (2024-03-01), so `result.asof == _ASOF`, the Redis cache key `scan:balanced:{_ASOF.isoformat()}` still matches, ranking assertions hold.

- [ ] **Step 5: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format .
```
Expected: PASS
```bash
git add backend/app/application/services/scanner.py backend/tests/test_scanner.py
git commit -m "fix(scanner): resolve asof from real data; remove fixture date"
```

---

### Task 16: Real backtest bias audit

**Files:**
- Modify: `backend/app/application/services/backtest_service.py`
- Test: `backend/tests/test_backtest_service.py` (append)

**Interfaces:**
- Consumes: `signals` frame (columns ticker, asof), `trades` (list of Trade with entry_date, ticker), `universe` param
- Produces: `_compute_bias_audit(signals, trades, universe) -> dict[str, bool]` with real checks; `run_backtest` persists the computed audit.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_backtest_service.py`:

```python
def test_compute_bias_audit_real_checks():
    import polars as pl
    from datetime import date

    from app.application.services.backtest_service import _compute_bias_audit

    signals = pl.DataFrame(
        {
            "ticker": ["BBCA", "BBRI"],
            "asof": [date(2026, 1, 5), date(2026, 1, 6)],
        }
    )

    class _Trade:
        def __init__(self, ticker, entry_date):
            self.ticker = ticker
            self.entry_date = entry_date

    trades = [_Trade("BBCA", date(2026, 1, 6)), _Trade("BBRI", date(2026, 1, 8))]
    audit = _compute_bias_audit(signals, trades, ["BBCA", "BBRI", "BMRI"])
    assert audit["fills_at_or_after_signal"] is True
    assert audit["no_post_d_score_revisions"] is True
    assert audit["universe_resolved_per_date"] is True


def test_compute_bias_audit_detects_lookahead():
    import polars as pl
    from datetime import date

    from app.application.services.backtest_service import _compute_bias_audit

    signals = pl.DataFrame(
        {
            "ticker": ["BBCA"],
            "asof": [date(2026, 1, 10)],
        }
    )

    class _Trade:
        def __init__(self, ticker, entry_date):
            self.ticker = ticker
            self.entry_date = entry_date

    trades = [_Trade("BBCA", date(2026, 1, 8))]  # filled BEFORE the signal
    audit = _compute_bias_audit(signals, trades, ["BBCA"])
    assert audit["fills_at_or_after_signal"] is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_backtest_service.py -v`
Expected: FAIL — `_compute_bias_audit` does not exist

- [ ] **Step 3: Implement `_compute_bias_audit`**

In `backend/app/application/services/backtest_service.py`, add before `run_backtest`:

```python
def _compute_bias_audit(
    signals: Any, trades: list[Any], universe: dict[str, object] | None
) -> dict[str, bool]:
    """Real bias audit from the actual signals/trades used by the backtest.

    - fills_at_or_after_signal: every trade entry_date >= that ticker's first
      signal asof.
    - no_post_d_score_revisions: no duplicate (ticker, asof) rows — a revised
      score history would violate point-in-time scoring.
    - universe_resolved_per_date: every traded ticker is in the universe.
    """
    signal_epoch: dict[str, Any] = {}
    seen: set[tuple[str, Any]] = set()
    no_revisions = True
    for row in signals.to_dicts():
        key = (row["ticker"], row["asof"])
        if key in seen:
            no_revisions = False
        seen.add(key)
        first = signal_epoch.get(row["ticker"])
        if first is None or row["asof"] < first:
            signal_epoch[row["ticker"]] = row["asof"]

    universe_tickers: set[str] = set()
    if universe:
        stocks = universe.get("tickers")
        if isinstance(stocks, list):
            universe_tickers = {str(t) for t in stocks}

    fills_ok = True
    universe_ok = True
    for trade in trades:
        epoch = signal_epoch.get(trade.ticker)
        if epoch is not None and trade.entry_date < epoch:
            fills_ok = False
        if universe_tickers and trade.ticker not in universe_tickers:
            universe_ok = False

    return {
        "fills_at_or_after_signal": fills_ok,
        "no_post_d_score_revisions": no_revisions,
        "universe_resolved_per_date": universe_ok,
    }
```

(Add `from typing import Any` to the module imports if not already present.)

- [ ] **Step 4: Use it in `run_backtest`**

Replace the hardcoded `bias_audit={...}` block in `run_backtest` with:

```python
        bias_audit=_compute_bias_audit(signals, trades, universe),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_backtest_service.py -v`
Expected: PASS

- [ ] **Step 6: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format .
```
Expected: PASS
```bash
git add backend/app/application/services/backtest_service.py backend/tests/test_backtest_service.py
git commit -m "fix(backtest): compute real bias audit from signals and trades"
```

---

### Task 17: Screener saved-endpoints honesty + LLM provider key handling

**Files:**
- Modify: `backend/app/interfaces/api/routes/screener.py`
- Modify: `backend/app/domain/llm/providers.py`
- Test: `backend/tests/test_api.py` (append), `backend/tests/test_llm_providers.py` (append)

**Interfaces:**
- Produces: `POST /api/v1/screener/saved` → 501 with honest message; `GET /saved` → `[]` (unchanged but documented); keyed LLM providers raise `LLMUnavailable` when no API key configured.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_api.py`:

```python
async def test_screener_saved_not_implemented(client):
    response = await client.get("/api/v1/screener/saved")
    assert response.status_code == 200
    assert response.json() == []

    response = await client.post("/api/v1/screener/saved", json={"name": "x"})
    assert response.status_code == 501
    assert "not implemented" in response.json()["detail"].lower()
```

Append to `backend/tests/test_llm_providers.py`:

```python
def test_keyed_providers_require_api_key():
    from app.domain.llm.exceptions import LLMUnavailable
    from app.domain.llm.providers import (
        AnthropicProvider,
        GoogleProvider,
        OpenAIProvider,
        OpenRouterProvider,
    )

    for provider_cls in (OpenAIProvider, AnthropicProvider, GoogleProvider, OpenRouterProvider):
        try:
            provider_cls(model="test-model", temperature=0.1, api_key=None)
        except LLMUnavailable:
            continue
        raise AssertionError(f"{provider_cls.__name__} should raise LLMUnavailable without a key")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && .venv/bin/python -m pytest tests/test_api.py tests/test_llm_providers.py -v`
Expected: FAIL — 200 with fake id; providers constructed with `SecretStr("test")`

- [ ] **Step 3: Fix the screener route**

In `backend/app/interfaces/api/routes/screener.py`, replace `save_screener`:

```python
@router.post("/saved", response_model=dict[str, object])
async def save_screener(config: dict[str, object] = Body(...)) -> dict[str, object]:
    """Save a screener configuration.

    Not implemented: no saved-screeners table yet. Returns 501 honestly
    instead of fabricating an id.
    """
    raise HTTPException(
        status_code=501,
        detail="Saved screeners are not implemented yet",
    )
```

(Import `HTTPException` from fastapi in the file.)

- [ ] **Step 4: Fix LLM provider key handling**

In `backend/app/domain/llm/providers.py`, replace the four `_build_*` keyed builders so a missing key raises `LLMUnavailable`:

```python
def _build_openai(
    model: str,
    temperature: float,
    api_key: str | None = None,
    base_url: str | None = None,
    request_timeout: float = 30.0,
) -> BaseChatModel:
    from langchain_openai import ChatOpenAI

    if not api_key:
        raise LLMUnavailable("OpenAI provider requires LLM_API_KEY")
    return ChatOpenAI(
        model=model,
        temperature=temperature,
        api_key=SecretStr(api_key),
        base_url=base_url,
        timeout=request_timeout,
    )
```

Apply the same pattern to `_build_anthropic` (`"Anthropic provider requires LLM_API_KEY"`), `_build_google` (`"Google provider requires LLM_API_KEY"`), `_build_openrouter` (`"OpenRouter provider requires LLM_API_KEY"`). `_build_ollama` stays as-is (local, keyless).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_api.py tests/test_llm_providers.py -v`
Expected: PASS (check `test_llm_*` suite too: `pytest tests/test_llm_service.py tests/test_llm_flags.py` — the service catches `LLMUnavailable` at construction, so fallbacks still work)

- [ ] **Step 6: Validation + commit**

```bash
cd backend && .venv/bin/pyright && .venv/bin/ruff check . && .venv/bin/ruff format .
```
Expected: PASS
```bash
git add backend/app/interfaces/api/routes/screener.py backend/app/domain/llm/providers.py backend/tests/test_api.py backend/tests/test_llm_providers.py
git commit -m "fix: honest screener saved-endpoints and LLM key validation"
```

---

### Task 18: Delete reference_data.py + final full-stack validation

**Files:**
- Delete: `backend/app/domain/reference_data.py`
- Modify: `backend/tests/test_api_reference_data.py` (remove leftover references)
- Run: full validation

**Interfaces:**
- Produces: no module imports `reference_data` anymore; the entire dummy-data module is gone.

- [ ] **Step 1: Verify no remaining imports**

Run: `cd backend && grep -rn "reference_data" app/ tests/ scripts/`
Expected: no matches except possibly comments. If any remain, replace them with DB-backed reads per the tasks above.

- [ ] **Step 2: Delete the module**

```bash
git rm backend/app/domain/reference_data.py
```

- [ ] **Step 3: Full backend validation**

```bash
cd backend && .venv/bin/python -m pytest -x -q
```
Expected: PASS (all tests, including the updated reference-data tests)

```bash
cd backend && .venv/bin/pyright
```
Expected: PASS — 0 errors

```bash
cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .
```
Expected: PASS

- [ ] **Step 4: Verify no dummy-data strings remain in production code**

Run: `cd backend && grep -rn "seed\|Demo portfolio\|curated\|placeholder" app/ --include="*.py" | grep -v "server_default\|settings\|__pycache__"`
Review every hit: each must be a legitimate code comment or DB default, not fabricated data. Fix any fabricated data found.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove hardcoded reference_data module (real data providers now serve all routes)"
```

---

## Self-Review Notes

- **Spec coverage:** providers (T3-T6), jobs (T8), routes from DB (T9-T12), portfolio CRUD (T10), data-quality route (T13), system status (T14), scanner fix (T15), backtest audit (T16), screener/LLM honesty (T17), reference_data removal (T18). Frontend cleanup is a separate plan (after this one).
- **Frontend contract fields preserved** in T9/T10 outputs (nullable impact/sentiment/actual allowed).
- **LLM fallback strings** in `llm_service.py` are already honest ("AI ENRICHED — LLM unavailable…") and stay; only the placeholder keys are removed (T17).
- **Watchdog/ping** in `jobs.py` remain trivial (real health stubs, not data).
