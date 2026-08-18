"use client";

import { useEffect, useState } from "react";
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Ticker</TableHead>
              <TableHead className="w-24">Price</TableHead>
              <TableHead className="w-24">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted text-center py-4">
                  No data yet
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, idx) => (
                <TableRow key={item.ticker}>
                  <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-sm">Sector Performance</CardTitle>
        <Badge variant="outline" className="text-xs">
          {sectors.length} sectors
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
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
                        ? "secondary"
                        : "destructive"
                    }
                    className="text-xs"
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
      <div className="flex items-center justify-center h-64 text-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading market data...</span>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load market data</p>
            <p className="text-sm text-muted">{state.message}</p>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
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

      {/* Market Header - 4 compact cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs text-muted">IHSG Index</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {fmtNum(data.macro?.support ?? 0)}
            </div>
            <p className="text-xs text-muted flex items-center gap-1.5">
              Regime:
              <Badge variant={regimeVariant} className="text-xs">
                {regime}
              </Badge>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs text-muted">Market Breadth</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{fmtNum(breadth, 1)}</p>
            <p className="text-xs text-muted">Breadth Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs text-muted">Regime Conf.</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {fmtNum(data.regime.confidence, 0)}%
            </p>
            <p className="text-xs text-muted">Confidence</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs text-muted">Top Opps</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {data.top_opportunities.length}
            </p>
            <p className="text-xs text-muted">Stocks ranked</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Regime, Breadth, Top Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Market Regime */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Market Regime</CardTitle>
            <Badge variant={regimeVariant} className="text-xs">
              {regime}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {fmtNum(data.regime.confidence, 0)}%
            </div>
            <p className="text-xs text-muted">Confidence</p>
            <div className="mt-3 space-y-1.5 text-xs">
              {Object.entries(data.regime.components).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="capitalize text-muted">{key.replace(/_/g, " ")}</span>
                  <span className="font-medium tabular-nums">
                    {typeof value === "number" ? fmtNum(value, 1) : "--"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Market Breadth */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Market Breadth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{fmtNum(breadth, 1)}</div>
            <p className="text-xs text-muted">Breadth Score</p>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Top opportunities</span>
                <span className="font-medium tabular-nums">
                  {data.top_opportunities.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Gainers</span>
                <span className="font-medium text-positive tabular-nums">
                  {data.top_gainers.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Losers</span>
                <span className="font-medium text-negative tabular-nums">
                  {data.top_losers.length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Opportunities */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Top Opportunities</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead className="w-20">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.top_opportunities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted text-center py-4">
                      No scan yet
                    </TableCell>
                  </TableRow>
                ) : (
                  data.top_opportunities.map((item, idx) => (
                    <TableRow key={item.ticker}>
                      <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{item.ticker}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {fmtNum(item.opportunity_score, 1)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Top Gainers / Losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <MoverTable title="Top Gainers" items={data.top_gainers} />
        <MoverTable title="Top Losers" items={data.top_losers} />
      </div>

      {/* Sector Performance */}
      <SectorTable sectors={sectors} />

      {/* Macro Risk/Support */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Macro Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-negative tabular-nums">
              {fmtNum(data.macro?.risk ?? 0, 1)}
            </p>
            <p className="text-xs text-muted">Risk Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Macro Support</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-positive tabular-nums">
              {fmtNum(data.macro?.support ?? 0, 1)}
            </p>
            <p className="text-xs text-muted">Support Score</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}