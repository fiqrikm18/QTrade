"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  RefreshCw,
  Activity,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSectorPerformance } from "@/lib/api";

interface SectorRow {
  sector: string;
  perf1d: number;
  perf5d: number;
  perf20d: number;
  perf60d: number;
  rs: number;
  score: number;
  rotation: "LEADING" | "IMPROVING" | "WEAKENING" | "LAGGING";
  momentum: number;
  breadth: number;
  volume: number;
  valuation: number;
  topMover: string;
  breadthPct: number;
  stage: string;
}

function perfClass(v: number): string {
  if (v > 0) return "text-positive";
  if (v < 0) return "text-negative";
  return "text-muted";
}

function perfLabel(v: number): string {
  if (v > 0) return `+${v.toFixed(2)}%`;
  if (v < 0) return `${v.toFixed(2)}%`;
  return "--";
}

const ROTATION_VARIANT: Record<
  SectorRow["rotation"],
  "success" | "default" | "warning" | "destructive" | "info"
> = {
  LEADING: "success",
  IMPROVING: "info",
  WEAKENING: "warning",
  LAGGING: "destructive",
};

const ROTATION_QUADRANTS: {
  name: SectorRow["rotation"];
  desc: string;
  variant: "success" | "info" | "warning" | "destructive";
  icon: typeof ArrowUpRight;
}[] = [
  {
    name: "LEADING",
    desc: "High Mom, High RS",
    variant: "success",
    icon: ArrowUpRight,
  },
  {
    name: "IMPROVING",
    desc: "Low Mom, High RS",
    variant: "info",
    icon: ArrowUpRight,
  },
  {
    name: "WEAKENING",
    desc: "High Mom, Low RS",
    variant: "warning",
    icon: ArrowDownRight,
  },
  {
    name: "LAGGING",
    desc: "Low Mom, Low RS",
    variant: "destructive",
    icon: ArrowDownRight,
  },
];

