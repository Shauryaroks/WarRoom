"""Pydantic schemas for Phase 8 decision levers and round structure.

Covers: decision submission, operating plan submission, budget response,
game phase transitions.
"""

from enum import Enum

from pydantic import BaseModel, Field


class LeverCategory(str, Enum):
    """Mirror of the SQLAlchemy LeverCategory enum for Pydantic validation."""

    PRICING = "PRICING"
    MARKETING = "MARKETING"
    SUPPLY_CHAIN = "SUPPLY_CHAIN"
    NEW_PRODUCT = "NEW_PRODUCT"


# ---------------------------------------------------------------------------
# Decision submission
# ---------------------------------------------------------------------------


class DecisionSubmitRequest(BaseModel):
    lever_category: LeverCategory
    decisions_json: dict = Field(
        ..., description="Lever-specific values as a JSON object"
    )
    budget_spent: float = Field(ge=0, description="Budget allocated to this lever")


class DecisionSubmitResponse(BaseModel):
    message: str
    decision_id: str
    lever_category: str
    budget_spent: str


class BulkDecisionSubmitRequest(BaseModel):
    """Submit all lever decisions at once (per D-07)."""

    decisions: list[DecisionSubmitRequest]


class BulkDecisionSubmitResponse(BaseModel):
    message: str
    decisions: list[DecisionSubmitResponse]
    total_budget_spent: str


# ---------------------------------------------------------------------------
# Operating plan
# ---------------------------------------------------------------------------


class OperatingPlanSubmitRequest(BaseModel):
    content: str = Field(
        ..., min_length=1, max_length=50000,
        description="Markdown content for the operating plan",
    )


class OperatingPlanSubmitResponse(BaseModel):
    message: str
    plan_id: str


# ---------------------------------------------------------------------------
# Budget
# ---------------------------------------------------------------------------


class BudgetResponse(BaseModel):
    total_budget: str
    allocated: str
    remaining: str
    multiplier: float


# ---------------------------------------------------------------------------
# Game phase
# ---------------------------------------------------------------------------


class SetGamePhaseRequest(BaseModel):
    phase: str = Field(
        ..., description='Game sub-phase: "war_room" or "live_floor"'
    )
    macro_brief: str | None = Field(
        default=None,
        description="Problem statement text shown during War Room",
    )


class GamePhaseResponse(BaseModel):
    game_phase: str | None
    macro_brief: str | None
    current_round: int
