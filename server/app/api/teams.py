from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_team, verify_admin_key
from decimal import Decimal
from app.database import get_db
from app.models import (
    CashLedger,
    Directive,
    GameState,
    StockHolding,
    Team,
    TeamStatus,
    Transaction,
)

router = APIRouter(prefix="/teams", tags=["teams"])


# --- Pydantic schemas ---


class TeamProfile(BaseModel):
    team_id: str
    name: str
    ticker: str
    status: str
    swot: dict
    portfolio_id: Optional[str]


class TeamFinancials(BaseModel):
    cash: float
    stock_price: float
    market_cap: float
    liquidity: float
    treasury_sale_limit_remaining: float


class PortfolioHolding(BaseModel):
    ticker: str
    shares: int
    current_price: float
    current_value: float
    cost_basis: float
    unrealized_pnl: float
    ownership_percentage: float


class Portfolio(BaseModel):
    holdings: list[PortfolioHolding]
    total_portfolio_value: float
    total_unrealized_pnl: float


class DirectiveSummary(BaseModel):
    id: str
    headline: str
    feedback: str
    submitted_at: str
    status: str


class CooldownStatus(BaseModel):
    active: bool
    started_at: Optional[str]
    ends_at: Optional[str]
    seconds_remaining: Optional[int]


class TeamDossier(BaseModel):
    profile: TeamProfile
    financials: TeamFinancials
    portfolio: Portfolio
    last_directive: Optional[DirectiveSummary]
    cooldown_status: CooldownStatus


# --- GET /teams/me ---


@router.get("/me", response_model=TeamDossier)
async def get_current_team_dossier(
    team: Team = Depends(get_current_team),
    db: AsyncSession = Depends(get_db),
):
    market_cap = float(team.stock_price * team.shares_outstanding)

    # Fetch holdings
    portfolio_stmt = select(StockHolding).where(
        and_(
            StockHolding.owner_team_id == team.id,
            StockHolding.shares_owned > 0,
        )
    )
    portfolio_result = await db.execute(portfolio_stmt)
    holdings = portfolio_result.scalars().all()

    holdings_list = []
    total_portfolio_value = 0.0
    total_cost_basis = 0.0

    for h in holdings:
        target = await db.get(Team, h.target_team_id)
        current_value = h.shares_owned * target.stock_price
        ownership_pct = (h.shares_owned / target.shares_outstanding) * 100
        cost_basis = float(h.total_cost_basis or 0)

        holdings_list.append(
            PortfolioHolding(
                ticker=target.ticker,
                shares=h.shares_owned,
                current_price=float(target.stock_price),
                current_value=float(current_value),
                cost_basis=cost_basis,
                unrealized_pnl=float(current_value) - cost_basis,
                ownership_percentage=float(ownership_pct),
            )
        )
        total_portfolio_value += float(current_value)
        total_cost_basis += cost_basis

    liquidity = float(team.cash) + (total_portfolio_value * 0.5)
    treasury_limit = team.dilution_cap_percent

    profile = TeamProfile(
        team_id=str(team.id),
        name=team.name,
        ticker=team.ticker,
        status=team.status.value,
        swot={
            "strengths": team.swot_strengths or "",
            "weaknesses": team.swot_weaknesses or "",
            "opportunities": team.swot_opportunities or "",
            "threats": team.swot_threats or "",
        },
        portfolio_id=team.portfolio_type,
    )

    financials = TeamFinancials(
        cash=float(team.cash),
        stock_price=float(team.stock_price),
        market_cap=market_cap,
        liquidity=liquidity,
        treasury_sale_limit_remaining=float(treasury_limit),
    )

    portfolio = Portfolio(
        holdings=holdings_list,
        total_portfolio_value=total_portfolio_value,
        total_unrealized_pnl=total_portfolio_value - total_cost_basis,
    )

    # Last directive
    last_directive_stmt = (
        select(Directive)
        .where(Directive.team_id == team.id)
        .order_by(Directive.created_at.desc())
        .limit(1)
    )
    last_result = await db.execute(last_directive_stmt)
    last_dir = last_result.scalar_one_or_none()

    last_directive = None
    if last_dir:
        last_directive = DirectiveSummary(
            id=str(last_dir.id),
            headline=last_dir.news_headline
            or (last_dir.content[:100] if last_dir.content else ""),
            feedback=last_dir.board_feedback or "",
            submitted_at=last_dir.created_at.isoformat() if last_dir.created_at else "",
            status=last_dir.status.value
            if hasattr(last_dir.status, "value")
            else str(last_dir.status),
        )

    # Cooldown
    cooldown_active = False
    cooldown_seconds = 0
    cooldown_ends = None

    if team.cooldown_until:
        now = datetime.utcnow()
        if team.cooldown_until > now:
            cooldown_active = True
            cooldown_seconds = int((team.cooldown_until - now).total_seconds())
            cooldown_ends = team.cooldown_until.isoformat()

    cooldown_status = CooldownStatus(
        active=cooldown_active,
        started_at=team.cooldown_until.isoformat() if cooldown_active else None,
        ends_at=cooldown_ends,
        seconds_remaining=cooldown_seconds if cooldown_active else None,
    )

    return TeamDossier(
        profile=profile,
        financials=financials,
        portfolio=portfolio,
        last_directive=last_directive,
        cooldown_status=cooldown_status,
    )


