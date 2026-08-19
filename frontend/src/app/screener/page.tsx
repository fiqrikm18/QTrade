"use client";

import { useCallback, useEffect, useState } from "react";
import { X, ChevronDown, ChevronUp, Save } from "lucide-react";
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
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ScoreBar } from "@/components/ui/score-bar";
import {
  runScreener,
  getScreenerSaved,
  type ScreenerFilters,
  type ScreenerItem,
  type ScreenerSavedConfig,
  type ScreenerResult,
} from "@/lib/api";

const CLASSIFICATIONS = [
  "OPPORTUNITY",
  "WATCHLIST",
  "NEUTRAL",
  "HIGH_RISK",
  "AVOID",
];

const PAGE_SIZE = 20;

interface Filters {
  minOpportunity: string;
  maxOpportunity: string;
  sector: string[];
  classification: string[];
  minRisk: string;
  maxRisk: string;
}

const EMPTY_FILTERS: Filters = {
  minOpportunity: "",
  maxOpportunity: "",
  sector: [],
  classification: [],
  minRisk: "",
  maxRisk: "",
};

type SortKey =
  | "ticker"
  | "name"
  | "sector_code"
  | "opportunity_score"
  | "technical_score"
  | "fundamental_score"
  | "momentum_score"
  | "relative_strength"
  | "smart_money_score"
  | "sector_score"
  | "risk_score"
  | "ml_score"
  | "classification";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: ScreenerItem[]; total: number; asof: string | null };

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

function MultiSelectTrigger({
  values,
  placeholder,
}: {
  values: string[];
  placeholder: string;
}) {
  return (
    <SelectTrigger>
      <SelectValue placeholder={placeholder}>
        {values.length === 0
          ? placeholder
          : values.map((v) => (
              <span key={v} className="inline-flex items-center gap-1 bg-accent/20 text-accent text-xs px-1.5 py-0.5 rounded mr-1">
                {v.replace(/_/g, " ")}
                <X className="h-3 w-3 cursor-pointer hover:opacity-50" onClick={(e) => e.stopPropagation()} />
              </span>
            ))}
      </SelectValue>
    </SelectTrigger>
  );
}

