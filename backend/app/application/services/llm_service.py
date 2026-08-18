"""LLM application service — explanations, NL screener, summaries, reports.

Thin async wrapper around the sync `LLMProvider` Protocol (Task 1). The service
owns four front-door methods (docs/llm.md §4):

- ``explain_stock_score`` — markdown explanation of a stored ``StockScore``.
- ``translate_nl_to_filter`` — NL query → validated ``FilterTree`` (executed by
  the deterministic screener; docs/llm.md §6).
- ``summarize_news`` — news-item digest for a single ticker.
- ``generate_report`` — multi-stock research markdown from stored scores.

Non-negotiables (docs/llm.md §1, §5, §9):

1. LLM is NEVER in the critical path. The whole platform runs with
   ``LLM_ENABLED=false``; every method returns a deterministic fallback string
   or permissive fallback tree when the provider is unavailable.
2. Structured DB state is serialised into a compact context before the prompt
   is built; no free-form DB rows are concatenated into instructions.
3. All AI output is prefixed ``AI ENRICHED`` so the UI can label it (PRD §17;
   docs/llm.md §1.3).
4. Caching, feature-flag refinement, and Redis-backed invalidation arrive in
   Task 3 + Task 5; this file stays free of those concerns.

The service mirrors the Task 1 sync Protocol: ``complete`` / ``complete_json``
are sync. Async method bodies wrap the sync calls so the public surface stays
awaitable; the event loop is not blocked in tests (mocked provider) and a later
``acomplete``/``acomplete_json`` Protocol upgrade can swap the seam without
touching callers (Task 1 concern §1).

→ skipped: per-call streaming, RQ job offload; add when UI requires streaming
   or reports exceed inline timeout windows (docs/llm.md §7).
→ skipped: LLM response cache; add in Task 3 keyed by
   ``(feature, context_hash, model)``.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.domain.llm.exceptions import LLMUnavailable
from app.domain.llm.providers import LLMProvider, get_provider
from app.infrastructure.cache.llm_cache import LLMCache, make_cache_key
from app.infrastructure.database.models import StockScore

__all__ = ["FilterTree", "LLMService", "make_cache_key"]


class FilterTree(BaseModel):
    """Validated filter spec produced by the NL screener.

    The LLM emits one of these; the deterministic screener engine executes it
    (docs/llm.md §6, docs/scoring.md §9). JSON aliases ``and``/``or`` map to
    the python-safe attributes ``and_``/``or_``.
    """

    model_config = ConfigDict(populate_by_name=True)

    # Recursive tree fields with JSON aliases.
    # pyright cannot resolve the generic parameter of list[FilterTree] inside
    # Field(default_factory=list) at class definition time because the class
    # is not yet fully defined. This is a genuine pyright limitation with
    # pydantic recursive models + Field(default_factory=...); the targeted
    # suppression below is the smallest correct fix (AGENTS.md §3.2 exception
    # for genuine external limitations with no reasonable alternative).
    and_: list[FilterTree] = Field(default_factory=list, alias="and")  # pyright: ignore[reportUnknownVariableType]
    or_: list[FilterTree] = Field(default_factory=list, alias="or")  # pyright: ignore[reportUnknownVariableType]
    field: str | None = None
    op: str | None = None
    value: Any = None


FilterTree.model_rebuild()


_AI_PREFIX = "AI ENRICHED — "
_FALLBACK_DISABLED = (
    _AI_PREFIX + "LLM unavailable (disabled or misconfigured); quantitative scoring "
    "remains fully operational."
)
_FALLBACK_EXPLAIN = (
    _AI_PREFIX
    + "Explanation unavailable; quantitative scoring remains fully operational."
)
_FALLBACK_SUMMARY = (
    _AI_PREFIX
    + "News summary unavailable; quantitative scoring remains fully operational."
)
_FALLBACK_REPORT = (
    _AI_PREFIX + "Report unavailable; quantitative scoring remains fully operational."
)
_FALLBACK_NL_TREE = FilterTree.model_validate(
    {"and": [{"field": "opportunity_score", "op": ">", "value": 50}]}
)


def _check_feature_flag(flag_name: str) -> str | None:
    """Check a feature flag; return fallback message if disabled, None if enabled."""
    s = get_settings()
    if not getattr(s, flag_name, True):
        readable = flag_name.replace("_", " ").title()
        return _AI_PREFIX + f"{readable} disabled via feature flag."
    return None


class LLMService:
    """Application-layer wrapper around the sync `LLMProvider` Protocol.

    Construction is cheap; the provider is resolved (or set to ``None``) once
    so subsequent method calls do not re-read settings. If ``LLM_ENABLED``
    is off the service still serves every method with a deterministic fallback
    (docs/llm.md §1.5, §9 degradation ladder).
    """

    def __init__(self) -> None:
        self._provider: LLMProvider | None = None
        self._cache: LLMCache | None = None
        settings = get_settings()
        if settings.llm_enabled:
            try:
                self._provider = get_provider()
            except LLMUnavailable:
                self._provider = None
            self._cache = LLMCache()

    # ------------------------------------------------------------------
    # Public surface
    # ------------------------------------------------------------------

    async def explain_stock_score(
        self,
        ticker: str,
        asof: date,
        session: AsyncSession,
        *,
        profile: str = "balanced",
    ) -> str:
        """Return ``AI ENRICHED`` markdown explaining a stored ``StockScore``.

        Embeds the structured ``score_components`` JSON into the prompt so the
        model cites real numbers (docs/llm.md §5). Falls back to deterministic
        text when the provider is absent or raises (docs/llm.md §1.5, §9).
        """
        if flag_fallback := _check_feature_flag("llm_stock_explanation_enabled"):
            return flag_fallback
        if self._provider is None:
            return _FALLBACK_DISABLED

        score = await self._fetch_score(ticker, asof, profile, session)
        if score is None:
            return _AI_PREFIX + f"No score data for {ticker} at {asof}."

        context = self._build_score_context(score)
        cache_context = {"ticker": ticker, "asof": asof.isoformat()}
        cache_key = make_cache_key("explain", cache_context, get_settings().llm_model)

        if self._cache:
            cached = await self._cache.get(cache_key)
            if cached:
                return _AI_PREFIX + cached

        prompt = _EXPLAIN_PROMPT.format(
            context=context,
            ticker=score.ticker,
            opportunity_score=score.opportunity_score,
            classification=score.classification or "N/A",
        )
        try:
            text = self._provider.complete(prompt, temperature=0.1)
            if self._cache:
                await self._cache.set(cache_key, text)
        except Exception:
            return _FALLBACK_EXPLAIN
        return _AI_PREFIX + text

    async def translate_nl_to_filter(self, query: str) -> FilterTree:
        """Translate a natural-language query into a validated ``FilterTree``.

        The screener engine executes the tree deterministically; the LLM only
        emits the spec (docs/llm.md §6). On any LLM failure returns a
        permissive fallback tree so the caller still produces results.
        """
        if _check_feature_flag("llm_nl_screener_enabled"):
            return _FALLBACK_NL_TREE.model_copy(deep=True)
        if self._provider is None:
            return _FALLBACK_NL_TREE.model_copy(deep=True)

        cache_context = {"query": query}
        cache_key = make_cache_key("translate", cache_context, get_settings().llm_model)

        if self._cache:
            cached = await self._cache.get(cache_key)
            if cached:
                return FilterTree.model_validate_json(cached)

        try:
            result = self._provider.complete_json(query, schema=FilterTree)
            if isinstance(result, FilterTree):
                result_tree = result
            else:
                result_tree = FilterTree.model_validate(result)
            if self._cache:
                await self._cache.set(cache_key, result_tree.model_dump_json())
            return result_tree
        except Exception:
            return _FALLBACK_NL_TREE.model_copy(deep=True)

    async def summarize_news(
        self, ticker: str, asof: date, news_items: list[str]
    ) -> str:
        """Summarise ``news_items`` for ``ticker`` into ``AI ENRICHED`` text."""
        if flag_fallback := _check_feature_flag("llm_news_summary_enabled"):
            return flag_fallback
        if self._provider is None:
            return _FALLBACK_DISABLED
        if not news_items:
            return _AI_PREFIX + f"No news items for {ticker} at {asof}."

        payload = json.dumps(
            {"ticker": ticker, "asof_date": asof.isoformat(), "news_items": news_items},
            ensure_ascii=False,
        )
        cache_context = {
            "ticker": ticker,
            "asof": asof.isoformat(),
            "news_hash": hash(payload),
        }
        cache_key = make_cache_key("summarize", cache_context, get_settings().llm_model)

        if self._cache:
            cached = await self._cache.get(cache_key)
            if cached:
                return _AI_PREFIX + cached

        prompt = _NEWS_PROMPT.format(payload=payload)
        try:
            text = self._provider.complete(prompt, temperature=0.2)
            if self._cache:
                await self._cache.set(cache_key, text)
        except Exception:
            return _FALLBACK_SUMMARY
        return _AI_PREFIX + text

    async def generate_report(
        self,
        tickers: list[str],
        asof: date,
        template: str = "standard",
        session: AsyncSession | None = None,
    ) -> str:
        """Generate a multi-stock research markdown from stored scores.

        When a ``session`` is provided the report pulls the latest
        ``StockScore`` per ticker and embeds the structured context
        (docs/llm.md §5). Otherwise it builds a thin prompt from the tickers
        list — the model still produces narrative; the caller can rerun with a
        session for a grounded version.
        """
        if flag_fallback := _check_feature_flag("llm_research_enabled"):
            return flag_fallback
        if self._provider is None:
            return _FALLBACK_DISABLED
        if not tickers:
            return _AI_PREFIX + "No tickers supplied for report."

        contexts: list[str] = []
        if session is not None:
            for ticker in tickers:
                score = await self._fetch_score(ticker, asof, "balanced", session)
                if score is not None:
                    contexts.append(self._build_score_context(score))
        if not contexts:
            contexts = [f"ticker: {t}" for t in tickers]

        joined = "\n---\n".join(contexts)
        cache_context = {
            "tickers": sorted(tickers),
            "asof": asof.isoformat(),
            "template": template,
        }
        cache_key = make_cache_key("report", cache_context, get_settings().llm_model)

        if self._cache:
            cached = await self._cache.get(cache_key)
            if cached:
                return _AI_PREFIX + cached

        prompt = _REPORT_PROMPT.format(
            template=template, asof=asof.isoformat(), contexts=joined
        )
        try:
            text = self._provider.complete(prompt, temperature=0.2)
            if self._cache:
                await self._cache.set(cache_key, text)
        except Exception:
            return _FALLBACK_REPORT
        return _AI_PREFIX + text

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    async def _fetch_score(
        self,
        ticker: str,
        asof: date,
        profile: str,
        session: AsyncSession,
    ) -> StockScore | None:
        return (
            (
                await session.execute(
                    select(StockScore).where(
                        StockScore.ticker == ticker,
                        StockScore.asof_date == asof,
                        StockScore.profile == profile,
                    )
                )
            )
            .scalars()
            .first()
        )

    def _build_score_context(self, score: StockScore) -> str:
        """Serialise a ``StockScore`` into a compact context block.

        Mirrors docs/llm.md §5 example: only fields the analyst page shows,
        plus the version strings so the model can cite ``feature_version``.
        """
        comps = score.score_components or {}
        return json.dumps(
            {
                "ticker": score.ticker,
                "asof_date": score.asof_date.isoformat(),
                "opportunity_score": score.opportunity_score,
                "classification": score.classification,
                "confidence": score.confidence,
                "scoring_version": score.scoring_version,
                "feature_version": score.feature_version,
                "components": comps,
                "drivers": list(score.drivers or []),
                "risks": list(score.risks or []),
            },
            ensure_ascii=False,
            default=str,
        )


_EXPLAIN_PROMPT = (
    "You are an equity analyst explaining quantitative scores to a "
    "professional investor.\n"
    "Cite specific numbers from the context. Do not invent figures. "
    "Do not give investment advice.\n\n"
    "Context:\n{context}\n\n"
    "Question: Why is {ticker} scored {opportunity_score}/100 ({classification})?"
)

_NEWS_PROMPT = (
    "You are an equity research analyst summarising news items for a "
    "single stock.\n"
    "Summarise concisely, flag sentiment, and cite each item's headline. "
    "Do not invent facts.\n"
    "Output a short markdown digest.\n\n"
    "Context (JSON):\n{payload}\n\nDigest:"
)

_REPORT_PROMPT = (
    "You are an equity research analyst generating a multi-stock report.\n"
    "Use only the supplied structured contexts; do not invent financial "
    "data. Do not give investment advice.\n"
    "Organise by ticker with a one-line verdict and supporting bullets "
    "from each context.\n\n"
    "Template: {template}\n"
    "As-of: {asof}\n\n"
    "Contexts:\n{contexts}\n\nReport (markdown):"
)
