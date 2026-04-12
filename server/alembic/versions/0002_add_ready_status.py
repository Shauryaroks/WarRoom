"""add READY to teamstatus enum

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-13

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE teamstatus ADD VALUE IF NOT EXISTS 'READY' AFTER 'PENDING'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values; no-op
    pass
