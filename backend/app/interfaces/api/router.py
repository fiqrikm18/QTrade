"""API route definitions."""

from fastapi import APIRouter, FastAPI

router = APIRouter(prefix="/api/v1")


def register_routes(app: FastAPI) -> None:
    from app.interfaces.api.routes import backtests, llm, market, ml, screener, stocks

    router.include_router(market.router, prefix="/market", tags=["market"])
    router.include_router(stocks.router, prefix="/stocks", tags=["stocks"])
    router.include_router(screener.router, prefix="/screener", tags=["screener"])
    router.include_router(backtests.router, prefix="/backtests", tags=["backtests"])
    router.include_router(ml.router, prefix="/ml", tags=["ml"])
    router.include_router(llm.router, prefix="/llm", tags=["llm"])

    app.include_router(router)
