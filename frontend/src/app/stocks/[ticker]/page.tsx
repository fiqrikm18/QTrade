"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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
  getStocks,
  getTechnicalIndicators,
  type StockListItem,
  type StockAnalysis,
  type TechnicalIndicators,
} from "@/lib/api";
import { TickerSelect } from "@/components/ui/ticker-select";
import { RiskLevelBadge } from "@/components/ui/risk-level-badge";
import { RegimeBadge } from "@/components/ui/regime-badge";
import { ScoreBar } from "@/components/ui/score-bar";
import { PriceChange } from "@/components/ui/price-change";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

function fmtNum(
  v: number | null | undefined,
  digits = 0,
): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtIndicator(
  v: number | null | undefined,
  digits = 2,
): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function StockPage() {
  const router = useRouter();
  const params = useParams<{ ticker: string }>();
  const ticker = params.ticker.toString().toUpperCase();

  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null);
  const [technical, setTechnical] = useState<TechnicalIndicators | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [universe, setUniverse] = useState<StockListItem[]>([]);
  const [universeError, setUniverseError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        const [analysisData, technicalData] = await Promise.all([
          getStockAnalysis(ticker),
          getTechnicalIndicators(ticker),
        ]);
        setAnalysis(analysisData);
        setTechnical(technicalData);
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

  useEffect(() => {
    let cancelled = false;
    async function fetchUniverse() {
      try {
        const data = await getStocks(1, 1000);
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

  const retry = () => {
    setIsLoading(true);
    setError(null);
    getStockAnalysis(ticker)
      .then((a) => setAnalysis(a))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      )
      .finally(() => setIsLoading(false));
  };

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading stock data">
        <LoadingSkeleton variant="card" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" className="md:col-span-2" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
        <LoadingSkeleton variant="card" />
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertTriangle className="h-10 w-10 text-negative" />
        <div className="ml-4 text-center">
          <h2 className="text-base font-semibold">Failed to load stock data</h2>
          <p className="text-xs text-muted">{error}</p>
          <Button
            size="sm"
            className="mt-3"
            onClick={retry}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Retrying...
              </>
            ) : (
              "Retry"
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (!analysis.ticker) {
    return (
      <EmptyState
        title={`No analysis available for ${ticker}`}
        description="The requested stock may not have sufficient data for analysis."
        icon="chart"
      />
    );
  }

  const componentEntries = Object.entries(analysis.components ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, v] as const);

  const technicalRows = technical
    ? [
        { label: "RSI (14)", value: technical.rsi_14 },
        { label: "MACD", value: technical.macd },
        { label: "MACD Signal", value: technical.macd_signal },
        { label: "MACD Histogram", value: technical.macd_hist },
        { label: "SMA 20", value: technical.sma_20 },
        { label: "SMA 50", value: technical.sma_50 },
        { label: "SMA 200", value: technical.sma_200 },
        { label: "EMA 20", value: technical.ema_20 },
        { label: "ATR (14)", value: technical.atr_14 },
        { label: "ADX (14)", value: technical.adx_14 },
        { label: "Bollinger Upper", value: technical.boll_upper },
        { label: "Bollinger Mid", value: technical.boll_mid },
        { label: "Bollinger Lower", value: technical.boll_lower },
        { label: "ROC (20)", value: technical.roc_20 },
        { label: "Relative Volume", value: technical.rel_volume },
        { label: "Hist Vol (20)", value: technical.hist_vol_20 },
        { label: "Stoch %K", value: technical.stoch_k },
        { label: "Stoch %D", value: technical.stoch_d },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Stock Header */}
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
            <span className="text-accent-foreground font-bold text-sm">
              {ticker}
            </span>
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">{ticker}</h1>
            <p className="text-xs text-muted">{analysis.name ?? "Unknown"}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="secondary" className="text-[10px]">
                {analysis.sector ?? "Unknown"}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {analysis.market_cap
                  ? analysis.market_cap > 1e12
                    ? "Large Cap"
                    : analysis.market_cap > 1e11
                    ? "Mid Cap"
                    : "Small Cap"
                  : "N/A"}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {analysis.volume
                  ? analysis.volume > 1e7
                    ? "Liquidity: Very High"
                    : analysis.volume > 1e6
                    ? "Liquidity: High"
                    : "Liquidity: Medium"
                  : "Liquidity: N/A"}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">
              {fmtNum(analysis.price)}
            </p>
            <PriceChange changePct={analysis.change_pct} />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge
              variant={
                analysis.classification === "OPPORTUNITY"
                  ? "success"
                  : analysis.classification === "WATCHLIST"
                  ? "default"
                  : "destructive"
              }
              className="text-[10px]"
            >
              {analysis.classification ?? "Unknown"}
            </Badge>
            <div className="flex gap-1">
              <RiskLevelBadge level={analysis.risk_level} />
              <RegimeBadge regime={analysis.regime} />
            </div>
          </div>
        </div>
      </div>

      {/* Top Grid: Opportunity Score, Component Scores, Technical */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Opportunity Score */}
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Opportunity</CardTitle>
            <Badge
              variant={
                analysis.classification === "OPPORTUNITY"
                  ? "success"
                  : analysis.classification === "WATCHLIST"
                  ? "default"
                  : "destructive"
              }
              className="text-[10px]"
            >
              {analysis.classification ?? "Unknown"}
            </Badge>
          </CardHeader>
          <CardContent>
            <ScoreBar
              score={analysis.opportunity_score}
              classification={analysis.classification ?? undefined}
              confidence={analysis.confidence ?? undefined}
            />
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Drivers</span>
                <span className="font-medium">
                  {analysis.drivers?.length ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Risks</span>
                <span className="font-medium">{analysis.risks?.length ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Invalidation</span>
                <span className="font-medium">
                  {analysis.invalidation_conditions?.length ?? 0}
                </span>
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
                  score={typeof value === "number" ? value : null}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Technical Indicators Table */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Technical Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            {technical ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indicator</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {technicalRows.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className="text-xs text-muted">{row.label}</TableCell>
                      <TableCell className="text-xs font-medium tabular-nums">
                        {fmtIndicator(row.value)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {(() => {
                          const v = row.value;
                          if (v === null || v === undefined) return <span className="text-muted">—</span>;
                          if (row.label === "RSI (14)") {
                            return v > 70 ? (
                              <span className="text-negative">Overbought ▼</span>
                            ) : v < 30 ? (
                              <span className="text-positive">Oversold ▲</span>
                            ) : (
                              <span className="text-muted">Neutral ●</span>
                            );
                          }
                          if (row.label === "MACD") {
                            return v > 0 ? (
                              <span className="text-positive">Bullish ▲</span>
                            ) : (
                              <span className="text-negative">Bearish ▼</span>
                            );
                          }
                          if (row.label.includes("SMA") || row.label.includes("EMA")) {
                            const price = analysis.price;
                            if (price && v) {
                              return price > v ? (
                                <span className="text-positive">Above ▲</span>
                              ) : (
                                <span className="text-negative">Below ▼</span>
                              );
                            }
                          }
                          if (row.label === "ADX (14)") {
                            return v > 25 ? (
                              <span className="text-positive">Trending ▲</span>
                            ) : (
                              <span className="text-muted">Ranging ●</span>
                            );
                          }
                          return <span className="text-muted">—</span>;
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="No technical data"
                description="Technical indicators are not available for this ticker."
                icon="chart"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Grid: Valuation, Smart Money, Risk - placeholder cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Valuation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Valuation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-xs">
              {[
                { label: "PER", value: null, suffix: "x" },
                { label: "PBV", value: null, suffix: "x" },
                { label: "EV/EBITDA", value: null, suffix: "x" },
                { label: "PSR", value: null, suffix: "x" },
                { label: "FCF Yield", value: null, suffix: "%" },
                { label: "Div Yield", value: null, suffix: "%" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-muted">{row.label}</span>
                  <span className="font-medium tabular-nums">
                    {row.value !== null ? fmtNum(row.value, 1) + row.suffix : "—"}
                  </span>
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
          <CardContent className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Accumulation Proxy</span>
              <Badge variant="secondary" className="text-[10px]">—</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Volume Anomaly</span>
              <Badge variant="secondary" className="text-[10px]">—</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Structure Score</span>
              <Badge variant="secondary" className="text-[10px]">—</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Vol-Price Agreement</span>
              <Badge variant="secondary" className="text-[10px]">—</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Risk */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Risk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Volatility (20D)</span>
              <span className="font-medium tabular-nums">
                {technical?.hist_vol_20 !== null && technical?.hist_vol_20 !== undefined
                  ? `${fmtNum(technical.hist_vol_20 * 100, 1)}%`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Max Drawdown (250D)</span>
              <span className="font-medium tabular-nums">—</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Beta vs IHSG</span>
              <span className="font-medium tabular-nums">—</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Liquidity Risk</span>
              <Badge variant="secondary" className="text-[10px]">—</Badge>
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
      <Tabs defaultValue="drivers" className="space-y-3">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="invalidation">Invalidation</TabsTrigger>
          <TabsTrigger value="fundamental">Fundamental</TabsTrigger>
        </TabsList>

        {/* Drivers Tab */}
        <TabsContent value="drivers">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Primary Drivers</CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.drivers && analysis.drivers.length > 0 ? (
                <ul className="space-y-1">
                  {analysis.drivers.map((d, i) => (
                    <li key={i} className="text-xs flex gap-1.5">
                      <span className="text-positive">+</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No drivers available"
                  description="No primary drivers identified for this analysis."
                  icon="folder"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risks Tab */}
        <TabsContent value="risks">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Risks</CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.risks && analysis.risks.length > 0 ? (
                <ul className="space-y-1">
                  {analysis.risks.map((r, i) => (
                    <li key={i} className="text-xs flex gap-1.5">
                      <span className="text-negative">−</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No risks listed"
                  description="No specific risks identified for this analysis."
                  icon="shield"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invalidation Tab */}
        <TabsContent value="invalidation">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Invalidation Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.invalidation_conditions &&
              analysis.invalidation_conditions.length > 0 ? (
                <ul className="space-y-1">
                  {analysis.invalidation_conditions.map((inv, i) => (
                    <li key={i} className="text-xs flex gap-1.5">
                      <span className="text-warning">!</span>
                      <span>{inv}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No invalidation conditions"
                  description="No invalidation conditions specified for this analysis."
                  icon="alert"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fundamental Tab - placeholder */}
        <TabsContent value="fundamental">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Fundamental Data</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                title="Fundamental data unavailable"
                description="Detailed fundamental metrics require additional data integration."
                icon="database"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Version metadata */}
      <p className="text-[10px] text-muted">
        {analysis.feature_version && `Features: ${analysis.feature_version}`}
        {analysis.feature_version && analysis.scoring_version && " · "}
        {analysis.scoring_version && `Scoring: ${analysis.scoring_version}`}
      </p>
    </div>
  );
}