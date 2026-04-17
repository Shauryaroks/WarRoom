"""Tests for solution submission endpoints (Phase 5 Plan 02).

Covers: SOLN-01 (1-hour window), SOLN-03 (cooldown), SOLN-04 (cooldown tracking),
T-05-05 (role check), T-05-06 (server-side time validation).
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.database import get_db
from app.auth_utils import require_team
from app.models import (
    GameState,
    GameStatus,
    Solution,
    SolutionType,
    Team,
    TeamStatus,
)


# --- Fixtures ---


@pytest.fixture
def strategist_user():
    """Fake strategist user dict returned by require_team."""
    team_id = uuid.uuid4()
    return {
        "id": uuid.uuid4(),
        "role": "strategist",
        "team_id": team_id,
        "entity": MagicMock(),
    }


@pytest.fixture
def trader_user():
    """Fake trader user dict returned by require_team."""
    team_id = uuid.uuid4()
    return {
        "id": uuid.uuid4(),
        "role": "trader",
        "team_id": team_id,
        "entity": MagicMock(),
    }


@pytest.fixture
def mock_db_session():
    """Mock AsyncSession."""
    session = AsyncMock()
    session.add = MagicMock()
    return session


@pytest.fixture
def active_team(strategist_user):
    """Active team with no cooldown."""
    team = MagicMock(spec=Team)
    team.id = strategist_user["team_id"]
    team.name = "Test Corp"
    team.ticker = "TEST"
    team.status = TeamStatus.ACTIVE
    team.stock_price = Decimal("100.00")
    team.cash = Decimal("1000000")
    team.cooldown_until = None
    team.caseline_document = "# Test Corp\n\nAI startup."
    team.company_display_name = "Test Corporation"
    return team


@pytest.fixture
def game_active_early():
    """Active game at 30 minutes (within 1-hour window)."""
    return GameState(
        id=1,
        status=GameStatus.ACTIVE,
        started_at=datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
        pause_offset=0,
        current_round=1,
    )


@pytest.fixture
def game_active_late():
    """Active game at 2 hours (past 1-hour window)."""
    return GameState(
        id=1,
        status=GameStatus.ACTIVE,
        started_at=datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc),  # Far past
        pause_offset=0,
        current_round=1,
    )


# --- Tests ---


class TestSubmitSolution:
    """Tests for POST /api/v1/solutions/submit."""

    @pytest.mark.asyncio
    async def test_submit_solution_within_window(
        self, strategist_user, mock_db_session, active_team, game_active_early
    ):
        """SOLN-01: Strategist can submit INITIAL within 1-hour window."""
        # Mock DB to return team and game state
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=game_active_early)
        mock_result.scalar_one = MagicMock(return_value=active_team)

        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # get_game_state_readonly
                result.scalar_one_or_none = MagicMock(return_value=game_active_early)
            else:
                # select Team
                result.scalar_one = MagicMock(return_value=active_team)
            return result

        mock_db_session.execute = AsyncMock(side_effect=mock_execute)

        # Mock solution refresh to set created_at and id
        async def mock_refresh(obj):
            if isinstance(obj, Solution):
                obj.id = uuid.uuid4()
                obj.created_at = datetime.now(timezone.utc)

        mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

        app.dependency_overrides[require_team] = lambda: strategist_user
        app.dependency_overrides[get_db] = lambda: mock_db_session

        try:
            with (
                patch("app.api.solutions.calculate_elapsed_seconds", return_value=1800),
                patch(
                    "app.worker.tasks.evaluate_solution.evaluate_solution"
                ) as mock_task,
            ):
                mock_task.delay = MagicMock()

                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    response = await client.post(
                        "/api/v1/solutions/submit",
                        json={
                            "content": "Our strategy is to expand into new AI markets with aggressive hiring.",
                            "solution_type": "INITIAL",
                        },
                    )

                assert response.status_code == 200
                data = response.json()
                assert data["solution_type"] == "INITIAL"
                assert data["evaluation_status"] is None
                mock_task.delay.assert_called_once()
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_submit_solution_outside_window_rejected(
        self, strategist_user, mock_db_session, active_team, game_active_late
    ):
        """SOLN-01: INITIAL submission rejected after 1-hour window."""

        async def mock_execute(stmt):
            result = MagicMock()
            result.scalar_one_or_none = MagicMock(return_value=game_active_late)
            result.scalar_one = MagicMock(return_value=active_team)
            return result

        mock_db_session.execute = AsyncMock(side_effect=mock_execute)

        app.dependency_overrides[require_team] = lambda: strategist_user
        app.dependency_overrides[get_db] = lambda: mock_db_session

        try:
            with patch(
                "app.api.solutions.calculate_elapsed_seconds", return_value=4000
            ):
                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    response = await client.post(
                        "/api/v1/solutions/submit",
                        json={
                            "content": "Our strategy is to expand into new markets.",
                            "solution_type": "INITIAL",
                        },
                    )

                assert response.status_code == 409
                assert "1 hour" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_microtweak_with_cooldown(
        self, strategist_user, mock_db_session, active_team, game_active_early
    ):
        """SOLN-03: MICROTWEAK rejected when cooldown is active."""
        # Set cooldown in the future
        active_team.cooldown_until = datetime.now(timezone.utc) + timedelta(minutes=10)

        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none = MagicMock(return_value=game_active_early)
            else:
                result.scalar_one = MagicMock(return_value=active_team)
            return result

        mock_db_session.execute = AsyncMock(side_effect=mock_execute)

        app.dependency_overrides[require_team] = lambda: strategist_user
        app.dependency_overrides[get_db] = lambda: mock_db_session

        try:
            with patch(
                "app.api.solutions.calculate_elapsed_seconds", return_value=1800
            ):
                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    response = await client.post(
                        "/api/v1/solutions/submit",
                        json={
                            "content": "A microtweak to refine our market positioning.",
                            "solution_type": "MICROTWEAK",
                        },
                    )

                assert response.status_code == 409
                assert "cooldown" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_microtweak_cooldown_expired(
        self, strategist_user, mock_db_session, active_team, game_active_early
    ):
        """SOLN-04: MICROTWEAK succeeds when cooldown has expired."""
        # Set cooldown in the past
        active_team.cooldown_until = datetime.now(timezone.utc) - timedelta(minutes=5)

        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none = MagicMock(return_value=game_active_early)
            else:
                result.scalar_one = MagicMock(return_value=active_team)
            return result

        mock_db_session.execute = AsyncMock(side_effect=mock_execute)

        async def mock_refresh(obj):
            if isinstance(obj, Solution):
                obj.id = uuid.uuid4()
                obj.created_at = datetime.now(timezone.utc)

        mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

        app.dependency_overrides[require_team] = lambda: strategist_user
        app.dependency_overrides[get_db] = lambda: mock_db_session

        try:
            with (
                patch("app.api.solutions.calculate_elapsed_seconds", return_value=1800),
                patch(
                    "app.worker.tasks.evaluate_solution.evaluate_solution"
                ) as mock_task,
            ):
                mock_task.delay = MagicMock()

                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    response = await client.post(
                        "/api/v1/solutions/submit",
                        json={
                            "content": "A microtweak to refine our market positioning.",
                            "solution_type": "MICROTWEAK",
                        },
                    )

                assert response.status_code == 200
                data = response.json()
                assert data["solution_type"] == "MICROTWEAK"
                # Verify cooldown was set (~20 minutes from now)
                assert active_team.cooldown_until is not None
                # cooldown_until should be in the future
                assert active_team.cooldown_until > datetime.now(timezone.utc)
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_trader_cannot_submit(self, trader_user, mock_db_session):
        """T-05-05: Traders get 403 when trying to submit."""
        app.dependency_overrides[require_team] = lambda: trader_user
        app.dependency_overrides[get_db] = lambda: mock_db_session

        # Mock game state as ACTIVE
        game_state = GameState(
            id=1,
            status=GameStatus.ACTIVE,
            started_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            pause_offset=0,
            current_round=1,
        )

        async def mock_execute(stmt):
            result = MagicMock()
            result.scalar_one_or_none = MagicMock(return_value=game_state)
            return result

        mock_db_session.execute = AsyncMock(side_effect=mock_execute)

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/v1/solutions/submit",
                    json={
                        "content": "Trader trying to submit a solution sneakily.",
                        "solution_type": "INITIAL",
                    },
                )

            assert response.status_code == 403
            assert "strategist" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_submit_sets_cooldown(
        self, strategist_user, mock_db_session, active_team, game_active_early
    ):
        """SOLN-04: MICROTWEAK sets cooldown_until ~20 minutes from now."""
        active_team.cooldown_until = None

        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none = MagicMock(return_value=game_active_early)
            else:
                result.scalar_one = MagicMock(return_value=active_team)
            return result

        mock_db_session.execute = AsyncMock(side_effect=mock_execute)

        async def mock_refresh(obj):
            if isinstance(obj, Solution):
                obj.id = uuid.uuid4()
                obj.created_at = datetime.now(timezone.utc)

        mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

        app.dependency_overrides[require_team] = lambda: strategist_user
        app.dependency_overrides[get_db] = lambda: mock_db_session

        try:
            with (
                patch("app.api.solutions.calculate_elapsed_seconds", return_value=1800),
                patch(
                    "app.worker.tasks.evaluate_solution.evaluate_solution"
                ) as mock_task,
            ):
                mock_task.delay = MagicMock()

                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    response = await client.post(
                        "/api/v1/solutions/submit",
                        json={
                            "content": "A microtweak to improve distribution strategy.",
                            "solution_type": "MICROTWEAK",
                        },
                    )

                assert response.status_code == 200
                # Verify cooldown was set
                assert active_team.cooldown_until is not None
                expected_min = datetime.now(timezone.utc) + timedelta(minutes=19)
                expected_max = datetime.now(timezone.utc) + timedelta(minutes=21)
                assert expected_min < active_team.cooldown_until < expected_max
        finally:
            app.dependency_overrides.clear()


class TestCooldownEndpoint:
    """Tests for GET /api/v1/solutions/cooldown."""

    @pytest.mark.asyncio
    async def test_no_cooldown(self, strategist_user, mock_db_session, active_team):
        """Cooldown inactive when cooldown_until is None."""
        active_team.cooldown_until = None

        async def mock_execute(stmt):
            result = MagicMock()
            result.scalar_one = MagicMock(return_value=active_team)
            return result

        mock_db_session.execute = AsyncMock(side_effect=mock_execute)

        app.dependency_overrides[require_team] = lambda: strategist_user
        app.dependency_overrides[get_db] = lambda: mock_db_session

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/v1/solutions/cooldown")

            assert response.status_code == 200
            data = response.json()
            assert data["cooldown_active"] is False
            assert data["seconds_remaining"] == 0
        finally:
            app.dependency_overrides.clear()


class TestCaselineEndpoint:
    """Tests for GET /api/v1/solutions/caseline."""

    @pytest.mark.asyncio
    async def test_get_caseline(self, strategist_user, mock_db_session, active_team):
        """D-15: Team can fetch their caseline document."""

        async def mock_execute(stmt):
            result = MagicMock()
            result.scalar_one = MagicMock(return_value=active_team)
            return result

        mock_db_session.execute = AsyncMock(side_effect=mock_execute)

        app.dependency_overrides[require_team] = lambda: strategist_user
        app.dependency_overrides[get_db] = lambda: mock_db_session

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/api/v1/solutions/caseline")

            assert response.status_code == 200
            data = response.json()
            assert data["caseline_document"] == "# Test Corp\n\nAI startup."
            assert data["company_display_name"] == "Test Corporation"
        finally:
            app.dependency_overrides.clear()
