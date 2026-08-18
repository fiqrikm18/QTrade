"""LLM service: explanations, NL screener, reports (CP4 Task 2).

Verifies the application-layer wrapper around `LLMProvider` (Task 1):
- `explain_stock_score` produces AI-ENRICHED markdown citing the structured
  components written by the scanner.
- `translate_nl_to_filter` returns a validated `FilterTree` whose execution is
  left to the deterministic screener (docs/llm.md §6).
- `summarize_news` / `generate_report` exercise the same provider seam and
  degrade to deterministic fallback when LLM is disabled.
- On any LLM failure the service returns a deterministic fallback string
  (docs/llm.md §1.5, §9); the platform never shows a blank page.

Conventions follow the Task 1 tests (sync `LLMProvider` Protocol):
- Provider mock is `MagicMock`, not `AsyncMock` — the Protocol's `complete`
  and `complete_json` are sync (Task 1 §concerns 1).
- Settings toggling mutates the cached `get_settings()` instance, the only
  place where `llm_enabled` actually lives (Task 1 deviation §1).
"""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy import delete

from app.application.services.llm_service import FilterTree, LLMService
from app.config.settings import get_settings
from app.infrastructure.database.models import StockScore


def _seed_score(session) -> StockScore:
    score = StockScore(
        ticker="BBCA",
        asof_date=date(2024, 3, 1),
        profile="balanced",
        scoring_version="v1",
        feature_version="v1",
        opportunity_score=86.0,
        technical_score=88.0,
        fundamental_score=82.0,
        momentum_score=75.0,
        relative_strength=80.0,
        smart_money_score=78.0,
        factor_score=85.0,
        sector_score=79.0,
        macro_score=72.0,
        risk_score=76.0,
        ml_score=None,
        score_components={
            "technical": {"score": 88, "drivers": ["RSI > 60"]},
            "risk": {"score": 76, "drawdown_250d": 0.12},
        },
        classification="OPPORTUNITY",
        confidence=0.8,
    )
    session.add(score)
    return score


def _mock_cache():
    """Create a mock cache that returns None (cache miss)."""
    mock_cache = AsyncMock()
    mock_cache.get.return_value = None
    return mock_cache


async def test_explain_stock_score_returns_markdown(session):
    """explain_stock_score returns AI-ENRICHED markdown citing stored numbers."""
    await session.execute(delete(StockScore))
    _seed_score(session)
    await session.flush()

    mock_provider = MagicMock()
    mock_provider.complete.return_value = "## BBCA Analysis\nBBCA scores 86/100..."
    mock_cache = _mock_cache()

    with (
        patch(
            "app.application.services.llm_service.get_provider",
            return_value=mock_provider,
        ),
        patch("app.application.services.llm_service.LLMCache", return_value=mock_cache),
    ):
        s = get_settings()
        prev = s.llm_enabled
        s.llm_enabled = True
        try:
            service = LLMService()
            result = await service.explain_stock_score(
                "BBCA", date(2024, 3, 1), session
            )
        finally:
            s.llm_enabled = prev

    assert "BBCA" in result
    assert "86" in result
    assert "AI ENRICHED" in result
    mock_provider.complete.assert_called_once()
    # Prompt must embed the structured context (cite numbers, no free-form DB).
    prompt_arg = mock_provider.complete.call_args.args[0]
    assert "opportunity_score" in prompt_arg
    assert "RSI > 60" in prompt_arg


async def test_explain_stock_score_provider_failure_falls_back(session):
    """On provider exception the service returns a deterministic fallback."""
    await session.execute(delete(StockScore))
    _seed_score(session)
    await session.flush()

    mock_provider = MagicMock()
    mock_provider.complete.side_effect = RuntimeError("upstream 5xx")
    mock_cache = _mock_cache()

    with (
        patch(
            "app.application.services.llm_service.get_provider",
            return_value=mock_provider,
        ),
        patch("app.application.services.llm_service.LLMCache", return_value=mock_cache),
    ):
        s = get_settings()
        prev = s.llm_enabled
        s.llm_enabled = True
        try:
            service = LLMService()
            result = await service.explain_stock_score(
                "BBCA", date(2024, 3, 1), session
            )
        finally:
            s.llm_enabled = prev

    assert "AI ENRICHED" in result
    assert "quantitative scoring remains fully operational" in result


async def test_explain_stock_score_no_score_data(session):
    """Missing score row yields a deterministic empty-state string."""
    await session.execute(delete(StockScore))
    await session.flush()

    mock_provider = MagicMock()
    mock_cache = _mock_cache()
    with (
        patch(
            "app.application.services.llm_service.get_provider",
            return_value=mock_provider,
        ),
        patch("app.application.services.llm_service.LLMCache", return_value=mock_cache),
    ):
        s = get_settings()
        prev = s.llm_enabled
        s.llm_enabled = True
        try:
            service = LLMService()
            result = await service.explain_stock_score(
                "UNLISTED", date(2024, 3, 1), session
            )
        finally:
            s.llm_enabled = prev

    assert "AI ENRICHED" in result
    assert "UNLISTED" in result
    mock_provider.complete.assert_not_called()


