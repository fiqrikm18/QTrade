"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Target,
  AlertTriangle,
  Clock,
  Zap,
  Eye,
  ExternalLink,
  Download,
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
import { PriceChange } from "@/components/ui/price-change";
import {
  getMarketOverview,
  type MarketOverview,
  type MoverItem,
  getSectorPerformance,
  type SectorPerformance,
} from "@/lib/api";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: MarketOverview; sectors: SectorPerformance[] };

const REGIME_VARIANT: Record<
  string,
  "success" | "warning" | "destructive" | "secondary" | "default"
> = {
  BULLISH: "success",
  STRONG_BULLISH: "success",
  NEUTRAL: "secondary",
  BEARISH: "destructive",
  WEAK_BEARISH: "destructive",
  HIGH_VOLATILITY: "warning",
  RISK_ON: "success",
  RISK_OFF: "destructive",
};

function fmtNum(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "--";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "--";
  const s = `${v.toFixed(2)}%`;
  return v > 0 ? `+${s}` : s;
}

function MoverTable({ title, items }: { title: string; items: MoverItem[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead className="w-24">Price</TableHead>
              <TableHead className="w-24">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No data yet
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.ticker}>
                  <TableCell className="font-medium">{item.ticker}</TableCell>
                  <TableCell>{fmtNum(item.price)}</TableCell>
                  <TableCell>
                    <PriceChange changePct={item.change_pct} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SectorTable({ sectors }: { sectors: SectorPerformance[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Sector Performance</CardTitle>
        <Badge variant="outline" className="text-xs">
          {sectors.length} sectors
        </Badge>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sector</TableHead>
              <TableHead className="w-24">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectors.map((sector) => (
              <TableRow key={sector.ticker}>
                <TableCell className="font-medium">{sector.ticker}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      sector.sector_score >= 80
                        ? "success"
                        : sector.sector_score >= 60
                          ? "default"
                          : "destructive"
                    }
                  >
                    {fmtNum(sector.sector_score, 1)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function MarketPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const [data, sectors] = await Promise.all([
        getMarketOverview(),
        getSectorPerformance(),
      ]);
      setState({ status: "ready", data, sectors });
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof Error ? err.message : "Failed to load market data",
      });
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function initialLoad() {
      try {
        const [data, sectors] = await Promise.all([
          getMarketOverview(),
          getSectorPerformance(),
        ]);
        if (cancelled) return;
        setState({ status: "ready", data, sectors });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              err instanceof Error ? err.message : "Failed to load market data",
          });
        }
      }
    }
    void initialLoad();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load market data</p>
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Button className="mt-4" onClick={() => void refresh()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data, sectors } = state;
  const regime = data.regime.regime;
  const regimeVariant = REGIME_VARIANT[regime] ?? "default";
  const breadth = data.breadth.breadth_score;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.asof ? `As of ${data.asof}` : "No scan data yet"}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Market Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              IHSG Index
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {fmtNum(data.macro?.support ?? 0)}
            </div>
            <p className="text-sm text-muted-foreground">
              Regime: <Badge variant={regimeVariant}>{regime}</Badge>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Market Breadth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{fmtNum(breadth, 1)}</div>
            <p className="text-sm text-muted-foreground">Breadth Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Regime Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {fmtNum(data.regime.confidence, 0)}%
            </div>
            <p className="text-sm text-muted-foreground">Confidence</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Top Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.top_opportunities.length}
            </div>
            <p className="text-sm text-muted-foreground">Stocks ranked</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Market Regime */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Market Regime</CardTitle>
              <Badge variant={regimeVariant} className="text-xs">
                {regime}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {fmtNum(data.regime.confidence, 0)}%
              </div>
              <p className="text-sm text-muted-foreground">Confidence</p>
              <div className="mt-4 space-y-2 text-sm">
                {Object.entries(data.regime.components).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">
                      {key.replaceAll(/_/g, " ")}
                    </span>
                    <span className="font-medium">
                      {typeof value === "number" ? fmtNum(value, 1) : "--"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Market Breadth */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Market Breadth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{fmtNum(breadth, 1)}</div>
              <p className="text-sm text-muted-foreground">Breadth Score</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Top opportunities</span>
                  <span className="font-medium">
                    {data.top_opportunities.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Gainers</span>
                  <span className="font-medium text-green-600">
                    {data.top_gainers.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Losers</span>
                  <span className="font-medium text-red-600">
                    {data.top_losers.length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Opportunities */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Top Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead className="w-20">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.top_opportunities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        No scan yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.top_opportunities.map((item, idx) => (
                      <TableRow key={item.ticker}>
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell className="font-medium">
                          {item.ticker}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">
                            {fmtNum(item.opportunity_score, 1)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>{" "}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MoverTable title="Top Gainers" items={data.top_gainers} />
        <MoverTable title="Top Losers" items={data.top_losers} />
      </div>

      {/* Sector Performance */}
      <SectorTable sectors={sectors} />

      {/* Macro Risk/Support */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Macro Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {fmtNum(data.macro?.risk ?? 0, 1)}
            </div>
            <p className="text-sm text-muted-foreground">Risk Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Macro Support</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {fmtNum(data.macro?.support ?? 0, 1)}
            </div>
            <p className="text-sm text-muted-foreground">Support Score</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
