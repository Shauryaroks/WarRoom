<!-- generated-by: gsd-doc-writer -->

# Development Guide

This document outlines how to set up the Complex Case Competition Platform for local development, along with our coding standards and build processes.

## Local Setup

The project consists of a Next.js frontend and a FastAPI backend with PostgreSQL and Redis. For local development, it is recommended to run the database and cache using Docker, while running the frontend and backend servers natively for better debugging and hot-reloading.

### 1. Prerequisites

- Docker and Docker Compose
- Node.js (>= 18)
- Python (>= 3.11, < 3.14)
- `uv` (Python package manager)

### 2. Infrastructure Setup

Start the required background services (PostgreSQL and Redis) using Docker Compose:

```bash
docker compose up db redis -d
```

### 3. Backend Setup

Configure and start the FastAPI application:

```bash
cd server
cp .env.example .env
```

_Note: Update `DATABASE_URL` and `REDIS_URL` in `server/.env` to point to `localhost` (e.g., `postgresql+asyncpg://postgres:postgres@localhost:5432/complex` and `redis://localhost:6379/0`) if running outside of Docker._

```bash
# Install dependencies using uv
uv sync --all-extras

# Initialize the database (run Alembic migrations and create tables)
uv run python init_db.py

# Start the development server with hot-reloading
uv run uvicorn app.main:app --reload --port 8000
```

### 4. Frontend Setup

Configure and start the Next.js application:

```bash
cd client
cp .env .env.local
```

_Note: You may need to update `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` in `.env.local` to point to your local backend (e.g., `http://localhost:8000/api/v1`)._

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

## Build Commands

### Frontend (`client/package.json`)

| Command         | Description                                                    |
| --------------- | -------------------------------------------------------------- |
| `npm run dev`   | Starts the Next.js development server with hot-reloading.      |
| `npm run build` | Creates an optimized production build of the Next.js app.      |
| `npm run start` | Starts the Next.js production server (requires a prior build). |
| `npm run lint`  | Runs ESLint to check for code quality and style issues.        |

### Backend (`server/uv`)

| Command                                                | Description                                            |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `uv sync --all-extras`                                 | Installs all Python dependencies, including dev tools. |
| `uv run uvicorn app.main:app --reload`                 | Starts the FastAPI development server.                 |
| `uv run celery -A app.worker.celery_app worker --beat` | Starts the Celery worker for background tasks.         |
| `uv run pytest`                                        | Runs the backend test suite.                           |

## Code Style

We use automated tools to maintain code quality across both the frontend and backend.

### Frontend

- **Linter**: ESLint (configured via `eslint-config-next` in `client/package.json`)
- **Run**: `npm run lint` from the `client/` directory.

### Backend

- **Linter & Formatter**: Ruff
- **Type Checker**: Mypy
- **Run Linting**: `uv run ruff check .`
- **Run Formatting**: `uv run ruff format .`
- **Run Type Checking**: `uv run mypy .`

## Branch Conventions

`No convention documented.`

## PR Process

While formal guidelines have not been established, please follow these general best practices when submitting a Pull Request:

- Ensure all local tests and linting checks pass before opening a PR.
- Provide a clear and descriptive summary of the changes in your PR description.
- Keep PRs focused on a single feature, bug fix, or improvement.
- Address any code review feedback promptly.
