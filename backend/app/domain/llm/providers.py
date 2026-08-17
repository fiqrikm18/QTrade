from __future__ import annotations

from typing import Protocol, runtime_checkable

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, SecretStr

from app.domain.llm.exceptions import LLMUnavailable


@runtime_checkable
class LLMProvider(Protocol):
    def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float | None = None,
    ) -> str: ...

    def complete_json(self, prompt: str, *, schema: type[BaseModel]) -> BaseModel: ...


def _build_openai(
    model: str,
    temperature: float,
    api_key: str | None = None,
    base_url: str | None = None,
    request_timeout: float = 30.0,
) -> BaseChatModel:
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=model,
        temperature=temperature,
        api_key=SecretStr(api_key) if api_key else SecretStr("test"),
        base_url=base_url,
        timeout=request_timeout,
    )


def _build_anthropic(
    model: str,
    temperature: float,
    api_key: str | None = None,
    request_timeout: float = 30.0,
) -> BaseChatModel:
    from langchain_anthropic import ChatAnthropic

    return ChatAnthropic(
        model_name=model,
        temperature=temperature,
        api_key=SecretStr(api_key) if api_key else SecretStr("test"),
        timeout=request_timeout,
        stop=None,
    )


def _build_google(
    model: str,
    temperature: float,
    api_key: str | None = None,
    request_timeout: float = 30.0,
) -> BaseChatModel:
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=model,
        temperature=temperature,
        api_key=SecretStr(api_key) if api_key else SecretStr("test"),
        timeout=request_timeout,
    )


def _build_openrouter(
    model: str,
    temperature: float,
    api_key: str | None = None,
    request_timeout: float = 30.0,
) -> BaseChatModel:
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=model,
        temperature=temperature,
        api_key=SecretStr(api_key) if api_key else SecretStr("test"),
        base_url="https://openrouter.ai/api/v1",
        timeout=request_timeout,
    )


def _build_ollama(
    model: str,
    temperature: float,
    base_url: str | None = None,
    request_timeout: float = 30.0,
) -> BaseChatModel:
    from langchain_ollama import ChatOllama

    # ChatOllama does not expose timeout; rely on Ollama server-side config
    return ChatOllama(
        model=model,
        temperature=temperature,
        base_url=base_url or "http://localhost:11434",
    )


def _extract_content(
    response: AIMessage | str | list[dict[str, object]] | list[str],
) -> str:
    if isinstance(response, AIMessage):
        content = response.content
        if isinstance(content, str):
            return content
        # Handle list of content blocks (e.g., tool calls)
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            else:
                text_val = block.get("text")
                if isinstance(text_val, str):
                    parts.append(text_val)
        return "".join(parts)
    return str(response)


class _BaseProvider:
    def __init__(self, model: BaseChatModel) -> None:
        self._model = model

    def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float | None = None,
    ) -> str:
        messages: list[HumanMessage | SystemMessage] = []
        if system:
            messages.append(SystemMessage(content=system))
        messages.append(HumanMessage(content=prompt))

        if temperature is not None:
            response = self._model.invoke(
                messages, config={"configurable": {"temperature": temperature}}
            )
        else:
            response = self._model.invoke(messages)
        return _extract_content(response)

    def complete_json(self, prompt: str, *, schema: type[BaseModel]) -> BaseModel:
        parser = PydanticOutputParser(pydantic_object=schema)
        format_instructions = parser.get_format_instructions()
        messages = [
            SystemMessage(
                content=f"Output JSON only matching this schema: {format_instructions}"
            ),
            HumanMessage(content=prompt),
        ]
        response = self._model.invoke(messages)
        content = _extract_content(response)
        return parser.parse(content)


class OpenAIProvider(_BaseProvider):
    def __init__(
        self,
        model: str,
        temperature: float,
        api_key: str | None = None,
        base_url: str | None = None,
        request_timeout: float = 30.0,
    ) -> None:
        chat_model = _build_openai(
            model, temperature, api_key, base_url, request_timeout
        )
        super().__init__(chat_model)


class AnthropicProvider(_BaseProvider):
    def __init__(
        self,
        model: str,
        temperature: float,
        api_key: str | None = None,
        request_timeout: float = 30.0,
    ) -> None:
        chat_model = _build_anthropic(model, temperature, api_key, request_timeout)
        super().__init__(chat_model)


class GoogleProvider(_BaseProvider):
    def __init__(
        self,
        model: str,
        temperature: float,
        api_key: str | None = None,
        request_timeout: float = 30.0,
    ) -> None:
        chat_model = _build_google(model, temperature, api_key, request_timeout)
        super().__init__(chat_model)


class OpenRouterProvider(_BaseProvider):
    def __init__(
        self,
        model: str,
        temperature: float,
        api_key: str | None = None,
        request_timeout: float = 30.0,
    ) -> None:
        chat_model = _build_openrouter(model, temperature, api_key, request_timeout)
        super().__init__(chat_model)


class OllamaProvider(_BaseProvider):
    def __init__(
        self,
        model: str,
        temperature: float,
        base_url: str | None = None,
        request_timeout: float = 30.0,
    ) -> None:
        chat_model = _build_ollama(model, temperature, base_url, request_timeout)
        super().__init__(chat_model)


def get_provider() -> LLMProvider:
    from app.config.settings import get_settings

    s = get_settings()
    if not s.llm_enabled:
        raise LLMUnavailable("LLM disabled via settings")

    provider = s.llm_provider.lower()
    model = s.llm_model
    temp = s.llm_temperature
    api_key = s.llm_api_key
    base_url = s.llm_base_url
    timeout = s.llm_request_timeout

    if provider == "openai":
        return OpenAIProvider(
            model=model,
            temperature=temp,
            api_key=api_key,
            base_url=base_url,
            request_timeout=timeout,
        )
    elif provider == "anthropic":
        return AnthropicProvider(
            model=model, temperature=temp, api_key=api_key, request_timeout=timeout
        )
    elif provider == "google":
        return GoogleProvider(
            model=model, temperature=temp, api_key=api_key, request_timeout=timeout
        )
    elif provider == "openrouter":
        return OpenRouterProvider(
            model=model, temperature=temp, api_key=api_key, request_timeout=timeout
        )
    elif provider == "ollama":
        return OllamaProvider(
            model=model, temperature=temp, base_url=base_url, request_timeout=timeout
        )
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")
