"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Download,
  Eye,
  ArrowUp,
  ArrowDown,
  BarChart2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Zap,
  Target,
  Gauge,
  DollarSign,
  Percent,
  Building2,
  Layers,
  Database,
  Activity,
  FileText,
  Calendar,
  Flag,
  Sparkles,
  Scale,
  Wallet,
  Coins,
  Banknote,
  LineChart,
  PieChart,
  ChevronUp,
  ChevronDown,
  Star,
  ExternalLink,
  Info,
  Circle,
  Crosshair,
  Loader2,
} from "lucide-react";
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
import { getStockAnalysis, getTechnicalIndicators } from "@/lib/api";
import { StockAnalysis, TechnicalIndicators } from "@/lib/api";

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

interface PriceHistoryItem {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface FundamentalData {
  profitability: Record<string, number>;
  growth: Record<string, number>;
  health: Record<string, number>;
  valuation: Record<string, number>;
}

interface TechnicalData {
  rsi: number;
  macd: number;
  sma20: number;
  sma50: number;
  sma200: number;
  ema20: number;
  atr: number;
  adx: number;
  bollUpper: number;
  bollMid: number;
  bollLower: number;
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
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !stockData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <AlertTriangle className="h-12 w-12 text-red-600" />
          <div className="ml-4">
            <h2 className="text-xl font-bold">Failed to load stock data</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
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

  // Derive fundamental data from components.fundamental score (placeholder until separate API available)
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

