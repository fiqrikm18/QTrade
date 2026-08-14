from fastapi import FastAPI

from app.interfaces.api.router import register_routes
from app.interfaces.api.router import router as api_router


def create_app() -> FastAPI:
    app = FastAPI(title="IHSG Quant API", version="0.1.0")

    register_routes(app)  # type: ignore[attr-defined]
    app.include_router(api_router)

    @app.get("/health")
    async def health() -> dict[str, str]:  # type: ignore[attr-defined]
        return {"status": "ok"}

    return app
