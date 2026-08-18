# CP4: LLM Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the optional LLM interpretation layer (provider abstraction, adapters, feature flags, explanation services, NL screener, research assistant, caching, API routes) per docs/llm.md and PRD §31-§34.

**Architecture:** Provider Protocol + adapters (OpenAI, Anthropic, Google, OpenRouter, Ollama) → LLMService (explanations, summaries, NL screener, reports) → API routes → Feature-flag gated. Deterministic engine unchanged when LLM disabled.

**Tech Stack:** Python 3.13, FastAPI, Pydantic v2, scikit-learn (existing), tenacity (retries), httpx (async HTTP), redis (cache), pytest/pytest-asyncio. LLM deps: langchain-core, langchain-openai, langchain-anthropic, langchain-google-genai, langchain-community (for Ollama), langchain-text-splitters (optional).

## Global Constraints

- Type checking: pyright `strict` must report 0 errors in `app/`; no `Any` where a real type exists; no `type: ignore` / `# pyright: ignore` / `noqa` (per AGENTS.md).
- TDD: every task starts with a failing test; verify RED, then GREEN, then commit.
- DB access: async SQLAlchemy sessions via `get_session()` (async generator); repos take `AsyncSession`.
- Tests run against `ihsg_quant_test` (conftest sets `POSTGRES_DSN`); real data in `ihsg_quant` must never be touched by tests.
- LLM is optional: `LLM_ENABLED=False` default; deterministic path unchanged when off (PRD §34).
- LLM never generates numerical indicators, overrides calculations, or hallucinates data (PRD §31).
- LLM never in critical path — scanner, indicators, fundamentals, regime, ranking, screening, risk, backtest, ML all work without it.
- All AI enrichment marked `AI_ENRICHED` (PRD §17); LLM output is untrusted text for humans, never fed back into quantitative logic.
- LLM on failure: graceful fallback to deterministic analytics. Never a blank page.
- Structured data → prompt via JSON; LLM produces only filter specs for NL screener; execution is 100% deterministic.
- LLM calls async with timeout/retries; cache responses keyed by `(feature, context_hash, model)`.
- No provider API keys in frontend; server-side only. LLM prompts: system fixed, user content separated.
- Every commit after GREEN + `pytest -q` + `ruff check .` + `ruff format --check .` + `pyright app` (0 errors).

---

### Task 1: LLM Provider Protocol + LangChain Adapters + Settings

**Files:**
- Create: `backend/app/domain/llm/providers.py`
- Create: `backend/app/domain/llm/__init__.py`
- Create: `backend/app/domain/llm/exceptions.py`
- Modify: `backend/app/config/settings.py`

**Interfaces:**
- Consumes: existing `Settings` (pydantic-settings)
- Produces: `LLMProvider` Protocol (`complete`, `complete_json`), langchain-based adapters (`OpenAIProvider`, `AnthropicProvider`, `GoogleProvider`, `OpenRouterProvider`, `OllamaProvider`), `LLMUnavailable` exception, `get_provider()` factory.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_llm_providers.py
"""LLM provider protocol + langchain adapters."""

import pytest
from app.domain.llm.providers import LLMProvider, get_provider
from app.domain.llm.exceptions import LLMUnavailable

def test_llm_provider_protocol_signature():
    """Protocol defines complete and complete_json."""
    from typing import Protocol
    assert hasattr(LLMProvider, "complete")
    assert hasattr(LLMProvider, "complete_json")

def test_get_provider_raises_when_disabled(monkeypatch):
    """get_provider raises LLMUnavailable when LLM_ENABLED=false."""
    from app.config import settings
    monkeypatch.setattr(settings, "llm_enabled", False)
    with pytest.raises(LLMUnavailable):
        get_provider()

