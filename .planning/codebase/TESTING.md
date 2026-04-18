# Testing Conventions

**Analyzed:** 2026-04-17
**Focus:** Test patterns

## Test File Organization

```
server/tests/
├── conftest.py          # Shared fixtures
├── test_game_service.py # Service tests
├── test_trading.py      # Trading endpoint tests
├── test_game_tick.py   # Celery tick tests
├── test_evaluation.py # LLM evaluation tests
└── test_simulation.py # Simulation engine tests
```

## Test Fixtures (conftest.py)

### Mocking Patterns

```python
@pytest.fixture
def mock_redis():
    """Mock Redis for async operations."""
    with patch("app.services.game_service.aioredis") as mock_aioredis:
        mock_r = AsyncMock()
        mock_aioredis.from_url.return_value = mock_r
        yield mock_r

@pytest.fixture
def mock_db():
    """Mock AsyncSession for database operations."""
    session = AsyncMock()
    return session
```

### Model Fixtures

```python
@pytest.fixture
def game_state_setup():
    """A GameState in SETUP status."""
    return GameState(id=1, status=GameStatus.SETUP, pause_offset=0, current_round=0)

@pytest.fixture
def game_state_active():
    """GameState in ACTIVE status with started_at set."""
    return GameState(
        id=1,
        status=GameStatus.ACTIVE,
        pause_offset=0,
        current_round=0,
        started_at=datetime.now(timezone.utc)
    )
```

### Test Data Patterns

```python
@pytest.fixture
def sample_team():
    """Team with basic attributes."""
    return Team(
        id=1,
        name="Test Team",
        password_hash=b"$2b$12$test",
        status=TeamStatus.READY,
        cash=Decimal("100000.00"),
        portfolio_value=Decimal("0.00"),
        game_id=1
    )

@pytest.fixture
def sample_solution():
    """Solution for evaluation."""
    return Solution(
        id=1,
        team_id=1,
        round_number=1,
        content="Test solution content",
        solution_type=SolutionType.STRATEGIC,
        status=EvaluationStatus.PENDING
    )
```

## Testing Patterns

### Service Tests

```python
@pytest.mark.asyncio
async def test_game_service_create(mock_redis, mock_db):
    """Test game creation."""
    service = GameService(session=mock_db, redis=mock_redis)
    result = await service.create_game(...)
    assert result.status == GameStatus.SETUP
```

### API Endpoint Tests

```python
@pytest.mark.asyncio
async def test_create_team(client):
    """Test team creation endpoint."""
    response = await client.post("/teams/", json={"name": "Test", "password": "pass"})
    assert response.status_code == 201
```

### Celery Task Tests

```python
@pytest.mark.asyncio
async def test_game_tick():
    """Test game tick task."""
    result = await game_tick.run()
    assert result is not None
```

## Client-Side Testing

### Store Tests (Zustand)

```typescript
describe("game store", () => {
  it("updates game state", () => {
    const { result } = renderHook(() => useGameStore());
    act(() => {
      result.current.setGame(mockGame);
    });
    expect(result.current.game).toEqual(mockGame);
  });
});
```

## Run Commands

```bash
# Backend tests
cd server && uv run pytest

# Frontend tests (if configured)
cd client && npm test
```

## Test Coverage Goals

- Core services: >80%
- API endpoints: All routes tested
- Critical paths: Buy/sell transactions, solution submission, game tick
