import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class TeamStatus(str, enum.Enum):
    PENDING = "PENDING"
    READY = "READY"
    ACTIVE = "ACTIVE"
    COOLDOWN = "COOLDOWN"
    BANKRUPT = "BANKRUPT"
    ELIMINATED = "ELIMINATED"
    REJECTED = "REJECTED"


class GameStatus(str, enum.Enum):
    SETUP = "SETUP"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    FINISHED = "FINISHED"


class TransactionType(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"
    TREASURY_SALE = "TREASURY_SALE"
    BANKRUPTCY_LIQUIDATION = "BANKRUPTCY_LIQUIDATION"


class SolutionType(str, enum.Enum):
    INITIAL = "INITIAL"              # Full strategic roadmap (per D-02)
    MICROTWEAK = "MICROTWEAK"        # Additive tweak (per D-03)
    CRISIS_RESPONSE = "CRISIS_RESPONSE"  # Crisis event response (per D-04)


class EvaluationStatus(str, enum.Enum):
    PROCESSING = "PROCESSING"          # LLM call in progress
    PENDING_APPROVAL = "PENDING_APPROVAL"  # Awaiting admin review (per EVAL-03)
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"                  # LLM call failed


class DirectiveStatus(str, enum.Enum):
    PENDING = "PENDING"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class PortfolioType(str, enum.Enum):
    TECH_STARTUP = "TECH_STARTUP"
    LEGACY_MANUFACTURER = "LEGACY_MANUFACTURER"
    DISRUPTOR = "DISRUPTOR"
    CONSULTING = "CONSULTING"
    RETAIL = "RETAIL"


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    ticker: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)

    # Dual credentials per D-01: Strategist + Trader sub-accounts
    strategist_email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    strategist_password_hash: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    trader_email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    trader_password_hash: Mapped[str] = mapped_column(
        String(255), nullable=False
    )

    status: Mapped[TeamStatus] = mapped_column(
        Enum(TeamStatus), default=TeamStatus.PENDING
    )
    portfolio_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Admin approval tracking
    approved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # SWOT Profile
    swot_strengths: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    swot_weaknesses: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    swot_opportunities: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    swot_threats: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Financial State
    cash: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("1000000"))
    stock_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("100")
    )
    shares_outstanding: Mapped[int] = mapped_column(Integer, default=1000000)
    public_float: Mapped[int] = mapped_column(Integer, default=100000)
    treasury_shares: Mapped[int] = mapped_column(Integer, default=900000)

    # Simulation: price trajectory (per D-05, Phase 4 mock score input)
    target_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    ticks_to_target: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Cooldown
    cooldown_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Bankruptcy tracking
    bankrupt_since: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    bankrupt_resolved: Mapped[bool] = mapped_column(Boolean, default=False)

    # Dilution cap (percentage of treasury shares that can be sold)
    dilution_cap_percent: Mapped[int] = mapped_column(Integer, default=10)

    # Elimination tracking
    eliminated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    elimination_reason: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True
    )
    rank_at_elimination: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Admin rejection reason
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Caseline document (per D-12, D-14)
    caseline_document: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    company_display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )

    # Relationships
    directives: Mapped[list["Directive"]] = relationship(
        "Directive", back_populates="team", order_by="desc(Directive.created_at)"
    )
    stock_holdings: Mapped[list["StockHolding"]] = relationship(
        "StockHolding",
        back_populates="owner_team",
        foreign_keys="StockHolding.owner_team_id",
    )
    transactions_as_buyer: Mapped[list["Transaction"]] = relationship(
        "Transaction", foreign_keys="Transaction.buyer_team_id", back_populates="buyer"
    )
    transactions_as_seller: Mapped[list["Transaction"]] = relationship(
        "Transaction",
        foreign_keys="Transaction.seller_team_id",
        back_populates="seller",
    )
    transactions_as_target: Mapped[list["Transaction"]] = relationship(
        "Transaction",
        foreign_keys="Transaction.target_team_id",
        back_populates="target_team",
    )
    cash_ledger: Mapped[list["CashLedger"]] = relationship(
        "CashLedger", back_populates="team", foreign_keys="CashLedger.team_id"
    )
    price_history: Mapped[list["PriceHistory"]] = relationship(
        "PriceHistory",
        back_populates="team",
        foreign_keys="PriceHistory.team_id",
        order_by="desc(PriceHistory.calculated_at)",
    )


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class Directive(Base):
    __tablename__ = "directives"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_rating: Mapped[Optional[float]] = mapped_column(nullable=True)

    status: Mapped[DirectiveStatus] = mapped_column(
        Enum(DirectiveStatus), default=DirectiveStatus.PENDING
    )

    # LLM Evaluation
    extraction_confidence: Mapped[Optional[float]] = mapped_column(nullable=True)
    consistency_score: Mapped[Optional[float]] = mapped_column(nullable=True)
    macro_sensitivity_score: Mapped[Optional[float]] = mapped_column(nullable=True)
    aggression_score: Mapped[Optional[float]] = mapped_column(nullable=True)
    innovation_score: Mapped[Optional[float]] = mapped_column(nullable=True)
    vibe_multiplier: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 2), nullable=True
    )

    # Financial Impact (JSON stored as text)
    financial_impact: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON

    # Board Feedback
    board_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    news_headline: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Execution penalty
    execution_penalty: Mapped[float] = mapped_column(default=1.0)

    # LLM call tracking
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    estimated_cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 6), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="directives")


class Solution(Base):
    __tablename__ = "solutions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    solution_type: Mapped[SolutionType] = mapped_column(
        Enum(SolutionType), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    # Relationships
    team: Mapped["Team"] = relationship("Team")
    evaluation: Mapped[Optional["Evaluation"]] = relationship(
        "Evaluation", back_populates="solution", uselist=False
    )


