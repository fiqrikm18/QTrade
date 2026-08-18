# Stock Universe Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pick a stock themselves: a `/stocks` universe page (sidebar entry) plus a searchable ticker selector on the stock detail page — no hardcoded `BBCA` links.

**Architecture:** Frontend-only. A new `getStocks()` client reads the existing `GET /api/v1/stocks` paginated universe. A pure `filterStocks()` helper powers both the universe-page search box and a new `TickerSelect` Radix component embedded in the detail page header. Navigation uses `useRouter().push()` (`next/navigation`, already used for `useParams`).

**Tech Stack:** Next.js 16 App Router (client components), Radix UI Select (`@radix-ui/react-select`), Tailwind v4 tokens (`text-muted`, `bg-elevated-panel`, `border-border`), Vitest + Testing Library (jsdom), TypeScript.

## Global Constraints

- No backend changes — `GET /api/v1/stocks` already exists (`backend/app/interfaces/api/routes/stocks.py:29`) and returns `{ items: [{ ticker, name, sector_id, board, listing_date, is_active }], total, page, page_size }`.
- No hardcoded tickers anywhere after this plan; `/stocks/BBCA` must disappear from `src/components/ui/sidebar.tsx:33`.
- TypeScript strict — no `any`, no `@ts-ignore`; explicit interfaces for all props/state (AGENTS.md §13-15).
- Tests use the existing vitest setup: jsdom, globals: true, `@/` alias, jest-dom matchers (`toBeInTheDocument`). Run with `npm run test`.
- Follow existing page conventions: spinner while loading, error message with Retry, empty state text, pagination footer matching `src/app/screener/page.tsx:436-468`.
- Validation per task: `npm run test`, `npx tsc --noEmit`, `npx eslint .`, and final `npm run build`. ESLint currently has 0 errors (pre-existing unused-import warnings allowed) — do not add new errors.
- Commit style follows repo history: conventional commits (`feat:`, `test:`).

---

### Task 1: API client for the stock universe

**Files:**
- Modify: `frontend/src/lib/api.ts` (after `ResearchMemo` interface, ~line 333, before `request`)
- Test: `frontend/src/lib/api.test.ts` (new)

**Interfaces:**
- Consumes: existing `request<T>(path, init?)` helper at `api.ts:335` (fetch wrapper, throws on non-OK, returns parsed JSON).
- Produces: `StockListItem` interface, `StocksResult` interface, `getStocks(page?: number, pageSize?: number): Promise<StocksResult>`. Later tasks consume all three by name.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getStocks } from "@/lib/api";

