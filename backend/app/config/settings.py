from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: str = "development"
    postgres_dsn: str = "postgresql+asyncpg://ihsg:ihsg@localhost:5432/ihsg_quant"
    redis_url: str = "redis://localhost:6379/0"
    data_dir: str = "./data"
    market_data_provider: str = "yfinance"
    ingest_cron: str = "15 16 * * 1-5"
    watchdog_cron: str = "*/30 * * * *"

    # AI feature flags (PRD §33) — default OFF for deterministic-first
    ml_enabled: bool = False
    llm_enabled: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
