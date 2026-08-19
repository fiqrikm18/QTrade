# Frontend Real Data Plan (Phase 2)

**Base commit**: b4d23a4 (backend complete)
**Target**: Replace all frontend dummy/fallback data with real API consumption, update types to match backend contracts, implement honest loading/error/empty/stale states per DESIGN.md.

## Contract Changes from Backend (must update `src/lib/api.ts`)

| Type | Field | Old | New | Reason |
|------|-------|-----|-----|--------|
| `CalendarEvent` | `prev`, `consensus`, `actual` | `string` | `number \| null` | Backend returns numeric or null |
| `NewsItem` | `id` | `number` | `string` | Backend returns string ID |
| `NewsItem` | `impact` | `"HIGH" \| "MEDIUM" \| "LOW"` | `"HIGH" \| "MEDIUM" \| "LOW" \| null` | Nullable when unknown |
| `NewsItem` | `sentiment` | `"POSITIVE" \| "NEGATIVE" \| "NEUTRAL"` | `"POSITIVE" \| "NEGATIVE" \| "NEUTRAL" \| null` | Nullable when unknown |
| `MarketOverview.macro` | `risk`, `support` | `number` | `number` (unchanged — now guaranteed non-null via 0.0 fallback) | |
| `ScreenerItem` | `sector_code` | `string \| null` | `string \| null` (unchanged — now populated) | |
| `StockAnalysis` | `risk_level` | `string \| null` | `"low" \| "medium" \| "high" \| null` | Lowercase enum from backend |
| `StockAnalysis` | `regime` | `string \| null` | `"trending_up" \| "trending_down" \| "ranging" \| "volatile" \| null` | New enum values |

## New Types to Add

```typescript
// Data Quality
export interface DataQualityReport {
  ohlcv: { last_update: string | null; row_count: number; tickers: number; gaps: string[] };
  macro: { last_update: string | null; row_count: number; indicators: number };
  calendar: { last_update: string | null; row_count: number; events: number };
  news: { last_update: string | null; row_count: number; articles: number };
  fundamentals: { last_update: string | null; row_count: number; tickers: number };
  technical_features: { last_update: string | null; row_count: number; tickers: number };
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
export interface PositionCreate {
  ticker: string;
  quantity: number;
  avg_price: number;
}
export interface PositionUpdate {
  quantity?: number;
  avg_price?: number;
}
```

## Page-by-Page Implementation

### 1. `src/lib/api.ts` — Type Contract Updates
- Update `CalendarEvent`, `NewsItem`, `StockAnalysis` enums as above
- Add `DataQualityReport`, `SystemStatus`, `ScreenerSavedConfig`, `PortfolioCreate`, `PortfolioResponse`, `PositionCreate`, `PositionUpdate`
- Add API functions: `getDataQuality()`, `getSystemStatus()`, `getScreenerSaved()`, `createPortfolio()`, `getPortfolioDetail()`, `addPosition()`, `updatePosition()`, `deletePosition()`, `deletePortfolio()`

### 2. `src/app/macro/page.tsx` — Macro Indicators
- Replace any hardcoded fallback data
- Use `getMacroIndicators()` with loading/error/empty states
- Display trend as "up"/"down"/"neutral" with proper icons
- Show `source` field from backend

### 3. `src/app/calendar/page.tsx` — Economic Calendar
- Use `getCalendarEvents()` 
- Handle `prev`/`consensus`/`actual` as `number | null` — render "—" for null
- Filter by impact (HIGH/MEDIUM/LOW) with proper badge colors per DESIGN.md
- Loading skeleton for table rows

### 4. `src/app/news/page.tsx` — News Feed
- Use `getNews()`
- Handle `id: string` for keys
- Render `impact`/`sentiment` badges with null → "Unknown" label
- Infinite scroll or pagination (backend supports it)

### 5. `src/app/market/page.tsx` — Market Overview
- Use `getMarketOverview()`
- Display `regime.regime` with confidence badge
- `breadth.breadth_score` with progress bar (ScoreBar component)
- `sector_rotation` as horizontal scroll cards
- `top_gainers`/`top_losers` as MoverItem table with PriceChange component
- `macro.risk`/`support` as gauges (0-100 scale)
- `upcoming_events` as compact list
- All loading/error/empty states per DESIGN.md §71-72