export default function ScreenerPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("opportunity_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [savedConfigs, setSavedConfigs] = useState<ScreenerSavedConfig[]>([]);
  const [savedConfigsOpen, setSavedConfigsOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [sectorOptions, setSectorOptions] = useState<string[]>([]);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const toApiFilters = (f: Filters): ScreenerFilters => {
    const out: ScreenerFilters = {};
    if (f.sector.length > 0) out.sector = f.sector;
    if (f.classification.length > 0) out.classification = f.classification;
    const minOpp = Number(f.minOpportunity);
    const maxOpp = Number(f.maxOpportunity);
    const minR = Number(f.minRisk);
    const maxR = Number(f.maxRisk);
    if (f.minOpportunity !== "" && !Number.isNaN(minOpp)) out.min_opportunity_score = minOpp;
    if (f.maxOpportunity !== "" && !Number.isNaN(maxOpp)) out.max_opportunity_score = maxOpp;
    if (f.minRisk !== "" && !Number.isNaN(minR)) out.min_risk = minR;
    if (f.maxRisk !== "" && !Number.isNaN(maxR)) out.max_risk = maxR;
    return out;
  };

  const run = useCallback(
    async (p: number, showLoading: boolean) => {
      if (showLoading) setState({ status: "loading" });
      try {
        const result: ScreenerResult = await runScreener(toApiFilters(filters), p, PAGE_SIZE);
        const sectors = Array.from(new Set(result.items.map((i) => i.sector_code).filter(Boolean))) as string[];
        setSectorOptions(sectors.sort());
        setState({ status: "ready", items: result.items, total: result.total, asof: result.asof });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to run screener";
        setState({ status: "error", message: msg });
        showToast(msg, "error");
      }
    },
    [filters, showToast],
  );

  useEffect(() => {
    let cancelled = false;
    void runScreener(toApiFilters(filters), 1, PAGE_SIZE).then((result) => {
      if (cancelled) return;
      const sectors = Array.from(new Set(result.items.map((i) => i.sector_code).filter(Boolean))) as string[];
      setSectorOptions(sectors.sort());
      setState({ status: "ready", items: result.items, total: result.total, asof: result.asof });
    });
    return () => {
      cancelled = true;
    };
  }, [run, filters]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const configs = await getScreenerSaved();
        if (mounted) setSavedConfigs(configs);
      } catch {
        if (mounted) setSavedConfigs([]);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

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

  const handleToggleSector = (sector: string) => {
    setFilters((prev) => ({
      ...prev,
      sector: prev.sector.includes(sector)
        ? prev.sector.filter((s) => s !== sector)
        : [...prev.sector, sector],
    }));
  };

  const handleToggleClassification = (classification: string) => {
    setFilters((prev) => ({
      ...prev,
      classification: prev.classification.includes(classification)
        ? prev.classification.filter((c) => c !== classification)
        : [...prev.classification, classification],
    }));
  };

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={true}
            title="Saving not yet implemented (backend returns 501)"
          >
            <Save className="mr-1 h-3 w-3" />
            Save Config
          </Button>
          <Select open={savedConfigsOpen} onOpenChange={setSavedConfigsOpen}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Saved Configs" />
            </SelectTrigger>
            <SelectContent position="popper">
              {savedConfigs.length === 0 ? (
                <SelectItem disabled value="" className="text-muted text-center py-2">
                  No saved configs
                </SelectItem>
              ) : (
                savedConfigs.map((c) => (
                  <SelectItem key={c.id} value={c.id} onSelect={() => setSavedConfigsOpen(false)}>
                    {c.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-muted mb-1">
                Min Opp. Score
              </label>
              <Input
                type="number"
                placeholder="0"
                min="0"
                max="100"
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
                Max Opp. Score
              </label>
              <Input
                type="number"
                placeholder="100"
                min="0"
                max="100"
                value={filters.maxOpportunity}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    maxOpportunity: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted mb-1">
                Min Risk (0-100)
              </label>
              <Input
                type="number"
                placeholder="0"
                min="0"
                max="100"
                value={filters.minRisk}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    minRisk: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted mb-1">
                Max Risk (0-100)
              </label>
              <Input
                type="number"
                placeholder="100"
                min="0"
                max="100"
                value={filters.maxRisk}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    maxRisk: e.target.value,
                  }))
                }
              />
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <label className="block text-[10px] font-medium text-muted mb-1">
                Sector (multi)
              </label>
              <Select onOpenChange={(open) => open && setSectorOptions((prev) => prev)}>
                <MultiSelectTrigger values={filters.sector} placeholder="All Sectors" />
                <SelectContent>
                  {sectorOptions.length === 0 ? (
                    <SelectItem disabled value="" className="text-muted text-center py-2">
                      Loading sectors...
                    </SelectItem>
                  ) : (
                    sectorOptions.map((s) => (
                      <SelectItem
                        key={s}
                        value={s}
                        onSelect={(e) => {
                          e.preventDefault();
                          handleToggleSector(s);
                        }}
                      >
                        {s.replace(/_/g, " ")}
                        {filters.sector.includes(s) && (
                          <span className="ml-auto text-positive">✓</span>
                        )}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <label className="block text-[10px] font-medium text-muted mb-1">
                Classification (multi)
              </label>
              <Select>
                <MultiSelectTrigger values={filters.classification} placeholder="All" />
                <SelectContent>
                  {CLASSIFICATIONS.map((c) => (
                    <SelectItem
                      key={c}
                      value={c}
                      onSelect={(e) => {
                        e.preventDefault();
                        handleToggleClassification(c);
                      }}
                    >
                      {c.replace(/_/g, " ")}
                      {filters.classification.includes(c) && (
                        <span className="ml-auto text-positive">✓</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          {state.status === "loading" ? (
            <LoadingSkeleton variant="table" rows={5} columns={13} />
          ) : state.status === "error" ? (
            <div className="p-4">
              <p className="text-destructive">Failed to run screener</p>
              <p className="text-xs text-muted">{state.message}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => void run(page, true)}>
                Retry
              </Button>
            </div>
          ) : state.status === "ready" && state.items.length === 0 ? (
            <EmptyState
              title="No results match filters"
              description="Adjust your filters or run the screener with different criteria"
              icon="filter"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 cursor-pointer" onClick={() => handleSort("ticker")}>
                      # {getSortIcon("ticker")}
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("ticker")}>
                      Ticker {getSortIcon("ticker")}
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                      Company {getSortIcon("name")}
                    </TableHead>
                    <TableHead className="w-24 cursor-pointer" onClick={() => handleSort("sector_code")}>
                      Sector {getSortIcon("sector_code")}
                    </TableHead>
                    <TableHead className="w-24 text-center cursor-pointer" onClick={() => handleSort("opportunity_score")}>
                      Opp. Score {getSortIcon("opportunity_score")}
                    </TableHead>
                    <TableHead className="w-16 text-center cursor-pointer" onClick={() => handleSort("technical_score")}>
                      Tech {getSortIcon("technical_score")}
                    </TableHead>
                    <TableHead className="w-16 text-center cursor-pointer" onClick={() => handleSort("fundamental_score")}>
                      Fund {getSortIcon("fundamental_score")}
                    </TableHead>
                    <TableHead className="w-16 text-center cursor-pointer" onClick={() => handleSort("momentum_score")}>
                      Mom {getSortIcon("momentum_score")}
                    </TableHead>
                    <TableHead className="w-16 text-center cursor-pointer" onClick={() => handleSort("relative_strength")}>
                      Rel Str {getSortIcon("relative_strength")}
                    </TableHead>
                    <TableHead className="w-16 text-center cursor-pointer" onClick={() => handleSort("smart_money_score")}>
                      Smart {getSortIcon("smart_money_score")}
                    </TableHead>
                    <TableHead className="w-16 text-center cursor-pointer" onClick={() => handleSort("sector_score")}>
                      Sector {getSortIcon("sector_score")}
                    </TableHead>
                    <TableHead className="w-16 text-center cursor-pointer" onClick={() => handleSort("risk_score")}>
                      Risk {getSortIcon("risk_score")}
                    </TableHead>
                    <TableHead className="w-16 text-center cursor-pointer" onClick={() => handleSort("ml_score")}>
                      ML {getSortIcon("ml_score")}
                    </TableHead>
                    <TableHead className="w-24 cursor-pointer" onClick={() => handleSort("classification")}>
                      Classification {getSortIcon("classification")}
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
                        {item.sector_code ? item.sector_code.replace(/_/g, " ") : "--"}
                      </TableCell>
                      <TableCell className="text-center">
                        <ScoreBar score={item.opportunity_score} classification={item.classification ?? undefined} />
                      </TableCell>
                      <TableCell className="text-center font-medium tabular-nums">{fmtScore(item.technical_score)}</TableCell>
                      <TableCell className="text-center font-medium tabular-nums">{fmtScore(item.fundamental_score)}</TableCell>
                      <TableCell className="text-center font-medium tabular-nums">{fmtScore(item.momentum_score)}</TableCell>
                      <TableCell className="text-center font-medium tabular-nums">{fmtScore(item.relative_strength)}</TableCell>
                      <TableCell className="text-center font-medium tabular-nums">{fmtScore(item.smart_money_score)}</TableCell>
                      <TableCell className="text-center font-medium tabular-nums">{fmtScore(item.sector_score)}</TableCell>
                      <TableCell className="text-center font-medium tabular-nums">{fmtScore(item.risk_score)}</TableCell>
                      <TableCell className="text-center font-medium tabular-nums">{fmtScore(item.ml_score)}</TableCell>
                      <TableCell>
                        {item.classification ? (
                          <Badge variant={scoreBadgeVariant(item.opportunity_score)} className="text-xs">
                            {item.classification}
                          </Badge>
                        ) : (
                          "--"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
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

      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-md text-sm font-medium shadow-lg animate-in slide-in-from-bottom-4 ${
            toast.type === "success" ? "bg-positive text-white" : "bg-negative text-white"
          }`}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}