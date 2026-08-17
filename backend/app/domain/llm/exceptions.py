"""LLM-related exceptions."""


class LLMUnavailable(Exception):  # noqa: N818 - name mandated by PRD §32 / docs/llm.md §3
    """Raised when LLM is disabled or unavailable."""

    pass
