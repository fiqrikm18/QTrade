from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import AuditMixin, Base


class Exchange(AuditMixin, Base):
    __tablename__ = "exchanges"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)


class Sector(AuditMixin, Base):
    __tablename__ = "sectors"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)


class Industry(AuditMixin, Base):
    __tablename__ = "industries"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)


class Stock(AuditMixin, Base):
    __tablename__ = "stocks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ticker: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    listing_date: Mapped[date | None] = mapped_column(Date)
    board: Mapped[str | None] = mapped_column(Text)
    shares_outstanding: Mapped[Decimal | None] = mapped_column(Numeric)
    sector_id: Mapped[int | None] = mapped_column(
        ForeignKey("sectors.id", ondelete="RESTRICT")
    )
    industry_id: Mapped[int | None] = mapped_column(
        ForeignKey("industries.id", ondelete="RESTRICT")
    )
    exchange_id: Mapped[int | None] = mapped_column(
        ForeignKey("exchanges.id", ondelete="RESTRICT")
    )
    status: Mapped[str] = mapped_column(Text, server_default="active", nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, server_default=text("true"), nullable=False
    )
    listed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delisted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UniverseHistory(AuditMixin, Base):
    __tablename__ = "universe_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    effective_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(Text, nullable=False)


class OhlcvDaily(AuditMixin, Base):
    __tablename__ = "ohlcv_daily"
    __table_args__ = (
        UniqueConstraint(
            "ticker",
            "trade_date",
            "provider",
            name="uq_ohlcv_daily_ticker_trade_date_provider",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    open: Mapped[Decimal | None] = mapped_column(Numeric)
    high: Mapped[Decimal | None] = mapped_column(Numeric)
    low: Mapped[Decimal | None] = mapped_column(Numeric)
    close: Mapped[Decimal | None] = mapped_column(Numeric)
    volume: Mapped[Decimal | None] = mapped_column(Numeric)
    turnover: Mapped[Decimal | None] = mapped_column(Numeric)
    adjustment_factor: Mapped[Decimal | None] = mapped_column(Numeric)
    adj_close: Mapped[Decimal | None] = mapped_column(Numeric)
    split_factor: Mapped[Decimal | None] = mapped_column(Numeric, server_default="1")
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    source_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class FinancialStatement(AuditMixin, Base):
    """Point-in-time fundamental snapshots (docs/data-model.md §5, §6).

    ``available_at`` is the anti-look-ahead gate: consumers must filter
    ``available_at <= asof``, never ``reported_at`` or ``period_end``.
    """

    __tablename__ = "financial_statements"
    __table_args__ = (
        UniqueConstraint(
            "ticker",
            "asof_date",
            "available_at",
            name="uq_fs_ticker_asof_available",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    asof_date: Mapped[date] = mapped_column(Date, nullable=False)
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    reported_at: Mapped[date | None] = mapped_column(Date)
    period_end: Mapped[date | None] = mapped_column(Date)
    is_annual: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    items: Mapped[dict[str, float]] = mapped_column(JSONB, nullable=False)


class StockScore(AuditMixin, Base):
    """Scan result per ticker per profile/version (docs/data-model.md §9).

    Idempotent upsert keyed on ``(ticker, asof_date, profile, scoring_version)``.
    """

    __tablename__ = "stock_scores"
    __table_args__ = (
        UniqueConstraint(
            "ticker",
            "asof_date",
            "profile",
            "scoring_version",
            name="uq_stock_scores_ticker_asof_profile_version",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    asof_date: Mapped[date] = mapped_column(Date, nullable=False)
    profile: Mapped[str] = mapped_column(Text, nullable=False)
    scoring_version: Mapped[str] = mapped_column(Text, nullable=False)
    feature_version: Mapped[str] = mapped_column(Text, nullable=False)
    opportunity_score: Mapped[float | None] = mapped_column(Numeric)
    technical_score: Mapped[float | None] = mapped_column(Numeric)
    fundamental_score: Mapped[float | None] = mapped_column(Numeric)
    momentum_score: Mapped[float | None] = mapped_column(Numeric)
    relative_strength: Mapped[float | None] = mapped_column(Numeric)
    smart_money_score: Mapped[float | None] = mapped_column(Numeric)
    factor_score: Mapped[float | None] = mapped_column(Numeric)
    sector_score: Mapped[float | None] = mapped_column(Numeric)
    macro_score: Mapped[float | None] = mapped_column(Numeric)
    risk_score: Mapped[float | None] = mapped_column(Numeric)
    ml_score: Mapped[float | None] = mapped_column(Numeric)
    score_components: Mapped[dict] = mapped_column(JSONB, nullable=False)
    classification: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float | None] = mapped_column(Numeric)
    drivers: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'")
    )
    risks: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'")
    )
    invalidation_conditions: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'")
    )
