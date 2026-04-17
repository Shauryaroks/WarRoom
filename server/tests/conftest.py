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


# ============================================================
# Phase 9 fixtures (enhanced simulation engine)
# ============================================================

import json  # noqa: E402
import pytest_asyncio  # noqa: E402

from app.models import (  # noqa: E402
    Archetype,
    FundamentalEvalStatus,
    FundamentalEvaluation,
    PendingShock,
    ShockSource,
)


@pytest_asyncio.fixture
async def mock_archetype_with_bands(mock_db):
    """Archetype with deterministic benchmark bands for Phase 9 tests.

    Bands chosen so midpoints are round numbers:
    market_share mid=15, margin mid=10, growth mid=5, ops_efficiency mid=70.
    """
    bands = {
        "market_share": [10, 20],
        "margin": [5, 15],
        "growth": [2, 8],
        "ops_efficiency": [60, 80],
    }
    archetype = Archetype(
        id=uuid.uuid4(),
        name="Test Archetype",
        slug="test-archetype",
        description="Test archetype for Phase 9 fixtures",
        sector="FOODS",
        dossier_content="Test dossier",
        benchmark_bands=json.dumps(bands),
        starting_cash=Decimal("1000000.00"),
        starting_stock_price=Decimal("100.00"),
        starting_shares=1_000_000,
        swot_strengths="s",
        swot_weaknesses="w",
        swot_opportunities="o",
        swot_threats="t",
        is_preset=False,
    )
    mock_db.add(archetype)
    await mock_db.flush()
    return archetype


@pytest_asyncio.fixture
async def mock_team_with_fundamentals(mock_db, mock_archetype_with_bands):
    """Team with fundamentals at band midpoints (MS=15, margin=10, growth=5, ops=70)."""
    team = Team(
        id=uuid.uuid4(),
        name="TestTeam",
        ticker="TEST",
        strategist_email="strat-phase9@test.com",
        strategist_password_hash="hash",
        trader_email="trader-phase9@test.com",
        trader_password_hash="hash",
        stock_price=Decimal("100.00"),
        shares_outstanding=1_000_000,
        cash=Decimal("1000000.00"),
        status=TeamStatus.ACTIVE,
        archetype_id=mock_archetype_with_bands.id,
        fundamental_market_share=Decimal("15.0000"),
        fundamental_margin=Decimal("10.0000"),
        fundamental_growth=Decimal("5.0000"),
        fundamental_ops_efficiency=Decimal("70.0000"),
        drift_target_pct=None,
        drift_floor_pct=None,
        ramp_started_at=None,
    )
    mock_db.add(team)
    await mock_db.flush()
    return team


@pytest_asyncio.fixture
async def mock_fundamental_evaluation(mock_db, mock_team_with_fundamentals):
    """FundamentalEvaluation PENDING_APPROVAL for the team-with-fundamentals fixture."""
    evaluation = FundamentalEvaluation(
        id=uuid.uuid4(),
        team_id=mock_team_with_fundamentals.id,
        round_number=1,
        proposed_deltas=json.dumps(
            {
                "market_share_delta": 1.0,
                "margin_delta": 0.5,
                "growth_delta": 0.3,
                "ops_efficiency_delta": 2.0,
            }
        ),
        admin_edits=None,
        narrative="Strong quarter, modest gains",
        status=FundamentalEvalStatus.PENDING_APPROVAL,
    )
    mock_db.add(evaluation)
    await mock_db.flush()
    return evaluation


@pytest_asyncio.fixture
async def mock_pending_shock(mock_db, mock_team_with_fundamentals):
    """Unapplied +8% LLM_EVENT shock for team-with-fundamentals."""
    shock = PendingShock(
        id=uuid.uuid4(),
        team_id=mock_team_with_fundamentals.id,
        magnitude_pct=Decimal("8.000"),
        source=ShockSource.LLM_EVENT,
        source_ref_id=None,
        applied_at=None,
    )
    mock_db.add(shock)
    await mock_db.flush()
    return shock
