"""Pydantic response schemas for API contracts."""

from __future__ import annotations

from datetime import date


class MarketOverview(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    regime: str
    regime_confidence: float
    ihsg_price: float
    ihsg_change: float
    ihsg_change_pct: float
    volume: int
    turnover: float
    market_breadth: dict[str, object]
    top_gainers: list[dict[str, object]]
    top_losers: list[dict[str, object]]
    top_opportunities: list[dict[str, object]]
    sector_rotation: list[dict[str, object]]
    macro_risk: float
    macro_support: float
    upcoming_events: list[dict[str, object]]
    asof: date


class MarketRegimeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    regime: str
    confidence: float
    components: dict[str, object]
    asof: date


class MarketBreadthResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    advance: int
    decline: int
    new_highs: int
    new_lows: int
    pct_above_sma20: float
    pct_above_sma50: float
    pct_above_sma200: float
    rsi_breadth: float
    volume_breadth: float
    breakout_breadth: float
    momentum_breadth: float
    breadth_score: float
    asof: date


class TechnicalIndicators(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ticker: str
    rsi_14: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    macd_hist: float | None = None
    sma_20: float | None = None
    sma_50: float | None = None
    sma_200: float | None = None
    ema_20: float | None = None
    atr_14: float | None = None
    adx_14: float | None = None
    bollinger_upper: float | None = None
    bollinger_mid: float | None = None
    bollinger_lower: float | None = None
    roc_20: float | None = None
    atr_14: float | None = None
    stoch_k: float | None = None
    stoch_d: float | None = None
    asof: date


class StockAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ticker: str
    name: str
    sector: str
    price: float
    change: float
    change_pct: float
    volume: int
    turnover: float
    market_cap: float
    opportunity_score: float
    classification: str
    confidence: float
    risk_level: str
    regime: str
    components: dict[str, object]
    drivers: list[str]
    risks: list[str]
    invalidation_conditions: list[str]
    asof: date
    feature_version: str
    scoring_version: str


class ScreenerFilter(BaseModel):
    sector: list[str] | None = None
    min_price: float | None = None
    max_price: float | None = None
    min_market_cap: float | None = None
    max_market_cap: float | None = None
    min_avg_volume: int | None = None
    min_turnover: float | None = None
    rsi_min: float | None = None
    rsi_max: float | None = None
    sma_above: list[str] | None = None
    ema_above: list[str] | None = None
    macd_signal: str | None = None
    adx_min: float | None = None
    atr_max: float | None = None
    bollinger_position: str | None = None
    breakout: bool | None = None
    min_momentum_1d: float | None = None
    max_momentum_1d: float | None = None
    min_momentum_5d: float | None = None
    max_momentum_5d: float | None = None
    min_momentum_20d: float | None = None
    max_momentum_20d: float | None = None
    min_momentum_60d: float | None = None
    max_momentum_60d: float | None = None
    min_momentum_120d: float | None = None
    max_momentum_120d: float | None = None
    min_opportunity_score: float | None = None
    max_opportunity_score: float | None = None
    page: int = 1
    page_size: int = 20


class ScreenerResultItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ticker: str
    name: str
    price: float
    change: float
    change_pct: float
    volume: int
    turnover: float
    market_cap: float
    technical_score: float | None = None
    fundamental_score: float | None = None
    momentum_score: float | None = None
    smart_money_score: float | None = None
    sector_score: float | None = None
    risk_score: float | None = None
    ml_score: float | None = None
    opportunity_score: float
    classification: str
    sector: str
    asof: date


class ScreenerResponse(BaseModel):
    items: list[dict[str, object]]
    total: int
    page: int
    page_size: int
    asof: date


class PaginatedStocksResponse(BaseModel):
    items: list[dict[str, object]]
    total: int
    page: int
    page_size: int


class SectorRotationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sector: str
    perf_1m: float
    perf_3m: float
    rel_strength: float
    momentum: float
    vol_trend: float
    breadth: float
    sector_score: float
    rotation_class: str
    asof: date


class MarketOverviewResponse(BaseModel):
    regime: "MarketRegimeResponse"
    breadth: "MarketBreadthResponse"
    top_gainers: list[dict[str, object]]
    top_losers: list[dict[str, object]]
    top_opportunities: list[dict[str, object]]
    sector_rotation: list[dict[str, object]]
    macro: dict[str, object]
    upcoming_events: list[dict[str, object]]
    asof: date
