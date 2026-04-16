"""Tests for Celery game tick guard."""

from unittest.mock import patch, MagicMock


def test_is_game_active_returns_true_when_active():
    """is_game_active returns True when Redis key is 'ACTIVE'."""
    with patch("app.worker.tasks.game_tick.redis") as mock_redis:
        mock_r = MagicMock()
        mock_r.get.return_value = b"ACTIVE"
        mock_redis.from_url.return_value = mock_r

        from app.worker.tasks.game_tick import is_game_active

        assert is_game_active() is True
        mock_r.close.assert_called_once()


def test_is_game_active_returns_false_when_paused():
    """is_game_active returns False when Redis key is 'PAUSED'."""
    with patch("app.worker.tasks.game_tick.redis") as mock_redis:
        mock_r = MagicMock()
        mock_r.get.return_value = b"PAUSED"
        mock_redis.from_url.return_value = mock_r

        from app.worker.tasks.game_tick import is_game_active

        assert is_game_active() is False


def test_is_game_active_returns_false_when_not_set():
    """is_game_active returns False when Redis key is None (not set)."""
    with patch("app.worker.tasks.game_tick.redis") as mock_redis:
        mock_r = MagicMock()
        mock_r.get.return_value = None
        mock_redis.from_url.return_value = mock_r

        from app.worker.tasks.game_tick import is_game_active

        assert is_game_active() is False


def test_game_tick_skips_when_not_active():
    """game_tick returns early (no side effects) when game not active."""
    with patch(
        "app.worker.tasks.game_tick.is_game_active", return_value=False
    ):
        from app.worker.tasks.game_tick import game_tick

        result = game_tick()
        assert result is None  # early return
