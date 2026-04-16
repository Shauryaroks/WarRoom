"""Tests for game service state machine and timer calculation."""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.models import GameState, GameStatus
from app.services.game_service import (
    VALID_TRANSITIONS,
    calculate_elapsed_seconds,
    transition_state,
)


# --- Valid Transitions ---


async def test_start_game_from_setup(mock_db, mock_redis, game_state_setup):
    """SETUP -> ACTIVE sets started_at and status=ACTIVE."""
    # Mock get_game_state to return our setup state
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = game_state_setup
    mock_db.execute.return_value = mock_result

    with patch("app.services.game_service.publish_broadcast", new_callable=AsyncMock):
        state = await transition_state(mock_db, GameStatus.ACTIVE)

    assert state.status == GameStatus.ACTIVE
    assert state.started_at is not None
    mock_db.commit.assert_awaited_once()


async def test_pause_game(mock_db, mock_redis, game_state_active):
    """ACTIVE -> PAUSED sets paused_at and status=PAUSED."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = game_state_active
    mock_db.execute.return_value = mock_result

    with patch("app.services.game_service.publish_broadcast", new_callable=AsyncMock):
        state = await transition_state(mock_db, GameStatus.PAUSED)

    assert state.status == GameStatus.PAUSED
    assert state.paused_at is not None


async def test_resume_game(mock_db, mock_redis, game_state_paused):
    """PAUSED -> ACTIVE accumulates pause_offset, clears paused_at, sets resumed_at."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = game_state_paused
    mock_db.execute.return_value = mock_result

    with patch("app.services.game_service.publish_broadcast", new_callable=AsyncMock):
        state = await transition_state(mock_db, GameStatus.ACTIVE)

    assert state.status == GameStatus.ACTIVE
    assert state.pause_offset > 0  # Should have accumulated pause duration
    assert state.paused_at is None
    assert state.resumed_at is not None


# --- Invalid Transitions ---


async def test_invalid_setup_to_paused(mock_db, mock_redis, game_state_setup):
    """SETUP -> PAUSED should raise ValueError."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = game_state_setup
    mock_db.execute.return_value = mock_result

    with pytest.raises(ValueError, match="Invalid transition"):
        await transition_state(mock_db, GameStatus.PAUSED)


async def test_invalid_finished_to_active(mock_db, mock_redis):
    """FINISHED -> ACTIVE should raise ValueError (terminal state)."""
    finished_state = GameState(
        id=1,
        status=GameStatus.FINISHED,
        started_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        finished_at=datetime(2026, 1, 1, 1, 0, 0, tzinfo=timezone.utc),
        pause_offset=0,
        current_round=1,
    )
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = finished_state
    mock_db.execute.return_value = mock_result

    with pytest.raises(ValueError, match="Invalid transition"):
        await transition_state(mock_db, GameStatus.ACTIVE)


# --- Timer Calculation (pure function tests) ---


def test_elapsed_zero_when_not_started():
    """calculate_elapsed_seconds returns 0 when started_at is None."""
    state = GameState(id=1, status=GameStatus.SETUP, pause_offset=0, current_round=0)
    assert calculate_elapsed_seconds(state) == 0


def test_elapsed_freezes_when_paused():
    """When PAUSED, elapsed = (paused_at - started_at) - pause_offset."""
    state = GameState(
        id=1,
        status=GameStatus.PAUSED,
        started_at=datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
        paused_at=datetime(2026, 1, 1, 0, 10, 0, tzinfo=timezone.utc),
        pause_offset=0,
        current_round=1,
    )
    elapsed = calculate_elapsed_seconds(state)
    assert elapsed == 600  # 10 minutes = 600 seconds


def test_elapsed_excludes_pause_duration():
    """After resume, elapsed excludes paused time via pause_offset."""
    now = datetime.now(timezone.utc)
    state = GameState(
        id=1,
        status=GameStatus.ACTIVE,
        started_at=now - timedelta(minutes=20),
        resumed_at=now - timedelta(minutes=5),
        pause_offset=300,  # 5 minutes of paused time
        current_round=1,
    )
    elapsed = calculate_elapsed_seconds(state)
    # Total = ~20 min = ~1200s, minus 300s pause_offset = ~900s
    assert 895 <= elapsed <= 905  # Allow 5s tolerance for test execution time


# --- VALID_TRANSITIONS coverage ---


def test_valid_transitions_covers_all_states():
    """VALID_TRANSITIONS dict covers all 4 GameStatus values."""
    assert len(VALID_TRANSITIONS) == 4
    for status in GameStatus:
        assert status in VALID_TRANSITIONS


def test_finished_is_terminal():
    """FINISHED state has no valid transitions (terminal)."""
    assert VALID_TRANSITIONS[GameStatus.FINISHED] == set()
