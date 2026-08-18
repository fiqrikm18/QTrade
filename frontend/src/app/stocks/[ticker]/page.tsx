"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getStockAnalysis,
  getTechnicalIndicators,
  type TechnicalIndicators,
} from "@/lib/api";

interface StockData {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  turnover: number;
  marketCap: number;
  opportunityScore: number;
  classification: string;
  confidence: number;
  riskLevel: string;
  regime: string;
  components: Record<string, number>;
  drivers: string[];
  risks: string[];
  invalidation: string[];
  featureVersion: string;
  scoringVersion: string;
}

interface TechnicalItem {
  label: string;
  value: number | string;
  status: "bullish" | "bearish" | "neutral";
}

interface ScenarioItem {
  scenario: string;
  probability: string;
  targetPrice: number;
  upsideDownside: string;
  keyDrivers: string;
  invalidation: string;
  variant: "success" | "default" | "destructive";
  upsideColor: "green" | "red";
}

function fmtNum(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "--";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const COMPONENT_LABELS: Record<string, string> = {
  technical: "Technical",
  fundamental: "Fundamental",
  momentum: "Momentum",
  smart_money: "Smart Money",
  sector: "Sector",
  macro: "Macro",
  risk: "Risk",
  ml: "ML",
};

const COMPONENT_ORDER = [
  "technical",
  "fundamental",
  "momentum",
  "smart_money",
  "sector",
  "macro",
  "risk",
  "ml",
];

function ScoreBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    clamped >= 70 ? "bg-positive" : clamped >= 40 ? "bg-warning" : "bg-negative";
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-xs text-muted truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-elevated-panel rounded-sm overflow-hidden">
        <div
          className={cn("h-full rounded-sm", color)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs font-medium tabular-nums">
        {fmtNum(clamped, 0)}
      </span>
    </div>
  );
}

