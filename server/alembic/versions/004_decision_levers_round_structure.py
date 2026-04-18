"""Add decisions, operating_plans tables and game_phase fields on game_state

Revision ID: 004_decision_levers
Revises: 003_archetype
Create Date: 2026-04-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "004_decision_levers"
down_revision = "003_archetype"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create levercategory enum type
    lever_enum = sa.Enum(
        "PRICING",
        "MARKETING",
        "SUPPLY_CHAIN",
        "NEW_PRODUCT",
        name="levercategory",
    )
    # lever_enum.create(op.get_bind(), checkfirst=True)

    # Create decisions table (per D-13)
    op.create_table(
        "decisions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "team_id",
            UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=False,
        ),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("lever_category", lever_enum, nullable=False),
        sa.Column("decisions_json", sa.Text(), nullable=False),
        sa.Column(
            "budget_spent",
            sa.Numeric(15, 2),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("window_end", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "team_id",
            "round_number",
            "lever_category",
            name="uq_decision_team_round_lever",
        ),
    )
    op.create_index(
        "ix_decisions_team_round_lever",
        "decisions",
        ["team_id", "round_number", "lever_category"],
    )

    # Create operating_plans table (per D-14)
    op.create_table(
        "operating_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "team_id",
            UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=False,
        ),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "team_id",
            "round_number",
            name="uq_operating_plan_team_round",
        ),
    )

    # Extend game_state with phase 8 fields (per D-15)
    op.add_column(
        "game_state",
        sa.Column("game_phase", sa.String(20), nullable=True),
    )
    op.add_column(
        "game_state",
        sa.Column("macro_brief", sa.Text(), nullable=True),
    )
    op.add_column(
        "game_state",
        sa.Column(
            "current_quarter_start",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("game_state", "current_quarter_start")
    op.drop_column("game_state", "macro_brief")
    op.drop_column("game_state", "game_phase")

    op.drop_index("ix_decisions_team_round_lever", table_name="decisions")
    op.drop_table("operating_plans")
    op.drop_table("decisions")

    sa.Enum(name="levercategory").drop(op.get_bind(), checkfirst=True)
