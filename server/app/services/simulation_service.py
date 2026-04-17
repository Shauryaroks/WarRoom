"""Simulation engine: Phase 9 per-tick price compute.

Replaces v1 random-walk + target_price + interpolate pipeline with:
  new_price = prev * (1 + drift_ramped + sentiment + shock + noise)

Where:
  drift_ramped = clamp(DRIFT_COEF * weighted_z, ±DRIFT_CAP) * ramp_fraction
  weighted_z   = 0.35*z(MS) + 0.30*z(margin) + 0.20*z(ops) + 0.15*z(growth)
  z(v, [lo,hi]) = (v - midpoint) / half_range, clamped ±2
  ramp_fraction = min(1, ticks_since_ramp_start / 5)
  sentiment    = last-60s signed INR volume / public float INR, * 0.02, clamped ±0.3%
  shock        = consume one PendingShock row if present, signed severity magnitude
  noise        = gauss(0, 0.02) bounded ±4%

Fundamentals updated per quarter via fundamental_service.apply_fundamental_deltas.
"""

import json
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    PendingShock,
    PriceHistory,
    ShockDirection,
    ShockSeverity,
    Team,
    TeamStatus,
    Transaction,
    TransactionType,
)

logger = logging.getLogger(__name__)

# --- Constants (Phase 9 CONTEXT D-05/06/07, D-13-21) ---
WEIGHT_MARKET_SHARE = Decimal("0.35")
WEIGHT_MARGIN = Decimal("0.30")
WEIGHT_OPS = Decimal("0.20")
WEIGHT_GROWTH = Decimal("0.15")

DRIFT_COEF = Decimal("0.15")
DRIFT_CAP = Decimal("0.05")
Z_CLAMP = Decimal("2")

SENTIMENT_COEF = Decimal("0.02")
SENTIMENT_CAP = Decimal("0.003")
PUBLIC_FLOAT_RATIO = Decimal("0.30")

RAMP_TICKS = 5

SHOCK_MAGNITUDES = {
    ShockSeverity.MINOR: Decimal("0.03"),
    ShockSeverity.MAJOR: Decimal("0.08"),
    ShockSeverity.CATASTROPHIC: Decimal("0.15"),
}


def z_score(value: Decimal, band: tuple[float, float] | list) -> Decimal:
    """Z-score relative to archetype band. Mid=0, max=+1, min=-1, clamped ±Z_CLAMP."""
    lo = Decimal(str(band[0]))
    hi = Decimal(str(band[1]))
    mid = (lo + hi) / 2
    half = (hi - lo) / 2
    if half == 0:
        return Decimal("0")
    z = (Decimal(str(value)) - mid) / half
    if z > Z_CLAMP:
        return Z_CLAMP
    if z < -Z_CLAMP:
        return -Z_CLAMP
    return z


def compute_weighted_z(team: Team, bands: dict) -> Decimal:
    """Weighted z-score across 4 fundamentals. Returns 0 if any fundamental is null."""
    if None in (
        team.fundamental_market_share,
        team.fundamental_margin,
        team.fundamental_growth,
        team.fundamental_ops_efficiency,
    ):
        return Decimal("0")
    ms = z_score(team.fundamental_market_share, bands.get("market_share", [0, 100]))
    mg = z_score(team.fundamental_margin, bands.get("margin", [0, 30]))
    op = z_score(team.fundamental_ops_efficiency, bands.get("ops_efficiency", [60, 100]))
    gr = z_score(team.fundamental_growth, bands.get("growth", [0, 50]))
    return (
        WEIGHT_MARKET_SHARE * ms
        + WEIGHT_MARGIN * mg
        + WEIGHT_OPS * op
        + WEIGHT_GROWTH * gr
    )


def compute_drift_target(weighted_z: Decimal) -> Decimal:
    """Natural drift per tick = DRIFT_COEF * weighted_z, clamped ±DRIFT_CAP."""
    drift = DRIFT_COEF * weighted_z
    if drift > DRIFT_CAP:
        return DRIFT_CAP
    if drift < -DRIFT_CAP:
        return -DRIFT_CAP
    return drift


def compute_ramp_fraction(team: Team, now: datetime) -> Decimal:
    """Linear ramp 0→1 over RAMP_TICKS (5 minutes). Returns 1 if ramp_started_at is None."""
    if team.ramp_started_at is None:
        return Decimal("1")
    elapsed_s = (now - team.ramp_started_at).total_seconds()
    ticks = elapsed_s / 60.0
    frac = min(1.0, max(0.0, ticks / RAMP_TICKS))
    return Decimal(str(frac))