async def test_translate_nl_to_filter_returns_filter_tree():
    """translate_nl_to_filter returns a validated FilterTree (pydantic model)."""
    mock_provider = MagicMock()
    mock_provider.complete_json.return_value = FilterTree.model_validate(
        {
            "and": [
                {"field": "sector", "op": "=", "value": "BANKING"},
                {"field": "opportunity_score", "op": ">", "value": 70},
            ]
        }
    )
    mock_cache = _mock_cache()

    with (
        patch(
            "app.application.services.llm_service.get_provider",
            return_value=mock_provider,
        ),
        patch("app.application.services.llm_service.LLMCache", return_value=mock_cache),
    ):
        s = get_settings()
        prev = s.llm_enabled
        s.llm_enabled = True
        try:
            service = LLMService()
            result = await service.translate_nl_to_filter(
                "strong banking stocks above 70"
            )
        finally:
            s.llm_enabled = prev

    assert isinstance(result, FilterTree)
    assert result.and_[0].field == "sector"
    assert result.and_[0].op == "="
    assert result.and_[0].value == "BANKING"
    assert result.and_[1].field == "opportunity_score"
    assert result.and_[1].op == ">"
    assert result.and_[1].value == 70
    mock_provider.complete_json.assert_called_once()


async def test_translate_nl_to_filter_provider_failure_falls_back():
    """Provider failure yields a permissive fallback filter (no blank page)."""
    mock_provider = MagicMock()
    mock_provider.complete_json.side_effect = RuntimeError("upstream 5xx")
    mock_cache = _mock_cache()

    with (
        patch(
            "app.application.services.llm_service.get_provider",
            return_value=mock_provider,
        ),
        patch("app.application.services.llm_service.LLMCache", return_value=mock_cache),
    ):
        s = get_settings()
        prev = s.llm_enabled
        s.llm_enabled = True
        try:
            service = LLMService()
            result = await service.translate_nl_to_filter("anything")
        finally:
            s.llm_enabled = prev

    assert isinstance(result, FilterTree)
    assert result.and_  # non-empty fallback


async def test_summarize_news_returns_summary():
    """summarize_news returns AI-ENRICHED text for the given ticker."""
    mock_provider = MagicMock()
    mock_provider.complete.return_value = "BBCA news digest: net positive flows."
    mock_cache = _mock_cache()

    with (
        patch(
            "app.application.services.llm_service.get_provider",
            return_value=mock_provider,
        ),
        patch("app.application.services.llm_service.LLMCache", return_value=mock_cache),
    ):
        s = get_settings()
        prev = s.llm_enabled
        s.llm_enabled = True
        try:
            service = LLMService()
            result = await service.summarize_news(
                "BBCA", date(2024, 3, 1), ["BBCA dividend announced."]
            )
        finally:
            s.llm_enabled = prev

    assert "AI ENRICHED" in result
    assert "BBCA" in result
    mock_provider.complete.assert_called_once()
    prompt_arg = mock_provider.complete.call_args.args[0]
    assert "BBCA dividend announced." in prompt_arg


async def test_generate_report_returns_markdown():
    """generate_report stitches per-ticker summaries into a single markdown."""
    mock_provider = MagicMock()
    mock_provider.complete.return_value = (
        "## Multi-stock report\n- BBCA: 86\n- BBRI: 72"
    )
    mock_cache = _mock_cache()

    with (
        patch(
            "app.application.services.llm_service.get_provider",
            return_value=mock_provider,
        ),
        patch("app.application.services.llm_service.LLMCache", return_value=mock_cache),
    ):
        s = get_settings()
        prev = s.llm_enabled
        s.llm_enabled = True
        try:
            service = LLMService()
            result = await service.generate_report(
                ["BBCA", "BBRI"], date(2024, 3, 1), template="standard"
            )
        finally:
            s.llm_enabled = prev

    assert "AI ENRICHED" in result
    assert "Multi-stock report" in result
    mock_provider.complete.assert_called_once()
    prompt_arg = mock_provider.complete.call_args.args[0]
    assert "BBCA" in prompt_arg
    assert "BBRI" in prompt_arg


async def test_llm_unavailable_returns_fallback(session, monkeypatch):
    """When LLM disabled, explain_stock_score returns deterministic fallback."""
    await session.execute(delete(StockScore))
    _seed_score(session)
    await session.flush()

    s = get_settings()
    monkeypatch.setattr(s, "llm_enabled", False)

    service = LLMService()
    result = await service.explain_stock_score("BBCA", date(2024, 3, 1), session)

    assert "LLM unavailable" in result or "disabled" in result
    assert "quantitative scoring remains fully operational" in result


async def test_llm_unavailable_translate_nl_falls_back(monkeypatch):
    """Disabled LLM: translate_nl_to_filter returns a permissive fallback tree."""
    s = get_settings()
    monkeypatch.setattr(s, "llm_enabled", False)

    service = LLMService()
    result = await service.translate_nl_to_filter("anything")

    assert isinstance(result, FilterTree)
    assert result.and_  # non-empty fallback


async def test_filter_tree_validates_alias():
    """FilterTree accepts `and`/`or` JSON aliases and exposes them as `and_`."""
    tree = FilterTree.model_validate(
        {
            "and": [
                {"field": "sector", "op": "=", "value": "BANKING"},
                {"or": [{"field": "opportunity_score", "op": ">", "value": 70}]},
            ]
        }
    )
    assert len(tree.and_) == 2
    assert tree.and_[1].or_[0].field == "opportunity_score"
