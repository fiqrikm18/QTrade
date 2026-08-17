"use client";

import {
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  BarChart2,
  Target,
  AlertTriangle,
  Clock,
  Zap,
  Eye,
  ExternalLink,
  RefreshCw,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
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

const sectorData: SectorRow[] = [
  {
    sector: "BANKING",
    perf1d: 2.1,
    perf5d: 4.2,
    perf20d: 7.8,
    perf60d: 12.4,
    rs: 91,
    score: 89,
    rotation: "LEADING",
    momentum: 88,
    breadth: 72,
    volume: 1.2,
    valuation: 78,
    topMover: "BBCA",
    breadthPct: 72,
    stage: "Accumulation",
  },
  {
    sector: "ENERGY",
    perf1d: 1.7,
    perf5d: 5.8,
    perf20d: 3.1,
    perf60d: 8.2,
    rs: 84,
    score: 82,
    rotation: "IMPROVING",
    momentum: 79,
    breadth: 68,
    volume: 0.9,
    valuation: 85,
    topMover: "PGAS",
    breadthPct: 68,
    stage: "Markup",
  },
  {
    sector: "TELCO",
    perf1d: -0.3,
    perf5d: 1.1,
    perf20d: 2.4,
    perf60d: 1.0,
    rs: 63,
    score: 65,
    rotation: "WEAKENING",
    momentum: 65,
    breadth: 58,
    volume: 0.7,
    valuation: 72,
    topMover: "TLKM",
    breadthPct: 58,
    stage: "Distribution",
  },
  {
    sector: "PROPERTY",
    perf1d: -1.2,
    perf5d: -2.4,
    perf20d: -4.8,
    perf60d: -6.1,
    rs: 42,
    score: 44,
    rotation: "LAGGING",
    momentum: 45,
    breadth: 38,
    volume: 0.5,
    valuation: 58,
    topMover: "SMRA",
    breadthPct: 38,
    stage: "Markdown",
  },
  {
    sector: "CONSUMER",
    perf1d: 0.8,
    perf5d: 2.1,
    perf20d: 1.8,
    perf60d: 3.5,
    rs: 71,
    score: 68,
    rotation: "IMPROVING",
    momentum: 72,
    breadth: 62,
    volume: 0.8,
    valuation: 75,
    topMover: "UNVR",
    breadthPct: 62,
    stage: "Markup",
  },
  {
    sector: "HEALTHCARE",
    perf1d: 0.5,
    perf5d: -0.2,
    perf20d: -1.2,
    perf60d: -0.5,
    rs: 58,
    score: 61,
    rotation: "WEAKENING",
    momentum: 55,
    breadth: 52,
    volume: 0.6,
    valuation: 70,
    topMover: "KLBF",
    breadthPct: 52,
    stage: "Distribution",
  },
  {
    sector: "INFRASTRUCTURE",
    perf1d: 1.1,
    perf5d: 2.8,
    perf20d: 3.5,
    perf60d: 5.1,
    rs: 76,
    score: 73,
    rotation: "IMPROVING",
    momentum: 78,
    breadth: 66,
    volume: 0.9,
    valuation: 80,
    topMover: "WIJK",
    breadthPct: 66,
    stage: "Markup",
  },
];

const rotationVariant: Record<
  SectorRow["rotation"],
  "success" | "default" | "warning" | "destructive"
> = {
  LEADING: "success",
  IMPROVING: "default",
  WEAKENING: "warning",
  LAGGING: "destructive",
};

function perfClass(v: number): string {
  return v >= 0 ? "text-green-600" : "text-red-600";
}

function perfLabel(v: number): string {
  return `${v > 0 ? "+" : ""}${v}%`;
}

export default function SectorsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sector Analysis</h1>
          <p className="text-muted-foreground">
            Sector rotation, performance, and rotation matrix
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Rotation Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Rotation Matrix</CardTitle>
            <Badge variant="outline" className="text-xs">
              Momentum vs RS
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground">
              [Rotation Matrix Chart - Momentum vs Relative Strength]
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-green-50 rounded">
                <span className="font-medium text-green-600">LEADING</span>
                <br />
                High Mom, High RS
              </div>
              <div className="p-2 bg-blue-50 rounded">
                <span className="font-medium text-blue-600">IMPROVING</span>
                <br />
                Low Mom, High RS
              </div>
              <div className="p-2 bg-yellow-50 rounded">
                <span className="font-medium text-yellow-600">WEAKENING</span>
                <br />
                High Mom, Low RS
              </div>
              <div className="p-2 bg-red-50 rounded">
                <span className="font-medium text-red-600">LAGGING</span>
                <br />
                Low Mom, Low RS
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary stats */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Sector Summary</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {sectorData.filter((s) => s.rotation === "LEADING").length}
                </p>
                <p className="text-xs text-muted-foreground">Leading</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {sectorData.filter((s) => s.rotation === "IMPROVING").length}
                </p>
                <p className="text-xs text-muted-foreground">Improving</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">
                  {sectorData.filter((s) => s.rotation === "WEAKENING").length}
                </p>
                <p className="text-xs text-muted-foreground">Weakening</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">
                  {sectorData.filter((s) => s.rotation === "LAGGING").length}
                </p>
                <p className="text-xs text-muted-foreground">Lagging</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sector Performance Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Sector Performance</CardTitle>
          <Badge variant="outline" className="text-xs">
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
                <TableRow key={sector.sector} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{sector.sector}</TableCell>
                  <TableCell className={perfClass(sector.perf1d)}>
                    {perfLabel(sector.perf1d)}
                  </TableCell>
                  <TableCell className={perfClass(sector.perf5d)}>
                    {perfLabel(sector.perf5d)}
                  </TableCell>
                  <TableCell className={perfClass(sector.perf20d)}>
                    {perfLabel(sector.perf20d)}
                  </TableCell>
                  <TableCell className={perfClass(sector.perf60d)}>
                    {perfLabel(sector.perf60d)}
                  </TableCell>
                  <TableCell className="font-medium">{sector.rs}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sector.momentum >= 70
                          ? "success"
                          : sector.momentum >= 50
                            ? "default"
                            : "destructive"
                      }
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
                    >
                      {sector.breadth}%
                    </Badge>
                  </TableCell>
                  <TableCell>{sector.volume}x</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sector.valuation >= 70
                          ? "success"
                          : sector.valuation >= 50
                            ? "default"
                            : "destructive"
                      }
                    >
                      {sector.valuation}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={rotationVariant[sector.rotation]}>
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
        <h2 className="text-lg font-semibold mb-3">Sector Cards</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sectorData.map((sector) => (
            <Card key={sector.sector}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{sector.sector}</CardTitle>
                <Badge
                  variant={rotationVariant[sector.rotation]}
                  className="text-xs"
                >
                  {sector.rotation}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Top Mover</p>
                    <p className="font-semibold">{sector.topMover}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">1D</p>
                    <p
                      className={`font-bold ${perfClass(sector.perf1d)}`}
                    >
                      {perfLabel(sector.perf1d)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">5D</span>
                    <span className={perfClass(sector.perf5d)}>
                      {perfLabel(sector.perf5d)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">20D</span>
                    <span className={perfClass(sector.perf20d)}>
                      {perfLabel(sector.perf20d)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">60D</span>
                    <span className={perfClass(sector.perf60d)}>
                      {perfLabel(sector.perf60d)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">RS</span>
                    <span className="font-medium">{sector.rs}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Breadth
                  </span>
                  <Badge
                    variant={
                      sector.breadthPct >= 60
                        ? "success"
                        : sector.breadthPct >= 40
                          ? "default"
                          : "destructive"
                    }
                    className="text-xs"
                  >
                    {sector.breadthPct}%
                  </Badge>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
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
                  className="text-xs"
                >
                  Score {sector.score}
                </Badge>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
