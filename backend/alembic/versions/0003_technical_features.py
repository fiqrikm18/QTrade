"""technical_features table

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-17 10:00:00.000000
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "technical_features",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("ticker", sa.Text(), nullable=False),
        sa.Column("asof_date", sa.Date(), nullable=False),
        sa.Column("feature_version", sa.Text(), nullable=False),
        sa.Column("indicators", sa.dialects.postgresql.JSONB(), nullable=False),
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
            "feature_version",
            name="uq_technical_features_ticker_asof_version",
        ),
    )


def downgrade() -> None:
    op.drop_table("technical_features")
