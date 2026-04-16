"""Add solution and evaluation models with caseline fields on teams

Revision ID: 004_solution_eval
Revises: 003_target_price
Create Date: 2026-04-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "004_solution_eval"
down_revision = "003_target_price"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add caseline fields to teams
    op.add_column("teams", sa.Column("caseline_document", sa.Text(), nullable=True))
    op.add_column("teams", sa.Column("company_display_name", sa.String(100), nullable=True))

    # Create solutiontype enum
    solutiontype_enum = sa.Enum("INITIAL", "MICROTWEAK", name="solutiontype")
    solutiontype_enum.create(op.get_bind(), checkfirst=True)

    # Create evaluationstatus enum
    evalstatus_enum = sa.Enum(
        "PROCESSING", "PENDING_APPROVAL", "APPROVED", "REJECTED", "FAILED",
        name="evaluationstatus",
    )
    evalstatus_enum.create(op.get_bind(), checkfirst=True)

    # Create solutions table
    op.create_table(
        "solutions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("solution_type", solutiontype_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Create evaluations table
    op.create_table(
        "evaluations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("solution_id", UUID(as_uuid=True), sa.ForeignKey("solutions.id"), unique=True, nullable=False),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("status", evalstatus_enum, nullable=True),
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

    # Drop enums
    sa.Enum(name="evaluationstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="solutiontype").drop(op.get_bind(), checkfirst=True)

    op.drop_column("teams", "company_display_name")
    op.drop_column("teams", "caseline_document")
