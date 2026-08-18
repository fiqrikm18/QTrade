"""LLM service cache integration."""

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

from app.application.services.llm_service import LLMService


async def test_explain_uses_cache(session):
    """Second call with same context hits cache."""
    mock_cache = AsyncMock()
    # First call: cache miss (returns None), second call: cache hit (returns value)
    mock_cache.get.side_effect = [None, "Cached explanation"]

    service = LLMService()
    service._provider = MagicMock()
    service._provider.complete.return_value = "First call"
    service._cache = mock_cache

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

        await service.explain_stock_score("BBCA", date(2024, 3, 1), session)
        await service.explain_stock_score("BBCA", date(2024, 3, 1), session)

    # First call: miss -> get; second call: hit -> get
    assert mock_cache.get.call_count == 2
    # Only first call should call set
    assert mock_cache.set.call_count == 1


async def test_translate_uses_cache():
    """translate_nl_to_filter uses cache."""
    mock_cache = AsyncMock()
    mock_cache.get.side_effect = [
        None,
        '{"and": [{"field": "sector", "op": "=", "value": "BANKING"}]}',
    ]

    service = LLMService()
    service._provider = MagicMock()
    service._provider.complete_json.return_value = {
        "and": [{"field": "sector", "op": "=", "value": "BANKING"}]
    }
    service._cache = mock_cache

    await service.translate_nl_to_filter("banking stocks")
    await service.translate_nl_to_filter("banking stocks")

    assert mock_cache.get.call_count == 2
    assert mock_cache.set.call_count == 1


async def test_summarize_uses_cache():
    """summarize_news uses cache."""
    mock_cache = AsyncMock()
    mock_cache.get.side_effect = [None, "Cached summary"]

    service = LLMService()
    service._provider = MagicMock()
    service._provider.complete.return_value = "News summary"
    service._cache = mock_cache

    await service.summarize_news("BBCA", date(2024, 3, 1), ["news item 1"])
    await service.summarize_news("BBCA", date(2024, 3, 1), ["news item 1"])

    assert mock_cache.get.call_count == 2
    assert mock_cache.set.call_count == 1


async def test_generate_report_uses_cache(session):
    """generate_report uses cache."""
    mock_cache = AsyncMock()
    mock_cache.get.side_effect = [None, "Cached report"]

    service = LLMService()
    service._provider = MagicMock()
    service._provider.complete.return_value = "Report content"
    service._cache = mock_cache

    await service.generate_report(["BBCA"], date(2024, 3, 1), session=session)
    await service.generate_report(["BBCA"], date(2024, 3, 1), session=session)

    assert mock_cache.get.call_count == 2
    assert mock_cache.set.call_count == 1
