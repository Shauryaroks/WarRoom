"""Test fixtures for Complex backend tests."""

import uuid

import pytest
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from app.models import (
    Evaluation,
    EvaluationStatus,
    GameState,
    GameStatus,
    Solution,
    SolutionType,
    Team,
    TeamStatus,
)


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


@pytest.fixture
def mock_team():
    """A mock ACTIVE team for testing."""
    team = Team(
        id=uuid.uuid4(),
        name="Test Corp",
        ticker="TEST",
        strategist_email="strat@test.com",
        strategist_password_hash="hash",
        trader_email="trader@test.com",
        trader_password_hash="hash",
        status=TeamStatus.ACTIVE,
        stock_price=Decimal("100.00"),
        cash=Decimal("1000000"),
        shares_outstanding=1000000,
        caseline_document="# Test Corp Caseline\n\nTech startup in AI sector.",
    )
    return team


@pytest.fixture
def mock_solution(mock_team):
    """A mock solution for testing."""
    return Solution(
        id=uuid.uuid4(),
        team_id=mock_team.id,
        content="Our strategy is to expand into new markets...",
        solution_type=SolutionType.INITIAL,
    )


@pytest.fixture
def mock_evaluation(mock_solution, mock_team):
    """A mock PENDING_APPROVAL evaluation."""
    return Evaluation(
        id=uuid.uuid4(),
        solution_id=mock_solution.id,
        team_id=mock_team.id,
        status=EvaluationStatus.PENDING_APPROVAL,
        scoring_metrics='{"strategic_quality": 0.7, "feasibility": 0.6, "innovation": 0.8, "market_awareness": 0.5, "overall_score": 0.65}',
        overall_score=0.65,
        price_timeline='[{"month": 1, "price_change_pct": 3.0}, {"month": 2, "price_change_pct": 5.0}, {"month": 3, "price_change_pct": 2.0}]',
        news_headline="Test Corp Announces Expansion",
        news_body="Test Corp revealed plans to expand...",
        news_sentiment=Decimal("0.60"),
    )
