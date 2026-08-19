"""Add macro, news, portfolio, checkpoint tables.

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-19
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "economic_indicators",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("indicator", sa.Text(), nullable=False),
        sa.Column("asof_date", sa.Date(), nullable=False),
        sa.Column("value", sa.Numeric(), nullable=False),
        sa.Column("unit", sa.Text(), server_default="", nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
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
            "indicator", "asof_date", "source", name="uq_econ_indicator"
        ),
    )

    op.create_table(
        "economic_events",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("event", sa.Text(), nullable=False),
        sa.Column("country", sa.Text(), server_default="ID", nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("importance", sa.BigInteger(), server_default="2", nullable=False),
        sa.Column("category", sa.Text(), server_default="", nullable=False),
        sa.Column("previous", sa.Numeric(), nullable=True),
        sa.Column("consensus", sa.Numeric(), nullable=True),
        sa.Column("actual", sa.Numeric(), nullable=True),
        sa.Column("status", sa.Text(), server_default="scheduled", nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
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
        sa.UniqueConstraint("event", "scheduled_at", "source", name="uq_econ_event"),
    )

    op.create_table(
        "news",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), server_default="", nullable=False),
        sa.Column("category", sa.Text(), server_default="MARKET", nullable=False),
        sa.Column("sentiment", sa.Text(), nullable=True),
        sa.Column("impact", sa.Text(), nullable=True),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
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
        sa.UniqueConstraint("source", "url", name="uq_news_source_url"),
    )

    op.create_table(
        "news_entities",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("article_id", sa.BigInteger(), nullable=False),
        sa.Column("ticker", sa.Text(), nullable=False),
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
        sa.ForeignKeyConstraint(["article_id"], ["news.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("article_id", "ticker", name="uq_news_entity"),
    )

    op.create_table(
        "portfolios",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.Text(), server_default="Default", nullable=False),
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
    )

    op.create_table(
        "portfolio_positions",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("portfolio_id", sa.BigInteger(), nullable=False),
        sa.Column("ticker", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Numeric(), nullable=False),
        sa.Column("avg_price", sa.Numeric(), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint("portfolio_id", "ticker", name="uq_portfolio_position"),
    )

    op.create_table(
        "ingestion_checkpoints",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("job_name", sa.Text(), nullable=False),
        sa.Column("watermark", sa.DateTime(timezone=True), nullable=False),
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
        sa.UniqueConstraint("job_name", name="uq_checkpoint_job"),
    )


def downgrade() -> None:
    op.drop_table("ingestion_checkpoints")
    op.drop_table("portfolio_positions")
    op.drop_table("portfolios")
    op.drop_table("news_entities")
    op.drop_table("news")
    op.drop_table("economic_events")
    op.drop_table("economic_indicators")
