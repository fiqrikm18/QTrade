"""financial_statements + stock_scores tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-12 12:00:00.000000
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "financial_statements",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("ticker", sa.Text(), nullable=False),
        sa.Column("asof_date", sa.Date(), nullable=False),
        sa.Column(
            "available_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column("reported_at", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column(
            "is_annual",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("items", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "ticker",
            "asof_date",
            "available_at",
            name="uq_fs_ticker_asof_available",
        ),
    )

    op.create_table(
        "stock_scores",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("ticker", sa.Text(), nullable=False),
        sa.Column("asof_date", sa.Date(), nullable=False),
        sa.Column("profile", sa.Text(), nullable=False),
        sa.Column("scoring_version", sa.Text(), nullable=False),
        sa.Column("feature_version", sa.Text(), nullable=False),
        sa.Column("opportunity_score", sa.Numeric(), nullable=True),
        sa.Column("technical_score", sa.Numeric(), nullable=True),
        sa.Column("fundamental_score", sa.Numeric(), nullable=True),
        sa.Column("momentum_score", sa.Numeric(), nullable=True),
        sa.Column("relative_strength", sa.Numeric(), nullable=True),
        sa.Column("smart_money_score", sa.Numeric(), nullable=True),
        sa.Column("factor_score", sa.Numeric(), nullable=True),
        sa.Column("sector_score", sa.Numeric(), nullable=True),
        sa.Column("macro_score", sa.Numeric(), nullable=True),
        sa.Column("risk_score", sa.Numeric(), nullable=True),
        sa.Column("ml_score", sa.Numeric(), nullable=True),
        sa.Column("score_components", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column("classification", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Numeric(), nullable=True),
        sa.Column(
            "drivers",
            sa.dialects.postgresql.JSONB(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
        sa.Column(
            "risks",
            sa.dialects.postgresql.JSONB(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
        sa.Column(
            "invalidation_conditions",
            sa.dialects.postgresql.JSONB(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "ticker",
            "asof_date",
            "profile",
            "scoring_version",
            name="uq_stock_scores_ticker_asof_profile_version",
        ),
    )


def downgrade() -> None:
    op.drop_table("stock_scores")
    op.drop_table("financial_statements")
