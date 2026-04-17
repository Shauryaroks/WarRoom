"""Decision submission and operating plan API endpoints.

Per D-04: Teams submit decisions during Live Floor.
Per D-03: Teams submit operating plans during War Room.
Per D-07: Resubmission within same window overwrites previous.
Per D-12: Budget validation blocks overspend.

Threat mitigations:
  T-08-01: require_team + strategist role check
  T-08-02: Server recalculates budget_spent from decisions_json
  T-08-04: Per-lever validation with explicit field constraints
  T-08-05: Upsert prevents unbounded row creation
  T-08-07: max_length on operating plan content
"""

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import require_team
from app.database import get_db
from app.models import (
    Decision,
    GameState,
    GameStatus,
    LeverCategory,
    OperatingPlan,
    Team,
    TeamStatus,
)
from app.schemas.decisions import (
    BudgetResponse,
    BulkDecisionSubmitRequest,
    BulkDecisionSubmitResponse,
    DecisionSubmitResponse,
    OperatingPlanSubmitRequest,
    OperatingPlanSubmitResponse,
)
from app.services.game_service import get_game_state_readonly, get_operating_budget

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/decisions", tags=["decisions"])

# Decision window duration (20 minutes per D-04)
DECISION_WINDOW_MINUTES = 20

# Fixed costs for budget calculation (per D-11)
SUPPLY_CHAIN_TIER_COSTS = {"TIER1": Decimal("5"), "TIER2": Decimal("3"), "RURAL": Decimal("2")}  # Cr
NEW_PRODUCT_RD_COST = Decimal("10")  # Cr


# ---------------------------------------------------------------------------
# Per-lever validation (D-06, T-08-04)
# ---------------------------------------------------------------------------

VALID_CHANNELS = {"GT", "MT", "QCOM", "D2C"}
VALID_THEMES = {"VALUE", "PREMIUM", "HEALTH", "PATRIOTISM", "NOSTALGIA"}
VALID_INVENTORY_POLICIES = {"LEAN", "BALANCED", "STOCKED"}
VALID_DISTRIBUTION_TIERS = {"TIER1", "TIER2", "RURAL"}


def _validate_pricing(d: dict) -> None:
    lpc = d.get("list_price_change")
    if lpc is None or not isinstance(lpc, (int, float)):
        raise ValueError("list_price_change must be a number")
    if not (-15 <= lpc <= 15):
        raise ValueError("list_price_change must be between -15 and 15")

    pd_val = d.get("promo_depth")
    if pd_val is None or not isinstance(pd_val, (int, float)):
        raise ValueError("promo_depth must be a number")
    if not (0 <= pd_val <= 40):
        raise ValueError("promo_depth must be between 0 and 40")

    cp = d.get("channel_pricing")
    if cp not in VALID_CHANNELS:
        raise ValueError(f"channel_pricing must be one of {VALID_CHANNELS}")


def _validate_marketing(d: dict) -> None:
    pcts = {}
    for key in ("atl_pct", "digital_pct", "influencer_pct", "btl_pct"):
        val = d.get(key)
        if val is None or not isinstance(val, (int, float)):
            raise ValueError(f"{key} must be a number")
        if val < 0:
            raise ValueError(f"{key} must be >= 0")
        pcts[key] = val

    total = sum(pcts.values())
    if abs(total - 100) > 0.01:
        raise ValueError(f"Marketing percentages must sum to 100 (got {total})")

    theme = d.get("campaign_theme")
    if theme not in VALID_THEMES:
        raise ValueError(f"campaign_theme must be one of {VALID_THEMES}")


def _validate_supply_chain(d: dict) -> None:
    ip = d.get("inventory_policy")
    if ip not in VALID_INVENTORY_POLICIES:
        raise ValueError(f"inventory_policy must be one of {VALID_INVENTORY_POLICIES}")

    de = d.get("distribution_expansion")
    if not isinstance(de, list):
        raise ValueError("distribution_expansion must be a list")
    for tier in de:
        if tier not in VALID_DISTRIBUTION_TIERS:
            raise ValueError(f"Invalid distribution tier: {tier}. Must be one of {VALID_DISTRIBUTION_TIERS}")

    cu = d.get("capacity_utilization")
    if cu is None or not isinstance(cu, (int, float)):
        raise ValueError("capacity_utilization must be a number")
    if not (60 <= cu <= 100):
        raise ValueError("capacity_utilization must be between 60 and 100")


def _validate_new_product(d: dict) -> None:
    launch = d.get("launch_sku")
    if not isinstance(launch, bool):
        raise ValueError("launch_sku must be a boolean")

    if launch:
        desc = d.get("sku_description")
        if not desc or not isinstance(desc, str) or len(desc.strip()) == 0:
            raise ValueError("sku_description is required when launch_sku is True")


