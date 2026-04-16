"""Simulation engine service: price interpolation, trajectory, and tick calculation.

Per D-02: Stock prices driven by evaluation results (LLM in Phase 5, mock in Phase 4).
Per D-03: 3-5% volatility per tick via bounded Gaussian noise.
Per D-04: Each 20-minute window = 1 simulated quarter.
Per D-05: Pluggable score input -- admin sets quality_score, converted to target_price.
Per SIM-01: Price tick every 60s for all ACTIVE teams.
"""

import logging
import random
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PriceHistory, Team, TeamStatus

logger = logging.getLogger(__name__)


def interpolate_price(
    current_price: Decimal,
    target_price: Decimal,
    ticks_remaining: int,
    volatility_pct: float = 0.04,
) -> Decimal:
    """Move current_price toward target_price with bounded noise.

    Per D-02: Price trajectory driven by target prices from evaluation.
    Per D-03: 3-5% volatility per tick.

    Args:
        current_price: Current stock price.
        target_price: Target price to interpolate toward.
        ticks_remaining: Number of ticks until target should be reached.
        volatility_pct: Maximum noise as fraction of current price (default 4%).

    Returns:
        New price as Decimal, rounded to 2 places, floored at $0.01.
    """
    if ticks_remaining <= 0:
        return target_price

    # Linear interpolation step
    step = (target_price - current_price) / Decimal(ticks_remaining)

    # Bounded Gaussian noise: normal distribution clamped to [-volatility, +volatility]
    noise_pct = random.gauss(0, volatility_pct / 2)
    noise_pct = max(-volatility_pct, min(volatility_pct, noise_pct))
    noise = current_price * Decimal(str(noise_pct))

    new_price = current_price + step + noise
    return max(Decimal("0.01"), round(new_price, 2))


def get_current_quarter(elapsed_seconds: int) -> int:
    """Calculate current simulated quarter from elapsed game time.

    Per D-04/SIM-02: Each 20-minute (1200 second) window is one quarter.

    Args:
        elapsed_seconds: Total elapsed game time excluding pauses.

    Returns:
        Quarter number (1-based).
    """
    return elapsed_seconds // 1200 + 1


async def set_team_score(
    db: AsyncSession, team_id: uuid.UUID, quality_score: float
) -> dict:
    """Set a quality score for a team, converting to target_price.

    Per D-05: Admin sets quality score (0.0-1.0) for Phase 4 testing.
    Score=0.5 holds price flat, score=1.0 targets +20%, score=0.0 targets -20%.
    Target reached over 20 ticks (one quarter at 1 tick/min).

    Args:
        db: Async database session.
        team_id: UUID of the team.
        quality_score: Score from 0.0 to 1.0.

    Returns:
        Dict with team_id, target_price, ticks_remaining.
    """
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()

    if team is None:
        raise ValueError(f"Team {team_id} not found")

    # Convert quality score to target price
    # score=0.5 -> factor=1.0 (flat), score=1.0 -> factor=1.2 (+20%), score=0.0 -> factor=0.8 (-20%)
    factor = Decimal(str(1 + (quality_score - 0.5) * 0.4))
    target = round(team.stock_price * factor, 2)

    team.target_price = target
    team.ticks_to_target = 20  # One quarter = 20 ticks at 1 tick/min

    return {
        "team_id": str(team.id),
        "ticker": team.ticker,
        "target_price": str(target),
        "ticks_remaining": 20,
    }


async def calculate_all_prices(db: AsyncSession) -> list[dict]:
    """Calculate new stock prices for all active teams.

    Per SIM-01: Single batch query for all ACTIVE teams (no N+1).
    For teams with target_price set and ticks_to_target > 0: interpolate.
    For teams without target_price: price stays unchanged, no PriceHistory row.

    Args:
        db: Async database session. Caller must commit after.

    Returns:
        List of price update dicts for broadcasting.
    """
    # Single batch query for all active teams
    result = await db.execute(
        select(Team).where(Team.status == TeamStatus.ACTIVE)
    )
    teams = result.scalars().all()

    if not teams:
        return []

    price_updates = []
    now = datetime.now(timezone.utc)

    for team in teams:
        # Per D-01: No price movement without a target (no random walk)
        if team.target_price is None or team.ticks_to_target is None or team.ticks_to_target <= 0:
            continue

        old_price = team.stock_price
        new_price = interpolate_price(
            current_price=old_price,
            target_price=team.target_price,
            ticks_remaining=team.ticks_to_target,
        )

        # Update team
        team.stock_price = new_price
        team.ticks_to_target -= 1

        # Clear target when ticks exhausted
        if team.ticks_to_target <= 0:
            team.target_price = None
            team.ticks_to_target = None

        # Calculate market cap
        market_cap = new_price * team.shares_outstanding

        # Create PriceHistory row
        db.add(PriceHistory(
            team_id=team.id,
            price=new_price,
            market_cap=market_cap,
            calculated_at=now,
        ))

        # Calculate change percentage
        if old_price > 0:
            change_pct = ((new_price - old_price) / old_price) * 100
        else:
            change_pct = Decimal("0")

        # Serialize as strings to avoid float precision issues (Pitfall 5)
        price_updates.append({
            "team_id": str(team.id),
            "ticker": team.ticker,
            "price": str(new_price),
            "change_pct": f"{change_pct:+.2f}",
            "market_cap": str(market_cap),
            "timestamp": now.isoformat(),
        })

    return price_updates
