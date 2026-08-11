from app.config.settings import get_settings


def test_settings_load_defaults():
    s = get_settings()
    assert s.app_env in {"development", "production", "test"}
    assert s.postgres_dsn.startswith("postgresql")
    assert s.market_data_provider != ""
