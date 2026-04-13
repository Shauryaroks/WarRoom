from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
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
    request: Request,
    status_filter: Optional[str] = None,
    filter: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    # Accept status from multiple param names (frontend sends "filter", spec uses "status_filter")
    raw_status = (status_filter or status or "").strip().upper()
    # "filter" param: if it looks like a status name, use it as status; otherwise treat as text search
    filter_val = (filter or "").strip()
    known_statuses = {
        "ALL",
        "PENDING",
        "READY",
        "ACTIVE",
        "COOLDOWN",
        "BANKRUPT",
        "ELIMINATED",
        "REJECTED",
    }
    if not raw_status and filter_val.upper() in known_statuses:
        raw_status = filter_val.upper()
        filter_val = ""

    text_search = search or filter_val

    # Admin callers (X-Admin-Key present) default to ALL teams
    is_admin = bool(request.headers.get("X-Admin-Key"))

    stmt = select(Team)

    if raw_status == "ALL":
        pass  # Show everything
    elif raw_status:
        try:
            status_enum = TeamStatus(raw_status)
            stmt = stmt.where(Team.status == status_enum)
        except ValueError:
            pass
    elif is_admin:
        pass  # Admin with no filter: show all
    else:
        # Public view: only active/cooldown
        stmt = stmt.where(Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN]))

    if text_search:
        stmt = stmt.where(
            (Team.name.ilike(f"%{text_search}%"))
            | (Team.ticker.ilike(f"%{text_search}%"))
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


# --- POST /teams/{team_id}/approve ---


class ApproveRequest(BaseModel):
    portfolio_id: str


@router.post("/{team_id}/approve")
async def approve_team(
    team_id: str,
    request: ApproveRequest,
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    import uuid as _uuid

    try:
        team_uuid = _uuid.UUID(team_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid team ID")

    team = await db.get(Team, team_uuid)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.status != TeamStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Team is {team.status.value}, not PENDING",
        )

    template = get_portfolio_template(request.portfolio_id)
    team.portfolio_type = request.portfolio_id
    team.swot_strengths = template["strengths"]
    team.swot_weaknesses = template["weaknesses"]
    team.swot_opportunities = template["opportunities"]
    team.swot_threats = template["threats"]
    team.status = TeamStatus.READY

    await db.commit()

    return {
        "message": "Team approved",
        "team_id": str(team.id),
        "status": team.status.value,
        "portfolio_id": team.portfolio_type,
    }


# --- POST /teams/{team_id}/reject ---


class RejectRequest(BaseModel):
    reason: str = "Admin Rejection"


@router.post("/{team_id}/reject")
async def reject_team(
    team_id: str,
    request: RejectRequest,
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    import uuid as _uuid

    try:
        team_uuid = _uuid.UUID(team_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid team ID")

    team = await db.get(Team, team_uuid)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.status not in [TeamStatus.PENDING, TeamStatus.READY]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Team is {team.status.value}, cannot reject",
        )

    await db.delete(team)
    await db.commit()

    return {
        "message": "Team rejected and deleted",
        "team_id": str(team.id),
        "reason": request.reason,
    }


# --- POST /teams/{team_id}/bankrupt ---


class BankruptRequest(BaseModel):
    reason: str = "Admin Override"


@router.post("/{team_id}/bankrupt")
async def force_bankrupt_team(
    team_id: str,
    request: BankruptRequest,
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    import uuid as _uuid

    try:
        team_uuid = _uuid.UUID(team_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid team ID")

    team = await db.get(Team, team_uuid)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.status not in [TeamStatus.ACTIVE, TeamStatus.COOLDOWN]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Team is {team.status.value}, cannot bankrupt",
        )

    now = datetime.now(timezone.utc)
    team.status = TeamStatus.BANKRUPT
    team.bankrupt_since = now
    team.elimination_reason = request.reason

    await db.commit()

    # Broadcast bankruptcy event via WebSocket
    from app.websocket import manager

    await manager.broadcast_system_event(
        "BANKRUPTCY_DECLARATION",
        {
            "team_id": str(team.id),
            "ticker": team.ticker,
            "reason": request.reason,
        },
    )

    return {
        "message": "Team declared bankrupt",
        "team_id": str(team.id),
        "ticker": team.ticker,
    }


# --- GET /teams/{team_id} ---


@router.get("/{team_id}", response_model=dict)
async def get_team(
    team_id: str,
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    import uuid as _uuid

    try:
        team_uuid = _uuid.UUID(team_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid team ID")

    team = await db.get(Team, team_uuid)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    return {
        "team_id": str(team.id),
        "name": team.name,
        "ticker": team.ticker,
        "email": team.email,
        "status": team.status.value,
        "portfolio_type": team.portfolio_type,
        "cash": float(team.cash),
        "stock_price": float(team.stock_price),
        "shares_outstanding": team.shares_outstanding,
        "public_float": team.public_float,
        "treasury_shares": team.treasury_shares,
        "cooldown_until": team.cooldown_until.isoformat()
        if team.cooldown_until
        else None,
        "bankrupt_since": team.bankrupt_since.isoformat()
        if team.bankrupt_since
        else None,
        "eliminated_at": team.eliminated_at.isoformat() if team.eliminated_at else None,
        "elimination_reason": team.elimination_reason,
        "rank_at_elimination": team.rank_at_elimination,
    }


# --- PUT /teams/{team_id} ---


class TeamUpdateRequest(BaseModel):
    name: Optional[str] = None
    ticker: Optional[str] = None
    status: Optional[str] = None
    cash: Optional[float] = None
    stock_price: Optional[float] = None
    portfolio_type: Optional[str] = None
    shares_outstanding: Optional[int] = None
    public_float: Optional[int] = None
    treasury_shares: Optional[int] = None
    email: Optional[str] = None


@router.put("/{team_id}", response_model=dict)
async def update_team(
    team_id: str,
    request: TeamUpdateRequest,
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    import uuid as _uuid

    try:
        team_uuid = _uuid.UUID(team_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid team ID")

    team = await db.get(Team, team_uuid)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if request.name is not None:
        team.name = request.name
    if request.ticker is not None:
        team.ticker = request.ticker
    if request.email is not None:
        team.email = request.email
    if request.status is not None:
        try:
            team.status = TeamStatus(request.status)
        except ValueError:
            raise HTTPException(
                status_code=400, detail=f"Invalid status: {request.status}"
            )
    if request.cash is not None:
        team.cash = request.cash
    if request.stock_price is not None:
        team.stock_price = request.stock_price
    if request.portfolio_type is not None:
        team.portfolio_type = request.portfolio_type
    if request.shares_outstanding is not None:
        team.shares_outstanding = request.shares_outstanding
    if request.public_float is not None:
        team.public_float = request.public_float
    if request.treasury_shares is not None:
        team.treasury_shares = request.treasury_shares

    await db.commit()

    return {
        "team_id": str(team.id),
        "name": team.name,
        "ticker": team.ticker,
        "email": team.email,
        "status": team.status.value,
        "portfolio_type": team.portfolio_type,
        "cash": float(team.cash),
        "stock_price": float(team.stock_price),
        "shares_outstanding": team.shares_outstanding,
        "public_float": team.public_float,
        "treasury_shares": team.treasury_shares,
    }


# --- DELETE /teams/{team_id} ---


@router.delete("/{team_id}")
async def delete_team(
    team_id: str,
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    import uuid as _uuid

    try:
        team_uuid = _uuid.UUID(team_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid team ID")

    team = await db.get(Team, team_uuid)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    await db.delete(team)
    await db.commit()

    return {"message": "Team deleted"}


# --- Portfolio templates ---


PORTFOLIO_TEMPLATES = {
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


def get_portfolio_template(portfolio_type: str) -> dict:
    return PORTFOLIO_TEMPLATES.get(portfolio_type, PORTFOLIO_TEMPLATES["PORT_TECH_01"])