  return (
    <div className="space-y-6">
      {/* Stock Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">
              {ticker}
            </span>
          </div>
          <div>
            <h1 className="text-3xl font-bold">{ticker}</h1>
            <p className="text-muted-foreground">{stockData.name}</p>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <Badge variant="default">{stockData.sector}</Badge>
              <Badge variant="secondary">Large Cap</Badge>
              <Badge variant="outline">Liquidity: Very High</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          <div className="text-right">
            <p className="text-3xl font-bold">
              {stockData.price.toLocaleString()}
            </p>
            <p
              className={cn(
                "font-medium",
                isPositive ? "text-green-600" : "text-red-600",
              )}
            >
              {isPositive ? "+" : ""}
              {stockData.changePct}%
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                stockData.classification === "OPPORTUNITY"
                  ? "success"
                  : stockData.classification === "WATCHLIST"
                    ? "default"
                    : "destructive"
              }
              className="text-sm"
            >
              {stockData.classification}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Risk: {stockData.riskLevel}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Regime: {stockData.regime}
            </Badge>
          </div>
        </div>
      </div>

      {/* Top Grid: Opportunity Score, Technical, Fundamental */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Opportunity Score */}
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Opportunity Score</CardTitle>
            <Badge variant="success" className="text-xs">
              {stockData.classification}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {stockData.opportunityScore}
            </div>
            <p className="text-sm text-muted-foreground">
              Confidence {stockData.confidence}%
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Drivers</span>
                <span className="font-medium">
                  {stockData.drivers.length} factors
                </span>
              </div>
              <div className="flex justify-between">
                <span>Risks</span>
                <span className="font-medium">
                  {stockData.risks.length} factors
                </span>
              </div>
              <div className="flex justify-between">
                <span>Invalidation</span>
                <span className="font-medium">
                  {stockData.invalidation.length} conditions
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technical Card */}
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Technical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {technicalItems.map((item) => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">
                    {typeof item.value === "number" ? item.value : item.value}{" "}
                    <span
                      className={cn(
                        "ml-1",
                        item.status === "bullish" && "text-green-600",
                        item.status === "bearish" && "text-red-600",
                        item.status === "neutral" && "text-muted-foreground",
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

        {/* Fundamental Card */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Fundamental</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">ROE</p>
                  <p className="text-lg font-bold">
                    {fundamentalData.profitability.roe}%
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">ROIC</p>
                  <p className="text-lg font-bold">
                    {fundamentalData.profitability.roic}%
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">NPM</p>
                  <p className="text-lg font-bold">
                    {fundamentalData.profitability.npm}%
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">GPM</p>
                  <p className="text-lg font-bold">
                    {fundamentalData.profitability.gpm}%
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    Revenue Growth
                  </p>
                  <p className="text-lg font-bold text-green-600">
                    +{fundamentalData.growth.revenue}%
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">EPS Growth</p>
                  <p className="text-lg font-bold text-green-600">
                    +{fundamentalData.growth.eps}%
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">FCF Growth</p>
                  <p className="text-lg font-bold text-green-600">
                    +{fundamentalData.growth.fcf}%
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">D/E</p>
                  <p className="text-lg font-bold">
                    {fundamentalData.health.debtEquity}x
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Grid: Valuation, Smart Money, Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Valuation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Valuation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">PER</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {fundamentalData.valuation.per}x
                  </span>
                  <Badge variant="warning">Expensive</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Hist: 20.1x ──●── 25.8x | Sector: 21.8x
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">PBV</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {fundamentalData.valuation.pbv}x
                  </span>
                  <Badge variant="default">Fair</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Hist: 2.2x ──●── 3.1x | Sector: 2.5x
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">EV/EBITDA</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {fundamentalData.valuation.evEbitda}x
                  </span>
                  <Badge variant="default">Fair</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Sector: 11.8x
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Smart Money */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Smart Money</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Accumulation Proxy</span>
                <Badge variant="success">78</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Volume Anomaly</span>
                <Badge variant="default">72</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Structure Score</span>
                <Badge variant="success">81</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Volume-Price Agreement</span>
                <Badge variant="success">76</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Volatility (20D)</span>
                <span className="font-medium">18.5%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Max Drawdown (250D)</span>
                <span className="font-medium">12.4%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Beta vs IHSG</span>
                <span className="font-medium">1.12</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Liquidity Risk</span>
                <Badge variant="success">Low</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Price Chart Placeholder */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Price Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground">
              [Price Chart - Integrate lightweight-charts]
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="technical" className="space-y-4">
          <TabsList>
            <TabsTrigger value="technical">Technical</TabsTrigger>
            <TabsTrigger value="fundamental">Fundamental</TabsTrigger>
            <TabsTrigger value="valuation">Valuation</TabsTrigger>
            <TabsTrigger value="smart-money">Smart Money</TabsTrigger>
            <TabsTrigger value="factors">Factors</TabsTrigger>
            <TabsTrigger value="risk">Risk</TabsTrigger>
            <TabsTrigger value="news">News</TabsTrigger>
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
          </TabsList>

          {/* Technical Tab */}
          <TabsContent value="technical">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>RSI (14)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground">
                    [RSI Chart]
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>MACD</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground">
                    [MACD Chart]
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Bollinger Bands</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground">
                    [Bollinger Chart]
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Volume Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground">
                    [Volume Chart]
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Fundamental Tab */}
          <TabsContent value="fundamental">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Profitability</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>ROE</span>
                      <span className="font-bold">
                        {fundamentalData.profitability.roe}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>ROIC</span>
                      <span className="font-bold">
                        {fundamentalData.profitability.roic}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>NPM</span>
                      <span className="font-bold">
                        {fundamentalData.profitability.npm}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>GPM</span>
                      <span className="font-bold">
                        {fundamentalData.profitability.gpm}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>OPM</span>
                      <span className="font-bold">38.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Earnings Quality</span>
                      <span className="font-bold">1.12x</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Revenue Growth</span>
                      <span className="font-bold text-green-600">
                        +{fundamentalData.growth.revenue}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>EPS Growth</span>
                      <span className="font-bold text-green-600">
                        +{fundamentalData.growth.eps}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>FCF Growth</span>
                      <span className="font-bold text-green-600">
                        +{fundamentalData.growth.fcf}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Book Value Growth</span>
                      <span className="font-bold text-green-600">+8.9%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Financial Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Debt/Equity</span>
                      <span className="font-bold">
                        {fundamentalData.health.debtEquity}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Current Ratio</span>
                      <span className="font-bold">
                        {fundamentalData.health.currentRatio}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Interest Coverage</span>
                      <span className="font-bold">
                        {fundamentalData.health.interestCoverage}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>FCF Conversion</span>
                      <span className="font-bold">1.08x</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dividend Yield</span>
                      <span className="font-bold">
                        {fundamentalData.valuation.divYield}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Valuation Tab */}
          <TabsContent value="valuation">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Valuation Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">PER</p>
                      <div className="flex justify-between">
                        <span className="text-2xl font-bold">
                          {fundamentalData.valuation.per}x
                        </span>
                        <Badge variant="warning">Expensive</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Hist: 20.1x ──●── 25.8x | Sector: 21.8x
                      </p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">PBV</p>
                      <div className="flex justify-between">
                        <span className="text-2xl font-bold">
                          {fundamentalData.valuation.pbv}x
                        </span>
                        <Badge variant="default">Fair</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Hist: 2.2x ──●── 3.1x | Sector: 2.5x
                      </p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">EV/EBITDA</p>
                      <div className="flex justify-between">
                        <span className="text-2xl font-bold">
                          {fundamentalData.valuation.evEbitda}x
                        </span>
                        <Badge variant="default">Fair</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Sector: 11.8x
                      </p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">PSR</p>
                      <div className="flex justify-between">
                        <span className="text-2xl font-bold">
                          {fundamentalData.valuation.psr}x
                        </span>
                        <Badge variant="warning">Rich</Badge>
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">FCF Yield</p>
                      <div className="flex justify-between">
                        <span className="text-2xl font-bold">
                          {fundamentalData.valuation.fcfYield}%
                        </span>
                        <Badge variant="success">Good</Badge>
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        Dividend Yield
                      </p>
                      <div className="flex justify-between">
                        <span className="text-2xl font-bold">
                          {fundamentalData.valuation.divYield}%
                        </span>
                        <Badge variant="default">Fair</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Smart Money Tab */}
          <TabsContent value="smart-money">
            <Card>
              <CardHeader>
                <CardTitle>Smart Money Proxies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Accumulation Proxy
                    </p>
                    <p className="text-3xl font-bold text-green-600">78</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Volume Behavior
                    </p>
                    <p className="text-3xl font-bold text-blue-600">72</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Price Structure
                    </p>
                    <p className="text-3xl font-bold text-green-600">81</p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Relative Strength
                    </p>
                    <p className="text-3xl font-bold text-yellow-600">68</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Liquidity</p>
                    <p className="text-3xl font-bold text-purple-600">85</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Volatility Behavior
                    </p>
                    <p className="text-3xl font-bold text-red-600">65</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Wyckoff Phase</span>
                    <Badge variant="success">Phase C (Spring)</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Break of Structure</span>
                    <Badge variant="success">Bullish</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Change of Character</span>
                    <Badge variant="default">Not Detected</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Liquidity Sweep</span>
                    <Badge variant="warning">Recent (Low)</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Factors Tab */}
          <TabsContent value="factors">
            <Card>
              <CardHeader>
                <CardTitle>Factor Scores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    <div
                      key={factor.name}
                      className="p-4 bg-muted/50 rounded-lg text-center"
                    >
                      <p className="text-xs text-muted-foreground">
                        {factor.name}
                      </p>
                      <p className="text-3xl font-bold">{factor.score}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Risk Tab */}
          <TabsContent value="risk">
            <Card>
              <CardHeader>
                <CardTitle>Risk Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Volatility (20D)
                    </p>
                    <p className="text-2xl font-bold text-red-600">18.5%</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Max Drawdown (250D)
                    </p>
                    <p className="text-2xl font-bold text-red-600">12.4%</p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Beta vs IHSG
                    </p>
                    <p className="text-2xl font-bold text-yellow-600">1.12</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Liquidity Risk
                    </p>
                    <p className="text-2xl font-bold text-green-600">Low</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* News Tab */}
          <TabsContent value="news">
            <Card>
              <CardHeader>
                <CardTitle>Latest News & Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <p className="font-medium">
                      BBCA: Q4 2023 Net Profit Rises 15% YoY
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Jan 15, 2024 | Bisnis Indonesia
                    </p>
                  </div>
                  <div className="border-l-4 border-green-500 pl-4 py-2">
                    <p className="font-medium">
                      BBCA: Digital Banking Users Reach 25M
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Jan 10, 2024 | Kontan
                    </p>
                  </div>
                  <div className="border-l-4 border-yellow-500 pl-4 py-2">
                    <p className="font-medium">
                      BI Rate Decision: Policy Rate Maintained at 5.75%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Jan 18, 2024 | Reuters
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scenarios Tab */}
          <TabsContent value="scenarios">
            <Card>
              <CardHeader>
                <CardTitle>Scenario Analysis</CardTitle>
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
                          <Badge variant={scenario.variant}>
                            {scenario.scenario}
                          </Badge>
                        </TableCell>
                        <TableCell>{scenario.probability}</TableCell>
                        <TableCell>
                          {scenario.targetPrice.toLocaleString()}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "font-medium",
                            scenario.upsideColor === "green"
                              ? "text-green-600"
                              : "text-red-600",
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
      </div>
    </div>
  );
}
