"""LLM feature flags control individual features."""

from datetime import date

from app.application.services.llm_service import LLMService
from app.config.settings import Settings, get_settings


def test_feature_flags_exist():
    """All required flags present on settings."""
    # Use fresh Settings instance to avoid lru_cache issues
    s = Settings()
    required = [
        "llm_analysis_enabled",
        "llm_news_summary_enabled",
        "llm_stock_explanation_enabled",
        "llm_macro_summary_enabled",
        "llm_nl_screener_enabled",
        "llm_research_enabled",
    ]
    for flag in required:
        assert hasattr(s, flag), f"missing {flag}"


async def test_stock_explanation_respects_flag(session, monkeypatch):
    """LLM_STOCK_EXPLANATION_ENABLED gates explain_stock_score."""
    settings = get_settings()
    monkeypatch.setattr(settings, "llm_enabled", True)
    monkeypatch.setattr(settings, "llm_stock_explanation_enabled", False)

    service = LLMService()
    result = await service.explain_stock_score("BBCA", date(2024, 3, 1), session)
    assert "disabled" in result.lower() or "unavailable" in result.lower()


async def test_nl_screener_respects_flag(monkeypatch):
    """LLM_NL_SCREENER_ENABLED gates translate_nl_to_filter."""
    settings = get_settings()
    monkeypatch.setattr(settings, "llm_enabled", True)
    monkeypatch.setattr(settings, "llm_nl_screener_enabled", False)

    service = LLMService()
    result = await service.translate_nl_to_filter("test query")
    # Should return default filter, not call LLM
    expected = {"and": [{"field": "opportunity_score", "op": ">", "value": 50}]}
    # Compare the "and" branch which is the meaningful part
    dump = result.model_dump(by_alias=True, exclude_none=True, exclude_defaults=True)
    assert dump == expected
