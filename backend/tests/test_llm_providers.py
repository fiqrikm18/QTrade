"""LLM provider protocol + langchain adapters."""

import pytest

from app.domain.llm.exceptions import LLMUnavailable
from app.domain.llm.providers import LLMProvider, get_provider


def test_llm_provider_protocol_signature():
    """Protocol defines complete and complete_json."""
    assert hasattr(LLMProvider, "complete")
    assert hasattr(LLMProvider, "complete_json")


def test_get_provider_raises_when_disabled(monkeypatch):
    """get_provider raises LLMUnavailable when LLM_ENABLED=false."""
    from app.config.settings import get_settings

    s = get_settings()
    monkeypatch.setattr(s, "llm_enabled", False)
    with pytest.raises(LLMUnavailable):
        get_provider()


def test_get_provider_openai_when_configured(monkeypatch):
    """get_provider returns OpenAIProvider when LLM_PROVIDER=openai."""
    from app.config.settings import get_settings

    s = get_settings()
    monkeypatch.setattr(s, "llm_enabled", True)
    monkeypatch.setattr(s, "llm_provider", "openai")
    monkeypatch.setattr(s, "llm_model", "gpt-4o-mini")
    monkeypatch.setattr(s, "llm_temperature", 0.1)
    provider = get_provider()
    assert provider.__class__.__name__ == "OpenAIProvider"


def test_get_provider_anthropic_when_configured(monkeypatch):
    """get_provider returns AnthropicProvider when LLM_PROVIDER=anthropic."""
    from app.config.settings import get_settings

    s = get_settings()
    monkeypatch.setattr(s, "llm_enabled", True)
    monkeypatch.setattr(s, "llm_provider", "anthropic")
    monkeypatch.setattr(s, "llm_model", "claude-3-haiku-20240307")
    monkeypatch.setattr(s, "llm_temperature", 0.1)
    provider = get_provider()
    assert provider.__class__.__name__ == "AnthropicProvider"


def test_get_provider_google_when_configured(monkeypatch):
    """get_provider returns GoogleProvider when LLM_PROVIDER=google."""
    from app.config.settings import get_settings

    s = get_settings()
    monkeypatch.setattr(s, "llm_enabled", True)
    monkeypatch.setattr(s, "llm_provider", "google")
    monkeypatch.setattr(s, "llm_model", "gemini-1.5-flash")
    monkeypatch.setattr(s, "llm_temperature", 0.1)
    provider = get_provider()
    assert provider.__class__.__name__ == "GoogleProvider"


def test_get_provider_openrouter_when_configured(monkeypatch):
    """get_provider returns OpenRouterProvider when LLM_PROVIDER=openrouter."""
    from app.config.settings import get_settings

    s = get_settings()
    monkeypatch.setattr(s, "llm_enabled", True)
    monkeypatch.setattr(s, "llm_provider", "openrouter")
    monkeypatch.setattr(s, "llm_model", "openai/gpt-4o-mini")
    monkeypatch.setattr(s, "llm_temperature", 0.1)
    provider = get_provider()
    assert provider.__class__.__name__ == "OpenRouterProvider"


def test_get_provider_ollama_when_configured(monkeypatch):
    """get_provider returns OllamaProvider when LLM_PROVIDER=ollama."""
    from app.config.settings import get_settings

    s = get_settings()
    monkeypatch.setattr(s, "llm_enabled", True)
    monkeypatch.setattr(s, "llm_provider", "ollama")
    monkeypatch.setattr(s, "llm_model", "llama3.1:8b")
    monkeypatch.setattr(s, "llm_temperature", 0.1)
    provider = get_provider()
    assert provider.__class__.__name__ == "OllamaProvider"


def test_get_provider_unknown_raises(monkeypatch):
    """get_provider raises ValueError for unknown provider."""
    from app.config.settings import get_settings

    s = get_settings()
    monkeypatch.setattr(s, "llm_enabled", True)
    monkeypatch.setattr(s, "llm_provider", "unknown")
    with pytest.raises(ValueError, match="Unknown LLM provider"):
        get_provider()


def test_openai_complete_smoke(monkeypatch):
    """OpenAIProvider.complete delegates to langchain (mocked)."""
    from langchain_openai import ChatOpenAI

    from app.domain.llm.providers import OpenAIProvider

    def mock_invoke(self, messages, config=None, stop=None, **kwargs):
        from langchain_core.messages import AIMessage

        return AIMessage(content="ok")

    monkeypatch.setattr(ChatOpenAI, "invoke", mock_invoke)
    provider = OpenAIProvider(model="gpt-4o-mini", temperature=0.1, api_key="test")
    result = provider.complete("test")
    assert result == "ok"


def test_openai_complete_json_smoke(monkeypatch):
    """OpenAIProvider.complete_json delegates to langchain with PydanticOutputParser."""
    from langchain_openai import ChatOpenAI
    from pydantic import BaseModel

    from app.domain.llm.providers import OpenAIProvider

    class ResultSchema(BaseModel):
        answer: str

    def mock_invoke(self, messages, config=None, stop=None, **kwargs):
        from langchain_core.messages import AIMessage

        return AIMessage(content='{"answer": "42"}')

    monkeypatch.setattr(ChatOpenAI, "invoke", mock_invoke)
    provider = OpenAIProvider(model="gpt-4o-mini", temperature=0.1, api_key="test")
    result = provider.complete_json("test", schema=ResultSchema)
    assert isinstance(result, ResultSchema)
    assert result.answer == "42"
