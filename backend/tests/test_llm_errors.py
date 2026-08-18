"""LLM error handling and graceful fallback."""

from datetime import date
from unittest.mock import MagicMock, patch

from app.application.services.llm_service import _FALLBACK_NL_TREE, LLMService


async def test_timeout_returns_fallback(session):
    """Provider timeout triggers fallback."""
    service = LLMService()
    service._provider = MagicMock()
    service._provider.complete.side_effect = TimeoutError("request timeout")

    with patch.object(service, "_fetch_score") as mock_fetch:
        from app.infrastructure.database.models import StockScore

        mock_fetch.return_value = StockScore(
            ticker="BBCA",
            asof_date=date(2024, 3, 1),
            profile="balanced",
            scoring_version="v1",
            feature_version="v1",
            opportunity_score=86.0,
        )

        result = await service.explain_stock_score("BBCA", date(2024, 3, 1), session)
        assert "unavailable" in result.lower() or "fallback" in result.lower()


async def test_auth_error_returns_fallback(session):
    """Auth error triggers fallback."""
    service = LLMService()
    service._provider = MagicMock()
    service._provider.complete.side_effect = Exception("401 Unauthorized")

    with patch.object(service, "_fetch_score") as mock_fetch:
        from app.infrastructure.database.models import StockScore

        mock_fetch.return_value = StockScore(
            ticker="BBCA",
            asof_date=date(2024, 3, 1),
            profile="balanced",
            scoring_version="v1",
            feature_version="v1",
            opportunity_score=86.0,
        )

        result = await service.explain_stock_score("BBCA", date(2024, 3, 1), session)
        assert "unavailable" in result.lower() or "fallback" in result.lower()


async def test_rate_limit_returns_fallback(session):
    """Rate limit triggers fallback."""
    service = LLMService()
    service._provider = MagicMock()
    service._provider.complete.side_effect = Exception("429 Rate limit")

    with patch.object(service, "_fetch_score") as mock_fetch:
        from app.infrastructure.database.models import StockScore

        mock_fetch.return_value = StockScore(
            ticker="BBCA",
            asof_date=date(2024, 3, 1),
            profile="balanced",
            scoring_version="v1",
            feature_version="v1",
            opportunity_score=86.0,
        )

        result = await service.explain_stock_score("BBCA", date(2024, 3, 1), session)
        assert "unavailable" in result.lower() or "fallback" in result.lower()


async def test_malformed_json_returns_fallback():
    """complete_json parse error returns default filter."""
    service = LLMService()
    service._provider = MagicMock()
    service._provider.complete_json.side_effect = Exception("invalid json")

    result = await service.translate_nl_to_filter("test")
    assert result == _FALLBACK_NL_TREE
