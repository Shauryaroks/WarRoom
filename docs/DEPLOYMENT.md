<!-- generated-by: gsd-doc-writer -->

# Deployment

## Deployment Targets

The project uses two primary deployment targets for the frontend and backend applications:

- **Frontend (Next.js):** Deployed to Vercel. Configuration is primarily managed via standard Next.js conventions and the deployment is automated in `.github/workflows/deploy-frontend.yml`.
- **Backend (FastAPI/Postgres/Redis/Celery):** Containerized using Docker and Docker Compose (`docker-compose.yml`), and reverse-proxied with Caddy (`Caddyfile`). The entire stack is deployed to a single Linux server instance via SSH, automated in `.github/workflows/deploy-backend.yml`.

## Build Pipeline

The CI/CD build pipeline is automated through two separate GitHub Actions workflows triggered on pushes to the `master` branch:

1.  **Deploy Frontend:**
    - **Trigger:** Push to `master` with changes in `client/**`.
    - **Pipeline:** Checks out the codebase, removes the `.git` folder, and uses the Vercel CLI (`npx vercel --prod`) to deploy the frontend.
    - **Required Secrets:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

2.  **Deploy Backend:**
    - **Trigger:** Push to `master` with changes outside of `client/**`.
    - **Pipeline:** Uses `appleboy/ssh-action` to SSH into the production server. It fetches the latest `master` branch via a GitHub token, builds the `api` and `worker` Docker containers (`docker compose build api worker`), and starts them detached (`docker compose up -d`).

## Environment Setup

The production deployment requires specific environment variables to function correctly. See `docs/CONFIGURATION.md` for a comprehensive overview.

### Frontend (Vercel)

Set the following variables in the Vercel dashboard:

- `NEXT_PUBLIC_API_URL`: <!-- VERIFY: The production URL of the backend API -->
- `NEXT_PUBLIC_WS_URL`: <!-- VERIFY: The production WebSocket URL of the backend API -->
- `NEXT_PUBLIC_ADMIN_API_KEY`: <!-- VERIFY: The secret key for admin authentication -->

### Backend (Server)

These variables must be populated in a `.env` file located in the `server/` directory on the production server:

- `DATABASE_URL`: Connection string for Postgres (defaults to `postgresql+asyncpg://postgres:postgres@db:5432/complex` in Compose).
- `REDIS_URL`: Connection string for Redis (defaults to `redis://redis:6379/0`).
- `JWT_SECRET`: A secure, randomly generated 64-character string. <!-- VERIFY: Secret value generated for the production environment -->
- `OPENROUTER_API_KEY`: A valid OpenRouter API key. <!-- VERIFY: OpenRouter production API key -->
- `OPENROUTER_BASE_URL`: Base URL for OpenRouter (defaults to `https://openrouter.ai/api/v1`).

_Note: The Caddy configuration currently sets the backend domain as `api-complex.helixtiet.in`. Ensure the DNS A record for this domain points to the server's public IP._

## Rollback Procedure

If a deployment introduces critical issues, the application can be rolled back using the following procedures:

1.  **Frontend (Vercel):**
    - Navigate to the project in the Vercel dashboard.
    - Go to the "Deployments" tab.
    - Select a previous, known-good deployment and click "Promote to Production" (or "Redeploy"). Alternatively, revert the commit on the `master` branch and push to trigger a new build.

2.  **Backend (Server):**
    - Revert the faulty commit on the `master` branch and push to trigger the `Deploy Backend` workflow.
    - Alternatively, SSH into the production server manually, navigate to the deployment directory (`DEPLOY_PATH`), check out an older working commit using `git checkout <commit-hash>`, and rebuild the containers using `docker compose up -d --build`.

## Monitoring

Currently, no dedicated APM or monitoring solutions (e.g., Sentry, Datadog) are configured for the application.

- **Backend Visibility:** Status and logs must be reviewed by SSH-ing into the server and inspecting container logs (`docker compose logs -f api worker caddy`).
- **Frontend Visibility:** Next.js deployment logs and basic analytics are available through the Vercel dashboard. <!-- VERIFY: Dashboard URL for the Vercel project -->
