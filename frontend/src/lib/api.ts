export interface RegimeInfo {
  regime: string;
  confidence: number;
  components: Record<string, unknown>;
  asof: string | null;
}

export interface MarketBreadthInfo {
  breadth_score: number;
  asof: string | null;
}

export interface OpportunityItem {
  ticker: string;
  opportunity_score: number;
}

export interface MoverItem {
  ticker: string;
  price: number;
  change_pct: number;
  asof: string;
}

export interface MarketOverview {
  regime: RegimeInfo;
  breadth: MarketBreadthInfo;
  top_gainers: MoverItem[];
  top_losers: MoverItem[];
  top_opportunities: OpportunityItem[];
  sector_rotation: Record<string, unknown>[];
  macro: { risk: number; support: number };
  upcoming_events: Record<string, unknown>[];
  asof: string | null;
}

export interface ScreenerItem {
  ticker: string;
  name: string | null;
  sector_id: number | null;
  sector_code: string | null;
  opportunity_score: number | null;
  technical_score: number | null;
  fundamental_score: number | null;
  momentum_score: number | null;
  relative_strength: number | null;
  smart_money_score: number | null;
  sector_score: number | null;
  risk_score: number | null;
  ml_score: number | null;
  classification: string | null;
}

export interface ScreenerResult {
  items: ScreenerItem[];
  total: number;
  page: number;
  page_size: number;
  asof: string | null;
}

export interface ValuationRatios {
  per: number | null;
  pbv: number | null;
  psr: number | null;
  ev_ebitda: number | null;
  fcf_yield: number | null;
  dividend_yield: number | null;
}

export interface FundamentalRatios {
  roe: number | null;
  roa: number | null;
  roic: number | null;
  npm: number | null;
  gpm: number | null;
  opm: number | null;
  debt_equity: number | null;
  current_ratio: number | null;
  interest_coverage: number | null;
}

export interface SmartMoneyData {
  score: number | null;
  proxies: {
    accumulation_proxy: number | null;
    volume_proxy: number | null;
    structure_proxy: number | null;
    rs_proxy: number | null;
    liquidity_proxy: number | null;
    vol_behavior_proxy: number | null;
  } | null;
}

export interface RiskMetrics {
  hist_vol_20: number | null;
  max_drawdown_250d: number | null;
  avg_turnover_20d: number | null;
  beta_vs_ihsg: number | null;
}

export interface StockAnalysis {
  ticker: string;
  name: string | null;
  sector: string | null;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  turnover: number | null;
  market_cap: number | null;
  opportunity_score: number | null;
  classification: string | null;
  confidence: number | null;
  risk_level: "low" | "medium" | "high" | null;
  regime: "trending_up" | "trending_down" | "ranging" | "volatile" | null;
  technical_indicators: TechnicalIndicators | null;
  valuation: ValuationRatios | null;
  fundamental: FundamentalRatios | null;
  smart_money: SmartMoneyData | null;
  risk_metrics: RiskMetrics;
  components: Record<string, unknown> | null;
  drivers: string[] | null;
  risks: string[] | null;
  invalidation_conditions: string[] | null;
  asof: string | null;
  feature_version: string | null;
  scoring_version: string | null;
}

export interface TechnicalIndicators {
  rsi_14: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_hist: number | null;
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  ema_20: number | null;
  atr_14: number | null;
  adx_14: number | null;
  boll_upper: number | null;
  boll_mid: number | null;
  boll_lower: number | null;
  roc_20: number | null;
  rel_volume: number | null;
  hist_vol_20: number | null;
  stoch_k: number | null;
  stoch_d: number | null;
  asof: string | null;
}

export interface ScreenerFilters {
  min_opportunity_score?: number;
  max_opportunity_score?: number;
  sector?: string[];
  classification?: string[];
  min_risk?: number;
  max_risk?: number;
}

export interface MLModel {
  model_name: string;
  model_version: string;
  target: string;
  horizon: number;
  feature_version: string;
  features_hash: string;
  training_start: string | null;
  training_end: string | null;
  metrics: Record<string, unknown>;
  status: string;
}

