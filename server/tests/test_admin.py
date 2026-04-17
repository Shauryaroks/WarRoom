"""Tests for admin API endpoints (Phase 3 Plan 01)."""

import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.database import get_db
from app.auth_utils import require_admin
from app.models import (
    ActivityEvent,
    Admin,
    GameState,
    GameStatus,
    MarketNews,
    Team,
    TeamStatus,
)


# --- Fixtures ---


@pytest.fixture
def admin_user():
    """Fake admin user dict returned by require_admin."""
    return {
        "id": uuid.uuid4(),
        "role": "admin",
        "team_id": None,
        "entity": MagicMock(),
    }


@pytest.fixture
def mock_db_session():
    """Mock AsyncSession with commit/refresh/execute/add/delete support."""
    session = AsyncMock()
    session.add = MagicMock()
    session.delete = AsyncMock()
    return session


@pytest.fixture
def sample_team():
    """Create a sample Team object."""
    team = Team(
        id=uuid.uuid4(),
        name="TestTeam",
        ticker="TST",
        strategist_email="strat@test.com",
        strategist_password_hash="hash",
        trader_email="trader@test.com",
        trader_password_hash="hash",
        status=TeamStatus.PENDING,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    return team


@pytest.fixture
def setup_game_state():
    """GameState in SETUP."""
    return GameState(id=1, status=GameStatus.SETUP, pause_offset=0, current_round=0)


@pytest.fixture
def active_game_state():
    """GameState in ACTIVE."""
    return GameState(
        id=1,
        status=GameStatus.ACTIVE,
        started_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        pause_offset=0,
        current_round=1,
    )


def _override_deps(admin_user, mock_db_session):
    """Override FastAPI deps for testing."""
    app.dependency_overrides[require_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: mock_db_session


def _clear_overrides():
    app.dependency_overrides.clear()


def _mock_execute_result(value):
    """Create a mock execute result that returns value from scalar_one_or_none."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = value
    mock_result.scalars.return_value.all.return_value = (
        value if isinstance(value, list) else [value]
    )
    mock_result.scalar.return_value = value
    return mock_result


# --- Test: Remove Team (Hard Delete in SETUP) ---


async def test_remove_team_hard_delete_in_setup(
    admin_user, mock_db_session, sample_team, setup_game_state
):
    """POST /teams/{id}/remove hard-deletes team when game is in SETUP."""
    _override_deps(admin_user, mock_db_session)

    # First execute returns team, second returns game_state
    mock_db_session.execute.side_effect = [
        _mock_execute_result(sample_team),  # select Team
        _mock_execute_result(setup_game_state),  # select GameState (readonly)
        MagicMock(),  # delete Directive
        MagicMock(),  # delete StockHolding (owner)
        MagicMock(),  # delete StockHolding (target)
        MagicMock(),  # delete Transaction (buyer)
        MagicMock(),  # delete Transaction (seller)
        MagicMock(),  # delete Transaction (target)
        MagicMock(),  # delete CashLedger
        MagicMock(),  # delete PriceHistory
    ]

    try:
        with patch("app.api.admin.publish_broadcast", new_callable=AsyncMock):
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                resp = await client.post(f"/api/v1/admin/teams/{sample_team.id}/remove")

        assert resp.status_code == 200
        data = resp.json()
        assert data["remove_type"] == "hard"
        assert data["team_id"] == str(sample_team.id)
        mock_db_session.delete.assert_awaited_once()
    finally:
        _clear_overrides()


# --- Test: Remove Team (Soft in ACTIVE) ---


async def test_remove_team_soft_in_active(
    admin_user, mock_db_session, sample_team, active_game_state
):
    """POST /teams/{id}/remove soft-marks team as BANKRUPT when game is ACTIVE."""
    _override_deps(admin_user, mock_db_session)

    mock_db_session.execute.side_effect = [
        _mock_execute_result(sample_team),  # select Team
        _mock_execute_result(active_game_state),  # select GameState
    ]

    try:
        with patch("app.api.admin.publish_broadcast", new_callable=AsyncMock):
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                resp = await client.post(f"/api/v1/admin/teams/{sample_team.id}/remove")

        assert resp.status_code == 200
        data = resp.json()
        assert data["remove_type"] == "soft"
        assert sample_team.status == TeamStatus.BANKRUPT
        assert sample_team.bankrupt_since is not None
    finally:
        _clear_overrides()


# --- Test: Remove Team Not Found ---


async def test_remove_team_not_found(admin_user, mock_db_session):
    """POST /teams/{id}/remove returns 404 for non-existent team."""
    _override_deps(admin_user, mock_db_session)

    mock_db_session.execute.return_value = _mock_execute_result(None)

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            resp = await client.post(f"/api/v1/admin/teams/{uuid.uuid4()}/remove")

        assert resp.status_code == 404
    finally:
        _clear_overrides()


# --- Test: Inject News (GLOBAL) ---


async def test_inject_news(admin_user, mock_db_session):
    """POST /news/inject creates MarketNews with source_type=ADMIN_INJECTED."""
    _override_deps(admin_user, mock_db_session)

    news_id = uuid.uuid4()
    created_at = datetime.now(timezone.utc)

    async def mock_refresh(obj):
        if isinstance(obj, MarketNews):
            obj.id = news_id
            obj.created_at = created_at

    mock_db_session.refresh = mock_refresh

    try:
        with patch(
            "app.api.admin.publish_broadcast", new_callable=AsyncMock
        ) as mock_broadcast:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                resp = await client.post(
                    "/api/v1/admin/news/inject",
                    json={
                        "headline": "Market crash incoming",
                        "body": "The market is about to crash",
                        "news_type": "GLOBAL",
                        "affected_tickers": [],
                    },
                )

        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "News injected"
        assert data["news_id"] == str(news_id)

        # Verify MarketNews was added (db.add called with MarketNews and ActivityEvent)
        add_calls = mock_db_session.add.call_args_list
        added_types = [type(c[0][0]).__name__ for c in add_calls]
        assert "MarketNews" in added_types
        assert "ActivityEvent" in added_types

        # Verify broadcast was called
        mock_broadcast.assert_awaited_once()
        broadcast_payload = mock_broadcast.call_args[0][0]
        assert broadcast_payload["type"] == "news_injected"
        assert broadcast_payload["payload"]["source_type"] == "ADMIN_INJECTED"
    finally:
        _clear_overrides()


# --- Test: Inject News (LOCAL with affected tickers) ---


async def test_inject_news_local(admin_user, mock_db_session):
    """POST /news/inject with LOCAL type stores affected_tickers correctly."""
    _override_deps(admin_user, mock_db_session)

    news_id = uuid.uuid4()
    created_at = datetime.now(timezone.utc)

    async def mock_refresh(obj):
        if isinstance(obj, MarketNews):
            obj.id = news_id
            obj.created_at = created_at

    mock_db_session.refresh = mock_refresh

    try:
        with patch(
            "app.api.admin.publish_broadcast", new_callable=AsyncMock
        ) as mock_broadcast:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                resp = await client.post(
                    "/api/v1/admin/news/inject",
                    json={
                        "headline": "ACME stock surge",
                        "body": "ACME reports record earnings",
                        "news_type": "LOCAL",
                        "affected_tickers": ["ACME", "BETA"],
                    },
                )

        assert resp.status_code == 200

        # Check that MarketNews was created with affected_tickers
        add_calls = mock_db_session.add.call_args_list
        news_obj = None
        for call in add_calls:
            obj = call[0][0]
            if isinstance(obj, MarketNews):
                news_obj = obj
                break
        assert news_obj is not None
        assert news_obj.affected_tickers == json.dumps(["ACME", "BETA"])

        # Verify broadcast payload includes affected_tickers
        broadcast_payload = mock_broadcast.call_args[0][0]
        assert broadcast_payload["payload"]["affected_tickers"] == ["ACME", "BETA"]
        assert broadcast_payload["payload"]["news_type"] == "LOCAL"
    finally:
        _clear_overrides()


# --- Test: Broadcast ---


async def test_broadcast(admin_user, mock_db_session):
    """POST /broadcast creates MarketNews with source_type=ADMIN_BROADCAST."""
    _override_deps(admin_user, mock_db_session)

    news_id = uuid.uuid4()
    created_at = datetime.now(timezone.utc)

    async def mock_refresh(obj):
        if isinstance(obj, MarketNews):
            obj.id = news_id
            obj.created_at = created_at

    mock_db_session.refresh = mock_refresh

    try:
        with patch(
            "app.api.admin.publish_broadcast", new_callable=AsyncMock
        ) as mock_broadcast:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                resp = await client.post(
                    "/api/v1/admin/broadcast",
                    json={
                        "message": "Attention all teams: market freeze in 5 minutes",
                    },
                )

        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Broadcast sent"

        # Verify MarketNews was created with ADMIN_BROADCAST source
        add_calls = mock_db_session.add.call_args_list
        news_obj = None
        for call in add_calls:
            obj = call[0][0]
            if isinstance(obj, MarketNews):
                news_obj = obj
                break
        assert news_obj is not None
        assert news_obj.source_type == "ADMIN_BROADCAST"
        assert news_obj.headline == "Attention all teams: market freeze in 5 minutes"

        # Verify broadcast uses same "news_injected" type (per D-05)
        broadcast_payload = mock_broadcast.call_args[0][0]
        assert broadcast_payload["type"] == "news_injected"
        assert broadcast_payload["payload"]["source_type"] == "ADMIN_BROADCAST"
    finally:
        _clear_overrides()


# --- Test: Advance Round ---


async def test_advance_round(admin_user, mock_db_session, setup_game_state):
    """POST /game/advance-round increments GameState.current_round."""
    _override_deps(admin_user, mock_db_session)

    # get_game_state (with FOR UPDATE lock)
    mock_db_session.execute.return_value = _mock_execute_result(setup_game_state)

    async def mock_refresh(obj):
        pass  # current_round already incremented in-place

    mock_db_session.refresh = mock_refresh

    try:
        with patch(
            "app.api.admin.publish_broadcast", new_callable=AsyncMock
        ) as mock_broadcast:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                resp = await client.post("/api/v1/admin/game/advance-round")

        assert resp.status_code == 200
        data = resp.json()
        assert data["current_round"] == 1  # 0 -> 1
        assert setup_game_state.current_round == 1

        mock_broadcast.assert_awaited_once()
        broadcast_payload = mock_broadcast.call_args[0][0]
        assert broadcast_payload["type"] == "round_advanced"
        assert broadcast_payload["payload"]["current_round"] == 1
    finally:
        _clear_overrides()


# --- Test: Activity Log ---


async def test_activity_log(admin_user, mock_db_session):
    """GET /activity returns recent ActivityEvent records."""
    _override_deps(admin_user, mock_db_session)

    events = [
        ActivityEvent(
            id=uuid.uuid4(),
            event_type="TEAM_APPROVED",
            actor="admin",
            description="Team 'Alpha' approved",
            metadata_json=None,
            created_at=datetime.now(timezone.utc),
        ),
    ]

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = events
    mock_db_session.execute.return_value = mock_result

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            resp = await client.get("/api/v1/admin/activity")

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["event_type"] == "TEAM_APPROVED"
        assert data[0]["description"] == "Team 'Alpha' approved"
    finally:
        _clear_overrides()


# --- Test: News History ---


async def test_news_history(admin_user, mock_db_session):
    """GET /news/history returns recent MarketNews records."""
    _override_deps(admin_user, mock_db_session)

    news_items = [
        MarketNews(
            id=uuid.uuid4(),
            headline="Market Update",
            content="Market is bullish",
            source_type="ADMIN_INJECTED",
            affected_tickers=json.dumps(["ACME"]),
            created_at=datetime.now(timezone.utc),
        ),
    ]

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = news_items
    mock_db_session.execute.return_value = mock_result

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            resp = await client.get("/api/v1/admin/news/history")

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["headline"] == "Market Update"
        assert data[0]["affected_tickers"] == ["ACME"]
        assert data[0]["source_type"] == "ADMIN_INJECTED"
    finally:
        _clear_overrides()


# --- Test: Endpoints Require Admin ---


async def test_endpoints_require_admin():
    """All new endpoints return 401/403 without auth token."""
    # Clear any overrides -- use default require_admin which needs a real token
    _clear_overrides()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            endpoints = [
                ("POST", f"/api/v1/admin/teams/{uuid.uuid4()}/remove"),
                ("POST", "/api/v1/admin/news/inject"),
                ("POST", "/api/v1/admin/broadcast"),
                ("POST", "/api/v1/admin/game/advance-round"),
                ("GET", "/api/v1/admin/activity"),
                ("GET", "/api/v1/admin/news/history"),
            ]

            for method, url in endpoints:
                if method == "POST":
                    resp = await client.post(url, json={})
                else:
                    resp = await client.get(url)

                # Should be 401 (no token) or 403 (wrong role)
                assert resp.status_code in (401, 403), (
                    f"{method} {url} returned {resp.status_code}, expected 401 or 403"
                )
    finally:
        _clear_overrides()
