"""Settings API route — read-only backend configuration."""

from fastapi import APIRouter

from app.config.settings import get_settings

router = APIRouter()


@router.get("", response_model=dict[str, object])
async def get_settings() -> dict[str, object]:
    settings = get_settings()
    return {
        "macro_provider": settings.macro_provider,
        "news_provider": settings.news_provider,
        "fundamental_provider": settings.fundamental_provider,
        "ingest_macro_cron": settings.ingest_macro_cron,
        "ingest_news_cron": settings.ingest_news_cron,
        "ingest_fundamentals_cron": settings.ingest_fundamentals_cron,
        "ingest_cron": settings.ingest_cron,
        "watchdog_cron": settings.watchdog_cron,
        "llm_enabled": settings.llm_enabled,
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
        "llm_analysis_enabled": settings.llm_analysis_enabled,
        "llm_news_summary_enabled": settings.llm_news_summary_enabled,
        "llm_stock_explanation_enabled": settings.llm_stock_explanation_enabled,
        "llm_macro_summary_enabled": settings.llm_macro_summary_enabled,
        "llm_nl_screener_enabled": settings.llm_nl_screener_enabled,
        "llm_research_enabled": settings.llm_research_enabled,
    }