export default function SectorsPage() {
  const [sectorData, setSectorData] = useState<SectorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getSectorPerformance();
        const mappedData: SectorRow[] = data.map((item) => ({
          sector: item.ticker,
          perf1d: 0,
          perf5d: 0,
          perf20d: 0,
          perf60d: 0,
          rs: 0,
          score: item.sector_score,
          rotation:
            item.sector_score >= 80
              ? "LEADING"
              : item.sector_score >= 60
                ? "IMPROVING"
                : item.sector_score >= 40
                  ? "WEAKENING"
                  : "LAGGING",
          momentum: item.sector_score,
          breadth: 0,
          volume: 0,
          valuation: 0,
          topMover: item.ticker,
          breadthPct: 0,
          stage: "Unknown",
        }));
        setSectorData(mappedData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load sector data",
        );
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertTriangle className="h-10 w-10 text-negative" />
        <div className="ml-4">
          <h2 className="text-base font-semibold">Failed to load sector data</h2>
          <p className="text-xs text-muted">{error}</p>
        </div>
      </div>
    );
  }

  const counts = {
    LEADING: sectorData.filter((s) => s.rotation === "LEADING").length,
    IMPROVING: sectorData.filter((s) => s.rotation === "IMPROVING").length,
    WEAKENING: sectorData.filter((s) => s.rotation === "WEAKENING").length,
    LAGGING: sectorData.filter((s) => s.rotation === "LAGGING").length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Sector Analysis</h1>
          <p className="text-xs text-muted">
            Sector rotation, performance, and rotation matrix
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="mr-2 h-3 w-3" />
          Refresh
        </Button>
      </div>

      {/* Rotation Matrix + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Rotation Matrix</CardTitle>
            <Badge variant="outline" className="text-[10px]">
              Momentum vs RS
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-elevated-panel/50 rounded-md flex items-center justify-center text-xs text-muted">
              [Rotation Matrix Chart - Momentum vs Relative Strength]
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {ROTATION_QUADRANTS.map((q) => (
                <div
                  key={q.name}
                  className="p-2 bg-elevated-panel/50 border border-border/50 rounded-md"
                >
                  <Badge variant={q.variant} className="text-[10px]">
                    {q.name}
                  </Badge>
                  <p className="mt-1 text-muted">{q.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm">Sector Summary</CardTitle>
            <Activity className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {ROTATION_QUADRANTS.map((q) => (
                <div
                  key={q.name}
                  className="text-center p-3 bg-elevated-panel/50 rounded-md border border-border/50"
                >
                  <p className="text-2xl font-bold tabular-nums">
                    {counts[q.name]}
                  </p>
                  <p className="text-[10px] text-muted">{q.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sector Performance Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm">Sector Performance</CardTitle>
          <Badge variant="outline" className="text-[10px]">
            {sectorData.length} sectors
          </Badge>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sector</TableHead>
                <TableHead className="w-20">1D</TableHead>
                <TableHead className="w-20">5D</TableHead>
                <TableHead className="w-20">20D</TableHead>
                <TableHead className="w-20">60D</TableHead>
                <TableHead className="w-16">RS</TableHead>
                <TableHead className="w-20">Momentum</TableHead>
                <TableHead className="w-20">Breadth</TableHead>
                <TableHead className="w-20">Volume</TableHead>
                <TableHead className="w-20">Valuation</TableHead>
                <TableHead className="w-24">Rotation</TableHead>
                <TableHead className="w-16">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectorData.map((sector) => (
                <TableRow key={sector.sector}>
                  <TableCell className="font-medium">{sector.sector}</TableCell>
                  <TableCell className={cn(perfClass(sector.perf1d), "tabular-nums")}>
                    {perfLabel(sector.perf1d)}
                  </TableCell>
                  <TableCell className={cn(perfClass(sector.perf5d), "tabular-nums")}>
                    {perfLabel(sector.perf5d)}
                  </TableCell>
                  <TableCell className={cn(perfClass(sector.perf20d), "tabular-nums")}>
                    {perfLabel(sector.perf20d)}
                  </TableCell>
                  <TableCell className={cn(perfClass(sector.perf60d), "tabular-nums")}>
                    {perfLabel(sector.perf60d)}
                  </TableCell>
                  <TableCell className="tabular-nums">{sector.rs}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sector.momentum >= 70
                          ? "success"
                          : sector.momentum >= 50
                            ? "default"
                            : "destructive"
                      }
                      className="text-[10px]"
                    >
                      {sector.momentum}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sector.breadth >= 60
                          ? "success"
                          : sector.breadth >= 40
                            ? "default"
                            : "destructive"
                      }
                      className="text-[10px]"
                    >
                      {sector.breadth}%
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{sector.volume}x</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sector.valuation >= 70
                          ? "success"
                          : sector.valuation >= 50
                            ? "default"
                            : "destructive"
                      }
                      className="text-[10px]"
                    >
                      {sector.valuation}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={ROTATION_VARIANT[sector.rotation]}
                      className="text-[10px]"
                    >
                      {sector.rotation}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sector.score >= 80
                          ? "success"
                          : sector.score >= 60
                            ? "default"
                            : "destructive"
                      }
                      className="text-[10px]"
                    >
                      {sector.score}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sector Cards Grid */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Sector Cards</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sectorData.map((sector) => (
            <Card key={sector.sector}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-sm">{sector.sector}</CardTitle>
                <Badge
                  variant={ROTATION_VARIANT[sector.rotation]}
                  className="text-[10px]"
                >
                  {sector.rotation}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted">Top Mover</p>
                    <p className="font-semibold text-sm">{sector.topMover}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted">1D</p>
                    <p className={cn("font-bold text-sm tabular-nums", perfClass(sector.perf1d))}>
                      {perfLabel(sector.perf1d)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">5D</span>
                    <span className={cn("tabular-nums", perfClass(sector.perf5d))}>
                      {perfLabel(sector.perf5d)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">20D</span>
                    <span className={cn("tabular-nums", perfClass(sector.perf20d))}>
                      {perfLabel(sector.perf20d)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">60D</span>
                    <span className={cn("tabular-nums", perfClass(sector.perf60d))}>
                      {perfLabel(sector.perf60d)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">RS</span>
                    <span className="font-medium tabular-nums">{sector.rs}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted">Breadth</span>
                  <Badge
                    variant={
                      sector.breadthPct >= 60
                        ? "success"
                        : sector.breadthPct >= 40
                          ? "default"
                          : "destructive"
                    }
                    className="text-[10px]"
                  >
                    {sector.breadthPct}%
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-muted">
                    Stage: {sector.stage}
                  </span>
                  <Badge
                    variant={
                      sector.score >= 80
                        ? "success"
                        : sector.score >= 60
                          ? "default"
                          : "destructive"
                    }
                    className="text-[10px]"
                  >
                    Score {sector.score}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
