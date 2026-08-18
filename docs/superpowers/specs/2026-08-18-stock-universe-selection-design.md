# Stock Universe Selection — Design

Date: 2026-08-18
Status: Approved (user approved approach B and the design)

## Problem

The sidebar "Stocks" entry links to a hardcoded `/stocks/BBCA`, and the stock
detail page only reads the ticker from the URL. The user cannot choose which
stock to inspect.

## Goal

No hardcoded tickers anywhere. The user selects a stock from the real universe
(`GET /api/v1/stocks`), either from a dedicated universe page or a ticker
selector on the detail page.

## Changes

### 1. API client — `frontend/src/lib/api.ts`

- Add `StockListItem` interface: `ticker: string`, `name: string | null`,
  `board: string | null`.
- Add `getStocks(page: number, pageSize: number): Promise<{ items: StockListItem[]; total: number; page: number; page_size: number }>`
  hitting `GET /stocks?page=&page_size=` via the existing `request()` helper.

### 2. Universe page — `frontend/src/app/stocks/page.tsx` (new)

- Renders a table of the universe: ticker, name, board.
- Client-side search box filtering fetched rows; server-side pagination via
  `page`/`page_size` (20 per page, consistent with backend default).
- Row click navigates to `/stocks/<ticker>` (via `useRouter().push()`).
- Loading / error / empty states following existing page patterns
  (spinner while loading, error message with retry, "no stocks" empty state).

### 3. Detail-page selector — `frontend/src/app/stocks/[ticker]/page.tsx`

- New small component `TickerSelect` (`src/components/ui/ticker-select.tsx`):
  Radix `Select` with a search `Input` embedded above the items in
  `SelectContent`; typing filters the visible `SelectItem`s (the base
  `Select` is scrollable but not searchable, and the universe has ~900
  tickers).
- The stock page fetches the universe once via `getStocks` and renders
  `TickerSelect` in the page header listing `ticker — name` options, with the
  current ticker preselected.
- On select, navigate via `useRouter().push()` (`next/navigation`, same
  module the page already uses for `useParams`) to `/stocks/<ticker>`
  (uppercased, matching current URL handling).
- If the universe fetch fails, the page continues to work (detail content is
  driven by the URL ticker); the selector area shows an error hint instead.
- Universe fetch is not awaited before detail data loads (parallel).

### 4. Sidebar — `frontend/src/components/ui/sidebar.tsx`

- "Stocks" href: `/stocks/BBCA` → `/stocks`.

## Non-Goals

- No backend changes (`GET /stocks` already exists and returns the fields
  needed).
- No ticker list caching, favorites, or watchlist features.

## Validation

- `npx tsc --noEmit` — clean
- `npx eslint .` — no new errors
- `npm run build` — passes
- Manual: `/stocks` lists universe, rows navigate; detail page selector
  switches tickers; sidebar link works.