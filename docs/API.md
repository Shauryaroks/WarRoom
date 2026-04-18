<!-- generated-by: gsd-doc-writer -->
# Complex API Documentation

## Authentication

The Complex API uses standard **Bearer JWT** (JSON Web Tokens) for authentication. Tokens are generated upon successful login (`POST /api/v1/auth/login` or `POST /api/v1/admin/login`).

Include the token in the `Authorization` header for protected endpoints:

```http
Authorization: Bearer <your_jwt_token>
```

**Token Payload Claims:**
- `sub`: User ID (UUID)
- `role`: Role of the user (`strategist`, `trader`, or `admin`)
- `team_id`: Team ID (UUID, absent for admins)
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp

**WebSocket Authentication:**
WebSocket connections to `/ws` require authentication via the first message sent over the socket:
```json
{
  "type": "auth",
  "token": "<your_jwt_token>"
}
```

## Endpoints Overview

*Note: Base URL for all endpoints is `/api/v1`.*

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| **Auth** | | | |
| POST | `/auth/register` | Register a new team (creates Strategist & Trader) | No |
| POST | `/auth/login` | Login as a team member | No |
| GET | `/auth/me` | Get current user info | Yes |
| **Admin** | | | |
| POST | `/admin/login` | Admin login | No |
| GET | `/admin/teams` | List all teams | Yes (Admin) |
| POST | `/admin/teams/{id}/approve` | Approve a team registration | Yes (Admin) |
| POST | `/admin/game/start` | Start the simulation | Yes (Admin) |
| GET | `/admin/game/state` | Get overall game state | Yes (Admin) |
| POST | `/admin/broadcast` | Broadcast a message to all connected clients | Yes (Admin) |
| **Teams** | | | |
| GET | `/teams/approved` | List all approved teams | Yes |
| GET | `/teams/game-state` | Get public game state | Yes |
| **Trading** | | | |
| POST | `/trading/buy` | Execute a buy order | Yes (Trader) |
| POST | `/trading/sell` | Execute a sell order | Yes (Trader) |
| GET | `/trading/portfolio` | Get current portfolio positions | Yes (Trader) |
| **Market** | | | |
| GET | `/market/companies` | List all companies and current market data | Yes |
| GET | `/market/prices/{id}` | Get historical price data for a team | Yes |
| GET | `/market/leaderboard` | Get current leaderboard | Yes |
| GET | `/market/news` | Get latest news feed | Yes |
| **Solutions** | | | |
| POST | `/solutions/submit` | Submit a strategic solution | Yes (Strategist) |
| GET | `/solutions/my-solutions` | View past submitted solutions | Yes |
| GET | `/solutions/caseline` | Get current caseline assignment | Yes |
| **Decisions** | | | |
| POST | `/decisions/submit` | Submit business lever decisions | Yes (Strategist) |
| POST | `/decisions/operating-plan` | Submit operating plan markdown | Yes (Strategist) |
| GET | `/decisions/current` | Get currently submitted decisions | Yes |
| **Game** | | | |
| GET | `/game/phase` | Get current game phase (e.g., war_room) | Yes |
| GET | `/game/budget` | Get current team budget | Yes |

*There is also a single WebSocket endpoint at `/ws` for real-time market ticks, notifications, and events.*

## Request/Response Formats

The API expects standard JSON requests with `Content-Type: application/json` and returns JSON responses.

**Example: Submitting Business Decisions (`POST /api/v1/decisions/submit`)**

*Request Shape:*
```json
{
  "decisions": [
    {
      "lever_category": "MARKETING",
      "decisions_json": { "spend": 50000, "channel": "digital" },
      "budget_spent": 50000
    }
  ]
}
```

*Response Shape:*
```json
{
  "message": "Decisions submitted successfully",
  "decisions": [
    {
      "message": "Lever decision updated",
      "decision_id": "848bdc4a-18c7-43c8-89f5-7e8e581dc41c",
      "lever_category": "MARKETING",
      "budget_spent": "50000"
    }
  ],
  "total_budget_spent": "50000"
}
```

## Error Codes

The API relies on FastAPI's default exception handling. Error responses typically take the following shape:

```json
{
  "detail": "Descriptive error message here"
}
```
*Note: Validation errors (HTTP 422) return a more structured `detail` array describing exactly which fields failed validation.*

**Common HTTP Status Codes:**
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created (e.g., Registration).
- `400 Bad Request`: Invalid input or business logic violation (e.g., Insufficient funds for a trade).
- `401 Unauthorized`: Missing, expired, or invalid JWT token.
- `403 Forbidden`: Valid token, but insufficient permissions (e.g., Trader trying to submit a solution).
- `404 Not Found`: Resource does not exist.
- `422 Unprocessable Entity`: Request body failed schema validation.
- `500 Internal Server Error`: Unexpected server issue.

## Rate Limits

There is currently **no explicit rate limiting** configured at the application level (no Redis-backed rate limiting middleware is used). 

However, the API enforces specific business-logic "cooldowns" and state restrictions:
- Strategic solutions have a timeout/cooldown window between submissions (enforced by `GET /api/v1/solutions/cooldown` logic).
- Trading is restricted during specific game phases.
- Certain endpoints strictly enforce user roles (e.g., only the `strategist` can submit a solution, only the `trader` can execute trades).
