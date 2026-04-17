"""Add fundamentals, FundamentalEvaluation, PendingShock; drop target_price/ticks_to_target.

Revision ID: 005_fundamentals
Revises: 004_decision_levers
Create Date: 2026-04-17
"""

import json
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM as PG_ENUM

# revision identifiers, used by Alembic.
revision = "005_fundamentals"
down_revision = "004_decision_levers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Enums (D-30, D-32) ---
    # Create the Postgres enum types via raw DDL (idempotent) BEFORE referencing
    # them in column definitions. Using sa.Enum().create() with asyncpg has
    # historically had ordering quirks where create_table still attempts to
    # re-emit CREATE TYPE despite create_type=False. Raw DDL sidesteps that.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fundamentalevalstatus') THEN
                CREATE TYPE fundamentalevalstatus AS ENUM (
                    'PROCESSING', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FAILED'
                );
            END IF;
        END$$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shocksource') THEN
                CREATE TYPE shocksource AS ENUM ('CRISIS', 'LLM_EVENT');
            END IF;
        END$$;
        """
    )

    # Bind-level references for create_table columns (do not re-create the type).
    # Use PG_ENUM with create_type=False to bind to the Postgres enums already
    # created via the raw DDL above; this avoids SQLAlchemy re-emitting CREATE TYPE.
    fundstatus_col = PG_ENUM(
        "PROCESSING",
        "PENDING_APPROVAL",
        "APPROVED",
        "REJECTED",
        "FAILED",
        name="fundamentalevalstatus",
        create_type=False,
    )
    shocksource_col = PG_ENUM(
        "CRISIS",
        "LLM_EVENT",
        name="shocksource",
        create_type=False,
    )

    # --- Team new columns (D-30, nullable for safe rollout) ---
    op.add_column(
        "teams", sa.Column("fundamental_market_share", sa.Numeric(10, 4), nullable=True)
    )
    op.add_column(
        "teams", sa.Column("fundamental_margin", sa.Numeric(10, 4), nullable=True)
    )
    op.add_column(
        "teams", sa.Column("fundamental_growth", sa.Numeric(10, 4), nullable=True)
    )
    op.add_column(
        "teams",
        sa.Column("fundamental_ops_efficiency", sa.Numeric(10, 4), nullable=True),
    )
    op.add_column(
        "teams", sa.Column("drift_target_pct", sa.Numeric(8, 6), nullable=True)
    )
    op.add_column(
        "teams", sa.Column("drift_floor_pct", sa.Numeric(8, 6), nullable=True)
    )
    op.add_column(
        "teams", sa.Column("ramp_started_at", sa.DateTime(timezone=True), nullable=True)
    )

    # --- Team v1 column drops (D-31) ---
    op.drop_column("teams", "target_price")
    op.drop_column("teams", "ticks_to_target")

    # --- fundamental_evaluations table (D-32) ---
    op.create_table(
        "fundamental_evaluations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False
        ),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("proposed_deltas", sa.Text(), nullable=False),
        sa.Column("admin_edits", sa.Text(), nullable=True),
        sa.Column("narrative", sa.Text(), nullable=True),
        sa.Column(
            "status",
            fundstatus_col,
            nullable=False,
            server_default="PROCESSING",
        ),
        sa.Column("llm_model", sa.String(100), nullable=True),
        sa.Column("llm_latency_ms", sa.Integer(), nullable=True),
        sa.Column("raw_response", sa.Text(), nullable=True),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column(
            "approved_by_admin_id",
            UUID(as_uuid=True),
            sa.ForeignKey("admins.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("team_id", "round_number", name="uq_fundeval_team_round"),
    )
    op.create_index("ix_fundeval_status", "fundamental_evaluations", ["status"])

    # --- pending_shocks table (D-19, D-32) ---
    op.create_table(
        "pending_shocks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False
        ),
        sa.Column("magnitude_pct", sa.Numeric(6, 3), nullable=False),
        sa.Column(
            "source",
            shocksource_col,
            nullable=False,
        ),
        sa.Column("source_ref_id", UUID(as_uuid=True), nullable=True),
        sa.Column(
            "enqueued_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_pending_shocks_team_unapplied", "pending_shocks", ["team_id", "applied_at"]
    )

    # --- Backfill fundamentals for existing archetype-assigned teams (D-03, Open Question 5) ---
    # Idempotent: only updates teams where fundamental_market_share IS NULL.
    conn = op.get_bind()
    archetypes = conn.execute(
        sa.text("SELECT id, benchmark_bands FROM archetypes")
    ).fetchall()
    for row in archetypes:
        bands = json.loads(row.benchmark_bands)
        mid_ms = (bands["market_share"][0] + bands["market_share"][1]) / 2
        mid_mg = (bands["margin"][0] + bands["margin"][1]) / 2
        mid_gr = (bands["growth"][0] + bands["growth"][1]) / 2
        mid_op = (bands["ops_efficiency"][0] + bands["ops_efficiency"][1]) / 2
        conn.execute(
            sa.text(
                """
                UPDATE teams SET
                    fundamental_market_share   = :ms,
                    fundamental_margin         = :mg,
                    fundamental_growth         = :gr,
                    fundamental_ops_efficiency = :op
                WHERE archetype_id = :aid AND fundamental_market_share IS NULL
                """
            ),
            {"ms": mid_ms, "mg": mid_mg, "gr": mid_gr, "op": mid_op, "aid": row.id},
        )


def downgrade() -> None:
    op.drop_index("ix_pending_shocks_team_unapplied", table_name="pending_shocks")
    op.drop_table("pending_shocks")
    op.drop_index("ix_fundeval_status", table_name="fundamental_evaluations")
    op.drop_table("fundamental_evaluations")

    op.add_column("teams", sa.Column("target_price", sa.Numeric(10, 2), nullable=True))
    op.add_column("teams", sa.Column("ticks_to_target", sa.Integer(), nullable=True))

    op.drop_column("teams", "ramp_started_at")
    op.drop_column("teams", "drift_floor_pct")
    op.drop_column("teams", "drift_target_pct")
    op.drop_column("teams", "fundamental_ops_efficiency")
    op.drop_column("teams", "fundamental_growth")
    op.drop_column("teams", "fundamental_margin")
    op.drop_column("teams", "fundamental_market_share")

    sa.Enum(name="shocksource").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="fundamentalevalstatus").drop(op.get_bind(), checkfirst=True)
