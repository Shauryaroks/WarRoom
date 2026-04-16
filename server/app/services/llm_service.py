"""LLM service: OpenRouter client with structured JSON output.

Calls OpenRouter API for solution evaluation. Returns parsed structured
output conforming to EVALUATION_SCHEMA and metadata (model, latency, tokens).

Per T-05-02: API key validated before call, never logged.
Per T-05-03: httpx timeout=90s prevents hanging connections.
"""

import json
import logging
import time

import httpx

from app.database import settings

logger = logging.getLogger(__name__)


EVALUATION_SCHEMA = {
    "name": "evaluation_output",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "scoring_metrics": {
                "type": "object",
                "properties": {
                    "strategic_quality": {
                        "type": "number",
                        "description": "0.0 to 1.0",
                    },
                    "feasibility": {
                        "type": "number",
                        "description": "0.0 to 1.0",
                    },
                    "innovation": {
                        "type": "number",
                        "description": "0.0 to 1.0",
                    },
                    "market_awareness": {
                        "type": "number",
                        "description": "0.0 to 1.0",
                    },
                    "overall_score": {
                        "type": "number",
                        "description": "0.0 to 1.0",
                    },
                },
                "required": [
                    "strategic_quality",
                    "feasibility",
                    "innovation",
                    "market_awareness",
                    "overall_score",
                ],
                "additionalProperties": False,
            },
            "price_timeline": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "month": {"type": "integer"},
                        "price_change_pct": {
                            "type": "number",
                            "description": "percentage change e.g. 5.0 means +5%",
                        },
                    },
                    "required": ["month", "price_change_pct"],
                    "additionalProperties": False,
                },
                "description": "3-month price trajectory as percentage changes",
            },
            "news_article": {
                "type": "object",
                "properties": {
                    "headline": {
                        "type": "string",
                        "description": "Max 120 chars",
                    },
                    "body": {"type": "string"},
                    "sentiment": {
                        "type": "number",
                        "description": "-1.0 to 1.0",
                    },
                },
                "required": ["headline", "body", "sentiment"],
                "additionalProperties": False,
            },
        },
        "required": ["scoring_metrics", "price_timeline", "news_article"],
        "additionalProperties": False,
    },
}


async def call_openrouter(
    messages: list[dict],
    model: str | None = None,
    max_tokens: int = 2000,
    temperature: float = 0.7,
    json_schema: dict | None = None,
) -> tuple[dict, dict]:
    """Call OpenRouter API with structured JSON output.

    Args:
        messages: Chat messages list (system + user).
        model: Model identifier. Falls back to default if None.
        max_tokens: Maximum tokens for response.
        temperature: Sampling temperature.
        json_schema: Custom JSON schema for response_format. Defaults to
            EVALUATION_SCHEMA when None (backward compatible).

    Returns:
        Tuple of (parsed_output, metadata) where:
        - parsed_output: Dict conforming to the provided schema
        - metadata: Dict with model, latency_ms, prompt_tokens, completion_tokens

    Raises:
        ValueError: If API key not configured or LLM response cannot be parsed.
        httpx.HTTPStatusError: If OpenRouter returns non-2xx status.
    """
    if not settings.OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not configured")

    if model is None:
        model = "nvidia/nemotron-3-super-120b-a12b:free"

    url = f"{settings.OPENROUTER_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://complex-game.com",
    }
    body = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "response_format": {
            "type": "json_schema",
            "json_schema": json_schema if json_schema is not None else EVALUATION_SCHEMA,
        },
    }

    start = time.monotonic()
    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(url, json=body, headers=headers)
        response.raise_for_status()

    latency_ms = int((time.monotonic() - start) * 1000)
    data = response.json()

    # Extract content from response
    raw_content = data["choices"][0]["message"]["content"]

    try:
        parsed_output = json.loads(raw_content)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Failed to parse LLM response as JSON: {e}\nRaw content: {raw_content}"
        )

    # Validate required top-level keys (T-05-01: validate before saving)
    # Only check EVALUATION_SCHEMA-specific keys when using the default schema
    if json_schema is None:
        required_keys = {"scoring_metrics", "price_timeline", "news_article"}
        missing = required_keys - set(parsed_output.keys())
        if missing:
            raise ValueError(
                f"LLM response missing required keys: {missing}\n"
                f"Raw content: {raw_content}"
            )

    # Extract usage info
    usage = data.get("usage", {})
    metadata = {
        "model": data.get("model", model),
        "latency_ms": latency_ms,
        "prompt_tokens": usage.get("prompt_tokens"),
        "completion_tokens": usage.get("completion_tokens"),
    }

    return parsed_output, metadata
