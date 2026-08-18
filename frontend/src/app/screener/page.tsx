"use client";

import { useCallback, useEffect, useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  runScreener,
  type ScreenerFilters,
  type ScreenerItem,
} from "@/lib/api";

const BOARDS = [
  "ACCELERATION_BOARD",
  "DEVELOPMENT_BOARD",
  "MAIN_BOARD",
  "NEW_BOARD",
  "NEW_ECONOMY",
  "SPECIAL_MONITORING",
];

const CLASSIFICATIONS = [
  "OPPORTUNITY",
  "WATCHLIST",
  "NEUTRAL",
  "HIGH_RISK",
  "AVOID",
];

const PAGE_SIZE = 20;

interface Filters {
  sector: string;
  minOpportunity: string;
  maxOpportunity: string;
  classification: string;
}

const EMPTY_FILTERS: Filters = {
  sector: "",
  minOpportunity: "",
  maxOpportunity: "",
  classification: "",
};

type SortKey =
  | "ticker"
  | "name"
  | "sector_code"
  | "opportunity_score"
  | "technical_score"
  | "fundamental_score"
  | "momentum_score"
  | "smart_money_score"
  | "sector_score"
  | "risk_score"
  | "ml_score";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: ScreenerItem[]; total: number };

function fmtScore(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "--";
  return v.toFixed(1);
}

function scoreBadgeVariant(
  v: number | null | undefined,
): "success" | "warning" | "destructive" | "secondary" {
  if (v === null || v === undefined) return "secondary";
  if (v >= 60) return "success";
  if (v >= 40) return "warning";
  return "destructive";
}

