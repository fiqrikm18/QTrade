"use client";

import { useEffect, useState } from "react";
import { RefreshCw, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
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
import { RegimeBadge } from "@/components/ui/regime-badge";
import { ScoreBar } from "@/components/ui/score-bar";
import { PriceChange } from "@/components/ui/price-change";
import { ImpactBadge } from "@/components/ui/impact-badge";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  getMarketOverview,
  type MarketOverview,
  type MoverItem,
  type RegimeInfo,
} from "@/lib/api";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: MarketOverview };

type SectorRotationItem = {
  sector: string;
  score: number;
  asof: string | null;
};

type UpcomingEventItem = {
  date: string;
  time: string;
  event: string;
  impact: "HIGH" | "MEDIUM" | "LOW" | null;
  category?: string;
};

function fmtNum(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "--";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function isStale(asof: string | null, thresholdMs = 5 * 60 * 1000): boolean {
  if (!asof) return true;
  const dataTime = new Date(asof).getTime();
  const now = Date.now();
  return now - dataTime > thresholdMs;
}

function StaleIndicator({ asof }: { asof: string | null }) {
  if (!asof) return null;
  const stale = isStale(asof);
  if (!stale) return null;
  return (
    <span className="text-xs text-warning flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
      Data may be stale (as of {new Date(asof).toLocaleTimeString()})
    </span>
  );
}

function SectionSkeleton({ variant = "card", rows = 4 }: { variant?: "card" | "table" | "list"; rows?: number }) {
  return <LoadingSkeleton variant={variant === "table" ? "table" : variant === "list" ? "list-item" : "card"} rows={rows} />;
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <div className="flex-1">
            <p className="text-destructive font-medium text-sm">Failed to load section</p>
            <p className="text-xs text-muted">{message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RegimePanel({ regime, onRetry }: { regime: RegimeInfo | null; onRetry: () => void }) {
  const [expanded, setExpanded] = useState(false);

  if (!regime) {
    return <SectionError message="Regime data unavailable" onRetry={onRetry} />;
  }

  const regimeType = regime.regime?.toLowerCase();
  const validRegimes = ["trending_up", "trending_down", "ranging", "volatile"];
  const regimeForBadge = validRegimes.includes(regimeType ?? "") ? regimeType as "trending_up" | "trending_down" | "ranging" | "volatile" : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-sm">Market Regime</CardTitle>
        <div className="flex items-center gap-2">
          <RegimeBadge regime={regimeForBadge} />
          {regime.asof && <span className="text-xs text-muted">{new Date(regime.asof).toLocaleTimeString()}</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScoreBar score={regime.confidence} classification="Confidence" />
        <StaleIndicator asof={regime.asof} />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-left px-0"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-xs text-muted">Components</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
        {expanded && (
          <div className="space-y-1.5 text-xs border-t border-border pt-2">
            {Object.entries(regime.components).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="capitalize text-muted">{key.replace(/_/g, " ")}</span>
                <span className="font-medium tabular-nums">
                  {typeof value === "number" ? fmtNum(value, 1) : "--"}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BreadthScore({ breadth, onRetry }: { breadth: { breadth_score: number; asof: string | null } | null; onRetry: () => void }) {
  if (!breadth) {
    return <SectionError message="Breadth data unavailable" onRetry={onRetry} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Market Breadth</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScoreBar score={breadth.breadth_score} classification="Breadth Score" />
        <StaleIndicator asof={breadth.asof} />
      </CardContent>
    </Card>
  );
}

function SectorRotation({ sectors }: { sectors: SectorRotationItem[]; onRetry?: () => void }) {
  if (sectors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sector Rotation</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title="No sector data" description="Sector rotation data is not available at this time" icon="chart" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Sector Rotation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
          {sectors.map((sector) => (
            <div key={sector.sector} className="min-w-[180px] flex-shrink-0">
              <div className="text-xs font-medium text-muted mb-1">{sector.sector}</div>
              <ScoreBar score={sector.score} />
              {sector.asof && (
                <p className="text-[10px] text-muted mt-1">
                  {new Date(sector.asof).toLocaleTimeString()}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MoverTableSection({ title, items }: { title: string; items: MoverItem[]; onRetry?: () => void }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title={`No ${title.toLowerCase()}`} description="No movers data available at this time" icon="chart" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Ticker</TableHead>
              <TableHead className="w-20">Price</TableHead>
              <TableHead className="w-28">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={item.ticker}>
                <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                <TableCell className="font-medium">{item.ticker}</TableCell>
                <TableCell>{fmtNum(item.price)}</TableCell>
                <TableCell>
                  <PriceChange changePct={item.change_pct} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MacroGauges({ macro, onRetry }: { macro: { risk: number; support: number } | null; onRetry: () => void }) {
  if (!macro) {
    return <SectionError message="Macro data unavailable" onRetry={onRetry} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm">Macro Risk</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ScoreBar score={macro.risk} classification="Risk Score" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm">Macro Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ScoreBar score={macro.support} classification="Support Score" />
        </CardContent>
      </Card>
    </div>
  );
}

function UpcomingEvents({ events }: { events: UpcomingEventItem[]; onRetry?: () => void }) {
  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title="No upcoming events" description="No economic events scheduled at this time" icon="clock" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Upcoming Events</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              <TableHead className="w-20">Time</TableHead>
              <TableHead>Event</TableHead>
              <TableHead className="w-20">Impact</TableHead>
              <TableHead className="w-24">Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event, idx) => (
              <TableRow key={`${event.date}-${event.time}-${event.event}-${idx}`} className="hover:bg-elevated-panel/50">
                <TableCell className="font-mono text-xs">
                  {new Date(event.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </TableCell>
                <TableCell className="font-mono text-xs">{event.time}</TableCell>
                <TableCell className="font-medium">{event.event}</TableCell>
                <TableCell className="text-center">
                  <ImpactBadge impact={event.impact} />
                </TableCell>
                <TableCell className="text-center text-xs text-muted capitalize">
                  {event.category?.toLowerCase() ?? "--"}
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
      const data = await getMarketOverview();
      setState({ status: "ready", data });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load market data",
      });
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function initialLoad() {
      try {
        const data = await getMarketOverview();
        if (cancelled) return;
        setState({ status: "ready", data });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load market data",
          });
        }
      }
    }
    void initialLoad();
    return () => { cancelled = true; };
  }, []);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Market Overview</h1>
            <p className="text-muted">Full-universe market analytics</p>
          </div>
          <Button variant="outline" size="sm" disabled>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Loading...
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <SectionSkeleton variant="card" rows={5} />
          <SectionSkeleton variant="card" rows={3} />
          <SectionSkeleton variant="card" rows={4} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <SectionSkeleton variant="table" rows={5} />
          <SectionSkeleton variant="table" rows={5} />
        </div>

        <SectionSkeleton variant="card" rows={3} />

        <SectionSkeleton variant="card" rows={2} />

        <SectionSkeleton variant="table" rows={5} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Market Overview</h1>
            <p className="text-muted">Full-universe market analytics</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              <div className="flex-1">
                <p className="text-destructive font-medium">Failed to load market data</p>
                <p className="text-sm text-muted">{state.message}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Retrying..." : "Retry"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data } = state;
  const sectorRotation = (data.sector_rotation as unknown as SectorRotationItem[]) ?? [];
  const upcomingEvents = (data.upcoming_events as unknown as UpcomingEventItem[]) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Market Overview</h1>
          <p className="text-muted">Full-universe market analytics</p>
        </div>
        <div className="flex items-center gap-2">
          {data.asof && (
            <span className="text-xs text-muted flex items-center gap-1">
              <span className={cn("h-1.5 w-1.5 rounded-full", isStale(data.asof) ? "bg-warning animate-pulse" : "bg-positive")} />
              Data as of {new Date(data.asof).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
              {isStale(data.asof) && <span className="text-warning">(stale)</span>}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={refreshing}
            className={refreshing ? "animate-spin" : ""}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Top Row: Regime, Breadth, Top Opportunities Count */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <RegimePanel regime={data.regime} onRetry={refresh} />
        <BreadthScore breadth={data.breadth} onRetry={refresh} />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Top Opportunities</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {data.top_opportunities.length}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold tabular-nums text-primary">
              {data.top_opportunities.length}
            </div>
            <p className="text-xs text-muted">Stocks ranked</p>
            <StaleIndicator asof={data.asof} />
          </CardContent>
        </Card>
      </div>

      {/* Sector Rotation */}
      <SectorRotation sectors={sectorRotation} onRetry={refresh} />

      {/* Top Movers Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <MoverTableSection title="Top Gainers" items={data.top_gainers} onRetry={refresh} />
        <MoverTableSection title="Top Losers" items={data.top_losers} onRetry={refresh} />
      </div>

      {/* Macro Gauges */}
      <MacroGauges macro={data.macro} onRetry={refresh} />

      {/* Upcoming Events */}
      <UpcomingEvents events={upcomingEvents} onRetry={refresh} />
    </div>
  );
}