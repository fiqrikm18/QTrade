"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownRight,
  Gauge,
  BarChart3,
  ListFilter,
  GitCompare,
  ClipboardList,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceChange } from "@/components/ui/price-change";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMarketOverview, type MarketOverview } from "@/lib/api";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: MarketOverview };

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

const QUICK_LINKS = [
  { href: "/stocks/BBCA", label: "Stock Analysis", icon: BarChart3 },
  { href: "/screener", label: "Screener", icon: ListFilter },
  { href: "/compare", label: "Compare", icon: GitCompare },
  { href: "/research", label: "Research", icon: ClipboardList },
];

export default function Home() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getMarketOverview();
        setState({ status: "ready", data });
      } catch (err) {
        setState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Failed to load market data",
        });
      }
    }
    fetchData();
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertTriangle className="h-10 w-10 text-negative" />
        <div className="ml-4">
          <h2 className="text-base font-semibold">
            Failed to load market data
          </h2>
          <p className="text-xs text-muted">{state.message}</p>
        </div>
      </div>
    );
  }

  const data = state.data;
  const regime = data.regime.regime;
  const regimeVariant = REGIME_VARIANT[regime] ?? "default";

  const kpis = [
    {
      label: "Market Regime",
      value: regime,
      note: `Confidence ${fmtNum(data.regime.confidence, 0)}%`,
      badge: true,
    },
    {
      label: "Breadth",
      value: fmtNum(data.breadth.breadth_score, 1),
      note: "Breadth score",
    },
    {
      label: "Top Opportunities",
      value: String(data.top_opportunities.length),
      note: "Current scan",
    },
    {
      label: "Gainers / Losers",
      value: `${data.top_gainers.length} / ${data.top_losers.length}`,
      note: "Top movers",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Market Overview</h1>
          <p className="text-xs text-muted">
            {data.asof ? `As of ${data.asof}` : "No scan data yet"} · IHSG
            Composite
          </p>
        </div>
        <Badge variant={regimeVariant} className="text-[10px]">
          <Gauge className="mr-1 h-3 w-3" />
          {regime}
        </Badge>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-3">
              <p className="text-[10px] text-muted uppercase tracking-wide">
                {kpi.label}
              </p>
              <p className="text-xl font-bold tabular-nums truncate">
                {kpi.value}
              </p>
              <p className="text-xs text-muted">{kpi.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="hover:border-accent/60 transition-colors">
              <CardContent className="p-3 flex items-center gap-2">
                <link.icon className="h-4 w-4 text-muted" />
                <span className="text-sm font-medium">{link.label}</span>
                <ArrowUpRight className="h-3 w-3 text-muted ml-auto" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Top gainers / losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Top Gainers</CardTitle>
            <Badge variant="success" className="text-[10px]">
              <ArrowUpRight className="mr-1 h-3 w-3" />
              Gainers
            </Badge>
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
                {data.top_gainers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted text-center py-4">
                      No data yet
                    </TableCell>
                  </TableRow>
                ) : (
                  data.top_gainers.map((stock, idx) => (
                    <TableRow key={stock.ticker}>
                      <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                      <TableCell>
                        <Link
                          href={`/stocks/${stock.ticker}`}
                          className="font-medium hover:text-accent"
                        >
                          {stock.ticker}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {fmtNum(stock.price)}
                      </TableCell>
                      <TableCell>
                        <PriceChange changePct={stock.change_pct} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Top Losers</CardTitle>
            <Badge variant="destructive" className="text-[10px]">
              <ArrowDownRight className="mr-1 h-3 w-3" />
              Losers
            </Badge>
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
                {data.top_losers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted text-center py-4">
                      No data yet
                    </TableCell>
                  </TableRow>
                ) : (
                  data.top_losers.map((stock, idx) => (
                    <TableRow key={stock.ticker}>
                      <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                      <TableCell>
                        <Link
                          href={`/stocks/${stock.ticker}`}
                          className="font-medium hover:text-accent"
                        >
                          {stock.ticker}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {fmtNum(stock.price)}
                      </TableCell>
                      <TableCell>
                        <PriceChange changePct={stock.change_pct} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
