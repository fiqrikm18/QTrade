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


class TechnicalFeature(AuditMixin, Base):
    """Latest technical indicators per ticker (docs/data-model.md §9).

    Written by the scanner on each scan (latest-only row per scan date);
    keyed on ``(ticker, asof_date, feature_version)``.
    """

    __tablename__ = "technical_features"
    __table_args__ = (
        UniqueConstraint(
            "ticker",
            "asof_date",
            "feature_version",
            name="uq_technical_features_ticker_asof_version",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    asof_date: Mapped[date] = mapped_column(Date, nullable=False)
    feature_version: Mapped[str] = mapped_column(Text, nullable=False)
    indicators: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)


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
    score_components: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
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


class MLModel(AuditMixin, Base):
    """Registered ML artifacts (docs/data-model.md §10, docs/ml.md §7-8).

    Keyed on ``(model_name, model_version)``; ``status`` is the lifecycle flag
    (staging|production|archived). Append-only registry: promote by inserting a
    new row + flipping status, never mutate a production artifact in place.
    """

    __tablename__ = "ml_models"
    __table_args__ = (
        UniqueConstraint(
            "model_name", "model_version", name="uq_ml_models_name_version"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    model_name: Mapped[str] = mapped_column(Text, nullable=False)
    model_version: Mapped[str] = mapped_column(Text, nullable=False)
    target: Mapped[str] = mapped_column(Text, nullable=False)
    horizon: Mapped[int] = mapped_column(BigInteger, nullable=False)
    feature_version: Mapped[str] = mapped_column(Text, nullable=False)
    features_hash: Mapped[str] = mapped_column(Text, nullable=False)
    training_start: Mapped[date | None] = mapped_column(Date)
    training_end: Mapped[date | None] = mapped_column(Date)
    metrics: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    artifact_path: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'staging'")
    )


class MLPrediction(AuditMixin, Base):
    """Append-only per-ticker predictions (docs/data-model.md §10, docs/ml.md §6).

    Unique on ``(ticker, asof_date, model_name, model_version)``; inserts use
    ON CONFLICT DO NOTHING so re-runs never overwrite history.
    """

    __tablename__ = "ml_predictions"
    __table_args__ = (
        UniqueConstraint(
            "ticker",
            "asof_date",
            "model_name",
            "model_version",
            name="uq_ml_predictions_ticker_asof_model_version",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    asof_date: Mapped[date] = mapped_column(Date, nullable=False)
    model_name: Mapped[str] = mapped_column(Text, nullable=False)
    model_version: Mapped[str] = mapped_column(Text, nullable=False)
    feature_version: Mapped[str] = mapped_column(Text, nullable=False)
    probability: Mapped[Decimal | None] = mapped_column(Numeric)
    expected_return: Mapped[Decimal | None] = mapped_column(Numeric)
    confidence: Mapped[Decimal | None] = mapped_column(Numeric)
    prediction_class: Mapped[str | None] = mapped_column(Text)


class Backtest(AuditMixin, Base):
    """Persisted backtest run config + metrics + bias audit (docs/backtesting.md §8)."""

    __tablename__ = "backtests"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    strategy: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    universe: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    start: Mapped[date] = mapped_column(Date, nullable=False)
    end: Mapped[date] = mapped_column(Date, nullable=False)
    feature_version: Mapped[str | None] = mapped_column(Text)
    scoring_version: Mapped[str | None] = mapped_column(Text)
    model_version: Mapped[str | None] = mapped_column(Text)
    metrics: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    bias_audit: Mapped[dict[str, object] | None] = mapped_column(JSONB)


class BacktestTrade(AuditMixin, Base):
    """Per-trade output of a backtest run (docs/backtesting.md §8)."""

    __tablename__ = "backtest_trades"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    backtest_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("backtests.id", ondelete="CASCADE"), nullable=False
    )
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    exit_date: Mapped[date] = mapped_column(Date, nullable=False)
    entry_price: Mapped[Decimal | None] = mapped_column(Numeric)
    exit_price: Mapped[Decimal | None] = mapped_column(Numeric)
    shares: Mapped[Decimal | None] = mapped_column(Numeric)
    pnl: Mapped[Decimal | None] = mapped_column(Numeric)
    fees: Mapped[Decimal | None] = mapped_column(Numeric)
    slippage: Mapped[Decimal | None] = mapped_column(Numeric)
    exit_reason: Mapped[str | None] = mapped_column(Text)


class EconomicIndicator(AuditMixin, Base):
    """Point-in-time macro indicator time series (docs/data-model.md §7)."""

    __tablename__ = "economic_indicators"
    __table_args__ = (
        UniqueConstraint("indicator", "asof_date", "source", name="uq_econ_indicator"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    indicator: Mapped[str] = mapped_column(Text, nullable=False)
    asof_date: Mapped[date] = mapped_column(Date, nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    unit: Mapped[str] = mapped_column(Text, server_default="", nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class EconomicEvent(AuditMixin, Base):
    """Economic calendar events with release status (docs/data-model.md §8)."""

    __tablename__ = "economic_events"
    __table_args__ = (
        UniqueConstraint("event", "scheduled_at", "source", name="uq_econ_event"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    event: Mapped[str] = mapped_column(Text, nullable=False)
    country: Mapped[str] = mapped_column(Text, server_default="ID", nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    importance: Mapped[int] = mapped_column(
        BigInteger, server_default="2", nullable=False
    )
    category: Mapped[str] = mapped_column(Text, server_default="", nullable=False)
    previous: Mapped[Decimal | None] = mapped_column(Numeric)
    consensus: Mapped[Decimal | None] = mapped_column(Numeric)
    actual: Mapped[Decimal | None] = mapped_column(Numeric)
    status: Mapped[str] = mapped_column(
        Text, server_default="scheduled", nullable=False
    )
    source: Mapped[str] = mapped_column(Text, nullable=False)


class NewsArticle(AuditMixin, Base):
    """News articles ingested from RSS (docs/data-model.md §11)."""

    __tablename__ = "news"
    __table_args__ = (UniqueConstraint("source", "url", name="uq_news_source_url"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, server_default="", nullable=False)
    category: Mapped[str] = mapped_column(Text, server_default="MARKET", nullable=False)
    sentiment: Mapped[str | None] = mapped_column(Text)
    impact: Mapped[str | None] = mapped_column(Text)
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class NewsEntity(AuditMixin, Base):
    """Ticker references found in a news article (docs/data-model.md §11)."""

    __tablename__ = "news_entities"
    __table_args__ = (UniqueConstraint("article_id", "ticker", name="uq_news_entity"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    article_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("news.id", ondelete="CASCADE"), nullable=False
    )
    ticker: Mapped[str] = mapped_column(Text, nullable=False)


class Portfolio(AuditMixin, Base):
    """User portfolio (single-user v1) (docs/data-model.md §11)."""

    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(Text, server_default="Default", nullable=False)


class PortfolioPosition(AuditMixin, Base):
    """A holding: ticker + quantity + average cost (docs/data-model.md §11)."""

    __tablename__ = "portfolio_positions"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "ticker", name="uq_portfolio_position"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False
    )
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    avg_price: Mapped[Decimal] = mapped_column(Numeric, nullable=False)


class IngestionCheckpoint(AuditMixin, Base):
    """Crawler watermark per job (docs/data-pipeline.md §2.1)."""

    __tablename__ = "ingestion_checkpoints"
    __table_args__ = (UniqueConstraint("job_name", name="uq_checkpoint_job"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    job_name: Mapped[str] = mapped_column(Text, nullable=False)
    watermark: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
