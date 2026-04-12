FROM python:3.13-slim

# Install uv.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Create app directory
RUN mkdir -p /app
WORKDIR /app

# Copy only dependency files first
COPY pyproject.toml uv.lock ./

# Install the application dependencies
RUN uv sync --frozen --no-cache

# Copy the application code
COPY . .

# Use 'uv run' to execute the application
# Run migrations then start the app (same behavior in local Docker and deployment)
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 80"]
