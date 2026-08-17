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
    if (f.minOpportunity !== "" && !Number.isNaN(min)) out.min_opportunity_score = min;
    if (f.maxOpportunity !== "" && !Number.isNaN(max)) out.max_opportunity_score = max;
    return out;
  };

  const run = useCallback(
    async (p: number, showLoading: boolean) => {
      if (showLoading) setState({ status: "loading" });
      try {
        const result = await runScreener(
          toApiFilters(filters),
          p,
          PAGE_SIZE,
        );
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
    if (sortKey !== key)
      return <ChevronDown className="h-4 w-4 text-muted-foreground" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  const items =
    state.status === "ready"
      ? [...state.items].sort((a, b) => {
          const av = a[sortKey] ?? "";
          const bv = b[sortKey] ?? "";
          const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
          return sortDir === "asc" ? cmp : -cmp;
        })
      : [];

  const totalPages = state.status === "ready" ? Math.max(1, Math.ceil(state.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Screener</h1>
          <p className="text-muted-foreground">
            Filter and rank stocks across the IDX universe
            {state.status === "ready" && ` (${state.total} results)`}
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
          >
            <X className="mr-2 h-4 w-4" />
            Clear All
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Min Opportunity
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Max Opportunity
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

          <div className="flex justify-end pt-2">
            <Button
              disabled={state.status === "loading"}
              onClick={() => {
                setPage(1);
                void run(1, true);
              }}
            >
              {state.status === "loading" ? "Running..." : "Run Screener"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {state.status === "error" ? (
            <div className="p-6">
              <p className="text-destructive">Failed to run screener</p>
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
          ) : state.status === "ready" && state.items.length === 0 ? (
            <div className="p-6 text-muted-foreground">
              No stocks match the current filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="w-10"
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
                    className="w-28 cursor-pointer"
                    onClick={() => handleSort("sector_code")}
                  >
                    Board {getSortIcon("sector_code")}
                  </TableHead>
                  <TableHead
                    className="w-20 text-center cursor-pointer"
                    onClick={() => handleSort("technical_score")}
                  >
                    Tech {getSortIcon("technical_score")}
                  </TableHead>
                  <TableHead
                    className="w-20 text-center cursor-pointer"
                    onClick={() => handleSort("fundamental_score")}
                  >
                    Fund {getSortIcon("fundamental_score")}
                  </TableHead>
                  <TableHead
                    className="w-20 text-center cursor-pointer"
                    onClick={() => handleSort("momentum_score")}
                  >
                    Mom {getSortIcon("momentum_score")}
                  </TableHead>
                  <TableHead
                    className="w-20 text-center cursor-pointer"
                    onClick={() => handleSort("smart_money_score")}
                  >
                    Smart {getSortIcon("smart_money_score")}
                  </TableHead>
                  <TableHead
                    className="w-20 text-center cursor-pointer"
                    onClick={() => handleSort("risk_score")}
                  >
                    Risk {getSortIcon("risk_score")}
                  </TableHead>
                  <TableHead
                    className="w-20 text-center cursor-pointer"
                    onClick={() => handleSort("ml_score")}
                  >
                    ML {getSortIcon("ml_score")}
                  </TableHead>
                  <TableHead
                    className="w-28 text-center cursor-pointer"
                    onClick={() => handleSort("opportunity_score")}
                  >
                    Opportunity {getSortIcon("opportunity_score")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={item.ticker}>
                    <TableCell className="font-medium">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">{item.ticker}</TableCell>
                    <TableCell>{item.name ?? "--"}</TableCell>
                    <TableCell>
                      {item.sector_code ? item.sector_code.replace(/_/g, " ") : "--"}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {fmtScore(item.technical_score)}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {fmtScore(item.fundamental_score)}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {fmtScore(item.momentum_score)}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {fmtScore(item.smart_money_score)}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {fmtScore(item.risk_score)}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {fmtScore(item.ml_score)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={scoreBadgeVariant(item.opportunity_score)}>
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
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
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
              size="sm"
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