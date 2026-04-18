<!-- generated-by: gsd-doc-writer -->
## Getting Started

### Prerequisites

- **Docker and Docker Compose**: Required to run the database, cache, and backend services.
- **Node.js**: >= 20.0.0
- **npm**: Comes with Node.js
- **Python**: >= 3.11, < 3.14 (If running the backend locally outside of Docker)
- **uv**: Python package manager (Recommended for local backend development)

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd complex
   ```

2. **Configure Backend Environment Variables:**
   ```bash
   cd server
   cp .env.example .env
   ```
   Open `server/.env` and configure your credentials. Crucially, you must provide a valid `OPENROUTER_API_KEY` for the LLM evaluation features, and set a secure `JWT_SECRET`.

3. **Configure Frontend Environment Variables:**
   Create a `.env` file in the `client/` directory with the following configuration for local development:
   ```bash
   cd ../client
   echo 'NEXT_PUBLIC_API_URL="http://localhost:8080/api/v1"' > .env
   echo 'NEXT_PUBLIC_WS_URL="ws://localhost:8080"' >> .env
   echo 'NEXT_PUBLIC_ADMIN_API_KEY="admin-secret-key"' >> .env
   cd ..
   ```

4. **Install Frontend Dependencies:**
   ```bash
   cd client
   npm install
   cd ..
   ```

### First Run

1. **Start the Backend Services:**
   The application uses Docker Compose to run PostgreSQL, Redis, FastAPI, Celery, and Caddy.
   ```bash
   docker compose up --build -d
   ```

2. **Run Database Migrations:**
   Once the containers are healthy, apply the Alembic migrations to set up the database schema:
   ```bash
   docker compose exec api uv run alembic upgrade head
   ```

3. **Start the Frontend Development Server:**
   ```bash
   cd client
   npm run dev
   ```
   The frontend application will now be available at `http://localhost:3000`.

### Common Setup Issues

- **Database / Port Conflicts:** The backend requires local ports `5432` (PostgreSQL), `6379` (Redis), `8080` (HTTP), and `443` (HTTPS via Caddy). If any of these are already in use on your machine, the `docker compose up` command will fail.
- **LLM Features Failing:** Ensure you have added a valid OpenRouter API key to `server/.env`.
- **WebSocket Disconnections:** If real-time features aren't working locally, ensure the `NEXT_PUBLIC_WS_URL` in your frontend environment correctly matches the Caddy endpoint (e.g., `ws://localhost:8080`).

### Next Steps

- Check out [DEVELOPMENT.md](DEVELOPMENT.md) for detailed local setup instructions, code style, and build commands.
- See [TESTING.md](TESTING.md) to understand the test suite setup and coverage requirements.
- Review [CONFIGURATION.md](CONFIGURATION.md) for a comprehensive list of all environment variables.