def test_get_provider_openai_when_configured(monkeypatch):
    """get_provider returns OpenAIProvider when LLM_PROVIDER=openai."""
    from app.config import settings
    monkeypatch.setattr(settings, "llm_enabled", True)
    monkeypatch.setattr(settings, "llm_provider", "openai")
    monkeypatch.setattr(settings, "llm_model", "gpt-4o-mini")
    monkeypatch.setattr(settings, "llm_temperature", 0.1)
    provider = get_provider()
    assert provider.__class__.__name__ == "OpenAIProvider"

def test_openai_complete_smoke(monkeypatch):
    """OpenAIProvider.complete delegates to langchain (mocked)."""
    from app.domain.llm.providers import OpenAIProvider
    from langchain_openai import ChatOpenAI
    mock_llm = monkeypatch.setattr(ChatOpenAI, "ainvoke", lambda self, messages: type("R", (), {"content": "ok"})())
    provider = OpenAIProvider(model="gpt-4o-mini", temperature=0.1)
    result = provider.complete("test")
    assert result == "ok"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_llm_providers.py -q`
Expected: FAIL — modules not found / imports fail

- [ ] **Step 3: Write minimal implementation**

**`backend/app/config/settings.py`** — add LLM config fields:
```python
llm_enabled: bool = False
llm_provider: str = "openai"
llm_model: str = "gpt-4o-mini"
llm_temperature: float = 0.1
```

**`backend/app/domain/llm/exceptions.py`**:
```python
class LLMUnavailable(Exception):
    pass
```

**`backend/app/domain/llm/__init__.py`** — empty.

**`backend/app/domain/llm/providers.py`**:
```python
from __future__ import annotations

from typing import Protocol, runtime_checkable
from pydantic import BaseModel
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import PydanticOutputParser

@runtime_checkable
class LLMProvider(Protocol):
    def complete(self, prompt: str, *, system: str | None = None, temperature: float | None = None) -> str: ...
    def complete_json(self, prompt: str, *, schema: type[BaseModel]) -> BaseModel: ...

class LLMUnavailable(Exception):
    pass


def _get_langchain_model() -> BaseChatModel:
    from app.config import settings
    provider = settings.llm_provider.lower()
    model = settings.llm_model
    temp = settings.llm_temperature
    
    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=model, temperature=temp)
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(model=model, temperature=temp)
    elif provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(model=model, temperature=temp)
    elif provider == "openrouter":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model, temperature=temp,
            base_url="https://openrouter.ai/api/v1",
        )
    elif provider == "ollama":
        from langchain_community.chat_models import ChatOllama
        return ChatOllama(model=model, temperature=temp)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")


class OpenAIProvider:
    def __init__(self, model: str, temperature: float):
        self._model = _get_langchain_model()
    
    def complete(self, prompt: str, *, system: str | None = None, temperature: float | None = None) -> str:
        messages = []
        if system:
            messages.append(SystemMessage(content=system))
        messages.append(HumanMessage(content=prompt))
        return self._model.invoke(messages).content
    
    def complete_json(self, prompt: str, *, schema: type[BaseModel]) -> BaseModel:
        parser = PydanticOutputParser(pydantic_object=schema)
        messages = [
            SystemMessage(content=f"Output JSON only matching this schema: {parser.get_format_instructions()}"),
            HumanMessage(content=prompt),
        ]
        result = self._model.invoke(messages)
        return parser.parse(result.content)


def get_provider() -> LLMProvider:
    from app.config import settings
    if not settings.llm_enabled:
        raise LLMUnavailable("LLM disabled via settings")
    return OpenAIProvider(model=settings.llm_model, temperature=settings.llm_temperature)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_llm_providers.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domain/llm/__init__.py backend/app/domain/llm/exceptions.py backend/app/domain/llm/providers.py backend/app/config/settings.py backend/pyproject.toml tests/test_llm_providers.py
