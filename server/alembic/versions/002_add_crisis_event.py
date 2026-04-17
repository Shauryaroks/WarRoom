"""Add crisis_events table and CRISIS_RESPONSE solution type

Revision ID: 002_crisis_event
Revises: 001_initial
Create Date: 2026-04-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "002_crisis_event"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create crisis_events table
    op.create_table(
        "crisis_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("scenario", sa.Text(), nullable=False),
        sa.Column("timer_seconds", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), server_default="ACTIVE"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Add CRISIS_RESPONSE to the solutiontype enum
    # Note: IF NOT EXISTS prevents failure if enum value already present
    op.execute("ALTER TYPE solutiontype ADD VALUE IF NOT EXISTS 'CRISIS_RESPONSE'")


def downgrade() -> None:
    op.drop_table("crisis_events")
    # Note: PostgreSQL does not support removing individual enum values easily.
    # The CRISIS_RESPONSE value will remain in the solutiontype enum after downgrade.