async def compute_sentiment(
    db: AsyncSession,
    team_id: uuid.UUID,
    stock_price: Decimal,
    shares_outstanding: int,
    now: datetime,
) -> Decimal:
    """Last-60s signed INR volume imbalance normalized by public-float INR. Clamped ±0.3%/tick."""
    cutoff = now - timedelta(seconds=60)
    result = await db.execute(
        select(Transaction).where(
            and_(
                Transaction.target_team_id == team_id,
                Transaction.tx_type.in_([TransactionType.BUY, TransactionType.SELL]),
                Transaction.executed_at >= cutoff,
            )
        )
    )
    net_inr = Decimal("0")
    for tx in result.scalars().all():
        amt = Decimal(tx.shares) * tx.price_per_share
        if tx.tx_type == TransactionType.BUY:
            net_inr += amt
        else:
            net_inr -= amt

    float_inr = stock_price * Decimal(shares_outstanding) * PUBLIC_FLOAT_RATIO
    if float_inr == 0:
        return Decimal("0")
    raw = (net_inr / float_inr) * SENTIMENT_COEF
    if raw > SENTIMENT_CAP:
        return SENTIMENT_CAP
    if raw < -SENTIMENT_CAP:
        return -SENTIMENT_CAP
    return raw


async def consume_shock(
    db: AsyncSession, team_id: uuid.UUID, now: datetime
) -> tuple[Decimal, PendingShock | None]:
    """Pop one unapplied PendingShock for team. Returns (signed_pct, shock_or_none)."""
    result = await db.execute(
        select(PendingShock)
        .where(and_(PendingShock.team_id == team_id, PendingShock.applied_at.is_(None)))
        .order_by(PendingShock.enqueued_at)
        .limit(1)
    )
    shock = result.scalar_one_or_none()
    if not shock:
        return (Decimal("0"), None)
    mag = SHOCK_MAGNITUDES.get(shock.severity, Decimal("0"))
    sign = Decimal("1") if shock.direction == ShockDirection.POSITIVE else Decimal("-1")
    shock.applied_at = now
    return (sign * mag, shock)


async def calculate_all_prices(db: AsyncSession) -> list[dict]:
    """Phase 9 per-tick engine. One batched SELECT for ACTIVE teams.

    Returns list of price_update dicts for WebSocket broadcast.
    Caller must commit.
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Team)
        .options(selectinload(Team.archetype))
        .where(Team.status == TeamStatus.ACTIVE)
    )
    teams = result.scalars().all()
    if not teams:
        return []

    price_updates: list[dict] = []
    for team in teams:
        old_price = team.stock_price
        if old_price is None or old_price <= 0:
            continue

        # Drift from fundamentals
        if team.archetype is None:
            weighted_z = Decimal("0")
        else:
            try:
                bands = json.loads(team.archetype.benchmark_bands)
            except Exception:
                bands = {}
            weighted_z = compute_weighted_z(team, bands)

        drift_natural = compute_drift_target(weighted_z)
        ramp_frac = compute_ramp_fraction(team, now)
        drift_ramped = drift_natural * ramp_frac

        # D-21 snap-free floor: while ramping up to a new target, don't retreat below floor
        floor = team.drift_floor_pct or Decimal("0")
        if floor != 0 and (floor * drift_natural) >= 0:
            # Same sign; keep whichever has greater magnitude
            if floor.copy_abs() > drift_ramped.copy_abs():
                drift_ramped = floor

        # Sentiment
        sentiment = await compute_sentiment(
            db, team.id, old_price, team.shares_outstanding, now
        )

        # Shock
        shock_pct, _shock_row = await consume_shock(db, team.id, now)

        # Noise
        noise = Decimal(str(random.gauss(0, 0.02)))
        noise = max(Decimal("-0.04"), min(Decimal("0.04"), noise))

        pct_change = drift_ramped + sentiment + shock_pct + noise
        new_price = old_price * (Decimal("1") + pct_change)
        new_price = max(Decimal("0.01"), new_price.quantize(Decimal("0.01")))

        team.stock_price = new_price
        market_cap = new_price * team.shares_outstanding

        db.add(
            PriceHistory(
                team_id=team.id,
                price=new_price,
                market_cap=market_cap,
                calculated_at=now,
            )
        )

        if old_price > 0:
            change_pct = ((new_price - old_price) / old_price) * 100
        else:
            change_pct = Decimal("0")

        price_updates.append(
            {
                "team_id": str(team.id),
                "ticker": team.ticker,
                "price": str(new_price),
                "change_pct": f"{change_pct:+.2f}",
                "market_cap": str(market_cap),
                "timestamp": now.isoformat(),
                "shock_applied": str(shock_pct) if shock_pct != 0 else None,
            }
        )

    return price_updates
