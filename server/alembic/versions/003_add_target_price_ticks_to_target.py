"""Add target_price and ticks_to_target to teams

Revision ID: 003_target_price
Revises: 002_activity_event
Create Date: 2026-04-16
"""

from alembic import op
import sqlalchemy as sa

revision = "003_target_price"
down_revision = "002_activity_event"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("teams", sa.Column("target_price", sa.Numeric(10, 2), nullable=True))
    op.add_column("teams", sa.Column("ticks_to_target", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("teams", "ticks_to_target")
    op.drop_column("teams", "target_price")