# --- GET /teams/me/holdings ---


@router.get("/me/holdings", response_model=Portfolio)
async def get_team_holdings(
    team: Team = Depends(get_current_team),
    db: AsyncSession = Depends(get_db),
):
    portfolio_stmt = select(StockHolding).where(
        and_(
            StockHolding.owner_team_id == team.id,
            StockHolding.shares_owned > 0,
        )
    )
    portfolio_result = await db.execute(portfolio_stmt)
    holdings = portfolio_result.scalars().all()

    holdings_list = []
    total_portfolio_value = 0.0
    total_cost_basis = 0.0

    for h in holdings:
        target = await db.get(Team, h.target_team_id)
        current_value = h.shares_owned * target.stock_price
        ownership_pct = (h.shares_owned / target.shares_outstanding) * 100
        cost_basis = float(h.total_cost_basis or 0)

        holdings_list.append(
            PortfolioHolding(
                ticker=target.ticker,
                shares=h.shares_owned,
                current_price=float(target.stock_price),
                current_value=float(current_value),
                cost_basis=cost_basis,
                unrealized_pnl=float(current_value) - cost_basis,
                ownership_percentage=float(ownership_pct),
            )
        )
        total_portfolio_value += float(current_value)
        total_cost_basis += cost_basis

    return Portfolio(
        holdings=holdings_list,
        total_portfolio_value=total_portfolio_value,
        total_unrealized_pnl=total_portfolio_value - total_cost_basis,
    )


# --- GET /teams/me/directives ---


class DirectiveWithFeedback(BaseModel):
    id: str
    headline: str
    feedback: str
    submitted_at: str
    status: str
    raw_markdown: str
    character_count: int
    extraction_confidence: Optional[float]
    vibe_scores: dict
    financial_impact: dict


class DirectivesListResponse(BaseModel):
    directives: list[DirectiveWithFeedback]
    total_count: int


