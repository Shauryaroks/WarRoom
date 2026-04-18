# Technology Stack

**Analysis Date:** 2026-04-17

## Frontend (client/)

### Core Dependencies

| Technology               | Version | Purpose                      | Notes                                   |
| ------------------------ | ------- | ---------------------------- | --------------------------------------- |
| Next.js                  | 16.2.3  | React framework              | App Router, Turbopack bundler           |
| React                    | 19.2.4  | UI library                   | -                                       |
| React DOM                | 19.2.4  | React renderer               | -                                       |
| Zustand                  | 5.0.12  | Client state management      | For game state, portfolio, stock prices |
| lightweight-charts       | 5.1.0   | Financial candlestick charts | TradingView library                     |
| Zod                      | 4.3.6   | Schema validation            | Forms, API responses                    |
| Tailwind CSS             | 4       | Styling                      | PostCSS plugin                          |
| lucide-react             | 1.8.0   | Icons                        | Tree-shakeable icon set                 |
| next-themes              | 0.4.6   | Theme provider               | Dark mode support                       |
| sonner                   | 2.0.7   | Toast notifications          | -                                       |
| class-variance-authority | 0.7.1   | Component variants           | shadcn/ui dependency                    |
| tailwind-merge           | 3.5.0   | Tailwind class merging       | -                                       |
| clsx                     | 2.1.1   | Conditional class names      | -                                       |
| tw-animate-css           | 1.4.0   | Animation utilities          | -                                       |
| @base-ui/react           | 1.4.0   | UI primitives                | -                                       |
| react-markdown           | 10.1.0  | Markdown rendering           | -                                       |
| shadcn                   | 4.2.0   | UI component generator       | CLI tool                                |

### Dev Dependencies

| Technology           | Version | Purpose                     | Notes                      |
| -------------------- | ------- | --------------------------- | -------------------------- |
| ESLint               | 9       | Linting                     | -                          |
| eslint-config-next   | 16.2.3  | Next.js ESLint config       | Includes React hooks rules |
| TypeScript           | 5       | Type checking               | -                          |
| Tailwind CSS         | 4       | Styling                     | -                          |
| @tailwindcss/postcss | 4       | PostCSS plugin for Tailwind | -                          |
| @types/react         | 19      | TypeScript types            | -                          |
| @types/react-dom     | 19      | TypeScript types            | -                          |
| @types/node          | 20      | TypeScript types            | -                          |

---

## Backend (server/)

### Core Dependencies

| Technology        | Version   | Purpose                    | Notes                              |
| ----------------- | --------- | -------------------------- | ---------------------------------- |
| FastAPI           | >=0.135.3 | Web API + WebSocket server | Starlette-based async framework    |
| SQLAlchemy        | >=2.0.49  | ORM (async mode)           | `sqlalchemy[asyncio]` extras       |
| asyncpg           | >=0.29.0  | PostgreSQL async driver    | Required for SQLAlchemy async      |
| Celery            | >=5.6.3   | Background task queue      | `celery[redis]` extras             |
| Redis             | 5.2.0-6.5 | Cache + Celery broker      | `redis.asyncio` for pub/sub        |
| Pydantic          | >=2.9.0   | Data validation            | Request/response models            |
| pydantic-settings | >=2.0.0   | Environment config         | Loads `.env` files                 |
| Alembic           | >=1.18.4  | Database migrations        | Async support                      |
| PyJWT             | >=2.9.0   | JWT token handling         | Replaces python-jose               |
| websockets        | >=12.0    | WebSocket server           | FastAPI uses Starlette's native ws |
| bcrypt            | >=4.1.0   | Password hashing           | -                                  |
| httpx             | >=0.27.0  | Async HTTP client          | For OpenRouter API calls           |
| python-dotenv     | >=1.0.0   | Environment loading        | -                                  |
| pyyaml            | >=6.0     | YAML parsing               | -                                  |

### Python Version

| Technology | Version      | Purpose | Notes                |
| ---------- | ------------ | ------- | -------------------- |
| Python     | >=3.11,<3.14 | Runtime | Excludes 3.14 (beta) |

### Dev Dependencies

| Technology     | Version  | Purpose              | Notes                       |
| -------------- | -------- | -------------------- | --------------------------- |
| pytest         | >=8.0.0  | Test runner          | -                           |
| pytest-asyncio | >=0.23.0 | Async test support   | `asyncio_mode = "auto"`     |
| Ruff           | >=0.3.0  | Linting + formatting | Replaces flake8+black+isort |
| mypy           | >=1.8.0  | Type checking        | With SQLAlchemy stubs       |

---

## Infrastructure (docker-compose.yml)

### Services

| Technology      | Version   | Purpose                         | Notes                          |
| --------------- | --------- | ------------------------------- | ------------------------------ |
| PostgreSQL      | 15        | Primary database                | ACID for transaction integrity |
| Redis           | 7         | Cache + pub/sub + Celery broker | -                              |
| Caddy           | 2         | Reverse proxy + auto-TLS        | WebSocket proxying             |
| Python (api)    | 3.12-slim | API container                   | Built from server/             |
| Python (worker) | 3.12-slim | Celery worker container         | Runs Beat scheduler            |

### Build Contexts

| Service | Build Path | Entrypoint                                                             |
| ------- | ---------- | ---------------------------------------------------------------------- |
| api     | `./server` | `uv run uvicorn app.main:app --host 0.0.0.0 --port 80`                 |
| worker  | `./server` | `uv run celery -A app.worker.celery_app worker --beat --loglevel=info` |

---

## Key Database Configuration

**SQLAlchemy Async Engine** (`server/app/database.py`):

```python
engine = create_async_engine(
    settings.DATABASE_URL,  # postgresql+asyncpg://...
    echo=False,
    pool_size=20,
    max_overflow=0,
    connect_args={"prepared_statement_cache_size": 0},
)
```

**Celery Configuration** (`server/app/worker/celery_app.py`):

- Broker/Backend: `redis://redis:6379/0`
- Task serializer: JSON
- `beat_schedule`: game tick every 60 seconds for stock price updates

---

_Stack analysis: 2026-04-17_