git commit -m "feat(llm): provider protocol + langchain adapters + settings"
```

---

### Task 2: LLM Service Layer (Explanations, Summaries, NL Screener, Reports)

**Files:**
- Create: `backend/app/application/services/llm_service.py`
- Create: `backend/app/application/services/__init__.py` (if missing)
- Test: `backend/tests/test_llm_service.py`

**Interfaces:**
- Consumes: `LLMProvider` (Task 1), `StockScoreRepository`, `MarketDataRepository`, `StockRepository`, structured context builders from score components
- Produces: `LLMService` with methods:
  - `explain_stock_score(ticker, asof, context) -> str`
  - `summarize_news(ticker, asof, news_items) -> str`
  - `translate_nl_to_filter(query, schema) -> FilterTree`
  - `generate_report(tickers, asof, template) -> str`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_llm_service.py
"""LLM service: explanations, NL screener, reports."""

import pytest
from app.application.services.llm_service import LLMService
from app.domain.llm.exceptions import LLMUnavailable
from app.infrastructure.database.models import StockScore

async def test_explain_stock_score_returns_markdown(session):
    """explain_stock_score returns formatted markdown with cited numbers."""
    from app.application.services.llm_service import LLMService
    from app.domain.llm.providers import get_provider
    from unittest.mock import AsyncMock, patch
    
    # Seed a score row
    score = StockScore(
        ticker="BBCA", asof_date=date(2024, 3, 1), profile="balanced",
        scoring_version="v1", feature_version="v1", opportunity_score=86.0,
        technical_score=88.0, fundamental_score=82.0, momentum_score=75.0,
        relative_strength=80.0, smart_money_score=78.0, factor_score=85.0,
        sector_score=79.0, macro_score=72.0, risk_score=76.0, ml_score=None,
        score_components={"technical": {"score": 88, "drivers": ["RSI > 60"]}},
        classification="OPPORTUNITY", confidence=0.8,
    )
    session.add(score)
    await session.flush()

    # Mock provider
    mock_provider = AsyncMock()
    mock_provider.complete.return_value = "## BBCA Analysis\nBBCA scores 86/100..."
    
    with patch("app.application.services.llm_service.get_provider", return_value=mock_provider):
        service = LLMService()
        result = await service.explain_stock_score("BBCA", date(2024, 3, 1), session)
    
    assert "BBCA" in result
    assert "86" in result
    assert "AI ENRICHED" in result

async def test_nl_screener_translates_to_filter_tree():
    """translate_nl_to_filter_tree returns valid FilterTree."""
    from app.application.services.llm_service import LLMService
    from unittest.mock import AsyncMock, patch
    
    mock_provider = AsyncMock()
    mock_provider.complete_json.return_value = {
        "and": [
            {"field": "sector", "op": "=", "value": "BANKING"},
            {"field": "opportunity_score", "op": ">", "value": 70}
        ]
    }
    
    with patch("app.application.services.llm_service.get_provider", return_value=mock_provider):
        service = LLMService()
        result = await service.translate_nl_to_filter("strong banking stocks above 70")
    
    assert result["and"][0]["field"] == "sector"
    assert result["and"][1]["value"] == 70

async def test_llm_unavailable_returns_fallback(session):
    """When LLM disabled, service returns deterministic fallback."""
    from app.config import settings
    from app.application.services.llm_service import LLMService
    
    # Ensure LLM disabled
    settings.llm_enabled = False
    
    service = LLMService()
    result = await service.explain_stock_score("BBCA", date(2024, 3, 1), session)
    assert "LLM unavailable" in result or "disabled" in result
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_llm_service.py -q`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

