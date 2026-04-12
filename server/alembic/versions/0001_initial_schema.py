"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums
    teamstatus = postgresql.ENUM(
        "PENDING", "ACTIVE", "COOLDOWN", "BANKRUPT", "ELIMINATED", "REJECTED",
        name="teamstatus", create_type=False,
    )
    gamestatus = postgresql.ENUM(
        "SETUP", "ACTIVE", "PAUSED", "FINISHED",
        name="gamestatus", create_type=False,
    )
    transactiontype = postgresql.ENUM(
        "BUY", "SELL", "TREASURY_SALE", "BANKRUPTCY_LIQUIDATION",
        name="transactiontype", create_type=False,
    )
    directivestatus = postgresql.ENUM(
        "PENDING", "PROCESSING", "COMPLETED", "FAILED",
        name="directivestatus", create_type=False,
    )

    # Create enum types first
    teamstatus.create(op.get_bind(), checkfirst=True)
    gamestatus.create(op.get_bind(), checkfirst=True)
    transactiontype.create(op.get_bind(), checkfirst=True)
    directivestatus.create(op.get_bind(), checkfirst=True)

    # --- teams ---
    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("ticker", sa.String(10), unique=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("api_key", postgresql.UUID(as_uuid=True), unique=True),
        sa.Column("status", teamstatus, nullable=False),
        sa.Column("portfolio_type", sa.String(50), nullable=True),
        sa.Column("swot_strengths", sa.Text, nullable=True),
        sa.Column("swot_weaknesses", sa.Text, nullable=True),
        sa.Column("swot_opportunities", sa.Text, nullable=True),
        sa.Column("swot_threats", sa.Text, nullable=True),
        sa.Column("cash", sa.Numeric(15, 2), server_default="1000000"),
        sa.Column("stock_price", sa.Numeric(10, 2), server_default="100"),
        sa.Column("shares_outstanding", sa.Integer, server_default="1000000"),
        sa.Column("public_float", sa.Integer, server_default="100000"),
        sa.Column("treasury_shares", sa.Integer, server_default="900000"),
        sa.Column("cooldown_until", sa.DateTime, nullable=True),
        sa.Column("bankrupt_since", sa.DateTime, nullable=True),
        sa.Column("bankrupt_resolved", sa.Boolean, server_default="false"),
        sa.Column("dilution_cap_percent", sa.Integer, server_default="10"),
        sa.Column("eliminated_at", sa.DateTime, nullable=True),
        sa.Column("elimination_reason", sa.String(20), nullable=True),
        sa.Column("rank_at_elimination", sa.Integer, nullable=True),
        sa.Column("rejection_reason", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # --- directives ---
    op.create_table(
        "directives",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("confidence_rating", sa.Float, nullable=True),
        sa.Column("status", directivestatus, nullable=False),
        sa.Column("extraction_confidence", sa.Float, nullable=True),
        sa.Column("consistency_score", sa.Float, nullable=True),
        sa.Column("macro_sensitivity_score", sa.Float, nullable=True),
        sa.Column("aggression_score", sa.Float, nullable=True),
        sa.Column("innovation_score", sa.Float, nullable=True),
        sa.Column("vibe_multiplier", sa.Numeric(5, 2), nullable=True),
        sa.Column("financial_impact", sa.Text, nullable=True),
        sa.Column("board_feedback", sa.Text, nullable=True),
        sa.Column("news_headline", sa.Text, nullable=True),
        sa.Column("execution_penalty", sa.Float, server_default="1.0"),
        sa.Column("latency_ms", sa.Integer, nullable=True),
        sa.Column("estimated_cost", sa.Numeric(10, 6), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("completed_at", sa.DateTime, nullable=True),
    )

    # --- stock_holdings ---
    op.create_table(
        "stock_holdings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("target_team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("shares_owned", sa.Integer, server_default="0"),
        sa.Column("total_cost_basis", sa.Numeric(15, 2), server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_stock_holdings_owner_target", "stock_holdings", ["owner_team_id", "target_team_id"])

    # --- transactions ---
    op.create_table(
        "transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("buyer_team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=True),
        sa.Column("seller_team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=True),
        sa.Column("target_team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("shares", sa.Integer, nullable=False),
        sa.Column("price_per_share", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_value", sa.Numeric(15, 2), nullable=False),
        sa.Column("transaction_type", transactiontype, nullable=False),
        sa.Column("executed_at", sa.DateTime, nullable=False),
    )

    # --- cash_ledger ---
    op.create_table(
        "cash_ledger",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("entry_type", sa.String(50), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("balance_after", sa.Numeric(15, 2), nullable=False),
        sa.Column("reference_type", sa.String(50), nullable=True),
        sa.Column("reference_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    # --- price_history ---
    op.create_table(
        "price_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("market_cap", sa.Numeric(15, 2), nullable=False),
        sa.Column("vibe_multiplier", sa.Numeric(5, 2), nullable=True),
        sa.Column("sentiment_multiplier", sa.Numeric(5, 2), nullable=True),
        sa.Column("consistency_score", sa.Float, nullable=True),
        sa.Column("macro_sensitivity_score", sa.Float, nullable=True),
        sa.Column("profit_component", sa.Numeric(15, 2), nullable=True),
        sa.Column("cash_component", sa.Numeric(15, 2), nullable=True),
        sa.Column("calculated_at", sa.DateTime, nullable=False),
    )

    # --- market_news ---
    op.create_table(
        "market_news",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("headline", sa.String(120), nullable=False),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("source_type", sa.String(20), server_default="'SYSTEM'"),
        sa.Column("source_team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=True),
        sa.Column("sentiment_score", sa.Numeric(3, 2), nullable=True),
        sa.Column("affected_sectors", sa.Text, nullable=True),
        sa.Column("affected_tickers", sa.Text, nullable=True),
        sa.Column("relevance_decay", sa.Numeric(3, 2), server_default="1.00"),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    # --- game_state ---
    op.create_table(
        "game_state",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("status", gamestatus, nullable=False),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("paused_at", sa.DateTime, nullable=True),
        sa.Column("resumed_at", sa.DateTime, nullable=True),
        sa.Column("finished_at", sa.DateTime, nullable=True),
        sa.Column("current_round", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_purge_at", sa.DateTime, nullable=True),
        sa.Column("next_purge_at", sa.DateTime, nullable=True),
        sa.Column("teams_remaining", sa.Integer, nullable=True),
        sa.Column("purge_min_teams", sa.Integer, nullable=False, server_default="6"),
        sa.Column("llm_queue_depth", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_llm_cost", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("cooldown_minutes", sa.Integer, nullable=False, server_default="10"),
        sa.Column("tam_per_cycle", sa.Numeric(15, 2), nullable=False, server_default="50000000"),
        sa.Column("starting_cash", sa.Numeric(15, 2), nullable=False, server_default="1000000"),
        sa.Column("starting_price", sa.Numeric(10, 2), nullable=False, server_default="100"),
        sa.Column("starting_shares", sa.Integer, nullable=False, server_default="1000000"),
        sa.Column("llm_model", sa.String(50), nullable=False, server_default="'grok-3-mini'"),
        sa.Column("llm_max_tokens", sa.Integer, nullable=False, server_default="2000"),
        sa.Column("llm_temperature", sa.Float, nullable=False, server_default="0.7"),
        sa.Column("sentiment_map", sa.Text, nullable=True),
        sa.Column("aggregate_market_cap_at_purge", sa.Numeric(15, 2), nullable=True),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("game_state")
    op.drop_table("market_news")
    op.drop_table("price_history")
    op.drop_table("cash_ledger")
    op.drop_table("transactions")
    op.drop_table("stock_holdings")
    op.drop_table("directives")
    op.drop_table("teams")

    op.execute("DROP TYPE IF EXISTS directivestatus")
    op.execute("DROP TYPE IF EXISTS transactiontype")
    op.execute("DROP TYPE IF EXISTS gamestatus")
    op.execute("DROP TYPE IF EXISTS teamstatus")
