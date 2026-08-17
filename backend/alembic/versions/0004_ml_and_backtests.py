"""ml_models, ml_predictions, backtests, backtest_trades tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-17 12:00:00.000000
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ml_models",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("model_name", sa.Text(), nullable=False),
        sa.Column("model_version", sa.Text(), nullable=False),
        sa.Column("target", sa.Text(), nullable=False),
        sa.Column("horizon", sa.BigInteger(), nullable=False),
        sa.Column("feature_version", sa.Text(), nullable=False),
        sa.Column("features_hash", sa.Text(), nullable=False),
        sa.Column("training_start", sa.Date(), nullable=True),
        sa.Column("training_end", sa.Date(), nullable=True),
        sa.Column("metrics", postgresql.JSONB(), nullable=True),
        sa.Column("artifact_path", sa.Text(), nullable=True),
        sa.Column(
            "status", sa.Text(), nullable=False, server_default=sa.text("'staging'")
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
            "model_name", "model_version", name="uq_ml_models_name_version"
        ),
    )

    op.create_table(
        "ml_predictions",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("ticker", sa.Text(), nullable=False),
        sa.Column("asof_date", sa.Date(), nullable=False),
        sa.Column("model_name", sa.Text(), nullable=False),
        sa.Column("model_version", sa.Text(), nullable=False),
        sa.Column("feature_version", sa.Text(), nullable=False),
        sa.Column("probability", sa.Numeric(), nullable=True),
        sa.Column("expected_return", sa.Numeric(), nullable=True),
        sa.Column("confidence", sa.Numeric(), nullable=True),
        sa.Column("prediction_class", sa.Text(), nullable=True),
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
            "model_name",
            "model_version",
            name="uq_ml_predictions_ticker_asof_model_version",
        ),
    )

    op.create_table(
        "backtests",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("strategy", postgresql.JSONB(), nullable=True),
        sa.Column("universe", postgresql.JSONB(), nullable=True),
        sa.Column("start", sa.Date(), nullable=False),
        sa.Column("end", sa.Date(), nullable=False),
        sa.Column("feature_version", sa.Text(), nullable=True),
        sa.Column("scoring_version", sa.Text(), nullable=True),
        sa.Column("model_version", sa.Text(), nullable=True),
        sa.Column("metrics", postgresql.JSONB(), nullable=True),
        sa.Column("bias_audit", postgresql.JSONB(), nullable=True),
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
        "backtest_trades",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("backtest_id", sa.BigInteger(), nullable=False),
        sa.Column("ticker", sa.Text(), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("exit_date", sa.Date(), nullable=False),
        sa.Column("entry_price", sa.Numeric(), nullable=True),
        sa.Column("exit_price", sa.Numeric(), nullable=True),
        sa.Column("shares", sa.Numeric(), nullable=True),
        sa.Column("pnl", sa.Numeric(), nullable=True),
        sa.Column("fees", sa.Numeric(), nullable=True),
        sa.Column("slippage", sa.Numeric(), nullable=True),
        sa.Column("exit_reason", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["backtest_id"], ["backtests.id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("backtest_trades")
    op.drop_table("backtests")
    op.drop_table("ml_predictions")
    op.drop_table("ml_models")