export interface MLModelsResponse {
  models: MLModel[];
}

export interface MLModelDetail extends MLModel {
  artifact_path: string | null;
}

export interface ExplainRequest {
  ticker: string;
  asof: string;
}

export interface ExplainResponse {
  explanation: string;
}

export interface NLScreenerRequest {
  query: string;
}

export interface NLScreenerResponse {
  filter: Record<string, unknown>;
}

export interface ReportRequest {
  tickers: string[];
  template?: string;
}

export interface ReportResponse {
  report: string;
}

export interface BacktestRunRequest {
  strategy: Record<string, unknown>;
  universe: Record<string, unknown>;
  start: string;
  end: string;
  scoring_version?: string;
  model_version?: string | null;
  buy_fee?: number;
  sell_fee?: number;
  top_n?: number;
  max_weight?: number;
  seed?: number;
}

export interface BacktestMetrics {
  cagr?: number;
  sharpe?: number;
  sortino?: number;
  max_drawdown?: number;
  maxDD?: number;
  calmar?: number;
  win_rate?: number;
  winRate?: number;
  profit_factor?: number;
  profitFactor?: number;
  expectancy?: number;
  avg_hold?: number;
  avgHold?: number;
  turnover?: number;
  equity_curve?: number[];
  monthly_returns?: Array<{
    month: string;
    portfolio: number;
    benchmark: number;
    excess: number;
    cumulative: number;
  }>;
  avg_dd_duration?: number;
  recovery_time?: number;
}

export interface BacktestRunResponse {
  backtest_id: number;
  metrics: BacktestMetrics;
}

export interface BacktestDetail {
  strategy: Record<string, unknown>;
  universe: Record<string, unknown>;
  start: string;
  end: string;
  metrics: BacktestMetrics;
  bias_audit: Record<string, unknown>;
  trades: Array<{
    ticker: string;
    entry_date: string;
    exit_date: string;
    entry_price: number | null;
    exit_price: number | null;
    shares: number | null;
    pnl: number | null;
    fees: number | null;
    slippage: number | null;
    exit_reason: string | null;
  }>;
}

export interface SectorPerformance {
  ticker: string;
  sector_score: number;
  asof: string;
}

export interface MacroIndicator {
  indicator: string;
  current: number;
  previous: number;
  change: number;
  unit: string;
  trend: "up" | "down" | "neutral";
  source: string;
}

export interface CalendarEvent {
  date: string;
  time: string;
  country: string;
  event: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  category: string;
  prev: number | null;
  consensus: number | null;
  actual: number | null;
}

export interface NewsItem {
  id: string;
  date: string;
  time: string;
  title: string;
  source: string;
  category: string;
  impact: "HIGH" | "MEDIUM" | "LOW" | null;
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | null;
  tickers: string[];
  summary: string;
}

export interface CompareStockData {
  ticker: string;
  company: string;
  sector: string;
  price: number;
  change: number;
  volume: number;
  turnover: number;
  marketCap: number;
  technical: number;
  fundamental: number;
  momentum: number;
  smartMoney: number;
  sectorScore: number;
  risk: number;
  ml: number;
  opportunity: number;
}

export interface PortfolioItem {
  ticker: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
  weight: number;
  marketValue: number;
  sector?: string;
  beta?: number;
  sharpe?: number;
  var95?: number;
}

export interface Alert {
  id: number;
  time: string;
  type: "technical" | "fundamental" | "news" | "macro" | "market";
  ticker: string;
  message: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  status: "active" | "triggered" | "acknowledged" | "resolved";
  trigger: string;
  acknowledged: boolean;
  severity?: "HIGH" | "MEDIUM" | "LOW";
  read?: boolean;
}

export interface ResearchMemo {
  id: number;
  title: string;
  tickers: string[];
  date: string;
  thesis: string;
  scores: {
    technical: number;
    smartMoney: number;
    fundamental: number;
  };
}

