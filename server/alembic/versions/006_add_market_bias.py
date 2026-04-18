"""Add market_bias column to game_state.

Revision ID: 006_market_bias
Revises: 005_fundamentals
Create Date: 2026-04-18
"""

from alembic import op
import sqlalchemy as sa


revision = "006_market_bias"
down_revision = "005_fundamentals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "game_state",
        sa.Column("market_bias", sa.String(length=10), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("game_state", "market_bias")