describe("getStocks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the universe endpoint with pagination and parses the payload", async () => {
    const payload = {
      items: [
        { ticker: "BBCA", name: "Bank Central Asia", board: "Utama" },
        { ticker: "TLKM", name: "Telkom Indonesia", board: "Utama" },
      ],
      total: 2,
      page: 1,
      page_size: 20,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getStocks(1, 20);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/stocks?page=1&page_size=20",
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      ticker: "BBCA",
      name: "Bank Central Asia",
      board: "Utama",
    });
    expect(result.total).toBe(2);
    expect(result.page_size).toBe(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/api.test.ts`
Expected: FAIL — `Cannot find module "@/lib/api"` export `getStocks` (function not defined).

- [ ] **Step 3: Implement the client**

Edit `frontend/src/lib/api.ts`, inserting before the `request` helper (after the `ResearchMemo` interface):

```ts
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
```

Add after `getTechnicalIndicators` (which ends at line 365):

```ts
export function getStocks(
  page = 1,
  pageSize = 20,
): Promise<StocksResult> {
  return request<StocksResult>(
    `/api/v1/stocks?page=${page}&page_size=${pageSize}`,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/api.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/lib/api.test.ts
git commit -m "feat(api): add getStocks client for the stock universe"
```

---

### Task 2: Pure universe filter helper

**Files:**
- Create: `frontend/src/lib/stocks.ts`
- Test: `frontend/src/lib/stocks.test.ts` (new)

**Interfaces:**
- Consumes: `StockListItem` from Task 1.
- Produces: `filterStocks(items: StockListItem[], query: string): StockListItem[]` — case-insensitive, trims whitespace, empty query returns items unchanged. Used by Tasks 3 and 4.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/stocks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filterStocks } from "@/lib/stocks";
import type { StockListItem } from "@/lib/api";

const items: StockListItem[] = [
  { ticker: "BBCA", name: "Bank Central Asia", board: "Utama" },
  { ticker: "BBRI", name: "Bank Rakyat Indonesia", board: "Utama" },
  { ticker: "TLKM", name: "Telkom Indonesia", board: "Utama" },
];

describe("filterStocks", () => {
  it("returns all items for an empty or whitespace query", () => {
    expect(filterStocks(items, "")).toHaveLength(3);
    expect(filterStocks(items, "   ")).toHaveLength(3);
  });

  it("matches ticker case-insensitively", () => {
    expect(filterStocks(items, "bbca").map((i) => i.ticker)).toEqual(["BBCA"]);
  });

  it("matches name case-insensitively", () => {
    expect(filterStocks(items, "telkom").map((i) => i.ticker)).toEqual(["TLKM"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterStocks(items, "zzz")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/stocks.test.ts`
Expected: FAIL — `Cannot find module "@/lib/stocks"`.

- [ ] **Step 3: Implement the helper**

Create `frontend/src/lib/stocks.ts`:

```ts
import type { StockListItem } from "@/lib/api";

export function filterStocks(
  items: StockListItem[],
  query: string,
): StockListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.ticker.toLowerCase().includes(q) ||
      (item.name ?? "").toLowerCase().includes(q),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/stocks.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/stocks.ts frontend/src/lib/stocks.test.ts
git commit -m "feat(stocks): add filterStocks universe query helper"
```

---

### Task 3: Searchable TickerSelect component

**Files:**
- Create: `frontend/src/components/ui/ticker-select.tsx`
- Test: `frontend/src/components/ui/ticker-select.test.tsx` (new)

**Interfaces:**
- Consumes: `StockListItem` (Task 1), `filterStocks` (Task 2), existing `Select` primitives from `@/components/ui/select`, `Input` from `@/components/ui/input`.
- Produces: `TickerSelect` with props `{ options: StockListItem[]; value: string; onSelect: (ticker: string) => void }`. Renders a Radix `Select` whose `SelectContent` embeds a search `Input` above the filtered `SelectItem`s. Used by Task 5.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/ui/ticker-select.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TickerSelect } from "@/components/ui/ticker-select";
import type { StockListItem } from "@/lib/api";

const options: StockListItem[] = [
  { ticker: "BBCA", name: "Bank Central Asia", board: "Utama" },
  { ticker: "TLKM", name: "Telkom Indonesia", board: "Utama" },
  { ticker: "BBRI", name: "Bank Rakyat Indonesia", board: "Utama" },
];

describe("TickerSelect", () => {
  it("shows the current value in the trigger", () => {
    render(<TickerSelect options={options} value="BBCA" onSelect={() => {}} />);
    expect(screen.getByTestId("ticker-select-trigger")).toHaveTextContent(
      "BBCA",
    );
  });

  it("filters options by search query", () => {
    render(<TickerSelect options={options} value="BBCA" onSelect={() => {}} />);
    fireEvent.click(screen.getByTestId("ticker-select-trigger"));
    fireEvent.change(screen.getByPlaceholderText("Search ticker or name..."), {
      target: { value: "telkom" },
    });
    expect(screen.getByText("TLKM", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("BBRI", { exact: false })).not.toBeInTheDocument();
  });

  it("calls onSelect with the chosen ticker", () => {
    const onSelect = vi.fn();
    render(<TickerSelect options={options} value="BBCA" onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("ticker-select-trigger"));
    fireEvent.click(screen.getByText("TLKM", { exact: false }));
    expect(onSelect).toHaveBeenCalledWith("TLKM");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/ui/ticker-select.test.tsx`
Expected: FAIL — `Cannot find module "@/components/ui/ticker-select"`.

- [ ] **Step 3: Implement the component**

Create `frontend/src/components/ui/ticker-select.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { filterStocks } from "@/lib/stocks";
import type { StockListItem } from "@/lib/api";

interface TickerSelectProps {
  options: StockListItem[];
  value: string;
  onSelect: (ticker: string) => void;
}

export function TickerSelect({ options, value, onSelect }: TickerSelectProps) {
  const [query, setQuery] = useState("");
  const filtered = filterStocks(options, query);

  return (
    <Select value={value} onValueChange={onSelect}>
      <SelectTrigger className="w-56" data-testid="ticker-select-trigger">
        <SelectValue placeholder="Select stock" />
      </SelectTrigger>
      <SelectContent>
        <div className="px-1 pb-1">
          <Input
            placeholder="Search ticker or name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted">No matches</p>
        ) : (
          filtered.map((item) => (
            <SelectItem key={item.ticker} value={item.ticker}>
              <span className="font-medium">{item.ticker}</span>
              {item.name ? (
                <span className="ml-2 text-xs text-muted">{item.name}</span>
              ) : null}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/ui/ticker-select.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/ticker-select.tsx frontend/src/components/ui/ticker-select.test.tsx
git commit -m "feat(stocks): add searchable TickerSelect component"
```

---

### Task 4: Universe page + sidebar link

**Files:**
- Create: `frontend/src/app/stocks/page.tsx`
- Modify: `frontend/src/components/ui/sidebar.tsx:33`
- Test: `frontend/src/app/stocks/page.test.tsx` (new)

**Interfaces:**
- Consumes: `getStocks` (Task 1), `filterStocks` (Task 2), existing `Button`/`Card`/`Table`/`Input` primitives, `useRouter` from `next/navigation`.
- Produces: the `/stocks` route — universe table with client-side search, server-side pagination (20/page), clickable rows navigating to `/stocks/<ticker>`. Sidebar "Stocks" href becomes `/stocks`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/stocks/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StocksPage from "@/app/stocks/page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getStocks: vi.fn().mockResolvedValue({
      items: [
        { ticker: "BBCA", name: "Bank Central Asia", board: "Utama" },
        { ticker: "TLKM", name: "Telkom Indonesia", board: "Utama" },
      ],
      total: 2,
      page: 1,
      page_size: 20,
    }),
  };
});

describe("StocksPage", () => {
  it("renders the universe table after loading", async () => {
    render(<StocksPage />);
    expect(await screen.findByText("BBCA")).toBeInTheDocument();
    expect(screen.getByText("Bank Central Asia")).toBeInTheDocument();
  });

  it("filters rows by search query", async () => {
    render(<StocksPage />);
    await screen.findByText("BBCA");
    fireEvent.change(
      screen.getByPlaceholderText("Search ticker or name..."),
      { target: { value: "telkom" } },
    );
    expect(screen.getByText("TLKM")).toBeInTheDocument();
    expect(screen.queryByText("BBCA")).not.toBeInTheDocument();
  });

  it("navigates to the detail page on row click", async () => {
    render(<StocksPage />);
    await screen.findByText("BBCA");
    fireEvent.click(screen.getByText("BBCA"));
    expect(push).toHaveBeenCalledWith("/stocks/BBCA");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/app/stocks/page.test.tsx`
Expected: FAIL — `Cannot find module "@/app/stocks/page"`.

- [ ] **Step 3: Implement the page**

Create `frontend/src/app/stocks/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { getStocks, type StockListItem } from "@/lib/api";
import { filterStocks } from "@/lib/stocks";

const PAGE_SIZE = 20;

export default function StocksPage() {
  const router = useRouter();
  const [items, setItems] = useState<StockListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchPage() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getStocks(page, PAGE_SIZE);
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load stocks");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void fetchPage();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const filtered = filterStocks(items, searchQuery);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading universe...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertTriangle className="h-10 w-10 text-negative" />
        <div className="ml-4">
          <h2 className="text-base font-semibold">Failed to load stocks</h2>
          <p className="text-xs text-muted">{error}</p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => {
              setPage(1);
              setIsLoading(true);
              setError(null);
              void getStocks(1, PAGE_SIZE)
                .then((data) => {
                  setItems(data.items);
                  setTotal(data.total);
                })
                .catch((err) =>
                  setError(
                    err instanceof Error ? err.message : "Failed to load stocks",
                  ),
                )
                .finally(() => setIsLoading(false));
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Stock Universe</h1>
          <p className="text-xs text-muted">
            {total.toLocaleString("en-US")} listed stocks
          </p>
        </div>
        <Input
          placeholder="Search ticker or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-72"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-6 text-muted text-center text-sm">
              No stocks match the current search.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Board</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow
                    key={item.ticker}
                    className="cursor-pointer"
                    onClick={() => router.push(`/stocks/${item.ticker}`)}
                  >
                    <TableCell className="font-medium">{item.ticker}</TableCell>
                    <TableCell>{item.name ?? "--"}</TableCell>
                    <TableCell>{item.board ?? "--"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="xs"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="xs"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: the fetch-on-mount effect reruns on `page` change and the Retry handler both call `getStocks`; `filterStocks` keeps the search local (only current page is searchable — matches the spec's "client-side search box filtering fetched rows").

- [ ] **Step 4: Update the sidebar link**

Edit `frontend/src/components/ui/sidebar.tsx:33`:

```diff
-  { name: "Stocks", href: "/stocks/BBCA", icon: List },
+  { name: "Stocks", href: "/stocks", icon: List },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- src/app/stocks/page.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Verify sidebar change**

Run: `rg -n 'stocks/BBCA' src/`
Expected: no matches (the only occurrence was the sidebar line just edited).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/stocks/page.tsx frontend/src/app/stocks/page.test.tsx frontend/src/components/ui/sidebar.tsx
git commit -m "feat(stocks): add universe page with search and pagination"
```

---

### Task 5: Ticker selector on the detail page

**Files:**
- Modify: `frontend/src/app/stocks/[ticker]/page.tsx`
- Test: `frontend/src/app/stocks/[ticker]/page.test.tsx` (new)

**Interfaces:**
- Consumes: `TickerSelect` (Task 3), `getStocks` + `StockListItem` (Task 1), `useRouter` from `next/navigation`.
- Produces: the detail page fetches the universe once on mount (parallel with analysis/technical fetches — do not await it before detail data) and renders `TickerSelect` at the start of the header's left group with the current ticker preselected; selecting navigates to `/stocks/<TICKER>` (uppercased). If the universe fetch fails, the selector area shows a muted hint and the page keeps working.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/stocks/[ticker]/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StockPage from "@/app/stocks/[ticker]/page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ ticker: "BBCA" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getStockAnalysis: vi.fn().mockResolvedValue({
      ticker: "BBCA",
      name: "Bank Central Asia",
      price: 10400,
      change: 100,
      change_pct: 0.97,
      opportunity_score: 86.5,
      classification: "OPPORTUNITY",
      components: { technical: 88, fundamental: 91 },
      drivers: ["Strong relative strength"],
      risks: ["High valuation"],
      invalidation_conditions: ["Break below support"],
    }),
    getTechnicalIndicators: vi.fn().mockResolvedValue({
      ticker: "BBCA",
      rsi_14: 52.5,
      macd: 1.2,
    }),
    getStocks: vi.fn().mockResolvedValue({
      items: [
        { ticker: "BBCA", name: "Bank Central Asia", board: "Utama" },
        { ticker: "TLKM", name: "Telkom Indonesia", board: "Utama" },
      ],
      total: 2,
      page: 1,
      page_size: 20,
    }),
  };
});

describe("StockPage ticker selector", () => {
  it("shows the current ticker preselected in the selector", async () => {
    render(<StockPage />);
    expect(
      await screen.findByTestId("ticker-select-trigger"),
    ).toHaveTextContent("BBCA");
  });

  it("navigates to the selected ticker", async () => {
    render(<StockPage />);
    fireEvent.click(await screen.findByTestId("ticker-select-trigger"));
    fireEvent.click(screen.getByText("TLKM", { exact: false }));
    expect(push).toHaveBeenCalledWith("/stocks/TLKM");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- "src/app/stocks/[ticker]/page.test.tsx"`
Expected: FAIL — `Unable to find an element with the test id: ticker-select-trigger` (the page does not render the selector yet).

- [ ] **Step 3: Implement the selector on the detail page**

Edit `frontend/src/app/stocks/[ticker]/page.tsx`:

1. Imports — replace line 3 and extend the api import (lines 19-23):

```tsx
import { useParams, useRouter } from "next/navigation";
```

and

```tsx
import {
  getStockAnalysis,
  getStocks,
  getTechnicalIndicators,
  type StockListItem,
  type TechnicalIndicators,
} from "@/lib/api";
```

add:

```tsx
import { TickerSelect } from "@/components/ui/ticker-select";
```

2. Component state — after `const [error, setError] = useState<string | null>(null);` (line 123) add:

```tsx
const [universe, setUniverse] = useState<StockListItem[]>([]);
const [universeError, setUniverseError] = useState<string | null>(null);
```

3. Universe fetch — add a second effect after the existing `fetchData` effect (after line 166):

```tsx
useEffect(() => {
  let cancelled = false;
  async function fetchUniverse() {
    try {
      const data = await getStocks(1, 100);
      if (!cancelled) setUniverse(data.items);
    } catch (err) {
      if (!cancelled) {
        setUniverseError(
          err instanceof Error ? err.message : "Failed to load universe",
        );
      }
    }
  }
  void fetchUniverse();
  return () => {
    cancelled = true;
  };
}, []);
```

4. Header — replace the opening of the header's left group (lines 359-365) so the selector renders before the ticker block:

```tsx
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <TickerSelect
            options={universe}
            value={ticker}
            onSelect={(selected) =>
              router.push(`/stocks/${selected.toUpperCase()}`)
            }
          />
          {universeError && (
            <p className="text-[10px] text-muted hidden lg:block max-w-40">
              Universe unavailable: {universeError}
            </p>
          )}
          <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center">
```

5. Component hook — add at the top of `StockPage` (line 116, before `useParams`):

```tsx
const router = useRouter();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- "src/app/stocks/[ticker]/page.test.tsx"`
Expected: PASS (2 tests).

- [ ] **Step 5: Full validation**

Run: `npm run test` then `npx tsc --noEmit` then `npx eslint .`
Expected: all tests pass; tsc clean; eslint 0 errors (pre-existing warnings allowed).

- [ ] **Step 6: Commit**

```bash
git add "frontend/src/app/stocks/[ticker]/page.tsx" "frontend/src/app/stocks/[ticker]/page.test.tsx"
git commit -m "feat(stocks): add ticker selector to stock detail page"
```

---

### Task 6: Production build + end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds; `/stocks` and `/stocks/[ticker]` both compile.

- [ ] **Step 2: Smoke test against the live backend**

With `npm run dev` running and the backend on `:8000`:

- `curl -s http://localhost:3000/stocks -o /dev/null -w '%{http_code}\n'` → 200
- `curl -s http://localhost:3000/stocks/BBCA -o /dev/null -w '%{http_code}\n'` → 200
- `curl -s "http://localhost:8000/api/v1/stocks?page=1&page_size=20" | head -c 200` → JSON with `items`/`total`

- [ ] **Step 3: Manual click-through**

- Sidebar "Stocks" lands on `/stocks` (not `/stocks/BBCA`).
- Universe page lists real tickers; search filters; Previous/Next paginate; clicking a row opens its detail page.
- Detail page selector shows the current ticker; typing filters; choosing a ticker navigates and loads the new analysis.
- No console errors in the browser devtools.

- [ ] **Step 4: Final commit (if anything changed during verification)**

```bash
git status --short
git add -A
git commit -m "fix(stocks): verification fixes"
```

(Only run if Step 2/3 produced changes; otherwise skip.)