"""Tests for evaluation service and admin evaluation endpoints (Phase 5 Plan 02).

Covers: EVAL-01 (prompt building), EVAL-03 (save as PENDING_APPROVAL),
EVAL-04 (edit evaluation), EVAL-05 (approve/reject).
"""

import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import (
    Evaluation,
    EvaluationStatus,
    MarketNews,
    Solution,
    SolutionType,
    Team,
    TeamStatus,
)
from app.services.evaluation_service import (
    approve_evaluation,
    build_prompt,
    reject_evaluation,
    save_evaluation,
)


# --- Helper mocks ---


class MockScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class MockResult:
    def __init__(self, items, one=None):
        self._items = items
        self._one = one

    def scalars(self):
        return MockScalarResult(self._items)

    def scalar_one_or_none(self):
        return self._items[0] if self._items else None

    def scalar_one(self):
        if self._one is not None:
            return self._one
        if self._items:
            return self._items[0]
        raise Exception("No result")


def _make_team(team_id=None):
    team = MagicMock(spec=Team)
    team.id = team_id or uuid.uuid4()
    team.name = "Test Corp"
    team.ticker = "TEST"
    team.company_display_name = "Test Corporation"
    team.status = TeamStatus.ACTIVE
    team.stock_price = Decimal("100.00")
    team.cash = Decimal("1000000")
    team.shares_outstanding = 1000000
    team.caseline_document = "# Test Corp\n\nAI startup in competitive market."
    team.cooldown_until = None
    return team


def _make_solution(team, sol_type=SolutionType.INITIAL):
    sol = MagicMock(spec=Solution)
    sol.id = uuid.uuid4()
    sol.team_id = team.id
    sol.team = team
    sol.content = "Our strategy is to expand into new markets with AI-driven products."
    sol.solution_type = sol_type
    sol.created_at = datetime.now(timezone.utc)
    return sol


def _make_evaluation(solution, team, status=EvaluationStatus.PENDING_APPROVAL):
    ev = MagicMock(spec=Evaluation)
    ev.id = uuid.uuid4()
    ev.solution_id = solution.id
    ev.team_id = team.id
    ev.status = status
    ev.scoring_metrics = json.dumps({
        "strategic_quality": 0.7,
        "feasibility": 0.6,
        "innovation": 0.8,
        "market_awareness": 0.5,
        "overall_score": 0.65,
    })
    ev.overall_score = 0.65
    ev.price_timeline = json.dumps([
        {"month": 1, "price_change_pct": 5.0},
        {"month": 2, "price_change_pct": 3.0},
        {"month": 3, "price_change_pct": 2.0},
    ])
    ev.news_headline = "Test Corp Announces Expansion"
    ev.news_body = "Test Corp revealed plans to expand into AI-driven markets."
    ev.news_sentiment = Decimal("0.60")
    ev.llm_model = "test-model"
    ev.llm_latency_ms = 5000
    ev.admin_notes = None
    ev.approved_at = None
    ev.rejected_at = None
    ev.created_at = datetime.now(timezone.utc)
    ev.updated_at = datetime.now(timezone.utc)
    return ev


# --- build_prompt tests ---


class TestBuildPrompt:
    """Tests for build_prompt function (EVAL-01)."""

    @pytest.mark.asyncio
    async def test_build_prompt(self):
        """EVAL-01: Prompt contains COMPANY PROFILE, SOLUTION, COMPETITOR, NEWS sections."""
        team = _make_team()
        solution = _make_solution(team)

        db = AsyncMock()
        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # Solution with team
                return MockResult([solution])
            elif call_count == 2:
                # Competitors
                return MockResult([])
            elif call_count == 3:
                # News
                return MockResult([])
            return MockResult([])

        db.execute = AsyncMock(side_effect=mock_execute)

        messages = await build_prompt(db, solution.id)

        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"

        user_content = messages[1]["content"]
        assert "[COMPANY PROFILE]" in user_content
        assert "[STRATEGIC SOLUTION]" in user_content
        assert "[COMPETITOR ACTIONS]" in user_content
        assert "[MARKET NEWS]" in user_content
        assert "[SCORING CRITERIA]" in user_content
        assert "Test Corporation" in user_content
        assert "expand into new markets" in user_content


# --- save_evaluation tests ---


class TestSaveEvaluation:
    """Tests for save_evaluation function (EVAL-03)."""

    @pytest.mark.asyncio
    async def test_save_evaluation_pending_approval(self):
        """EVAL-03: save_evaluation creates PENDING_APPROVAL record."""
        team = _make_team()
        solution = _make_solution(team)

        db = AsyncMock()
        db.add = MagicMock()

        async def mock_execute(stmt):
            return MockResult([solution])

        db.execute = AsyncMock(side_effect=mock_execute)

        llm_output = {
            "scoring_metrics": {
                "strategic_quality": 0.7,
                "feasibility": 0.6,
                "innovation": 0.8,
                "market_awareness": 0.5,
                "overall_score": 0.65,
            },
            "price_timeline": [
                {"month": 1, "price_change_pct": 5.0},
                {"month": 2, "price_change_pct": 3.0},
                {"month": 3, "price_change_pct": 2.0},
            ],
            "news_article": {
                "headline": "Test Corp Expansion",
                "body": "Test Corp plans to expand.",
                "sentiment": 0.6,
            },
        }
        metadata = {"model": "test-model", "latency_ms": 5000}

        evaluation = await save_evaluation(db, solution.id, llm_output, metadata)

        assert evaluation.status == EvaluationStatus.PENDING_APPROVAL
        assert evaluation.overall_score == 0.65
        assert evaluation.news_headline == "Test Corp Expansion"
        assert evaluation.llm_model == "test-model"
        db.add.assert_called_once()


