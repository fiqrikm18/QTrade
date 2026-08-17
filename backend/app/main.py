from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.interfaces.api.router import register_routes
from app.interfaces.api.router import router as api_router

health_router = APIRouter()


@health_router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def create_app() -> FastAPI:
    app = FastAPI(title="IHSG Quant API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_routes(app)
    app.include_router(api_router)
    app.include_router(health_router)

    return app
