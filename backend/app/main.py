from fastapi import APIRouter, FastAPI

from app.interfaces.api.router import register_routes
from app.interfaces.api.router import router as api_router


def create_app() -> FastAPI:
    app = FastAPI(title="IHSG Quant API", version="0.1.0")

    register_routes(app)
    app.include_router(api_router)
    app.include_router(health_router)

    return app


health_router = APIRouter()


@health_router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
