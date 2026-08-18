"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Target,
  Gauge,
  DollarSign,
  Activity,
  LineChart,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertTriangle,
} from "lucide-react";
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
import { getStockCompare, type CompareStockData } from "@/lib/api";

interface StockData {
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

const AVAILABLE_TICKERS = [
  "BBCA",
  "BBRI",
  "BMRI",
  "TLKM",
  "ASII",
  "UNTR",
  "INDF",
  "ICBP",
  "KLBF",
  "SMGR",
  "WIKA",
  "PTPP",
  "ADRO",
  "ITMG",
  "PTBA",
  "HRUM",
  "MDKA",
  "ANTM",
  "INCO",
  "TINS",
  "GOTO",
  "BUKA",
  "EMTK",
  "ARTO",
  "DOKU",
  "MINT",
  "TOWR",
  "EXCL",
  "ISAT",
  "FREN",
];

type MetricRow = {
  label: string;
  key: keyof StockData;
  format: (value: number) => string;
  badgeVariant?: (
    value: number,
  ) =>
    | "default"
    | "success"
    | "destructive"
    | "warning"
    | "secondary"
    | "outline"
    | "info";
  align?: "left" | "center" | "right";
  className?: string;
};

const METRIC_ROWS: MetricRow[] = [
  {
    label: "Opportunity Score",
    key: "opportunity",
    format: (v) => String(v),
    badgeVariant: (v) =>
      v >= 85 ? "success" : v >= 70 ? "default" : "destructive",
    align: "center",
  },
  {
    label: "Technical",
    key: "technical",
    format: (v) => String(v),
    badgeVariant: () => "default",
    align: "center",
  },
  {
    label: "Fundamental",
    key: "fundamental",
    format: (v) => String(v),
    badgeVariant: () => "default",
    align: "center",
  },
  {
    label: "Momentum",
    key: "momentum",
    format: (v) => String(v),
    badgeVariant: () => "default",
    align: "center",
  },
  {
    label: "Smart Money",
    key: "smartMoney",
    format: (v) => String(v),
    badgeVariant: () => "default",
    align: "center",
  },
  {
    label: "Sector",
    key: "sectorScore",
    format: (v) => String(v),
    badgeVariant: () => "default",
    align: "center",
  },
  {
    label: "Risk",
    key: "risk",
    format: (v) => String(v),
    badgeVariant: () => "default",
    align: "center",
  },
  {
    label: "ML",
    key: "ml",
    format: (v) => String(v),
    badgeVariant: () => "default",
    align: "center",
  },
  {
    label: "Price",
    key: "price",
    format: (v) => v.toLocaleString(),
    align: "right",
    className: "font-medium",
  },
  {
    label: "Change",
    key: "change",
    format: (v) => `${v >= 0 ? "+" : ""}${v}%`,
    align: "right",
    className: "font-medium",
  },
  {
    label: "Volume",
    key: "volume",
    format: (v) => v.toLocaleString(),
    align: "right",
  },
  {
    label: "Turnover",
    key: "turnover",
    format: (v) => `${v}B`,
    align: "right",
  },
  {
    label: "Mkt Cap",
    key: "marketCap",
    format: (v) => `${(v / 1e12).toFixed(1)}T`,
    align: "right",
  },
];

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: StockData[] };