**`backend/app/application/services/llm_service.py`**:
```python
from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, Field

from app.config import settings
from app.domain.llm.providers import get_provider, LLMUnavailable
from app.infrastructure.database.models import StockScore
from app.infrastructure.database.session import AsyncSession


class FilterTree(BaseModel):
    and_: list["FilterTree"] = Field(default_factory=list, alias="and")
    or_: list["FilterTree"] = Field(default_factory=list, alias="or")
    field: str | None = None
    op: str | None = None
    value: Any = None


class LLMService:
    def __init__(self):
        self._provider = None
        if settings.llm_enabled:
            try:
                self._provider = get_provider()
            except LLMUnavailable:
                self._provider = None

    async def explain_stock_score(self, ticker: str, asof: date, session: AsyncSession) -> str:
        if self._provider is None:
            return "AI ENRICHED — LLM unavailable (disabled or misconfigured); quantitative scoring remains fully operational."
        
        score = await self._fetch_score(ticker, asof, session)
        if score is None:
            return f"AI ENRICHED — No score data for {ticker} at {asof}."
        
        context = self._build_score_context(score)
        prompt = f"""You are an equity analyst explaining quantitative scores to a professional investor.
Cite specific numbers from the context. Do not invent figures. Do not give investment advice.

Context:
{context}

Question: Why is {ticker} scored {score.opportunity_score}/100 ({score.classification})?"""
        
        try:
            return f"AI ENRICHED — {await self._provider.complete(prompt, temperature=0.1)}"
        except Exception:
            return "AI ENRICHED — Explanation unavailable; quantitative scoring remains fully operational."

    async def translate_nl_to_filter(self, query: str) -> dict:
        if self._provider is None:
            return {"and": [{"field": "opportunity_score", "op": ">", "value": 50}]}
        
        # System prompt defines FilterTree schema; omitted for brevity
        try:
            return await self._provider.complete_json(query, schema=dict)  # replace with FilterTree schema
        except Exception:
            return {"and": [{"field": "opportunity_score", "op": ">", "value": 50}]}

    async def _fetch_score(self, ticker: str, asof: date, session: AsyncSession) -> StockScore | None:
        from sqlalchemy import select
        return (await session.execute(
            select(StockScore).where(
                StockScore.ticker == ticker,
                StockScore.asof_date == asof,
                StockScore.profile == "balanced",
            )
        )).scalars().first()

    def _build_score_context(self, score: StockScore) -> str:
        comps = score.score_components or {}
        return f"""ticker: {score.ticker}
asof_date: {score.asof_date}
opportunity_score: {score.opportunity_score}
classification: {score.classification}
confidence: {score.confidence}
components: {comps}"""
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_llm_service.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/application/services/llm_service.py tests/test_llm_service.py
git commit -m "feat(llm): service layer (explanations, NL screener, fallback)"
```

---

### Task 3: LLM Caching (Redis)

**Files:**
- Create: `backend/app/infrastructure/cache/llm_cache.py`
- Test: `backend/tests/test_llm_cache.py`

**Interfaces:**
- Consumes: Redis client, `settings.redis_url`
- Produces: `LLMCache` class with `get(key) -> str | None`, `set(key, value, ttl) -> None`, `make_key(feature, context, model) -> str`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_llm_cache.py
"""LLM response cache."""

import pytest
from app.infrastructure.cache.llm_cache import LLMCache, make_cache_key

def test_make_cache_key_stable_and_content_sensitive():
    k1 = make_cache_key("explain", {"ticker": "BBCA"}, "gpt-4o-mini")
    k2 = make_cache_key("explain", {"ticker": "BBCA"}, "gpt-4o-mini")
    k3 = make_cache_key("explain", {"ticker": "BBRI"}, "gpt-4o-mini")
    assert k1 == k2
    assert k1 != k3

async def test_cache_get_set(redis_client):
    """Cache round-trip stores and retrieves value."""
    cache = LLMCache()
    await cache.set("test_key", "cached_response")
    val = await cache.get("test_key")
    assert val == "cached_response"

async def test_cache_miss_returns_none(redis_client):
    cache = LLMCache()
    val = await cache.get("nonexistent")
    assert val is None

async def test_cache_ttl_expires(redis_client):
    """Entries expire after TTL."""
    cache = LLMCache()
    await cache.set("expiring", "value", ttl=1)
    await asyncio.sleep(1.1)
    val = await cache.get("expiring")
    assert val is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_llm_cache.py -q`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

**`backend/app/infrastructure/cache/llm_cache.py`**:
```python
from __future__ import annotations