export default function StockPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = (params?.ticker ?? "BBCA").toString().toUpperCase();

  const [stockData, setStockData] = useState<StockData | null>(null);
  const [technicalData, setTechnicalData] =
    useState<TechnicalIndicators | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        const [analysis, technical] = await Promise.all([
          getStockAnalysis(ticker),
          getTechnicalIndicators(ticker),
        ]);
        setStockData({
          ticker: analysis.ticker,
          name: analysis.name ?? "",
          sector: analysis.sector ?? "",
          price: analysis.price ?? 0,
          change: analysis.change ?? 0,
          changePct: analysis.change_pct ?? 0,
          volume: analysis.volume ?? 0,
          turnover: analysis.turnover ?? 0,
          marketCap: analysis.market_cap ?? 0,
          opportunityScore: analysis.opportunity_score ?? 0,
          classification: analysis.classification ?? "neutral",
          confidence: analysis.confidence ?? 0,
          riskLevel: "MEDIUM",
          regime: "NEUTRAL",
          components: (analysis.components as Record<string, number>) || {},
          drivers: analysis.drivers || [],
          risks: analysis.risks || [],
          invalidation: analysis.invalidation_conditions || [],
          featureVersion: analysis.feature_version ?? "",
          scoringVersion: analysis.scoring_version ?? "",
        });
        setTechnicalData(technical);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load stock data",
        );
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [ticker]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading {ticker}...</span>
        </div>
      </div>
    );
  }

  if (error || !stockData) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertTriangle className="h-10 w-10 text-negative" />
        <div className="ml-4">
          <h2 className="text-base font-semibold">Failed to load stock data</h2>
          <p className="text-xs text-muted">{error}</p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => {
              setIsLoading(true);
              setError(null);
              getStockAnalysis(ticker)
                .then((a) => {
                  setStockData({
                    ticker: a.ticker,
                    name: a.name ?? "",
                    sector: a.sector ?? "",
                    price: a.price ?? 0,
                    change: a.change ?? 0,
                    changePct: a.change_pct ?? 0,
                    volume: a.volume ?? 0,
                    turnover: a.turnover ?? 0,
                    marketCap: a.market_cap ?? 0,
                    opportunityScore: a.opportunity_score ?? 0,
                    classification: a.classification ?? "neutral",
                    confidence: a.confidence ?? 0,
                    riskLevel: "MEDIUM",
                    regime: "NEUTRAL",
                    components:
                      (a.components as Record<string, number>) || {},
                    drivers: a.drivers || [],
                    risks: a.risks || [],
                    invalidation: a.invalidation_conditions || [],
                    featureVersion: a.feature_version ?? "",
                    scoringVersion: a.scoring_version ?? "",
                  });
                })
                .catch((err) =>
                  setError(err instanceof Error ? err.message : "Failed to load"),
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

  const technicalItems: TechnicalItem[] = technicalData
    ? [
        {
          label: "RSI (14)",
          value: technicalData.rsi_14 ?? "N/A",
          status:
            (technicalData.rsi_14 ?? 50) > 70
              ? "bearish"
              : (technicalData.rsi_14 ?? 50) < 30
                ? "bullish"
                : "neutral",
        },
        {
          label: "MACD",
          value: technicalData.macd ?? "N/A",
          status: (technicalData.macd ?? 0) > 0 ? "bullish" : "bearish",
        },
        {
          label: "Price vs SMA20",
          value:
            technicalData.sma_20 && stockData.price
              ? `${(((stockData.price - technicalData.sma_20) / technicalData.sma_20) * 100).toFixed(1)}%`
              : "N/A",
          status:
            technicalData.sma_20 && stockData.price > technicalData.sma_20
              ? "bullish"
              : "bearish",
        },
        {
          label: "Price vs SMA50",
          value:
            technicalData.sma_50 && stockData.price
              ? `${(((stockData.price - technicalData.sma_50) / technicalData.sma_50) * 100).toFixed(1)}%`
              : "N/A",
          status:
            technicalData.sma_50 && stockData.price > technicalData.sma_50
              ? "bullish"
              : "bearish",
        },
        {
          label: "Price vs SMA200",
          value:
            technicalData.sma_200 && stockData.price
              ? `${(((stockData.price - technicalData.sma_200) / technicalData.sma_200) * 100).toFixed(1)}%`
              : "N/A",
          status:
            technicalData.sma_200 && stockData.price > technicalData.sma_200
              ? "bullish"
              : "bearish",
        },
        {
          label: "ATR (14)",
          value: technicalData.atr_14 ?? "N/A",
          status: "neutral",
        },
      ]
    : [];

  const scenarios: ScenarioItem[] = [
    {
      scenario: "Bullish",
      probability: "35%",
      targetPrice: stockData.price * 1.15,
      upsideDownside: "+15%",
      keyDrivers: "Strong earnings, sector rotation, foreign inflows",
      invalidation: "Break below key support",
      variant: "success",
      upsideColor: "green",
    },
    {
      scenario: "Base",
      probability: "45%",
      targetPrice: stockData.price * 1.04,
      upsideDownside: "+4%",
      keyDrivers: "Steady earnings, stable NIM, moderate loan growth",
      invalidation: "Break below support",
      variant: "default",
      upsideColor: "green",
    },
    {
      scenario: "Bearish",
      probability: "20%",
      targetPrice: stockData.price * 0.9,
      upsideDownside: "-10%",
      keyDrivers: "Macro shock, NPL spike, capital outflow",
      invalidation: "Break below support",
      variant: "destructive",
      upsideColor: "red",
    },
  ];

  // Derive fundamental data from components.fundamental score (existing behavior)
  const fundamentalScore = stockData.components.fundamental ?? 0;
  const fundamentalData = {
    profitability: {
      roe: Math.round(fundamentalScore * 0.3),
      roic: Math.round(fundamentalScore * 0.25),
      npm: Math.round(fundamentalScore * 0.2),
      gpm: Math.round(fundamentalScore * 0.5),
    },
    growth: {
      revenue: Math.round(fundamentalScore * 0.15),
      eps: Math.round(fundamentalScore * 0.18),
      fcf: Math.round(fundamentalScore * 0.12),
    },
    health: {
      debtEquity: 0.2,
      currentRatio: 1.4,
      interestCoverage: 9.0,
    },
    valuation: {
      per: 20 + fundamentalScore / 10,
      pbv: 2.5,
      psr: 4.5,
      evEbitda: 12.0,
      fcfYield: 4.0,
      divYield: 1.5,
    },
  };

  const isPositive = stockData.change >= 0;
  const componentEntries = COMPONENT_ORDER
    .filter((k) => stockData.components[k] !== undefined)
    .map((k) => [k, stockData.components[k]] as const);

  return (
    <div className="space-y-4">
      {/* Stock Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center">
            <span className="text-accent-foreground font-bold text-sm">
              {ticker}
            </span>
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">{ticker}</h1>
            <p className="text-xs text-muted">{stockData.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="secondary" className="text-[10px]">{stockData.sector}</Badge>
              <Badge variant="outline" className="text-[10px]">Large Cap</Badge>
              <Badge variant="outline" className="text-[10px]">Liquidity: Very High</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">
              {fmtNum(stockData.price)}
            </p>
            <p
              className={cn(
                "text-sm font-medium tabular-nums",
                isPositive ? "text-positive" : "text-negative",
              )}
            >
              {isPositive ? "+" : ""}
              {fmtNum(stockData.change, 0)} ({isPositive ? "+" : ""}
              {fmtNum(stockData.changePct, 2)}%)
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge
              variant={
                stockData.classification === "OPPORTUNITY"
                  ? "success"
                  : stockData.classification === "WATCHLIST"
                    ? "default"
                    : "destructive"
              }
              className="text-[10px]"
            >
              {stockData.classification}
            </Badge>
            <div className="flex gap-1">
              <Badge variant="secondary" className="text-[10px]">
                Risk: {stockData.riskLevel}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                Regime: {stockData.regime}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Top Grid: Opportunity Score, Technical, Fundamental */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Opportunity Score */}
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Opportunity</CardTitle>
            <Badge variant="success" className="text-[10px]">
              {stockData.classification}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums">
                {fmtNum(stockData.opportunityScore, 0)}
              </span>
              <span className="text-xs text-muted">/ 100</span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Confidence {fmtNum(stockData.confidence, 0)}%
            </p>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Drivers</span>
                <span className="font-medium">{stockData.drivers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Risks</span>
                <span className="font-medium">{stockData.risks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Invalidation</span>
                <span className="font-medium">{stockData.invalidation.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Component Scores */}
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Component Scores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {componentEntries.length === 0 ? (
              <p className="text-xs text-muted">No component scores available</p>
            ) : (
              componentEntries.map(([key, value]) => (
                <ScoreBar
                  key={key}
                  label={COMPONENT_LABELS[key] ?? key.replace(/_/g, " ")}
                  value={typeof value === "number" ? value : 0}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Technical */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Technical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {technicalItems.map((item) => (
                <div key={item.label} className="flex justify-between text-xs">
                  <span className="text-muted">{item.label}</span>
                  <span className="font-medium tabular-nums">
                    {typeof item.value === "number"
                      ? fmtNum(item.value, 2)
                      : item.value}{" "}
                    <span
                      className={cn(
                        "ml-0.5",
                        item.status === "bullish" && "text-positive",
                        item.status === "bearish" && "text-negative",
                        item.status === "neutral" && "text-muted",
                      )}
                    >
                      {item.status === "bullish"
                        ? "▲"
                        : item.status === "bearish"
                          ? "▼"
                          : "●"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Grid: Valuation, Smart Money, Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Valuation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Valuation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: "PER", value: fundamentalData.valuation.per, suffix: "x", badge: "warning" as const, badgeText: "Expensive" },
                { label: "PBV", value: fundamentalData.valuation.pbv, suffix: "x", badge: "secondary" as const, badgeText: "Fair" },
                { label: "EV/EBITDA", value: fundamentalData.valuation.evEbitda, suffix: "x", badge: "secondary" as const, badgeText: "Fair" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-xs text-muted">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold tabular-nums">
                      {fmtNum(row.value, 1)}
                      {row.suffix}
                    </span>
                    <Badge variant={row.badge} className="text-[10px]">
                      {row.badgeText}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Smart Money */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Smart Money</CardTitle>
            <Badge variant="outline" className="text-[10px]">PROXY</Badge>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted">Accumulation Proxy</span>
              <Badge variant="success" className="text-[10px]">78</Badge>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Volume Anomaly</span>
              <Badge variant="secondary" className="text-[10px]">72</Badge>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Structure Score</span>
              <Badge variant="success" className="text-[10px]">81</Badge>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Vol-Price Agreement</span>
              <Badge variant="success" className="text-[10px]">76</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Risk */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Risk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted">Volatility (20D)</span>
              <span className="font-medium tabular-nums">18.5%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Max Drawdown (250D)</span>
              <span className="font-medium tabular-nums">12.4%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Beta vs IHSG</span>
              <span className="font-medium tabular-nums">1.12</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Liquidity Risk</span>
              <Badge variant="success" className="text-[10px]">Low</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Price Chart Placeholder */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm">Price Chart</CardTitle>
          <div className="flex items-center gap-1 text-[10px] text-muted">
            <span className="px-1.5 py-0.5 bg-elevated-panel border border-border rounded">1D</span>
            <span className="px-1.5 py-0.5 border border-border rounded">1W</span>
            <span className="px-1.5 py-0.5 border border-border rounded">1M</span>
            <span className="px-1.5 py-0.5 border border-border rounded">3M</span>
            <span className="px-1.5 py-0.5 border border-border rounded">1Y</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72 bg-elevated-panel/50 rounded-md flex items-center justify-center text-muted text-xs">
            [Price Chart - Integrate lightweight-charts]
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="fundamental" className="space-y-3">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="fundamental">Fundamental</TabsTrigger>
          <TabsTrigger value="valuation">Valuation</TabsTrigger>
          <TabsTrigger value="factors">Factors</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
        </TabsList>

        {/* Fundamental Tab */}
        <TabsContent value="fundamental">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Profitability</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">ROE</span>
                  <span className="font-bold tabular-nums">{fundamentalData.profitability.roe}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">ROIC</span>
                  <span className="font-bold tabular-nums">{fundamentalData.profitability.roic}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">NPM</span>
                  <span className="font-bold tabular-nums">{fundamentalData.profitability.npm}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">GPM</span>
                  <span className="font-bold tabular-nums">{fundamentalData.profitability.gpm}%</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Growth</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Revenue Growth</span>
                  <span className="font-bold text-positive tabular-nums">+{fundamentalData.growth.revenue}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">EPS Growth</span>
                  <span className="font-bold text-positive tabular-nums">+{fundamentalData.growth.eps}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">FCF Growth</span>
                  <span className="font-bold text-positive tabular-nums">+{fundamentalData.growth.fcf}%</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Financial Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Debt/Equity</span>
                  <span className="font-bold tabular-nums">{fundamentalData.health.debtEquity}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Current Ratio</span>
                  <span className="font-bold tabular-nums">{fundamentalData.health.currentRatio}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Interest Coverage</span>
                  <span className="font-bold tabular-nums">{fundamentalData.health.interestCoverage}x</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Valuation Tab */}
        <TabsContent value="valuation">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Valuation Metrics</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { label: "PER", value: `${fmtNum(fundamentalData.valuation.per, 1)}x`, badge: "warning" as const, badgeText: "Expensive" },
                { label: "PBV", value: `${fmtNum(fundamentalData.valuation.pbv, 1)}x`, badge: "secondary" as const, badgeText: "Fair" },
                { label: "EV/EBITDA", value: `${fmtNum(fundamentalData.valuation.evEbitda, 1)}x`, badge: "secondary" as const, badgeText: "Fair" },
                { label: "PSR", value: `${fmtNum(fundamentalData.valuation.psr, 1)}x`, badge: "warning" as const, badgeText: "Rich" },
                { label: "FCF Yield", value: `${fmtNum(fundamentalData.valuation.fcfYield, 1)}%`, badge: "success" as const, badgeText: "Good" },
                { label: "Div Yield", value: `${fmtNum(fundamentalData.valuation.divYield, 1)}%`, badge: "secondary" as const, badgeText: "Fair" },
              ].map((m) => (
                <div key={m.label} className="p-2 bg-elevated-panel/50 rounded-md">
                  <p className="text-[10px] text-muted">{m.label}</p>
                  <p className="text-base font-bold tabular-nums">{m.value}</p>
                  <Badge variant={m.badge} className="text-[10px] mt-0.5">{m.badgeText}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Factors Tab */}
        <TabsContent value="factors">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Factor Scores</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { name: "Value", score: 78 },
                { name: "Momentum", score: 91 },
                { name: "Quality", score: 83 },
                { name: "Growth", score: 72 },
                { name: "Low Vol", score: 61 },
                { name: "Size", score: 95 },
                { name: "Liquidity", score: 95 },
                { name: "Rel Strength", score: 87 },
              ].map((factor) => (
                <div key={factor.name} className="p-2 bg-elevated-panel/50 rounded-md text-center">
                  <p className="text-[10px] text-muted">{factor.name}</p>
                  <p className="text-xl font-bold tabular-nums">{factor.score}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risk Tab */}
        <TabsContent value="risk">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Risk Metrics</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: "Volatility (20D)", value: "18.5%", tone: "text-negative" },
                { label: "Max DD (250D)", value: "12.4%", tone: "text-negative" },
                { label: "Beta vs IHSG", value: "1.12", tone: "text-warning" },
                { label: "Liquidity Risk", value: "Low", tone: "text-positive" },
              ].map((m) => (
                <div key={m.label} className="p-2 bg-elevated-panel/50 rounded-md">
                  <p className="text-[10px] text-muted">{m.label}</p>
                  <p className={cn("text-lg font-bold tabular-nums", m.tone)}>{m.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scenarios Tab */}
        <TabsContent value="scenarios">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Scenario Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scenario</TableHead>
                    <TableHead>Probability</TableHead>
                    <TableHead>Target Price</TableHead>
                    <TableHead>Upside/Downside</TableHead>
                    <TableHead>Key Drivers</TableHead>
                    <TableHead>Invalidation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scenarios.map((scenario) => (
                    <TableRow key={scenario.scenario}>
                      <TableCell>
                        <Badge variant={scenario.variant} className="text-[10px]">
                          {scenario.scenario}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{scenario.probability}</TableCell>
                      <TableCell className="tabular-nums">
                        {fmtNum(scenario.targetPrice, 0)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-medium tabular-nums",
                          scenario.upsideColor === "green"
                            ? "text-positive"
                            : "text-negative",
                        )}
                      >
                        {scenario.upsideDownside}
                      </TableCell>
                      <TableCell>{scenario.keyDrivers}</TableCell>
                      <TableCell>{scenario.invalidation}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Evidence: Drivers / Risks / Invalidation */}
      {(stockData.drivers.length > 0 ||
        stockData.risks.length > 0 ||
        stockData.invalidation.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Primary Drivers</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {stockData.drivers.length === 0 ? (
                  <li className="text-xs text-muted">No drivers available</li>
                ) : (
                  stockData.drivers.map((d, i) => (
                    <li key={i} className="text-xs flex gap-1.5">
                      <span className="text-positive">+</span>
                      <span>{d}</span>
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Risks</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {stockData.risks.length === 0 ? (
                  <li className="text-xs text-muted">No risks listed</li>
                ) : (
                  stockData.risks.map((r, i) => (
                    <li key={i} className="text-xs flex gap-1.5">
                      <span className="text-negative">−</span>
                      <span>{r}</span>
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Invalidation</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {stockData.invalidation.length === 0 ? (
                  <li className="text-xs text-muted">No invalidation conditions</li>
                ) : (
                  stockData.invalidation.map((inv, i) => (
                    <li key={i} className="text-xs flex gap-1.5">
                      <span className="text-warning">!</span>
                      <span>{inv}</span>
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Version metadata */}
      <p className="text-[10px] text-muted">
        {stockData.featureVersion && `Features: ${stockData.featureVersion}`}
        {stockData.featureVersion && stockData.scoringVersion && " · "}
        {stockData.scoringVersion && `Scoring: ${stockData.scoringVersion}`}
      </p>
    </div>
  );
}