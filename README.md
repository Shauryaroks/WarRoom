<!-- generated-by: gsd-doc-writer -->

# Complex — Case Competition Platform

A real-time case competition platform where 32-40 teams compete by solving business caselines, submitting strategic solutions evaluated by an LLM with human-in-the-loop validation, and trading stocks in each other's companies.

## Installation

```bash
# Clone the repository
git clone <remote-url>
cd complex

# 1. Prepare backend environment
cp server/.env.example server/.env
# Edit server/.env to include OPENROUTER_API_KEY and JWT_SECRET

# 2. Install frontend dependencies
cd client
pnpm install
```

## Quick Start

```bash
# 1. Bring up the backend stack (PostgreSQL, Redis, FastAPI API, Celery worker, Caddy proxy)
docker compose up -d

# 2. Seed admin credentials and archetypes into the database
curl -X POST http://localhost:8080/api/v1/admin/seed
# Replace <ADMIN_TOKEN> with the JWT received or generated
curl -X POST http://localhost:8080/api/v1/admin/archetypes/seed \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# 3. Start the frontend development server
cd client
pnpm dev
# Application running at http://localhost:3000
```

## Usage Examples

**Access the Admin Portal:**
Login at `http://localhost:3000/auth/admin` using `admin@complex.com` to view the 8-tab dashboard, manage teams, and control the case competition phases.

**Access Backend API Documentation:**
FastAPI automatically serves OpenAPI documentation at:

```bash
http://localhost:8080/docs
```

**Check Public Game State:**

```bash
curl http://localhost:8080/api/v1/teams/game-state
```