// Data Quality
export interface DataQualityReport {
  ohlcv: {
    last_update: string | null;
    row_count: number;
    tickers: number;
    gaps: string[];
  };
  macro: { last_update: string | null; row_count: number; indicators: number };
  calendar: { last_update: string | null; row_count: number; events: number };
  news: { last_update: string | null; row_count: number; articles: number };
  fundamentals: {
    last_update: string | null;
    row_count: number;
    tickers: number;
  };
  technical_features: {
    last_update: string | null;
    row_count: number;
    tickers: number;
  };
  asof: string;
}

// System Status
export interface SystemStatus {
  db_status: "healthy" | "unhealthy";
  redis_status: "healthy" | "unhealthy";
  jobs_running: number;
  data_freshness: {
    ohlcv: string | null;
    macro: string | null;
    news: string | null;
    fundamentals: string | null;
    latest_scan: string | null;
  };
  uptime_seconds: number;
}

export interface BackendSettings {
  macro_provider: string;
  news_provider: string;
  fundamental_provider: string;
  ingest_macro_cron: string;
  ingest_news_cron: string;
  ingest_fundamentals_cron: string;
  ingest_cron: string;
  watchdog_cron: string;
  llm_enabled: boolean;
  llm_provider: string;
  llm_model: string;
  llm_analysis_enabled: boolean;
  llm_news_summary_enabled: boolean;
  llm_stock_explanation_enabled: boolean;
  llm_macro_summary_enabled: boolean;
  llm_nl_screener_enabled: boolean;
  llm_research_enabled: boolean;
}

// Screener Saved Configs
export interface ScreenerSavedConfig {
  id: string;
  name: string;
  filters: ScreenerFilters;
  created_at: string;
  updated_at: string;
}

// Portfolio CRUD
export interface PortfolioCreate {
  name: string;
}
export interface PortfolioResponse {
  id: string;
  name: string;
  created_at: string;
  positions: PortfolioItem[];
}
export interface PortfolioSummary {
  id: string;
  name: string;
  created_at: string;
  totalMarketValue: number;
  totalPnL: number;
  totalPnLPct: number;
  positionsCount: number;
}
export interface PositionCreate {
  ticker: string;
  quantity: number;
  avg_price: number;
}
export interface PositionUpdate {
  quantity?: number;
  avg_price?: number;
}

export interface StockListItem {
  ticker: string;
  name: string | null;
  board: string | null;
}

