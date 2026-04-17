"""Add archetypes table and archetype_id FK to teams

Revision ID: 003_archetype
Revises: 002_crisis_event
Create Date: 2026-04-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "003_archetype"
down_revision = "002_crisis_event"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create archetypes table
    op.create_table(
        "archetypes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(50), unique=True, nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sector", sa.String(20), nullable=False, server_default="FOODS"),
        sa.Column("dossier_content", sa.Text(), nullable=False),
        sa.Column("benchmark_bands", sa.Text(), nullable=False),
        sa.Column("starting_cash", sa.Numeric(15, 2), nullable=False),
        sa.Column("starting_stock_price", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "starting_shares", sa.Integer(), nullable=False, server_default="1000000"
        ),
        sa.Column("swot_strengths", sa.Text(), nullable=True),
        sa.Column("swot_weaknesses", sa.Text(), nullable=True),
        sa.Column("swot_opportunities", sa.Text(), nullable=True),
        sa.Column("swot_threats", sa.Text(), nullable=True),
        sa.Column("real_world_inspiration", sa.String(200), nullable=True),
        sa.Column("is_preset", sa.Boolean(), server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # Add archetype_id FK to teams table
    op.add_column(
        "teams",
        sa.Column(
            "archetype_id",
            UUID(as_uuid=True),
            sa.ForeignKey("archetypes.id"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("teams", "archetype_id")
    op.drop_table("archetypes")
