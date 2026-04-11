from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_team
from app.database import get_db, settings
from app.models import (
    CashLedger,
    GameSettings,
    MarketNews,
    PortfolioType,
    StockHolding,
    Team,
    TeamStatus,
)
from app.worker.tasks.pricing import recalculate_price_task

router = APIRouter(prefix="/admin", tags=["admin"])


async def get_admin_user(
    api_key: str = Query(..., alias="X-Admin-Key"),
    db: AsyncSession = Depends(get_db),
):
    if api_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin key")
    return True


class ApproveTeamRequest(BaseModel):
    team_id: str
    portfolio_type: PortfolioType


class RejectTeamRequest(BaseModel):
    team_id: str
    reason: str


@router.post("/teams/approve")
async def approve_team(
    request: ApproveTeamRequest,
    admin: bool = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models import Directive, StockHolding, Transaction
    import uuid

    try:
        team_uuid = uuid.UUID(request.team_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid team ID")

    team = await db.get(Team, team_uuid)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.status != TeamStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail="Team not pending approval")

    portfolio = get_portfolio_template(request.portfolio_type)

    team.status = TeamStatus.PENDING_START
    team.portfolio_type = request.portfolio_type
    team.swot_strengths = portfolio["strengths"]
    team.swot_weaknesses = portfolio["weaknesses"]
    team.swot_opportunities = portfolio["opportunities"]
    team.swot_threats = portfolio["threats"]

    settings = await db.get(GameSettings, 1)
    if settings and settings.game_active:
        team.status = TeamStatus.ACTIVE
        team.cash = settings.starting_cash or Decimal("1000000")
        team.stock_price = settings.starting_price or Decimal("100")
        team.shares_outstanding = settings.starting_shares or 1000000
        team.public_float = team.shares_outstanding // 10
        team.treasury_shares = team.shares_outstanding - team.public_float

    await db.commit()
    await db.refresh(team)

    return {
        "message": "Team approved",
        "team_id": str(team.id),
        "status": team.status.value,
    }


@router.post("/teams/reject")
async def reject_team(
    request: RejectTeamRequest,
    admin: bool = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    import uuid

    try:
        team_uuid = uuid.UUID(request.team_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid team ID")

    team = await db.get(Team, team_uuid)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team.status = TeamStatus.REJECTED
    team.rejection_reason = request.reason

    await db.commit()

    return {"message": "Team rejected", "team_id": str(team.id)}


@router.get("/teams/pending")
async def list_pending_teams(
    admin: bool = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Team)
        .where(Team.status == TeamStatus.PENDING_APPROVAL)
        .order_by(Team.created_at)
    )
    result = await db.execute(stmt)
    teams = result.scalars().all()

    return {
        "teams": [
            {
                "id": str(t.id),
                "name": t.name,
                "ticker": t.ticker,
                "email": t.email,
                "created_at": t.created_at.isoformat(),
            }
            for t in teams
        ]
    }


@router.get("/teams")
async def list_all_teams(
    admin: bool = Depends(get_admin_user),
    status: Optional[TeamStatus] = None,
    db: AsyncSession = Depends(get_db),
):
    if status:
        stmt = select(Team).where(Team.status == status).order_by(desc(Team.cash))
    else:
        stmt = select(Team).order_by(desc(Team.cash))

    result = await db.execute(stmt)
    teams = result.scalars().all()

    return {
        "teams": [
            {
                "id": str(t.id),
                "name": t.name,
                "ticker": t.ticker,
                "status": t.status.value,
                "cash": float(t.cash),
                "stock_price": float(t.stock_price),
                "market_cap": float(t.shares_outstanding) * float(t.stock_price),
            }
            for t in teams
        ]
    }


class StartGameRequest(BaseModel):
    pass


@router.post("/game/start")
async def start_game(
    admin: bool = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await db.get(GameSettings, 1)
    if not settings:
        settings = GameSettings(id=1)
        db.add(settings)

    settings.game_active = True

    stmt = select(Team).where(Team.status == TeamStatus.PENDING_START)
    result = await db.execute(stmt)
    pending_teams = result.scalars().all()

    for team in pending_teams:
        team.status = TeamStatus.ACTIVE
        team.cash = settings.starting_cash or Decimal("1000000")
        team.stock_price = settings.starting_price or Decimal("100")
        team.shares_outstanding = settings.starting_shares or 1000000
        team.public_float = team.shares_outstanding // 10
        team.treasury_shares = team.shares_outstanding - team.public_float

    await db.commit()

    return {"message": "Game started", "teams_activated": len(pending_teams)}


@router.post("/game/stop")
async def stop_game(
    admin: bool = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await db.get(GameSettings, 1)
    if settings:
        settings.game_active = False

    await db.commit()

    return {"message": "Game stopped"}


@router.post("/game/purge")
async def initiate_market_purge(
    admin: bool = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await db.get(GameSettings, 1)

    stmt = (
        select(Team)
        .where(Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN]))
        .order_by(desc(Team.cash))
    )
    result = await db.execute(stmt)
    active_teams = result.scalars().all()

    if len(active_teams) <= 6:
        raise HTTPException(status_code=400, detail="Not enough teams for purge")

    stmt = select(func.count(Team.id)).where(Team.status == TeamStatus.PENDING_APPROVAL)
    result = await db.execute(stmt)
    pending_count = result.scalar() or 0

    if pending_count > 0:
        raise HTTPException(status_code=400, detail="Pending approvals exist")

    num_to_eliminate = len(active_teams) // 2

    eliminated = active_teams[-num_to_eliminate:]
    survivors = active_teams[: len(active_teams) - num_to_eliminate]

    for team in eliminated:
        team.status = TeamStatus.ELIMINATED
        team.stock_price = Decimal("0")

        stmt = select(StockHolding).where(StockHolding.target_team_id == team.id)
        result = await db.execute(stmt)
        holdings = result.scalars().all()

        for holding in holdings:
            holding.shares_owned = 0

    for team in survivors:
        if team.dilution_cap_percent < 30:
            team.dilution_cap_percent += 10

    if settings:
        settings.current_purge_count += 1

    await db.commit()

    return {
        "message": f"Market purge complete. {num_to_eliminate} teams eliminated.",
        "eliminated_count": num_to_eliminate,
        "remaining_count": len(survivors),
        "eliminated_tickers": [t.ticker for t in eliminated],
    }


class UpdateSettingsRequest(BaseModel):
    cooldown_minutes: Optional[int] = None
    tam_per_cycle: Optional[Decimal] = None
    starting_cash: Optional[Decimal] = None
    starting_price: Optional[Decimal] = None
    starting_shares: Optional[int] = None
    llm_model: Optional[str] = None


@router.post("/settings")
async def update_settings(
    request: UpdateSettingsRequest,
    admin: bool = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await db.get(GameSettings, 1)
    if not settings:
        settings = GameSettings(id=1)
        db.add(settings)

    if request.cooldown_minutes is not None:
        settings.cooldown_minutes = request.cooldown_minutes
    if request.tam_per_cycle is not None:
        settings.tam_per_cycle = request.tam_per_cycle
    if request.starting_cash is not None:
        settings.starting_cash = request.starting_cash
    if request.starting_price is not None:
        settings.starting_price = request.starting_price
    if request.starting_shares is not None:
        settings.starting_shares = request.starting_shares
    if request.llm_model is not None:
        settings.llm_model = request.llm_model

    await db.commit()

    return {"message": "Settings updated"}


@router.get("/settings")
async def get_settings(
    admin: bool = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await db.get(GameSettings, 1)
    if not settings:
        settings = GameSettings(id=1)

    return {
        "game_active": settings.game_active,
        "current_purge_count": settings.current_purge_count,
        "cooldown_minutes": settings.cooldown_minutes,
        "tam_per_cycle": float(settings.tam_per_cycle),
        "starting_cash": float(settings.starting_cash),
        "starting_price": float(settings.starting_price),
        "starting_shares": settings.starting_shares,
        "llm_model": settings.llm_model,
    }


@router.post("/teams/{team_id}/reset")
async def reset_team(
    team_id: str,
    admin: bool = Depends(get_admin_user),
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

    settings = await db.get(GameSettings, 1)

    team.status = TeamStatus.ACTIVE
    team.cash = settings.starting_cash if settings else Decimal("1000000")
    team.stock_price = settings.starting_price if settings else Decimal("100")
    team.public_float = team.shares_outstanding // 10
    team.treasury_shares = team.shares_outstanding - team.public_float
    team.dilution_cap_percent = 10
    team.cooldown_until = None
    team.bankrupt_since = None
    team.bankrupt_resolved = False

    stmt = select(StockHolding).where(StockHolding.owner_team_id == team.id)
    result = await db.execute(stmt)
    holdings = result.scalars().all()

    for holding in holdings:
        holding.shares_owned = 0

    await db.commit()

    return {"message": "Team reset", "team_id": str(team.id)}


class InjectNewsRequest(BaseModel):
    headline: str = Field(..., max_length=120)
    content: Optional[str] = None
    impact_type: Optional[str] = Field(
        None, pattern="^(macro_bullish|macro_bearish|sector_specific|neutral)$"
    )
    affected_sectors: Optional[list[str]] = None
    affected_tickers: Optional[list[str]] = None
    scheduled_for: Optional[datetime] = None


@router.post("/news/inject")
async def inject_global_news(
    request: InjectNewsRequest,
    admin: bool = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    news = MarketNews(
        headline=request.headline,
        source_team_id=None,
        is_global=True,
        priority=1,
    )
    if request.content:
        news.content = request.content
    db.add(news)
    await db.commit()
    await db.refresh(news)

    return {
        "news_id": str(news.id),
        "broadcast_count": 0,
        "scheduled": request.scheduled_for is not None,
    }


class SeedNewsRequest(BaseModel):
    count: int = Field(10, ge=1, le=20)


@router.post("/news/seed")
async def seed_initial_news(
    request: SeedNewsRequest,
    admin: bool = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    existing_count = await db.scalar(
        select(func.count(MarketNews.id)).where(MarketNews.is_global == True)
    )

    if existing_count > 0:
        return {"message": "Global news already exists", "count": existing_count}

    headlines = [
        "Market opens with strong consumer confidence",
        "Tech sector leads gains in early trading",
        "Central bank maintains current interest rates",
        "Global supply chains show signs of improvement",
        "New regulatory framework announced for industry",
        "Major merger talks emerge in the sector",
        "Commodity prices stabilize after recent volatility",
        "Employment data exceeds expectations",
        "Inflation readings come in below forecasts",
        "Market sentiment turns bullish on earnings reports",
    ]

    for i, headline in enumerate(headlines[: request.count]):
        news = MarketNews(
            headline=headline,
            source_team_id=None,
            is_global=True,
            priority=i,
        )
        db.add(news)

    await db.commit()

    return {"message": f"Seeded {min(request.count, len(headlines))} global news items"}


def get_portfolio_template(portfolio_type: PortfolioType) -> dict:
    templates = {
        PortfolioType.TECH_STARTUP: {
            "strengths": "Strong IP portfolio in emerging technologies. Agile decision-making structure. High talent density in engineering.",
            "weaknesses": "Limited cash reserves. Dependency on venture funding. Small market share in established segments.",
            "opportunities": "Expansion into adjacent markets. Strategic partnerships with larger enterprises. New product lines in AI and cloud.",
            "threats": "Rapid technological displacement. Regulatory scrutiny on data privacy. Competition from well-funded startups.",
        },
        PortfolioType.LEGACY_MANUFACTURER: {
            "strengths": "Established supply chain networks. Strong brand recognition. Significant physical assets and infrastructure.",
            "weaknesses": "Legacy IT systems slowing innovation. High fixed costs. Resistance to organizational change.",
            "opportunities": "Automation and digital transformation. Sustainable manufacturing practices. Emerging market expansion.",
            "threats": "Global trade policy shifts. Commodity price volatility. Environmental regulations.",
        },
        PortfolioType.DISRUPTOR: {
            "strengths": "Unconventional business model. Strong social media presence. Ability to move fast without legacy constraints.",
            "weaknesses": "Unproven profitability. Limited regulatory relationships. Dependence on growth capital.",
            "opportunities": "Market creation in untapped segments. Acquisition by larger players. Platform expansion.",
            "threats": "Regulatory crackdown on gig economy. Public perception shifts. Sustainability concerns.",
        },
        PortfolioType.CONSULTING: {
            "strengths": "Deep domain expertise across industries. Strong client relationships. Highly skilled workforce.",
            "weaknesses": "High consultant turnover. Limited proprietary technology. Margin pressure from automation.",
            "opportunities": "Digital transformation advisory. ESG consulting services. AI-enabled analytics offerings.",
            "threats": "Market consolidation. Alternative consulting models. Economic downturn impact.",
        },
        PortfolioType.RETAIL: {
            "strengths": "Extensive store network. Established e-commerce presence. Strong supply chain management.",
            "weaknesses": "Thin margins on physical stores. Inventory management challenges. Competition from pure-play e-commerce.",
            "opportunities": "Omnichannel integration. Private label expansion. Data-driven personalization.",
            "threats": "Changing consumer behavior. Rising real estate costs. Supply chain disruptions.",
        },
    }

    return templates.get(portfolio_type, templates[PortfolioType.TECH_STARTUP])
