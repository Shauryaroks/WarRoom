<!-- generated-by: gsd-doc-writer -->
# Configuration

This document outlines the environment variables and configuration settings required to run the Complex platform.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Optional | `postgresql+asyncpg://postgres:postgres@localhost:5432/complex` | Database connection string. Production use requires setting to actual DB. |
| `REDIS_URL` | Optional | `redis://localhost:6379/0` | Redis connection string used for caching, pub/sub, and Celery backend. |
| `OPENROUTER_API_KEY` | Required* | `""` | API key for OpenRouter LLM integrations. Operations that call LLMs will fail if this is empty. |
| `OPENROUTER_BASE_URL` | Optional | `https://openrouter.ai/api/v1` | Base URL for LLM API calls. |
| `JWT_SECRET` | Required* | `""` | Secret key used to sign JWT authentication tokens. Application will likely throw validation errors if missing in production. |
| `JWT_ALGORITHM` | Optional | `HS256` | Algorithm used for JWT signing. |
| `JWT_EXPIRY_HOURS` | Optional | `24` | Token expiration time in hours. |
| `NEXT_PUBLIC_API_URL` | Optional | `http://localhost:8080` | Client-side setting for the backend API base URL. |
| `NEXT_PUBLIC_WS_URL` | Optional | `ws://localhost:8080` | Client-side setting for the WebSocket connection URL. |

*\* Note: Technically defined with an empty string default in Pydantic, but required for functioning application logic.*

<!-- VERIFY: external service URLs or dashboard links for OpenRouter or deployment environments -->
<!-- VERIFY: Database cluster names, cloud region identifiers, and CDN configuration -->
<!-- VERIFY: Actual production values or secrets not stored in repo -->

## Config File Format

The backend utilizes `pydantic-settings` to load environment variables from `.env` files. The primary configuration block is defined in `server/app/database.py`:

```python
class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/complex"
    REDIS_URL: str = "redis://localhost:6379/0"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    # JWT configuration (per D-04)
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
```

The frontend relies on standard Next.js `.env` loading conventions, exposing variables prefixed with `NEXT_PUBLIC_` to the browser environment.

## Required vs Optional Settings

While `pydantic-settings` supplies default empty strings for `OPENROUTER_API_KEY` and `JWT_SECRET`, these must be populated for normal application functionality:
- `JWT_SECRET`: Used to generate and validate authentication tokens.
- `OPENROUTER_API_KEY`: Required for evaluating case solutions via the OpenRouter API.

All other settings provide sensible local defaults but should be overridden in production environments (e.g., pointing to remote PostgreSQL or Redis instances).

## Defaults

- **`DATABASE_URL`**: defaults to `postgresql+asyncpg://postgres:postgres@localhost:5432/complex`
- **`REDIS_URL`**: defaults to `redis://localhost:6379/0`
- **`NEXT_PUBLIC_API_URL`**: defaults to `http://localhost:8080`
- **`NEXT_PUBLIC_WS_URL`**: defaults to `ws://localhost:8080`

## Per-Environment Overrides

- **Local Development**: Copy `server/.env.example` to `server/.env` and update values. Run the Next.js frontend with its own `.env` configuration for `NEXT_PUBLIC_` variables.
- **Docker Compose**: The `docker-compose.yml` file overrides the database URL for the API service to resolve PostgreSQL over the Docker network (`db:5432`).
- **Production/Deployment**: Set these environment variables directly within your deployment platform (e.g., Vercel for the frontend, Fly.io/Railway/Docker environments for the backend). Ensure `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, and `OPENROUTER_API_KEY` are all populated with secure production credentials.