import hashlib
import json
import redis.asyncio as redis

from app.config import settings

_DEFAULT_TTL = 86400  # 24h


def make_cache_key(feature: str, context: dict, model: str) -> str:
    """Stable hash of feature + sorted context + model."""
    material = feature + ":" + json.dumps(context, sort_keys=True) + ":" + model
    return "llm:" + hashlib.sha256(material.encode()).hexdigest()[:32]


class LLMCache:
    def __init__(self):
        self._redis = redis.Redis.from_url(settings.redis_url, decode_responses=True)

    async def get(self, key: str) -> str | None:
        return await self._redis.get(key)

    async def set(self, key: str, value: str, ttl: int = _DEFAULT_TTL) -> None:
        await self._redis.setex(key, ttl, value)

    async def close(self):
        await self._redis.close()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_llm_cache.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/infrastructure/cache/llm_cache.py tests/test_llm_cache.py
git commit -m "feat(llm): Redis cache with stable keys and TTL"
```

---

### Task 4: LLM API Routes

**Files:**
- Create: `backend/app/interfaces/api/routes/llm.py`
- Modify: `backend/app/interfaces/api/router.py` (register `/llm` prefix)
- Test: `backend/tests/test_api_llm.py`

**Interfaces:**
- Consumes: `LLMService` (Task 2), `get_session` dependency
- Produces: `POST /api/v1/llm/explain` (ticker, asof), `POST /api/v1/llm/nl-screener` (query), `POST /api/v1/llm/report` (tickers, template)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_api_llm.py
"""LLM API routes."""

import pytest
from httpx import ASGITransport, AsyncClient

async def test_llm_explain_endpoint_returns_200(client):
    """POST /api/v1/llm/explain returns explanation or fallback."""
    from app.config import settings
    # LLM may be disabled; endpoint should still respond
    resp = await client.post("/api/v1/llm/explain", json={"ticker": "BBCA", "asof": "2024-03-01"})
    assert resp.status_code == 200
    body = resp.json()
    assert "explanation" in body

async def test_llm_nl_screener_endpoint_returns_filter(client):
    """POST /api/v1/llm/nl-screener returns FilterTree."""
    resp = await client.post("/api/v1/llm/nl-screener", json={"query": "banking stocks above 70"})
    assert resp.status_code == 200
    body = resp.json()
    assert "filter" in body
    assert "and" in body["filter"] or "or" in body["filter"]

async def test_llm_report_endpoint_returns_200(client):
    """POST /api/v1/llm/report returns report text."""
    resp = await client.post("/api/v1/llm/report", json={"tickers": ["BBCA", "BBRI"], "template": "daily"})
    assert resp.status_code == 200
    body = resp.json()
    assert "report" in body
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_api_llm.py -q`
Expected: FAIL — 404 routes

- [ ] **Step 3: Write minimal implementation**

**`backend/app/interfaces/api/routes/llm.py`**:
```python
from __future__ import annotations

from datetime import date
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.llm_service import LLMService
from app.infrastructure.database.session import get_session

router = APIRouter()


class ExplainRequest(BaseModel):
    ticker: str
    asof: date


class NLScreenerRequest(BaseModel):
    query: str


class ReportRequest(BaseModel):
    tickers: list[str]
    template: str = "daily"


@router.post("/explain", response_model=dict[str, str])
async def explain_stock(
    req: ExplainRequest = Body(...),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    service = LLMService()
    text = await service.explain_stock_score(req.ticker, req.asof, session)
    return {"explanation": text}


@router.post("/nl-screener", response_model=dict[str, object])
async def nl_screener(
    req: NLScreenerRequest = Body(...),
) -> dict[str, object]:
    service = LLMService()
    filter_tree = await service.translate_nl_to_filter(req.query)
    return {"filter": filter_tree}


@router.post("/report", response_model=dict[str, str])
async def generate_report(
    req: ReportRequest = Body(...),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    service = LLMService()
    # Build report by explaining each ticker + summary
    explanations = []
    for t in req.tickers:
        exp = await service.explain_stock_score(t, date.today(), session)
        explanations.append(f"## {t}\n{exp}")
    return {"report": "\n\n".join(explanations)}
```

