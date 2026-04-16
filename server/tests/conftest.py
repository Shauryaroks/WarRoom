"""Test fixtures for Complex backend tests."""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.models import GameState, GameStatus


@pytest.fixture
def mock_redis():
    """Mock Redis for async operations (game_service uses redis.asyncio)."""
    with patch("app.services.game_service.aioredis") as mock_aioredis:
        mock_r = AsyncMock()
        mock_aioredis.from_url.return_value = mock_r
        yield mock_r


@pytest.fixture
def mock_db():
    """Mock AsyncSession for database operations."""
    session = AsyncMock()
    return session


@pytest.fixture
def game_state_setup():
    """A GameState in SETUP status."""
    state = GameState(id=1, status=GameStatus.SETUP, pause_offset=0, current_round=0)
    return state


@pytest.fixture
def game_state_active():
    """A GameState in ACTIVE status with started_at set."""
    state = GameState(
        id=1,
        status=GameStatus.ACTIVE,
        started_at=datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
        pause_offset=0,
        current_round=1,
    )
    return state


@pytest.fixture
def game_state_paused():
    """A GameState in PAUSED status with paused_at set."""
    state = GameState(
        id=1,
        status=GameStatus.PAUSED,
        started_at=datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
        paused_at=datetime(2026, 1, 1, 0, 10, 0, tzinfo=timezone.utc),
        pause_offset=0,
        current_round=1,
    )
    return state
