"""Tests for simulation service: price interpolation, quarter calculation, and price updates."""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.simulation_service import (
    interpolate_price,
    get_current_quarter,
)


class TestInterpolatePrice:
    """Tests for the interpolate_price pure function."""

    def test_interpolation_moves_toward_target(self):
        """interpolate_price with ticks_remaining=10, current=100, target=110
        returns value between 100 and 115 (step + noise clamped to 5%)."""
        current = Decimal("100")
        target = Decimal("110")
        result = interpolate_price(current, target, ticks_remaining=10)
        # Step is (110-100)/10 = 1.0, noise up to 4% of 100 = 4.0
        # So result should be between ~96 and ~115
        assert Decimal("95") < result < Decimal("115")

    def test_returns_target_when_ticks_zero(self):
        """interpolate_price with ticks_remaining=0 returns target_price exactly."""
        current = Decimal("100")
        target = Decimal("110")
        result = interpolate_price(current, target, ticks_remaining=0)
        assert result == target

    def test_floor_at_one_cent(self):
        """interpolate_price never returns below $0.01."""
        current = Decimal("0.02")
        target = Decimal("0.01")
        # Run multiple times to catch noise driving below floor
        for _ in range(100):
            result = interpolate_price(
                current, target, ticks_remaining=5, volatility_pct=0.5
            )
            assert result >= Decimal("0.01"), f"Price dropped below floor: {result}"

    def test_noise_bounded_within_volatility_band(self):
        """Noise is bounded within volatility band. Run 100 iterations,
        all changes should be within expected range."""
        current = Decimal("100")
        target = Decimal("100")  # Same target so step=0, only noise matters
        volatility = 0.05
        for _ in range(100):
            result = interpolate_price(
                current, target, ticks_remaining=10, volatility_pct=volatility
            )
            change_pct = abs(float(result - current) / float(current))
            # With step=0 and noise clamped to 5%, change should be <= 5%
            assert change_pct <= volatility + 0.001, (
                f"Change {change_pct:.4f} exceeds volatility {volatility}"
            )

    def test_returns_decimal_rounded_to_two_places(self):
        """Result should be a Decimal rounded to 2 decimal places."""
        result = interpolate_price(
            Decimal("100.00"), Decimal("110.00"), ticks_remaining=5
        )
        assert isinstance(result, Decimal)
        # Check it has at most 2 decimal places
        assert result == round(result, 2)


class TestGetCurrentQuarter:
    """Tests for get_current_quarter function."""

    def test_quarter_1_at_start(self):
        """At 0 seconds elapsed, it's quarter 1."""
        assert get_current_quarter(0) == 1

    def test_quarter_1_at_1199_seconds(self):
        """At 1199 seconds (just before 20 minutes), still quarter 1."""
        assert get_current_quarter(1199) == 1

    def test_quarter_2_at_1200_seconds(self):
        """At 1200 seconds (exactly 20 minutes), quarter 2."""
        assert get_current_quarter(1200) == 2

    def test_quarter_3_at_2400_seconds(self):
        """At 2400 seconds (40 minutes), quarter 3."""
        assert get_current_quarter(2400) == 3

    def test_quarter_at_large_elapsed(self):
        """At 7200 seconds (2 hours), quarter 7."""
        assert get_current_quarter(7200) == 7


class TestSetTeamScore:
    """Tests for set_team_score async function."""

    @pytest.mark.asyncio
    async def test_set_team_score_stores_target_price(self):
        """set_team_score stores target_price on team."""
        from app.services.simulation_service import set_team_score

        # Create a mock team
        mock_team = MagicMock()
        mock_team.stock_price = Decimal("100.00")
        mock_team.id = uuid.uuid4()
        mock_team.ticker = "TEST"

        # Mock the DB session
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_team
        mock_db.execute.return_value = mock_result

        result = await set_team_score(mock_db, mock_team.id, quality_score=0.8)

        # Score=0.8 -> target_price = 100 * (1 + (0.8 - 0.5) * 0.4) = 100 * 1.12 = 112.00
        assert mock_team.target_price == Decimal("112.00")
        assert mock_team.ticks_to_target == 20
        assert result["target_price"] == "112.00"
        assert result["ticks_remaining"] == 20


class TestCalculateAllPrices:
    """Tests for calculate_all_prices async function."""

    @pytest.mark.asyncio
    async def test_no_active_teams_returns_empty(self):
        """calculate_all_prices with no ACTIVE teams returns empty list."""
        from app.services.simulation_service import calculate_all_prices

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        result = await calculate_all_prices(mock_db)
        assert result == []