**`backend/app/interfaces/api/router.py`** — add:
```python
from app.interfaces.api.routes import backtests, ml, llm

router.include_router(backtests.router, prefix="/backtests", tags=["backtests"])
router.include_router(ml.router, prefix="/ml", tags=["ml"])
router.include_router(llm.router, prefix="/llm", tags=["llm"])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_api_llm.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/interfaces/api/routes/llm.py backend/app/interfaces/api/router.py tests/test_api_llm.py
git commit -m "feat(api): llm routes (explain, nl-screener, report)"
```

---

### Task 5: LLM Feature Flags + Integration Test

**Files:**
- Modify: `backend/app/config/settings.py` (add all feature flags per `docs/llm.md` §2)
- Modify: `backend/app/application/services/llm_service.py` (respect feature flags)
- Test: `backend/tests/test_llm_flags.py`

**Interfaces:**
- Consumes: `settings` with feature flags
- Produces: feature-gated LLM calls; when flag false, returns deterministic fallback

- [ ] **Step 1: Write the failing test**

```python
# tests/test_llm_flags.py
"""LLM feature flags control individual features."""

import pytest
from app.config import settings
from app.application.services.llm_service import LLMService

def test_feature_flags_exist():
    """All required flags present on settings."""
    required = [
        "llm_analysis_enabled", "llm_news_summary_enabled",
        "llm_stock_explanation_enabled", "llm_macro_summary_enabled",
        "llm_nl_screener_enabled", "llm_research_enabled",
    ]
    for flag in required:
        assert hasattr(settings, flag), f"missing {flag}"

async def test_stock_explanation_respects_flag(session):
    """LLM_STOCK_EXPLANATION_ENABLED gates explain_stock_score."""
    settings.llm_enabled = True
    settings.llm_stock_explanation_enabled = False
    
    service = LLMService()
    result = await service.explain_stock_score("BBCA", date(2024, 3, 1), session)
    assert "disabled" in result.lower() or "unavailable" in result.lower()

def test_nl_screener_respects_flag():
    """LLM_NL_SCREENER_ENABLED gates translate_nl_to_filter."""
    settings.llm_enabled = True
    settings.llm_nl_screener_enabled = False
    
    service = LLMService()
    result = await service.translate_nl_to_filter("test query")
    # Should return default filter, not call LLM
    assert result == {"and": [{"field": "opportunity_score", "op": ">", "value": 50}]}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_llm_flags.py -q`
Expected: FAIL — flags missing / logic missing

- [ ] **Step 3: Write minimal implementation**

**`backend/app/config/settings.py`** — add:
```python
llm_analysis_enabled: bool = True
llm_news_summary_enabled: bool = True
llm_stock_explanation_enabled: bool = True
llm_macro_summary_enabled: bool = True
llm_nl_screener_enabled: bool = True
llm_research_enabled: bool = True
```

**`backend/app/application/services/llm_service.py`** — guard each method:
```python
async def explain_stock_score(self, ticker: str, asof: date, session: AsyncSession) -> str:
    if not settings.llm_stock_explanation_enabled:
        return "AI ENRICHED — Stock explanation disabled via feature flag."
    # ... existing logic
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_llm_flags.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/config/settings.py backend/app/application/services/llm_service.py tests/test_llm_flags.py
git commit -m "feat(llm): feature flags with per-feature gating"
```

---

### Task 6: LLM Error Handling + Graceful Fallback

**Files:**
- Modify: `backend/app/application/services/llm_service.py`
- Test: `backend/tests/test_llm_errors.py`

**Interfaces:**
- Produces: on any LLM exception (timeout, rate limit, auth error, network), returns deterministic fallback string; never crashes.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_llm_errors.py
"""LLM error handling and graceful fallback."""