@router.get("/me/directives", response_model=DirectivesListResponse)
async def get_team_directives(
    limit: int = 10,
    offset: int = 0,
    team: Team = Depends(get_current_team),
    db: AsyncSession = Depends(get_db),
):
    count_stmt = select(func.count(Directive.id)).where(Directive.team_id == team.id)
    count_result = await db.execute(count_stmt)
    total_count = count_result.scalar() or 0

    stmt = (
        select(Directive)
        .where(Directive.team_id == team.id)
        .order_by(Directive.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    directives = result.scalars().all()

    import json

    directives_list = []
    for d in directives:
        vibe_scores = {}
        if d.consistency_score is not None:
            vibe_scores["consistency"] = d.consistency_score
        if d.macro_sensitivity_score is not None:
            vibe_scores["macro_sensitivity"] = d.macro_sensitivity_score
        if d.aggression_score is not None:
            vibe_scores["aggression"] = d.aggression_score
        if d.innovation_score is not None:
            vibe_scores["innovation"] = d.innovation_score

        financial_impact = {}
        if d.financial_impact:
            try:
                financial_impact = json.loads(d.financial_impact)
            except (json.JSONDecodeError, TypeError):
                pass

        directives_list.append(
            DirectiveWithFeedback(
                id=str(d.id),
                headline=d.news_headline or (d.content[:100] if d.content else ""),
                feedback=d.board_feedback or "",
                submitted_at=d.created_at.isoformat() if d.created_at else "",
                status=d.status.value if hasattr(d.status, "value") else str(d.status),
                raw_markdown=d.content or "",
                character_count=len(d.content) if d.content else 0,
                extraction_confidence=d.extraction_confidence,
                vibe_scores=vibe_scores,
                financial_impact=financial_impact,
            )
        )

    return DirectivesListResponse(directives=directives_list, total_count=total_count)


# --- GET /teams ---


class TeamSummary(BaseModel):
    team_id: str
    name: str
    ticker: str
    status: str
    stock_price: float
    market_cap: float
    portfolio_id: Optional[str]
    eliminated_at: Optional[str]
    rank_at_elimination: Optional[int]


@router.get("", response_model=dict)
async def list_teams(
    status_filter: Optional[str] = None,
    filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Team)

    if status_filter and status_filter != "ALL":
        try:
            status_enum = TeamStatus(status_filter)
            stmt = stmt.where(Team.status == status_enum)
        except ValueError:
            pass
    else:
        # Public: only show active/cooldown teams
        stmt = stmt.where(Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN]))

    if filter:
        stmt = stmt.where(
            (Team.name.ilike(f"%{filter}%")) | (Team.ticker.ilike(f"%{filter}%"))
        )

    result = await db.execute(stmt)
    teams = result.scalars().all()

    teams_list = []
    for t in teams:
        teams_list.append(
            {
                "team_id": str(t.id),
                "name": t.name,
                "ticker": t.ticker,
                "status": t.status.value,
                "stock_price": float(t.stock_price),
                "market_cap": float(t.stock_price * t.shares_outstanding),
                "portfolio_id": t.portfolio_type,
                "eliminated_at": t.eliminated_at.isoformat()
                if t.eliminated_at
                else None,
                "rank_at_elimination": t.rank_at_elimination,
            }
        )

    return {
        "teams": teams_list,
    }


# --- Portfolio templates ---


def get_portfolio_template(portfolio_type: str) -> dict:
    templates = {
        "PORT_TECH_01": {
            "strengths": "Proprietary LLM architecture with 40% faster inference than competitors. PhD-heavy engineering team.",
            "weaknesses": "Burn rate of $500k/month. No recurring revenue model yet. Single point of failure in cloud infrastructure.",
            "opportunities": "Enterprise API licensing deals. Regulatory tailwinds favoring domestic AI providers.",
            "threats": "Open-source models commoditizing the space. Big Tech incumbents with unlimited R&D budgets.",
        },
        "PORT_LEGACY_01": {
            "strengths": "Vertically integrated supply chain. 50-year brand reputation. Pension fund fully funded.",
            "weaknesses": "Unionized workforce resistant to automation. Legacy COBOL systems. High fixed costs.",
            "opportunities": "Infrastructure bill driving steel demand. Carbon capture technology tax credits.",
            "threats": "Chinese steel dumping. ESG divestment movements targeting heavy industry.",
        },
        "PORT_DISRUPT_01": {
            "strengths": "Viral TikTok marketing channel with 2M followers. Zero inventory (dropship model).",
            "weaknesses": "No supply chain control. Quality control issues. Founder-dependent leadership.",
            "opportunities": "Celebrity collaboration pipeline. International expansion (EU markets).",
            "threats": "Platform risk (TikTok algorithm changes). Copycat competitors with lower prices.",
        },
    }
    return templates.get(portfolio_type, templates["PORT_TECH_01"])


# --- POST /teams/{team_id}/approve ---