LEVER_VALIDATORS = {
    LeverCategory.PRICING: _validate_pricing,
    LeverCategory.MARKETING: _validate_marketing,
    LeverCategory.SUPPLY_CHAIN: _validate_supply_chain,
    LeverCategory.NEW_PRODUCT: _validate_new_product,
}


# ---------------------------------------------------------------------------
# Server-side budget calculation (T-08-02: never trust client)
# ---------------------------------------------------------------------------


def _calculate_budget_spent(
    lever: LeverCategory, decisions_json: dict, total_budget: Decimal
) -> Decimal:
    """Calculate actual budget spent for a lever decision server-side."""
    if lever == LeverCategory.PRICING:
        return Decimal("0")  # Pricing changes don't cost budget (D-11)

    if lever == LeverCategory.MARKETING:
        # Marketing spend = sum of allocation percentages as fraction of budget
        # The allocations represent how the marketing budget is split, not direct cost
        # For simplicity: marketing costs a fraction of total budget based on allocations
        # (the total marketing budget IS the cost)
        total_pct = sum(
            decisions_json.get(k, 0)
            for k in ("atl_pct", "digital_pct", "influencer_pct", "btl_pct")
        )
        # Marketing spend = percentage of total budget (scaled by a marketing_spend_rate)
        # For now, marketing costs 30% of total budget when fully allocated
        marketing_spend_rate = Decimal("0.3")
        return (total_budget * marketing_spend_rate * Decimal(str(total_pct)) / Decimal("100")).quantize(Decimal("0.01"))

    if lever == LeverCategory.SUPPLY_CHAIN:
        expansions = decisions_json.get("distribution_expansion", [])
        cost = Decimal("0")
        for tier in expansions:
            cost += SUPPLY_CHAIN_TIER_COSTS.get(tier, Decimal("0"))
        return cost

    if lever == LeverCategory.NEW_PRODUCT:
        if decisions_json.get("launch_sku"):
            return NEW_PRODUCT_RD_COST
        return Decimal("0")

    return Decimal("0")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/submit", response_model=BulkDecisionSubmitResponse)
async def submit_decisions(
    request: BulkDecisionSubmitRequest,
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
):
    """Submit lever decisions during Live Floor (D-04, D-07, LEVER-01).

    T-08-01: strategist role check.
    T-08-02: Server recalculates budget_spent.
    T-08-04: Per-lever Pydantic/validation.
    T-08-05: Upsert prevents unbounded rows.
    """
    # T-08-01: Strategist only
    if current_user["role"] != "strategist":
        raise HTTPException(status_code=403, detail="Only strategists can submit decisions")

    team_id = current_user["team_id"]

    # Guard: Game must be ACTIVE with game_phase == "live_floor"
    game_state = await get_game_state_readonly(db)
    if game_state.status != GameStatus.ACTIVE:
        raise HTTPException(status_code=409, detail="Game must be ACTIVE")
    if getattr(game_state, "game_phase", None) != "live_floor":
        raise HTTPException(
            status_code=409, detail="Decisions only accepted during Live Floor"
        )

    # Guard: Team must not be ELIMINATED or BANKRUPT
    team = await db.scalar(select(Team).where(Team.id == team_id))
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.status in (TeamStatus.ELIMINATED, TeamStatus.BANKRUPT):
        raise HTTPException(
            status_code=409,
            detail=f"Team is {team.status.value} and cannot submit decisions",
        )

    current_round = game_state.current_round

    # Get budget for validation
    try:
        budget_info = await get_operating_budget(db, team_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    total_budget = Decimal(budget_info["total_budget"])

    # Validate each lever and calculate server-side budget
    now = datetime.now(timezone.utc)
    quarter_start = game_state.current_quarter_start or now
    window_start = quarter_start
    window_end = quarter_start + timedelta(minutes=DECISION_WINDOW_MINUTES)

    responses = []
    total_spent = Decimal("0")
    upsert_data = []

    for dec in request.decisions:
        # Validate lever category
        try:
            lever = LeverCategory(dec.lever_category.value)
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid lever category: {dec.lever_category}",
            )

        # Validate decisions_json per lever (T-08-04)
        validator = LEVER_VALIDATORS.get(lever)
        if validator:
            try:
                validator(dec.decisions_json)
            except ValueError as e:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid {lever.value} decision: {e}",
                )

        # T-08-02: Server calculates budget_spent
        budget_spent = _calculate_budget_spent(lever, dec.decisions_json, total_budget)
        total_spent += budget_spent

        upsert_data.append({
            "lever": lever,
            "decisions_json": dec.decisions_json,
            "budget_spent": budget_spent,
        })

    # D-12: Budget validation
    if total_spent > total_budget:
        excess = (total_spent - total_budget).quantize(Decimal("0.01"))
        raise HTTPException(
            status_code=422,
            detail=f"BUDGET_EXCEEDED -- reduce allocations by Rs {excess} Cr",
        )

    # Upsert each decision (D-07: resubmission overwrites)
    for item in upsert_data:
        stmt = pg_insert(Decision).values(
            team_id=team_id,
            round_number=current_round,
            lever_category=item["lever"],
            decisions_json=json.dumps(item["decisions_json"]),
            budget_spent=item["budget_spent"],
            submitted_at=now,
            window_start=window_start,
            window_end=window_end,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_decision_team_round_lever",
            set_={
                "decisions_json": stmt.excluded.decisions_json,
                "budget_spent": stmt.excluded.budget_spent,
                "submitted_at": stmt.excluded.submitted_at,
                "window_start": stmt.excluded.window_start,
                "window_end": stmt.excluded.window_end,
            },
        )
        result = await db.execute(stmt)

        # Get the decision ID
        dec_result = await db.execute(
            select(Decision).where(
                Decision.team_id == team_id,
                Decision.round_number == current_round,
                Decision.lever_category == item["lever"],
            )
        )
        dec_row = dec_result.scalar_one()

        responses.append(
            DecisionSubmitResponse(
                message="Decision submitted",
                decision_id=str(dec_row.id),
                lever_category=item["lever"].value,
                budget_spent=str(item["budget_spent"]),
            )
        )

    await db.commit()

    logger.info(
        "Team %s submitted %d decisions for round %d (total spent: %s)",
        team_id, len(responses), current_round, total_spent,
    )

    return BulkDecisionSubmitResponse(
        message=f"Submitted {len(responses)} decisions",
        decisions=responses,
        total_budget_spent=str(total_spent.quantize(Decimal("0.01"))),
    )


