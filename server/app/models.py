import enum
import uuid
from datetime import datetime
from decimal import Decimal

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


class TeamStatus(str, enum.Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    PENDING_START = "PENDING_START"
    ACTIVE = "ACTIVE"
    COOLDOWN = "COOLDOWN"
    BANKRUPT = "BANKRUPT"
    ELIMINATED = "ELIMINATED"
    REJECTED = "REJECTED"


class TransactionType(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"
    TREASURY_SALE = "TREASURY_SALE"
    BANKRUPTCY_LIQUIDATION = "BANKRUPTCY_LIQUIDATION"


class DirectiveStatus(str, enum.Enum):
    PENDING = "PENDING"
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
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    api_key: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, default=uuid.uuid4
    )
    status: Mapped[TeamStatus] = mapped_column(
        Enum(TeamStatus), default=TeamStatus.PENDING_APPROVAL
    )
    portfolio_type: Mapped[PortfolioType] = mapped_column(
        Enum(PortfolioType), nullable=True
    )

    # SWOT Profile
    swot_strengths: Mapped[str] = mapped_column(Text, nullable=True)
    swot_weaknesses: Mapped[str] = mapped_column(Text, nullable=True)
    swot_opportunities: Mapped[str] = mapped_column(Text, nullable=True)
    swot_threats: Mapped[str] = mapped_column(Text, nullable=True)

    # Financial State
    cash: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("1000000"))
    stock_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("100"))
    shares_outstanding: Mapped[int] = mapped_column(Integer, default=1000000)
    public_float: Mapped[int] = mapped_column(Integer, default=100000)
    treasury_shares: Mapped[int] = mapped_column(Integer, default=900000)

    # Cooldown
    cooldown_until: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Bankruptcy tracking
    bankrupt_since: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    bankrupt_resolved: Mapped[bool] = mapped_column(Boolean, default=False)

    # Dilution cap (percentage of treasury shares that can be sold)
    dilution_cap_percent: Mapped[int] = mapped_column(Integer, default=10)

    # Admin rejection reason
    rejection_reason: Mapped[str] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.utcnow()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow()
    )

    # Relationships
    directives: Mapped[list["Directive"]] = relationship(
        "Directive", back_populates="team", order_by="desc(Directive.created_at)"
    )
    stock_holdings: Mapped[list["StockHolding"]] = relationship(
        "StockHolding", back_populates="owner_team"
    )
    transactions_as_buyer: Mapped[list["Transaction"]] = relationship(
        "Transaction", foreign_keys="Transaction.buyer_team_id", back_populates="buyer"
    )
    transactions_as_seller: Mapped[list["Transaction"]] = relationship(
        "Transaction",
        foreign_keys="Transaction.seller_team_id",
        back_populates="seller",
    )
    cash_ledger: Mapped[list["CashLedger"]] = relationship(
        "CashLedger", back_populates="team"
    )
    price_history: Mapped[list["PriceHistory"]] = relationship(
        "PriceHistory",
        back_populates="team",
        order_by="desc(PriceHistory.calculated_at)",
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
    confidence_rating: Mapped[float] = mapped_column(nullable=True)

    status: Mapped[DirectiveStatus] = mapped_column(
        Enum(DirectiveStatus), default=DirectiveStatus.PENDING
    )

    # LLM Evaluation
    extraction_confidence: Mapped[float] = mapped_column(nullable=True)
    consistency_score: Mapped[float] = mapped_column(nullable=True)
    macro_sensitivity_score: Mapped[float] = mapped_column(nullable=True)
    aggression_score: Mapped[float] = mapped_column(nullable=True)
    innovation_score: Mapped[float] = mapped_column(nullable=True)
    vibe_multiplier: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=True)

    # Financial Impact (JSON stored as text)
    financial_impact: Mapped[str] = mapped_column(Text, nullable=True)  # JSON

    # Board Feedback
    board_feedback: Mapped[str] = mapped_column(Text, nullable=True)
    news_headline: Mapped[str] = mapped_column(Text, nullable=True)

    # Execution penalty
    execution_penalty: Mapped[float] = mapped_column(default=1.0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.utcnow()
    )
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="directives")


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

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.utcnow()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow()
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
    buyer_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True
    )
    seller_team_id: Mapped[uuid.UUID] = mapped_column(
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
        DateTime, default=lambda: datetime.utcnow()
    )

    # Relationships
    buyer: Mapped["Team"] = relationship(
        "Team", foreign_keys=[buyer_team_id], back_populates="transactions_as_buyer"
    )
    seller: Mapped["Team"] = relationship(
        "Team", foreign_keys=[seller_team_id], back_populates="transactions_as_seller"
    )
    target_team: Mapped["Team"] = relationship("Team", foreign_keys=[target_team_id])


class CashLedger(Base):
    __tablename__ = "cash_ledger"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False
    )
    entry_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # e.g., "TRADE_BUY", "DIRECTIVE_PROFIT"
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    reference_type: Mapped[str] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.utcnow()
    )

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="cash_ledger")


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
    vibe_multiplier: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=True)
    sentiment_multiplier: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=True)
    consistency_score: Mapped[float] = mapped_column(nullable=True)
    macro_sensitivity_score: Mapped[float] = mapped_column(nullable=True)
    profit_component: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=True)
    cash_component: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=True)

    calculated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="price_history")


class MarketNews(Base):
    __tablename__ = "market_news"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    headline: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=True)
    source_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True
    )
    is_global: Mapped[bool] = mapped_column(
        Boolean, default=False
    )  # System-generated news
    priority: Mapped[int] = mapped_column(Integer, default=0)  # Higher = more important

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.utcnow()
    )


class GameSettings(Base):
    __tablename__ = "game_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    game_active: Mapped[bool] = mapped_column(Boolean, default=False)
    current_purge_count: Mapped[int] = mapped_column(Integer, default=0)
    cooldown_minutes: Mapped[int] = mapped_column(Integer, default=10)
    tam_per_cycle: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("50000000")
    )  # Total Addressable Market
    starting_cash: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("1000000")
    )
    starting_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("100")
    )
    starting_shares: Mapped[int] = mapped_column(Integer, default=1000000)

    # LLM Configuration
    llm_model: Mapped[str] = mapped_column(
        String(50), default="anthropic/claude-3.5-sonnet"
    )
    llm_max_tokens: Mapped[int] = mapped_column(Integer, default=2000)
    llm_temperature: Mapped[float] = mapped_column(default=0.7)
