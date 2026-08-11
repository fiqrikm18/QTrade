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
    status: Mapped[str] = mapped_column(
        Text, server_default="active", nullable=False
    )
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
    split_factor: Mapped[Decimal | None] = mapped_column(
        Numeric, server_default="1"
    )
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    source_timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
