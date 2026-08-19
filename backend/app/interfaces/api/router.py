"""API route definitions."""

from fastapi import APIRouter, FastAPI

router = APIRouter(prefix="/api/v1")


def register_routes(app: FastAPI) -> None:
    from app.interfaces.api.routes import (
        alerts,
        backtests,
        calendar,
        data_quality,
        llm,
        macro,
        market,
        ml,
        news,
        portfolio,
        research,
        screener,
        settings,
        stocks,
        system,
    )

    router.include_router(market.router, prefix="/market", tags=["market"])
    router.include_router(stocks.router, prefix="/stocks", tags=["stocks"])
    router.include_router(screener.router, prefix="/screener", tags=["screener"])
    router.include_router(backtests.router, prefix="/backtests", tags=["backtests"])
    router.include_router(ml.router, prefix="/ml", tags=["ml"])
    router.include_router(llm.router, prefix="/llm", tags=["llm"])
    router.include_router(macro.router, prefix="/macro", tags=["macro"])
    router.include_router(calendar.router, prefix="/calendar", tags=["calendar"])
    router.include_router(news.router, prefix="/news", tags=["news"])
    router.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])
    router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
    router.include_router(research.router, prefix="/research", tags=["research"])
    router.include_router(
        data_quality.router, prefix="/data-quality", tags=["data-quality"]
    )
    router.include_router(system.router, prefix="/system", tags=["system"])
    router.include_router(settings.router, prefix="/settings", tags=["settings"])

    app.include_router(router)