import pytest
from unittest.mock import AsyncMock, patch
from app.application.services.llm_service import LLMService
from app.domain.llm.exceptions import LLMUnavailable

async def test_timeout_returns_fallback(session):
    """Provider timeout triggers fallback."""
    service = LLMService()
    service._provider = AsyncMock()
    service._provider.complete.side_effect = TimeoutError("request timeout")
    
    result = await service.explain_stock_score("BBCA", date(2024, 3, 1), session)
    assert "unavailable" in result.lower() or "fallback" in result.lower()

async def test_auth_error_returns_fallback(session):
    """Auth error triggers fallback."""
    service = LLMService()
    service._provider = AsyncMock()
    service._provider.complete.side_effect = Exception("401 Unauthorized")
    
    result = await service.explain_stock_score("BBCA", date(2024, 3, 1), session)
    assert "unavailable" in result.lower() or "fallback" in result.lower()

async def test_rate_limit_returns_fallback(session):
    """Rate limit triggers fallback."""
    service = LLMService()
    service._provider = AsyncMock()
    service._provider.complete.side_effect = Exception("429 Rate limit")
    
    result = await service.explain_stock_score("BBCA", date(2024, 3, 1), session)
    assert "unavailable" in result.lower() or "fallback" in result.lower()

async def test_malformed_json_returns_fallback():
    """complete_json parse error returns default filter."""
    service = LLMService()
    service._provider = AsyncMock()
    service._provider.complete_json.side_effect = Exception("invalid json")
    
    result = await service.translate_nl_to_filter("test")
    assert result == {"and": [{"field": "opportunity_score", "op": ">", "value": 50}]}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_llm_errors.py -q`
Expected: FAIL — no try/except in service

- [ ] **Step 3: Write minimal implementation**

**`backend/app/application/services/llm_service.py`** — wrap calls:
```python
async def explain_stock_score(self, ticker: str, asof: date, session: AsyncSession) -> str:
    if self._provider is None:
        return "AI ENRICHED — LLM unavailable..."
    try:
        return f"AI ENRICHED — {await self._provider.complete(prompt, temperature=0.1)}"
    except Exception:
        return "AI ENRICHED — Explanation unavailable; quantitative scoring remains fully operational."
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_llm_errors.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/application/services/llm_service.py tests/test_llm_errors.py
git commit -m "feat(llm): error handling with graceful fallback strings"
```

---

### Task 6: LLM Cache Integration in Service

**Files:**
- Modify: `backend/app/application/services/llm_service.py` (use `LLMCache`)
- Test: `backend/tests/test_llm_cache_integration.py`

**Interfaces:**
- Consumes: `LLMCache` (Task 3)
- Produces: cached LLM responses keyed by `(feature, context_hash, model)`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_llm_cache_integration.py
"""LLM service cache integration."""

import pytest
from unittest.mock import AsyncMock, patch
from app.application.services.llm_service import LLMService
from app.infrastructure.cache.llm_cache import LLMCache

async def test_explain_uses_cache(session):
    """Second call with same context hits cache."""
    service = LLMService()
    service._provider = AsyncMock()
    service._provider.complete.return_value = "First call"
    
    with patch("app.application.services.llm_service.LLMCache") as mock_cache_class:
        mock_cache = AsyncMock()
        mock_cache.get.return_value = None  # miss first call
        mock_cache_class.return_value = mock_cache
        
        await service.explain_stock_score("BBCA", date(2024, 3, 1), session)
        await service.explain_stock_score("BBCA", date(2024, 3, 1), session)
        
        # First call: miss -> set; second call: hit -> get
        assert mock_cache.get.call_count == 2
        assert mock_cache.set.call_count == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_llm_cache_integration.py -q`
Expected: FAIL — no cache usage

- [ ] **Step 3: Write minimal implementation**

