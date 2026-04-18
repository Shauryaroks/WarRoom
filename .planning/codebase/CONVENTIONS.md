# Code Conventions

**Analyzed:** 2026-04-17
**Focus:** Quality patterns

## Python Backend

### File Organization

```
server/app/
├── api/          # FastAPI route handlers
├── services/     # Business logic
├── worker/      # Celery tasks
├── models.py    # SQLAlchemy models + enums
├── main.py      # FastAPI app factory
├── database.py # DB session management
└── redis_pubsub.py # WebSocket broadcast
```

### Naming Conventions

| Element          | Convention                            | Example                                 |
| ---------------- | ------------------------------------- | --------------------------------------- |
| Database models  | PascalCase                            | `GameState`, `Team`                     |
| API routers      | snake_case                            | `game.py`, `trading.py`                 |
| Services         | snake_case                            | `game_service.py`, `trading_service.py` |
| Celery tasks     | snake_case                            | `game_tick.py`, `evaluate_solution.py`  |
| Pydantic schemas | PascalCase                            | `TeamCreate`, `TradeRequest`            |
| Enums            | PascalCase + enum suffix where needed | `TeamStatus`, `GameStatus`              |

### SQLAlchemy Model Patterns

```python
# Column definitions using Mapped type annotations
id: Mapped[int] = mapped_column(primary_key=True)
name: Mapped[str] = mapped_column(String(255))
status: Mapped[TeamStatus] = mapped_column(Enum(TeamStatus))

# Relationships use relationship() with back_populates
teams: Mapped[list["Team"]] = relationship(back_populates="game")
```

### Pydantic Schema Patterns

```python
# Request/Response with config with_config(populate_by_name=True))
class TeamCreate(ConfigMixin):
    name: str
    password: str
```

### API Route Patterns

```python
# Standard router setup
router = APIRouter(prefix="/teams", tags=["teams"])

@router.post("/", response_model=TeamPublic)
async def create_team(...) -> TeamPublic:
    return TeamPublic.model_validate(team)
```

## TypeScript Frontend

### File Organization

```
client/src/
├── components/   # React components
├── stores/      # Zustand stores
├── lib/         # Utilities, types, API
├── hooks/       # Custom React hooks
```

### Naming Conventions

| Element    | Convention | Example             |
| ---------- | ---------- | ------------------- |
| Components | PascalCase | `GameDashboard.tsx` |
| Stores     | kebab-case | `game-store.ts`     |
| Hooks      | camelCase  | `useWebSocket.ts`   |
| Types      | PascalCase | `types.ts` exports  |

### Zustand Store Pattern

```typescript
interface GameState {
  game: GameState | null;
  // ...
}
export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      game: null,
      // ...
    }),
    { name: "game-store" },
  ),
);
```

## Git Conventions

### Commit Messages

- `feat: add X` - New feature
- `fix: fix X` - Bug fix
- `refactor: restructure X` - Code reorganization
- `test: add tests for X` - Test additions
- `docs: update X` - Documentation

### Branch Naming

- `phase/NN-name` - Phase implementation
- `fix/issue-description` - Bug fixes
- `quick/date-description` - Quick tasks

## General Patterns

### Error Handling

- Backend: Raise HTTPException with status_code and detail
- Frontend: Handle in try/catch, update store on error

### Environment Configuration

- Backend: `.env` with pydantic-settings
- Use `settings.DATABASE_URL`, `settings.REDIS_URL`, etc.

### WebSocket Messages

```python
# Server broadcasts via Redis pub/sub
await publish("ws:broadcast", json.dumps(message))
```

### Authentication

- JWT in Authorization header: `Bearer <token>`
- Token contains `{sub: team_id, role: "team"|"admin"}`
