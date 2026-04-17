FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Put venv outside /app so the dev bind-mount (./server:/app) doesn't hide it.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ENV UV_PYTHON=/usr/local/bin/python3
ENV PATH=/opt/venv/bin:$PATH
ENV UV_LINK_MODE=copy

WORKDIR /app

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies into /opt/venv (bound to system Python 3.12)
RUN uv sync --frozen --no-cache

# Copy application code
COPY . .

# Run app. `uv run` now uses /opt/venv because of UV_PROJECT_ENVIRONMENT.
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 80"]