### 6. `src/app/stocks/[ticker]/page.tsx` — Stock Analysis
- Use `getStockAnalysis()` + `getTechnicalIndicators()`
- **Critical**: Remove hardcoded fallbacks at lines 153-154 (`"MEDIUM"` / `"NEUTRAL"`) — use `analysis.risk_level` and `analysis.regime` directly
- Render `risk_level` with semantic color (low=green, medium=yellow, high=red)
- Render `regime` with icon (trending_up=↗, trending_down=↘, ranging=↔, volatile=⚡)
- Technical indicators table with proper null handling
- All states: loading skeleton, error toast, empty data → honest "No data"

### 7. `src/app/portfolio/page.tsx` — Portfolio CRUD
- Use `getPortfolio()` for list view
- "Create Portfolio" modal → `createPortfolio()`
- Portfolio detail: `getPortfolioDetail(id)` shows positions table
- "Add Position" form → `addPosition(portfolioId, {ticker, quantity, avg_price})`
- Inline edit quantity/avg_price → `updatePosition()`
- Delete position → `deletePosition()`
- Delete portfolio → `deletePortfolio()`
- Real-time PnL updates via `currentPrice` from API
- Empty state: "No portfolios yet. Create one." + CTA button

### 8. `src/app/screener/page.tsx` — Screener
- `runScreener()` already works — verify filters match backend (sector_code, classification, min/max risk)
- "Save Config" button → disabled with tooltip "Saving not yet implemented" (backend returns 501)
- "Saved Configs" dropdown → `getScreenerSaved()` returns `[]` (honest empty)
- Table columns: include `sector_code` from backend
- Pagination, loading, error states

### 9. `src/app/data-quality/page.tsx` — Data Quality (NEW or update existing)
- Use `getDataQuality()`
- Dashboard cards per domain (OHLCV, Macro, Calendar, News, Fundamentals, Technical Features)
- Show last_update, row_count, gaps
- Color-code freshness: green (<1h), yellow (<24h), red (>24h)
- Loading/error states

### 10. `src/app/settings/page.tsx` — Honest Settings
- Remove any "Demo Portfolio" references
- Show real settings from backend (provider selections, cron schedules) via new `GET /api/v1/settings` (if added) or static display
- Toggle for LLM features (reads `llm_*_enabled` flags)
- No dummy portfolio creation

### 10. `src/app/dashboard/page.tsx` — Dashboard
- Uses `getMarketOverview()` — verify it renders real data now
- Quick links to stocks/screener/portfolio work with real IDs
- No hardcoded BBCA fallbacks

### 11. `src/app/research/page.tsx`, `src/app/sectors/page.tsx`, etc.
- Verify all API calls use real endpoints
- Replace any remaining mock data with loading/error/empty states

## Shared Components to Update/Create

- **ScoreBar** — already exists, used for breadth_score, opportunity_score
- **PriceChange** — already exists, used for movers
- **ImpactBadge** — new: renders HIGH/MEDIUM/LOW/Unknown with semantic colors
- **SentimentBadge** — new: renders POSITIVE/NEGATIVE/NEUTRAL/Unknown
- **RegimeBadge** — new: renders trending_up/down/ranging/volatile with icons
- **RiskLevelBadge** — new: renders low/medium/high with semantic colors
- **DataTable** — ensure handles null values gracefully ("—" for null numbers)
- **LoadingSkeleton** — table rows, cards, lists
- **EmptyState** — illustration + message + CTA per DESIGN.md

## Validation Gates (must pass before claiming done)

```bash
# Frontend
cd frontend
bun run build          # must pass (17 routes)
bunx tsc --noEmit      # 0 errors
bunx eslint .          # 0 errors (warnings OK)
bun run test           # vitest all green

# Integration: run backend + frontend together
# - backend on :8000
# - frontend on :3000 (proxy /api/v1/* to :8000)
# - smoke test: dashboard, market, stocks/BBCA, screener, portfolio, macro, calendar, news
```

## Out of Scope (Future Work)

- WebSocket live updates for portfolio PnL
- Screener config persistence (backend 501 → implement when needed)
- Alerts page real data (backend not yet)
- Research memos real data (backend not yet)
- Compare page real data
- Backtest UI for new bias_audit fields

## Definition of Done

- [ ] `src/lib/api.ts` types match backend contracts exactly
- [ ] All 10 pages consume real APIs with loading/error/empty/stale states
- [ ] No hardcoded fallback data in any page/component (grep for "MEDIUM", "NEUTRAL", "BBCA", "dummy", "mock", "fake")
- [ ] Portfolio CRUD works end-to-end (create, add position, update, delete)
- [ ] Screener save returns 501 with honest message; saved list shows empty
- [ ] LLM features show "AI unavailable" when no key (already honest in backend)
- [ ] All validation gates pass
- [ ] No new ESLint/TypeScript errors