"""API route definitions."""

from fastapi import APIRouter, FastAPI

router = APIRouter(prefix="/api/v1")


def register_routes(app: FastAPI) -> None:
    from app.interfaces.api.routes import market, screener, stocks

    router.include_router(market.router, prefix="/market", tags=["market"])
    router.include_router(stocks.router, prefix="/stocks", tags=["stocks"])
    router.include_router(screener.router, prefix="/screener", tags=["screener"])

    app.include_router(router)