class ApproveTeamRequest(BaseModel):
    portfolio_id: str = Field(default="PORT_TECH_01")
    starting_cash: Optional[float] = 1000000.0


class TeamApprovalResponse(BaseModel):
    team_id: str
    api_key: str
    message: str


@router.post("/{team_id}/approve", response_model=TeamApprovalResponse)
async def approve_team(
    team_id: str,
    request: ApproveTeamRequest,
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    import uuid

    try:
        team_uuid = uuid.UUID(team_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid team ID")

    team = await db.get(Team, team_uuid)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.status != TeamStatus.PENDING:
        raise HTTPException(status_code=400, detail="Team not pending approval")

    portfolio = get_portfolio_template(request.portfolio_id)

    team.portfolio_type = request.portfolio_id
    team.swot_strengths = portfolio["strengths"]
    team.swot_weaknesses = portfolio["weaknesses"]
    team.swot_opportunities = portfolio["opportunities"]
    team.swot_threats = portfolio["threats"]

    # Check if game is running — if so, activate immediately
    settings = await db.get(GameState, 1)

    if settings and settings.status == GameStatus.ACTIVE:
        team.status = TeamStatus.ACTIVE
        team.cash = (
            Decimal(str(request.starting_cash))
            if request.starting_cash
            else (settings.starting_cash or Decimal("1000000"))
        )
        team.stock_price = settings.starting_price or Decimal("100")
        team.shares_outstanding = settings.starting_shares or 1000000
        team.public_float = team.shares_outstanding // 10
        team.treasury_shares = team.shares_outstanding - team.public_float
    else:
        # Stay PENDING — will be activated when game starts
        # But mark portfolio as assigned so we know they're approved
        pass

    await db.commit()
    await db.refresh(team)

    return TeamApprovalResponse(
        team_id=str(team.id),
        api_key=str(team.api_key),
        message="Team approved and activated"
        if team.status == TeamStatus.ACTIVE
        else "Team approved, will activate on game start",
    )


# --- POST /teams/{team_id}/reject ---


class RejectTeamRequest(BaseModel):
    reason: str = ""


@router.post("/{team_id}/reject")
async def reject_team(
    team_id: str,
    request: RejectTeamRequest,
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    import uuid

    try:
        team_uuid = uuid.UUID(team_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid team ID")

    team = await db.get(Team, team_uuid)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team.status = TeamStatus.REJECTED
    team.rejection_reason = request.reason

    await db.commit()

    return {"message": "Team rejected", "team_id": team_id}


# --- POST /teams/{team_id}/bankrupt ---


class BankruptTeamRequest(BaseModel):
    reason: str = Field(default="ADMIN_OVERRIDE")
    public_message: Optional[str] = None


@router.post("/{team_id}/bankrupt")
async def force_bankrupt_team(
    team_id: str,
    request: BankruptTeamRequest,
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    """Force a team into bankruptcy (admin override)."""
    import uuid

    try:
        team_uuid = uuid.UUID(team_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid team ID")

    team = await db.get(Team, team_uuid)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.status == TeamStatus.ELIMINATED:
        raise HTTPException(status_code=400, detail="Team already eliminated")

    team.status = TeamStatus.ELIMINATED
    team.eliminated_at = datetime.utcnow()
    team.elimination_reason = request.reason
    team.stock_price = Decimal("0")

    # Zero out holdings of this team
    holdings_stmt = select(StockHolding).where(StockHolding.target_team_id == team.id)
    holdings_result = await db.execute(holdings_stmt)
    affected_holdings = holdings_result.scalars().all()
    for h in affected_holdings:
        h.shares_owned = 0

    await db.commit()

    from app.websocket import manager

    await manager.broadcast_system_event(
        "BANKRUPTCY_DECLARATION",
        {
            "event_type": "ELIMINATION",
            "message": f"{team.ticker} eliminated due to admin override",
            "ticker": team.ticker,
            "reason": request.reason,
        },
    )

    return {
        "message": f"Team {team.ticker} force-bankrupted",
        "team_id": str(team.id),
        "reason": request.reason,
    }


# Need this import for approve_team
from app.models import GameState, GameStatus  # noqa: E402