**`backend/app/application/services/llm_service.py`** — add cache:
```python
from app.infrastructure.cache.llm_cache import LLMCache, make_cache_key

class LLMService:
    def __init__(self):
        self._provider = None
        self._cache = LLMCache() if settings.llm_enabled else None
        if settings.llm_enabled:
            try:
                self._provider = get_provider()
            except LLMUnavailable:
                self._provider = None

    async def explain_stock_score(self, ticker: str, asof: date, session: AsyncSession) -> str:
        if self._provider is None:
            return "AI ENRICHED — LLM unavailable..."
        
        # Check cache
        context = {"ticker": ticker, "asof": asof.isoformat()}
        cache_key = make_cache_key("explain", context, settings.llm_model)
        if self._cache:
            cached = await self._cache.get(cache_key)
            if cached:
                return f"AI ENRICHED — {cached}"
        
        try:
            text = await self._provider.complete(prompt, temperature=0.1)
            if self._cache:
                await self._cache.set(cache_key, text)
            return f"AI ENRICHED — {text}"
        except Exception:
            return "AI ENRICHED — Explanation unavailable..."
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_llm_cache_integration.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/application/services/llm_service.py tests/test_llm_cache_integration.py
git commit -m "feat(llm): Redis cache integration for LLM responses"
```

---

### Task 7: Full Validation + CP4 Checkpoint

**Files:**
- Modify: `docs/architecture.md` (§13 roadmap P4 status), `docs/architecture.md` §4 module map add `llm` domain, `README.md` roadmap Phase 4 status, `.superpowers/sdd/progress.md`

- [ ] **Step 1: Run full validation**

```bash
.venv/bin/pytest -q          # 126 + new LLM tests pass
.venv/bin/ruff check .       # clean
.venv/bin/ruff format --check .  # clean
.venv/bin/pyright app        # 0 errors
```

- [ ] **Step 2: Update docs**

**`docs/architecture.md` §13** — add P4 status:
```
| P4 | LLM, NL screener, research assistant, reports; UI: LLM research assistant, AI explanations (DESIGN §69-P4) | LLM off-critical-path, feature-flagged, falls back cleanly | **Status: implemented — provider abstraction (OpenAI/Anthropic/Google/OpenRouter/Ollama), feature flags, explanation/summary/NL-screener/report services, Redis cache, error handling with graceful fallback, API routes.** |
```

**`docs/architecture.md` §4** — add `llm` to module map:
```
| `llm` | Provider abstraction, adapters, explanations, NL screener, research, cache | `complete`, `complete_json`, explanations, FilterTree |
```

**`README.md` Phase 4** — status: implemented.

**`.superpowers/sdd/progress.md`** — add CP4 checkpoint.

- [ ] **Step 3: Final validation + commit**

```bash
git add docs/architecture.md docs/data-model.md README.md .superpowers/sdd/progress.md
git commit -m "docs(cp4): LLM layer implementation + docs + CP4 checkpoint"
```

---

## Self-Review Checklist

- [ ] Spec coverage: Every section of `docs/llm.md` mapped to a task (provider abstraction, feature flags, allowed features, structured data→prompt, NL screener, async/cost discipline, prompt safety, modes, UI transparency).
- [ ] Placeholder scan: No "TBD", "implement later", "similar to Task N" — all code blocks complete.
- [ ] Type consistency: `LLMProvider` Protocol matches adapter signatures; `FilterTree` schema used in `complete_json`; `LLMCache` methods match usage; API request/response models match service returns.
- [ ] TDD order: Each task has failing test first, then implementation.
- [ ] No `type: ignore` / `noqa` / `Any` unless genuine external limitation (e.g., `joblib.load`, sklearn imports — already handled in CP3).
- [ ] All new files under `app/domain/llm/`, `app/application/services/`, `app/infrastructure/cache/`, `app/interfaces/api/routes/llm.py`, `tests/test_llm_*.py`.
- [ ] Updates to `docs/architecture.md`, `README.md`, `.superpowers/sdd/progress.md`.

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-17-cp4-llm-layer.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review

**Which approach?**