@router.get("/current")
async def get_current_decisions(
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
):
    """Get current round decisions for the team (D-08)."""
    team_id = current_user["team_id"]

    game_state = await get_game_state_readonly(db)
    current_round = game_state.current_round

    result = await db.execute(
        select(Decision)
        .where(Decision.team_id == team_id, Decision.round_number == current_round)
        .order_by(Decision.lever_category)
    )
    decisions = result.scalars().all()

    return [
        {
            "id": str(d.id),
            "lever_category": d.lever_category.value,
            "decisions_json": json.loads(d.decisions_json),
            "budget_spent": str(d.budget_spent),
            "submitted_at": d.submitted_at.isoformat(),
            "window_start": d.window_start.isoformat(),
            "window_end": d.window_end.isoformat(),
        }
        for d in decisions
    ]


@router.post("/operating-plan", response_model=OperatingPlanSubmitResponse)
async def submit_operating_plan(
    request: OperatingPlanSubmitRequest,
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
):
    """Submit operating plan during War Room (D-03, ROUND-02).

    T-08-07: max_length enforced by Pydantic schema.
    """
    if current_user["role"] != "strategist":
        raise HTTPException(status_code=403, detail="Only strategists can submit operating plans")

    team_id = current_user["team_id"]

    # Guard: game_phase must be "war_room"
    game_state = await get_game_state_readonly(db)
    if game_state.status != GameStatus.ACTIVE:
        raise HTTPException(status_code=409, detail="Game must be ACTIVE")
    if getattr(game_state, "game_phase", None) != "war_room":
        raise HTTPException(
            status_code=409,
            detail="Operating plans only accepted during War Room",
        )

    current_round = game_state.current_round
    now = datetime.now(timezone.utc)

    # Upsert operating plan (team_id + round_number unique)
    stmt = pg_insert(OperatingPlan).values(
        team_id=team_id,
        round_number=current_round,
        content=request.content,
        submitted_at=now,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_operating_plan_team_round",
        set_={
            "content": stmt.excluded.content,
            "submitted_at": stmt.excluded.submitted_at,
        },
    )
    await db.execute(stmt)
    await db.commit()

    # Get the plan record
    plan_result = await db.execute(
        select(OperatingPlan).where(
            OperatingPlan.team_id == team_id,
            OperatingPlan.round_number == current_round,
        )
    )
    plan = plan_result.scalar_one()

    logger.info("Team %s submitted operating plan for round %d", team_id, current_round)

    return OperatingPlanSubmitResponse(
        message="Operating plan submitted",
        plan_id=str(plan.id),
    )


@router.get("/operating-plan")
async def get_operating_plan(
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
):
    """Get current round operating plan for the team (D-03)."""
    team_id = current_user["team_id"]

    game_state = await get_game_state_readonly(db)
    current_round = game_state.current_round

    result = await db.execute(
        select(OperatingPlan).where(
            OperatingPlan.team_id == team_id,
            OperatingPlan.round_number == current_round,
        )
    )
    plan = result.scalar_one_or_none()

    if not plan:
        raise HTTPException(status_code=404, detail="No operating plan for current round")

    return {
        "id": str(plan.id),
        "round_number": plan.round_number,
        "content": plan.content,
        "submitted_at": plan.submitted_at.isoformat(),
    }
