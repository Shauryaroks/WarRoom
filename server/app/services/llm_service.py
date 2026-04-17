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

    # Model preference order: caller-specified > primary > fallbacks.
    # Fallbacks only fire if the primary returns invalid JSON (common with free models).
    # Order chosen based on observed availability + JSON-schema reliability on this account.
    PRIMARY_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
    FALLBACK_MODELS = [
        "openai/gpt-oss-20b:free",
        "meta-llama/llama-3.3-70b-instruct:free",
    ]

    if model is None:
        model_chain = [PRIMARY_MODEL] + FALLBACK_MODELS
    else:
        # Caller explicitly specified — still give one fallback attempt
        model_chain = [model] + [m for m in FALLBACK_MODELS if m != model][:1]

    url = f"{settings.OPENROUTER_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://complex-game.com",
    }

    last_error: str = ""
    last_raw: str = ""
    for attempt_model in model_chain:
        body = {
            "model": attempt_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "response_format": {
                "type": "json_schema",
                "json_schema": json_schema if json_schema is not None else EVALUATION_SCHEMA,
            },
        }

        start = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post(url, json=body, headers=headers)
                response.raise_for_status()
        except httpx.HTTPStatusError as e:
            last_error = f"HTTP {e.response.status_code} from {attempt_model}: {e.response.text[:300]}"
            logger.warning("LLM call failed on %s, trying next: %s", attempt_model, last_error)
            continue
        except httpx.TimeoutException:
            last_error = f"Timeout from {attempt_model}"
            logger.warning("LLM timeout on %s, trying next", attempt_model)
            continue

        latency_ms = int((time.monotonic() - start) * 1000)
        data = response.json()

        # Extract content defensively — some models / error responses omit `choices`
        try:
            raw_content = data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as e:
            last_error = f"Malformed response shape from {attempt_model}: {e}. Body: {str(data)[:300]}"
            logger.warning("%s — trying next", last_error)
            continue
        last_raw = raw_content

        try:
            parsed_output = json.loads(raw_content)
        except json.JSONDecodeError as e:
            last_error = f"JSON parse failed for {attempt_model}: {e}"
            logger.warning(
                "LLM returned non-JSON on %s (raw=%r), trying next",
                attempt_model,
                raw_content[:200],
            )
            continue

        # Success — fell through
        logger.info(
            "LLM call succeeded on %s (latency=%dms)", attempt_model, latency_ms
        )
        break
    else:
        # Exhausted all models without valid JSON
        raise ValueError(
            f"All LLM models failed to return valid JSON. "
            f"Last error: {last_error}. Last raw: {last_raw[:300]}"
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
        "model": data.get("model", attempt_model),
        "latency_ms": latency_ms,
        "prompt_tokens": usage.get("prompt_tokens"),
        "completion_tokens": usage.get("completion_tokens"),
    }

    return parsed_output, metadata