# --- approve_evaluation tests ---


class TestApproveEvaluation:
    """Tests for approve_evaluation function (EVAL-05)."""

    @pytest.mark.asyncio
    async def test_approve_writes_target_price(self):
        """EVAL-05: approve_evaluation writes target_price to team, creates news."""
        team = _make_team()
        solution = _make_solution(team)
        evaluation = _make_evaluation(solution, team)

        # Use real attributes instead of MagicMock spec for mutable fields
        eval_obj = MagicMock()
        eval_obj.id = evaluation.id
        eval_obj.solution_id = solution.id
        eval_obj.team_id = team.id
        eval_obj.status = EvaluationStatus.PENDING_APPROVAL
        eval_obj.price_timeline = json.dumps([
            {"month": 1, "price_change_pct": 5.0},
            {"month": 2, "price_change_pct": 3.0},
            {"month": 3, "price_change_pct": 2.0},
        ])
        eval_obj.news_headline = "Test Corp Expansion"
        eval_obj.news_body = "Test Corp plans to expand."
        eval_obj.news_sentiment = Decimal("0.60")
        eval_obj.approved_at = None

        db = AsyncMock()
        db.add = MagicMock()
        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # Select evaluation
                return MockResult([eval_obj])
            elif call_count == 2:
                # Select team
                result = MagicMock()
                result.scalar_one = MagicMock(return_value=team)
                return result
            return MockResult([])

        db.execute = AsyncMock(side_effect=mock_execute)

        result = await approve_evaluation(db, evaluation.id)

        # sum of price_change_pct = 5+3+2 = 10%
        # target = 100 * (1 + 10/100) = 110.00
        assert result["target_price"] == "110.00"
        assert result["ticker"] == "TEST"
        assert team.target_price == Decimal("110.00")
        assert team.ticks_to_target == 20
        assert eval_obj.status == EvaluationStatus.APPROVED
        assert eval_obj.approved_at is not None

    @pytest.mark.asyncio
    async def test_approve_already_approved_fails(self):
        """Cannot approve an already-approved evaluation."""
        team = _make_team()
        solution = _make_solution(team)

        eval_obj = MagicMock()
        eval_obj.id = uuid.uuid4()
        eval_obj.status = EvaluationStatus.APPROVED

        db = AsyncMock()

        async def mock_execute(stmt):
            return MockResult([eval_obj])

        db.execute = AsyncMock(side_effect=mock_execute)

        with pytest.raises(ValueError, match="APPROVED.*expected PENDING_APPROVAL"):
            await approve_evaluation(db, eval_obj.id)


# --- reject_evaluation tests ---


class TestRejectEvaluation:
    """Tests for reject_evaluation function (EVAL-05)."""

    @pytest.mark.asyncio
    async def test_reject_evaluation(self):
        """EVAL-05: reject_evaluation marks REJECTED with notes."""
        team = _make_team()
        solution = _make_solution(team)

        eval_obj = MagicMock()
        eval_obj.id = uuid.uuid4()
        eval_obj.team_id = team.id
        eval_obj.status = EvaluationStatus.PENDING_APPROVAL
        eval_obj.rejected_at = None
        eval_obj.admin_notes = None

        db = AsyncMock()

        async def mock_execute(stmt):
            return MockResult([eval_obj])

        db.execute = AsyncMock(side_effect=mock_execute)

        result = await reject_evaluation(db, eval_obj.id, "Needs more detail")

        assert eval_obj.status == EvaluationStatus.REJECTED
        assert eval_obj.rejected_at is not None
        assert eval_obj.admin_notes == "Needs more detail"
        assert result["evaluation_id"] == str(eval_obj.id)


# --- edit_evaluation tests (via admin endpoint) ---


class TestEditEvaluation:
    """Tests for PUT /api/v1/admin/evaluations/{id} (EVAL-04)."""

    @pytest.mark.asyncio
    async def test_edit_evaluation(self):
        """EVAL-04: Admin can edit PENDING_APPROVAL evaluation fields."""
        from app.main import app
        from app.database import get_db
        from app.auth_utils import require_admin
        from httpx import ASGITransport, AsyncClient

        admin_user = {
            "id": uuid.uuid4(),
            "role": "admin",
            "team_id": None,
            "entity": MagicMock(),
        }

        eval_id = uuid.uuid4()
        eval_obj = MagicMock()
        eval_obj.id = eval_id
        eval_obj.status = EvaluationStatus.PENDING_APPROVAL
        eval_obj.overall_score = 0.65
        eval_obj.news_headline = "Old Headline"

        mock_db = AsyncMock()
        mock_db.add = MagicMock()

        async def mock_execute(stmt):
            return MockResult([eval_obj])

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        app.dependency_overrides[require_admin] = lambda: admin_user
        app.dependency_overrides[get_db] = lambda: mock_db

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.put(
                    f"/api/v1/admin/evaluations/{eval_id}",
                    json={
                        "overall_score": 0.75,
                        "news_headline": "Updated Headline",
                    },
                )

            assert response.status_code == 200
            data = response.json()
            assert data["message"] == "Evaluation updated"
            assert eval_obj.overall_score == 0.75
            assert eval_obj.news_headline == "Updated Headline"
        finally:
            app.dependency_overrides.clear()