class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    solution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solutions.id"), unique=True, nullable=False
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False
    )

    status: Mapped[EvaluationStatus] = mapped_column(
        Enum(EvaluationStatus), default=EvaluationStatus.PROCESSING
    )

    # LLM output: scoring metrics (per D-06 -- placeholder fields)
    scoring_metrics: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON
    overall_score: Mapped[Optional[float]] = mapped_column(nullable=True)

    # LLM output: price timeline (per D-06)
    price_timeline: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON array

    # LLM output: news article (per D-06)
    news_headline: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    news_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    news_sentiment: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(3, 2), nullable=True
    )

    # LLM call tracking
    llm_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    llm_latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    llm_cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 6), nullable=True
    )
    raw_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Approval tracking
    approved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejected_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    # Relationships
    solution: Mapped["Solution"] = relationship(
        "Solution", back_populates="evaluation"
    )
    team: Mapped["Team"] = relationship("Team")


class StockHolding(Base):
    __tablename__ = "stock_holdings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False
    )
    target_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False
    )
    shares_owned: Mapped[int] = mapped_column(Integer, default=0)
    total_cost_basis: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("0")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )

    # Relationships
    owner_team: Mapped["Team"] = relationship(
        "Team", foreign_keys=[owner_team_id], back_populates="stock_holdings"
    )
    target_team: Mapped["Team"] = relationship("Team", foreign_keys=[target_team_id])

    __table_args__ = (
        Index("ix_stock_holdings_owner_target", "owner_team_id", "target_team_id"),
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    buyer_team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True
    )
    seller_team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True
    )
    target_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False
    )
    shares: Mapped[int] = mapped_column(Integer, nullable=False)
    price_per_share: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)

    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType), nullable=False
    )

    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    # Relationships
    buyer: Mapped[Optional["Team"]] = relationship(
        "Team", foreign_keys=[buyer_team_id], back_populates="transactions_as_buyer"
    )
    seller: Mapped[Optional["Team"]] = relationship(
        "Team", foreign_keys=[seller_team_id], back_populates="transactions_as_seller"
    )
    target_team: Mapped["Team"] = relationship(
        "Team", foreign_keys=[target_team_id], back_populates="transactions_as_target"
    )


class CashLedger(Base):
    __tablename__ = "cash_ledger"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False
    )
    entry_type: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    # Relationships
    team: Mapped["Team"] = relationship(
        "Team", foreign_keys=[team_id], back_populates="cash_ledger"
    )


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False
    )
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    market_cap: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    vibe_multiplier: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    sentiment_multiplier: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    consistency_score: Mapped[Optional[float]] = mapped_column(nullable=True)
    macro_sensitivity_score: Mapped[Optional[float]] = mapped_column(nullable=True)
    profit_component: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2), nullable=True
    )
    cash_component: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2), nullable=True
    )

    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Relationships
    team: Mapped["Team"] = relationship(
        "Team", foreign_keys=[team_id], back_populates="price_history"
    )


class MarketNews(Base):
    __tablename__ = "market_news"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    headline: Mapped[str] = mapped_column(String(120), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(
        String(20), default="SYSTEM"
    )  # GLOBAL, TEAM_ACTION, SYSTEM, ADMIN_INJECTED
    source_team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True
    )
    sentiment_score: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(3, 2), nullable=True
    )  # -1.0 to +1.0
    affected_sectors: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON array stored as text
    affected_tickers: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON array stored as text
    relevance_decay: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), default=Decimal("1.00")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class ActivityEvent(Base):
    __tablename__ = "activity_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # TEAM_APPROVED, TEAM_REJECTED, TEAM_REMOVED, NEWS_INJECTED, BROADCAST_SENT, ROUND_ADVANCED, GAME_STARTED, GAME_PAUSED, GAME_RESUMED
    actor: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # "admin" or team name
    description: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON for extra context
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class CrisisEvent(Base):
    __tablename__ = "crisis_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    scenario: Mapped[str] = mapped_column(Text, nullable=False)
    timer_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="ACTIVE"
    )  # ACTIVE, RESOLVED
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class GameState(Base):
    __tablename__ = "game_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    status: Mapped[GameStatus] = mapped_column(
        Enum(GameStatus), default=GameStatus.SETUP
    )

    # Timing
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    paused_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resumed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Pause offset (total seconds of paused time)
    pause_offset: Mapped[int] = mapped_column(Integer, default=0)

    # Purge tracking
    current_round: Mapped[int] = mapped_column(Integer, default=0)
    last_purge_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    next_purge_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    teams_remaining: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    purge_min_teams: Mapped[int] = mapped_column(Integer, default=6)

    # LLM tracking
    llm_queue_depth: Mapped[int] = mapped_column(Integer, default=0)
    total_llm_cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0")
    )

    # Game config
    cooldown_minutes: Mapped[int] = mapped_column(Integer, default=10)
    tam_per_cycle: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("50000000")
    )
    starting_cash: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("1000000")
    )
    starting_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("100")
    )
    starting_shares: Mapped[int] = mapped_column(Integer, default=1000000)

    # LLM Configuration
    llm_model: Mapped[str] = mapped_column(
        String(50), default="nvidia/nemotron-3-super-120b-a12b:free"
    )
    llm_max_tokens: Mapped[int] = mapped_column(Integer, default=2000)
    llm_temperature: Mapped[float] = mapped_column(default=0.7)

    # News sentiment mapping (JSON: {"macro_bullish": 0.6, ...})
    sentiment_map: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON, if null use defaults

    # Market cap tracking for admin metrics
    aggregate_market_cap_at_purge: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2), nullable=True
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