export interface StocksResult {
  items: StockListItem[];
  total: number;
  page: number;
  page_size: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export function getMarketOverview(): Promise<MarketOverview> {
  return request<MarketOverview>("/api/v1/market/overview");
}

export function getStockAnalysis(
  ticker: string,
  profile = "balanced",
): Promise<StockAnalysis> {
  return request<StockAnalysis>(
    `/api/v1/stocks/${encodeURIComponent(ticker)}/analysis?profile=${profile}`,
  );
}

export function getStocks(
  page = 1,
  pageSize = 20,
  search?: string,
): Promise<StocksResult> {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (search && search.trim()) query.set("search", search.trim());
  return request<StocksResult>(`/api/v1/stocks?${query.toString()}`);
}

export function runScreener(
  filters: ScreenerFilters,
  page = 1,
  pageSize = 20,
): Promise<ScreenerResult> {
  return request<ScreenerResult>("/api/v1/screener/run", {
    method: "POST",
    body: JSON.stringify({ filters, page, page_size: pageSize }),
  });
}

export function explainStock(
  ticker: string,
  asof: string,
): Promise<ExplainResponse> {
  return request<ExplainResponse>("/api/v1/llm/explain", {
    method: "POST",
    body: JSON.stringify({ ticker, asof }),
  });
}

export function nlScreener(query: string): Promise<NLScreenerResponse> {
  return request<NLScreenerResponse>("/api/v1/llm/nl-screener", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export function generateReport(
  tickers: string[],
  template = "daily",
): Promise<ReportResponse> {
  return request<ReportResponse>("/api/v1/llm/report", {
    method: "POST",
    body: JSON.stringify({ tickers, template }),
  });
}

export function getMLModels(): Promise<MLModelsResponse> {
  return request<MLModelsResponse>("/api/v1/ml/models");
}

export function getMLModel(
  modelName: string,
  modelVersion: string,
): Promise<MLModelDetail> {
  return request<MLModelDetail>(
    `/api/v1/ml/models/${encodeURIComponent(modelName)}/${encodeURIComponent(modelVersion)}`,
  );
}

export function runBacktest(
  requestData: BacktestRunRequest,
): Promise<BacktestRunResponse> {
  return request<BacktestRunResponse>("/api/v1/backtests/run", {
    method: "POST",
    body: JSON.stringify(requestData),
  });
}

export function getBacktest(backtestId: number): Promise<BacktestDetail> {
  return request<BacktestDetail>(`/api/v1/backtests/${backtestId}`);
}

export function getSectorPerformance(): Promise<SectorPerformance[]> {
  return request<SectorPerformance[]>("/api/v1/market/sectors");
}

export function getMacroIndicators(): Promise<MacroIndicator[]> {
  return request<MacroIndicator[]>("/api/v1/macro/indicators");
}

export function getCalendarEvents(): Promise<CalendarEvent[]> {
  return request<CalendarEvent[]>("/api/v1/calendar/events");
}

export function getNews(): Promise<NewsItem[]> {
  return request<NewsItem[]>("/api/v1/news");
}

export function getStockCompare(
  tickers: string[],
): Promise<CompareStockData[]> {
  return request<CompareStockData[]>(
    `/api/v1/stocks/compare?${tickers.map((t) => `tickers=${encodeURIComponent(t)}`).join("&")}`,
  );
}

export function getPortfolio(): Promise<PortfolioResponse[]> {
  return request<PortfolioResponse[]>("/api/v1/portfolio");
}

export function getAlerts(): Promise<Alert[]> {
  return request<Alert[]>("/api/v1/alerts");
}

export function getResearchMemos(): Promise<ResearchMemo[]> {
  return request<ResearchMemo[]>("/api/v1/research/memos");
}

export function getDataQuality(): Promise<DataQualityReport> {
  return request<DataQualityReport>("/api/v1/data-quality");
}

export function getSystemStatus(): Promise<SystemStatus> {
  return request<SystemStatus>("/api/v1/system/status");
}

export function getSettings(): Promise<BackendSettings> {
  return request<BackendSettings>("/api/v1/settings");
}

export function getScreenerSaved(): Promise<ScreenerSavedConfig[]> {
  return request<ScreenerSavedConfig[]>("/api/v1/screener/saved");
}

export function createPortfolio(
  data: PortfolioCreate,
): Promise<PortfolioResponse> {
  return request<PortfolioResponse>("/api/v1/portfolio", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getPortfolioDetail(id: string): Promise<PortfolioResponse> {
  return request<PortfolioResponse>(
    `/api/v1/portfolio/${encodeURIComponent(id)}`,
  );
}

export function addPosition(
  portfolioId: string,
  data: PositionCreate,
): Promise<PortfolioItem> {
  return request<PortfolioItem>(
    `/api/v1/portfolio/${encodeURIComponent(portfolioId)}/positions`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export function updatePosition(
  portfolioId: string,
  positionId: string,
  data: PositionUpdate,
): Promise<PortfolioItem> {
  return request<PortfolioItem>(
    `/api/v1/portfolio/${encodeURIComponent(portfolioId)}/positions/${encodeURIComponent(positionId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
}

export function deletePosition(
  portfolioId: string,
  positionId: string,
): Promise<void> {
  return request<void>(
    `/api/v1/portfolio/${encodeURIComponent(portfolioId)}/positions/${encodeURIComponent(positionId)}`,
    {
      method: "DELETE",
    },
  );
}

export function deletePortfolio(id: string): Promise<void> {
  return request<void>(`/api/v1/portfolio/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