export default function ComparePage() {
  const [selectedTickers, setSelectedTickers] = useState<string[]>([
    "BBCA",
    "BBRI",
    "BMRI",
    "BBNI",
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (selectedTickers.length === 0) return;
    (async () => {
      try {
        const apiData = await getStockCompare(selectedTickers);
        if (cancelled) return;
        const mappedData: StockData[] = apiData.map((item) => ({
          ticker: item.ticker,
          company: item.company,
          sector: item.sector,
          price: item.price,
          change: item.change,
          volume: item.volume,
          turnover: item.turnover,
          marketCap: item.marketCap,
          technical: item.technical,
          fundamental: item.fundamental,
          momentum: item.momentum,
          smartMoney: item.smartMoney,
          sectorScore: item.sectorScore,
          risk: item.risk,
          ml: item.ml,
          opportunity: item.opportunity,
        }));
        setState({ status: "ready", data: mappedData });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Failed to load comparison data",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTickers]);

  const handleAddTicker = (ticker: string) => {
    const upper = ticker.toUpperCase();
    if (
      upper &&
      !selectedTickers.includes(upper) &&
      selectedTickers.length < 6
    ) {
      setState({ status: "loading" });
      setSelectedTickers([...selectedTickers, upper]);
      setSearchQuery("");
    }
  };

  const handleRemoveTicker = (ticker: string) => {
    const next = selectedTickers.filter((t) => t !== ticker);
    if (next.length === 0) {
      setState({ status: "ready", data: [] });
    } else {
      setState({ status: "loading" });
    }
    setSelectedTickers(next);
  };

  const handleSelectChange = (value: string) => {
    handleAddTicker(value);
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-64">
          <AlertTriangle className="h-12 w-12 text-negative" />
          <div className="ml-4">
            <h2 className="text-xl font-bold">
              Failed to load comparison data
            </h2>
            <p className="text-muted">{state.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredData = state.data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Compare Stocks</h1>
          <p className="text-muted">
            Side-by-side quantitative comparison
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select onValueChange={handleSelectChange} value={searchQuery}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Add ticker..." />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_TICKERS.filter(
                (t) => !selectedTickers.includes(t),
              ).map((ticker) => (
                <SelectItem key={ticker} value={ticker}>
                  {ticker}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => handleAddTicker(searchQuery)}
            disabled={
              !searchQuery ||
              selectedTickers.includes(searchQuery.toUpperCase()) ||
              selectedTickers.length >= 6
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Ticker chips */}
      <div className="flex flex-wrap gap-2">
        {selectedTickers.map((ticker) => (
          <div
            key={ticker}
            className="flex items-center gap-1 px-3 py-1 bg-elevated-panel border border-border rounded-full text-sm"
          >
            <span className="font-medium">{ticker}</span>
            <button
              onClick={() => handleRemoveTicker(ticker)}
              className="text-muted hover:text-foreground"
              aria-label={`Remove ${ticker}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {selectedTickers.length < 6 && (
          <Select onValueChange={handleSelectChange} value={searchQuery}>
            <SelectTrigger className="px-3 py-1 text-sm text-muted border border-dashed border-border rounded-full hover:bg-elevated-panel transition-colors h-8">
              <SelectValue placeholder="+ Add Ticker" />
              <Plus className="ml-2 h-3 w-3" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_TICKERS.filter(
                (t) => !selectedTickers.includes(t),
              ).map((ticker) => (
                <SelectItem key={ticker} value={ticker}>
                  {ticker}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filteredData.map((stock) => (
          <Card key={stock.ticker}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{stock.ticker}</CardTitle>
                <Badge variant="secondary">{stock.sector}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted">Price</span>
                <span className="font-bold text-lg">
                  {stock.price.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">Change</span>
                <span
                  className={`font-medium ${stock.change >= 0 ? "text-positive" : "text-negative"}`}
                >
                  {stock.change >= 0 ? "+" : ""}
                  {stock.change}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">
                  Opportunity
                </span>
                <Badge
                  variant={
                    stock.opportunity >= 85
                      ? "success"
                      : stock.opportunity >= 70
                        ? "default"
                        : "destructive"
                  }
                >
                  {stock.opportunity}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm">Quantitative Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Metric</TableHead>
                  {filteredData.map((stock) => (
                    <TableHead key={stock.ticker} className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-medium">{stock.ticker}</span>
                        <span className="text-xs text-muted truncate max-w-[100px]">
                          {stock.company}
                        </span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {METRIC_ROWS.map((metric) => (
                  <TableRow key={metric.label}>
                    <TableHead className="font-medium">
                      {metric.label}
                    </TableHead>
                    {filteredData.map((stock) => {
                      const value = stock[metric.key] as number;
                      const formatted = metric.format(value);
                      const alignClass =
                        metric.align === "right"
                          ? "text-right"
                          : metric.align === "center"
                            ? "text-center"
                            : "";
                      const customClass = metric.className
                        ? ` ${metric.className}`
                        : "";

                      if (metric.badgeVariant) {
                        const variant = metric.badgeVariant(value);
                        return (
                          <TableCell
                            key={stock.ticker}
                            className={`${alignClass}${customClass}`}
                          >
                            <Badge variant={variant}>{formatted}</Badge>
                          </TableCell>
                        );
                      }

                      if (metric.key === "change") {
                        const changeValue = stock.change;
                        return (
                          <TableCell
                            key={stock.ticker}
                            className={`${alignClass} font-medium ${changeValue >= 0 ? "text-positive" : "text-negative"}${customClass}`}
                          >
                            {formatted}
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell
                          key={stock.ticker}
                          className={`${alignClass}${customClass}`}
                        >
                          {formatted}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
