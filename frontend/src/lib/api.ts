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

export interface StockAnalysis {
  ticker: string;
  name: string;
  sector: string | null;
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  turnover: number;
  market_cap: number;
  opportunity_score: number;
  classification: string;
  confidence: number;
  risk_level: string;
  regime: string;
  components: Record<string, unknown>;
  drivers: string[];
  risks: string[];
  invalidation_conditions: string[];
  asof: string | null;
  feature_version: string | null;
  scoring_version: string | null;
}

export interface TechnicalIndicators {
  ticker: string;
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

export function getTechnicalIndicators(
  ticker: string,
): Promise<TechnicalIndicators> {
  return request<TechnicalIndicators>(
    `/api/v1/stocks/${encodeURIComponent(ticker)}/technical`,
  );
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