export default function ScreenerPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("opportunity_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [state, setState] = useState<LoadState>({ status: "idle" });

  const toApiFilters = (f: Filters): ScreenerFilters => {
    const out: ScreenerFilters = {};
    if (f.sector) out.sector = [f.sector];
    if (f.classification) out.classification = [f.classification];
    const min = Number(f.minOpportunity);
    const max = Number(f.maxOpportunity);
    if (f.minOpportunity !== "" && !Number.isNaN(min))
      out.min_opportunity_score = min;
    if (f.maxOpportunity !== "" && !Number.isNaN(max))
      out.max_opportunity_score = max;
    return out;
  };

  const run = useCallback(
    async (p: number, showLoading: boolean) => {
      if (showLoading) setState({ status: "loading" });
      try {
        const result = await runScreener(toApiFilters(filters), p, PAGE_SIZE);
        setState({ status: "ready", items: result.items, total: result.total });
      } catch (err) {
        setState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Failed to run screener",
        });
      }
    },
    [filters],
  );

  useEffect(() => {
    let cancelled = false;
    void runScreener(toApiFilters(filters), 1, PAGE_SIZE).then((result) => {
      if (cancelled) return;
      setState({ status: "ready", items: result.items, total: result.total });
    });
    return () => {
      cancelled = true;
    };
  }, [run, filters]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ChevronDown className="h-3 w-3 text-muted" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

  const items =
    state.status === "ready"
      ? [...state.items].sort((a, b) => {
          const av = a[sortKey] ?? "";
          const bv = b[sortKey] ?? "";
          const cmp =
            typeof av === "number"
              ? av - (bv as number)
              : String(av).localeCompare(String(bv));
          return sortDir === "asc" ? cmp : -cmp;
        })
      : [];

  const totalPages =
    state.status === "ready"
      ? Math.max(1, Math.ceil(state.total / PAGE_SIZE))
      : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Screener</h1>
          <p className="text-xs text-muted">
            Filter and rank stocks across the IDX universe
            {state.status === "ready" && ` ({state.total} results)`}
          </p>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm">Filters</CardTitle>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-muted mb-1">
                Board
              </label>
              <Select
                value={filters.sector}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, sector: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Boards" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Boards</SelectItem>
                  {BOARDS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-muted mb-1">
                Classification
              </label>
              <Select
                value={filters.classification}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, classification: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {CLASSIFICATIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-muted mb-1">
                Min Opp.
              </label>
              <Input
                type="number"
                placeholder="0"
                value={filters.minOpportunity}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    minOpportunity: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted mb-1">
                Max Opp.
              </label>
              <Input
                type="number"
                placeholder="100"
                value={filters.maxOpportunity}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    maxOpportunity: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              disabled={state.status === "loading"}
              onClick={() => {
                setPage(1);
                void run(1, true);
              }}
              size="sm"
            >
              {state.status === "loading" ? "Running..." : "Run Screener"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {state.status === "error" ? (
            <div className="p-4">
              <p className="text-destructive">Failed to run screener</p>
              <p className="text-xs text-muted">{state.message}</p>
            </div>
          ) : state.status === "ready" && state.items.length === 0 ? (
            <div className="p-6 text-muted text-center text-sm">
              No stocks match the current filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="w-8 cursor-pointer"
                    onClick={() => handleSort("ticker")}
                  >
                    # {getSortIcon("ticker")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort("ticker")}
                  >
                    Ticker {getSortIcon("ticker")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort("name")}
                  >
                    Company {getSortIcon("name")}
                  </TableHead>
                  <TableHead
                    className="w-24 cursor-pointer"
                    onClick={() => handleSort("sector_code")}
                  >
                    Board {getSortIcon("sector_code")}
                  </TableHead>
                  <TableHead
                    className="w-16 text-center cursor-pointer"
                    onClick={() => handleSort("technical_score")}
                  >
                    Tech {getSortIcon("technical_score")}
                  </TableHead>
                  <TableHead
                    className="w-16 text-center cursor-pointer"
                    onClick={() => handleSort("fundamental_score")}
                  >
                    Fund {getSortIcon("fundamental_score")}
                  </TableHead>
                  <TableHead
                    className="w-16 text-center cursor-pointer"
                    onClick={() => handleSort("momentum_score")}
                  >
                    Mom {getSortIcon("momentum_score")}
                  </TableHead>
                  <TableHead
                    className="w-16 text-center cursor-pointer"
                    onClick={() => handleSort("smart_money_score")}
                  >
                    Smart {getSortIcon("smart_money_score")}
                  </TableHead>
                  <TableHead
                    className="w-16 text-center cursor-pointer"
                    onClick={() => handleSort("risk_score")}
                  >
                    Risk {getSortIcon("risk_score")}
                  </TableHead>
                  <TableHead
                    className="w-16 text-center cursor-pointer"
                    onClick={() => handleSort("ml_score")}
                  >
                    ML {getSortIcon("ml_score")}
                  </TableHead>
                  <TableHead
                    className="w-20 text-center cursor-pointer"
                    onClick={() => handleSort("opportunity_score")}
                  >
                    Opp. {getSortIcon("opportunity_score")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={item.ticker}>
                    <TableCell className="font-mono text-xs">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">{item.ticker}</TableCell>
                    <TableCell>{item.name ?? "--"}</TableCell>
                    <TableCell>
                      {item.sector_code
                        ? item.sector_code.replace(/_/g, " ")
                        : "--"}
                    </TableCell>
                    <TableCell className="text-center font-medium tabular-nums">
                      {fmtScore(item.technical_score)}
                    </TableCell>
                    <TableCell className="text-center font-medium tabular-nums">
                      {fmtScore(item.fundamental_score)}
                    </TableCell>
                    <TableCell className="text-center font-medium tabular-nums">
                      {fmtScore(item.momentum_score)}
                    </TableCell>
                    <TableCell className="text-center font-medium tabular-nums">
                      {fmtScore(item.smart_money_score)}
                    </TableCell>
                    <TableCell className="text-center font-medium tabular-nums">
                      {fmtScore(item.risk_score)}
                    </TableCell>
                    <TableCell className="text-center font-medium tabular-nums">
                      {fmtScore(item.ml_score)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={scoreBadgeVariant(item.opportunity_score)}
                        className="text-xs"
                      >
                        {fmtScore(item.opportunity_score)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {state.status === "ready" && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="xs"
              disabled={page <= 1}
              onClick={() => {
                const p = page - 1;
                setPage(p);
                void run(p, true);
              }}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="xs"
              disabled={page >= totalPages}
              onClick={() => {
                const p = page + 1;
                setPage(p);
                void run(p, true);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
