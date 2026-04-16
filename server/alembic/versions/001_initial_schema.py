"""Initial schema for Complex platform

Revision ID: 001_initial
Revises:
Create Date: 2026-04-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Teams table
    op.create_table(
        "teams",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("ticker", sa.String(10), unique=True, nullable=False),
        sa.Column("strategist_email", sa.String(255), unique=True, nullable=False),
        sa.Column("strategist_password_hash", sa.String(255), nullable=False),
        sa.Column("trader_email", sa.String(255), unique=True, nullable=False),
        sa.Column("trader_password_hash", sa.String(255), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "READY",
                "ACTIVE",
                "COOLDOWN",
                "BANKRUPT",
                "ELIMINATED",
                "REJECTED",
                name="teamstatus",
            ),
            server_default="PENDING",
        ),
        sa.Column("portfolio_type", sa.String(50), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        # SWOT
        sa.Column("swot_strengths", sa.Text, nullable=True),
        sa.Column("swot_weaknesses", sa.Text, nullable=True),
        sa.Column("swot_opportunities", sa.Text, nullable=True),
        sa.Column("swot_threats", sa.Text, nullable=True),
        # Financial
        sa.Column("cash", sa.Numeric(15, 2), server_default="1000000"),
        sa.Column("stock_price", sa.Numeric(10, 2), server_default="100"),
        sa.Column("shares_outstanding", sa.Integer, server_default="1000000"),
        sa.Column("public_float", sa.Integer, server_default="100000"),
        sa.Column("treasury_shares", sa.Integer, server_default="900000"),
        # Cooldown
        sa.Column("cooldown_until", sa.DateTime(timezone=True), nullable=True),
        # Bankruptcy
        sa.Column("bankrupt_since", sa.DateTime(timezone=True), nullable=True),
        sa.Column("bankrupt_resolved", sa.Boolean, server_default="false"),
        # Dilution
        sa.Column("dilution_cap_percent", sa.Integer, server_default="10"),
        # Elimination
        sa.Column("eliminated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("elimination_reason", sa.String(20), nullable=True),
        sa.Column("rank_at_elimination", sa.Integer, nullable=True),
        # Admin
        sa.Column("rejection_reason", sa.Text, nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Admins table
    op.create_table(
        "admins",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Game state table
    op.create_table(
        "game_state",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "status",
            sa.Enum("SETUP", "ACTIVE", "PAUSED", "FINISHED", name="gamestatus"),
            server_default="SETUP",
        ),
        # Timing
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pause_offset", sa.Integer, server_default="0"),
        # Purge
        sa.Column("current_round", sa.Integer, server_default="0"),
        sa.Column("last_purge_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_purge_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("teams_remaining", sa.Integer, nullable=True),
        sa.Column("purge_min_teams", sa.Integer, server_default="6"),
        # LLM tracking
        sa.Column("llm_queue_depth", sa.Integer, server_default="0"),
        sa.Column("total_llm_cost", sa.Numeric(10, 2), server_default="0"),
        # Game config
        sa.Column("cooldown_minutes", sa.Integer, server_default="10"),
        sa.Column("tam_per_cycle", sa.Numeric(15, 2), server_default="50000000"),
        sa.Column("starting_cash", sa.Numeric(15, 2), server_default="1000000"),
        sa.Column("starting_price", sa.Numeric(10, 2), server_default="100"),
        sa.Column("starting_shares", sa.Integer, server_default="1000000"),
        # LLM config
        sa.Column(
            "llm_model",
            sa.String(50),
            server_default="nvidia/nemotron-3-super-120b-a12b:free",
        ),
        sa.Column("llm_max_tokens", sa.Integer, server_default="2000"),
        sa.Column("llm_temperature", sa.Float, server_default="0.7"),
        # Sentiment
        sa.Column("sentiment_map", sa.Text, nullable=True),
        # Market cap
        sa.Column(
            "aggregate_market_cap_at_purge", sa.Numeric(15, 2), nullable=True
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Directives table
    op.create_table(
        "directives",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "team_id",
            UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=False,
        ),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("confidence_rating", sa.Float, nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "PENDING_APPROVAL",
                "PROCESSING",
                "COMPLETED",
                "FAILED",
                name="directivestatus",
            ),
            server_default="PENDING",
        ),
        # LLM Evaluation
        sa.Column("extraction_confidence", sa.Float, nullable=True),
        sa.Column("consistency_score", sa.Float, nullable=True),
        sa.Column("macro_sensitivity_score", sa.Float, nullable=True),
        sa.Column("aggression_score", sa.Float, nullable=True),
        sa.Column("innovation_score", sa.Float, nullable=True),
        sa.Column("vibe_multiplier", sa.Numeric(5, 2), nullable=True),
        # Financial impact
        sa.Column("financial_impact", sa.Text, nullable=True),
        # Board feedback
        sa.Column("board_feedback", sa.Text, nullable=True),
        sa.Column("news_headline", sa.Text, nullable=True),
        # Execution
        sa.Column("execution_penalty", sa.Float, server_default="1.0"),
        # LLM tracking
        sa.Column("latency_ms", sa.Integer, nullable=True),
        sa.Column("estimated_cost", sa.Numeric(10, 6), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Stock holdings table
    op.create_table(
        "stock_holdings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "owner_team_id",
            UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=False,
        ),
        sa.Column(
            "target_team_id",
            UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=False,
        ),
        sa.Column("shares_owned", sa.Integer, server_default="0"),
        sa.Column("total_cost_basis", sa.Numeric(15, 2), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_stock_holdings_owner_target",
        "stock_holdings",
        ["owner_team_id", "target_team_id"],
    )

    # Transactions table
    op.create_table(
        "transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "buyer_team_id",
            UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=True,
        ),
        sa.Column(
            "seller_team_id",
            UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=True,
        ),
        sa.Column(
            "target_team_id",
            UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=False,
        ),
        sa.Column("shares", sa.Integer, nullable=False),
        sa.Column("price_per_share", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_value", sa.Numeric(15, 2), nullable=False),
        sa.Column(
            "transaction_type",
            sa.Enum(
                "BUY",
                "SELL",
                "TREASURY_SALE",
                "BANKRUPTCY_LIQUIDATION",
                name="transactiontype",
            ),
            nullable=False,
        ),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Cash ledger table
    op.create_table(
        "cash_ledger",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "team_id",
            UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=False,
        ),
        sa.Column("entry_type", sa.String(50), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("balance_after", sa.Numeric(15, 2), nullable=False),
        sa.Column("reference_type", sa.String(50), nullable=True),
        sa.Column("reference_id", UUID(as_uuid=True), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Price history table
    op.create_table(
        "price_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "team_id",
            UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=False,
        ),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("market_cap", sa.Numeric(15, 2), nullable=False),
        sa.Column("vibe_multiplier", sa.Numeric(5, 2), nullable=True),
        sa.Column("sentiment_multiplier", sa.Numeric(5, 2), nullable=True),
        sa.Column("consistency_score", sa.Float, nullable=True),
        sa.Column("macro_sensitivity_score", sa.Float, nullable=True),
        sa.Column("profit_component", sa.Numeric(15, 2), nullable=True),
        sa.Column("cash_component", sa.Numeric(15, 2), nullable=True),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Market news table
    op.create_table(
        "market_news",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("headline", sa.String(120), nullable=False),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("source_type", sa.String(20), server_default="SYSTEM"),
        sa.Column(
            "source_team_id",
            UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=True,
        ),
        sa.Column("sentiment_score", sa.Numeric(3, 2), nullable=True),
        sa.Column("affected_sectors", sa.Text, nullable=True),
        sa.Column("affected_tickers", sa.Text, nullable=True),
        sa.Column("relevance_decay", sa.Numeric(3, 2), server_default="1.00"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


    # Activity events table (from migration 002)
    op.create_table(
        "activity_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("actor_type", sa.String(20), nullable=False),
        sa.Column("actor_id", sa.String(36), nullable=True),
        sa.Column("actor_name", sa.String(100), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Target price columns on teams (from migration 003)
    op.add_column("teams", sa.Column("target_price", sa.Numeric(10, 2), nullable=True))
    op.add_column("teams", sa.Column("ticks_to_target", sa.Integer(), nullable=True))

    # Caseline columns on teams (from migration 004)
    op.add_column("teams", sa.Column("caseline_document", sa.Text(), nullable=True))
    op.add_column("teams", sa.Column("company_display_name", sa.String(100), nullable=True))

    # Solutions table (from migration 004)
    op.create_table(
        "solutions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "solution_type",
            sa.Enum("INITIAL", "MICROTWEAK", name="solutiontype"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Evaluations table (from migration 004)
    op.create_table(
        "evaluations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("solution_id", UUID(as_uuid=True), sa.ForeignKey("solutions.id"), unique=True, nullable=False),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PROCESSING", "PENDING_APPROVAL", "APPROVED", "REJECTED", "FAILED", name="evaluationstatus"),
            nullable=True,
        ),
        sa.Column("scoring_metrics", sa.Text(), nullable=True),
        sa.Column("overall_score", sa.Float(), nullable=True),
        sa.Column("price_timeline", sa.Text(), nullable=True),
        sa.Column("news_headline", sa.String(120), nullable=True),
        sa.Column("news_body", sa.Text(), nullable=True),
        sa.Column("news_sentiment", sa.Numeric(3, 2), nullable=True),
        sa.Column("llm_model", sa.String(100), nullable=True),
        sa.Column("llm_latency_ms", sa.Integer(), nullable=True),
        sa.Column("llm_cost", sa.Numeric(10, 6), nullable=True),
        sa.Column("raw_response", sa.Text(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("evaluations")
    op.drop_table("solutions")
    op.drop_table("activity_events")
    op.drop_table("market_news")
    op.drop_table("price_history")
    op.drop_table("cash_ledger")
    op.drop_table("transactions")
    op.drop_index("ix_stock_holdings_owner_target", table_name="stock_holdings")
    op.drop_table("stock_holdings")
    op.drop_table("directives")
    op.drop_table("game_state")
    op.drop_table("admins")
    op.drop_table("teams")
    # Drop enums
    op.execute("DROP TYPE IF EXISTS teamstatus")
    op.execute("DROP TYPE IF EXISTS gamestatus")
    op.execute("DROP TYPE IF EXISTS directivestatus")
    op.execute("DROP TYPE IF EXISTS transactiontype")
    op.execute("DROP TYPE IF EXISTS solutiontype")
    op.execute("DROP TYPE IF EXISTS evaluationstatus")
