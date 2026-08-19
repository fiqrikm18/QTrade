"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import {
  RefreshCw,
  AlertCircle,
  Clock,
} from "lucide-react";
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
import { getMacroIndicators, type MacroIndicator } from "@/lib/api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T; asof: string | null };

export default function MacroPage() {
  const [state, setState] = useState<LoadState<MacroIndicator[]>>({
    status: "loading",
  });

  async function fetchData() {
    try {
      setState({ status: "loading" });
      const data = await getMacroIndicators();
      const asof = data[0]?.source ? new Date().toISOString() : null;
      setState({ status: "ready", data, asof });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load macro data",
      });
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, []);

  const renderSkeleton = () => (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">Indicators</CardTitle>
      </CardHeader>
      <CardContent>
        <LoadingSkeleton variant="table" rows={8} columns={6} />
      </CardContent>
    </Card>
  );

  const renderError = (message: string) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-10 w-10 text-negative" aria-hidden="true" />
          <p className="text-sm font-medium">Failed to load macro indicators</p>
          <p className="text-xs text-muted max-w-sm">{message}</p>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1">
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Retry
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const getTrendBadge = (trend: MacroIndicator["trend"]) => {
    const variants = {
      up: "success" as const,
      down: "destructive" as const,
      neutral: "neutral" as const,
    };
    const labels = { up: "▲ Up", down: "▼ Down", neutral: "● Neutral" };
    return (
      <Badge variant={variants[trend]} className="text-[10px]">
        {labels[trend]}
      </Badge>
    );
  };

  const formatValue = (value: number, unit: string) =>
    `${value.toLocaleString()}${unit}`;

  const formatChange = (change: number, unit: string, trend: MacroIndicator["trend"]) => {
    const sign = trend === "up" ? "+" : trend === "down" ? "" : "±";
    return `${sign}${change}${unit}`;
  };

  if (state.status === "loading") {
    return <div className="space-y-4">{renderSkeleton()}</div>;
  }

  if (state.status === "error") {
    return <div className="space-y-4">{renderError(state.message)}</div>;
  }

  const { data, asof } = state;

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-12">
            <EmptyState
              title="No macro data available"
              description="No macroeconomic indicators found in the database."
              icon="database"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Macro Dashboard</h1>
          <p className="text-xs text-muted">Indonesia & Global macroeconomic indicators</p>
        </div>
        {asof && (
          <div className="flex items-center gap-1 text-xs text-muted">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>Updated: {new Date(asof).toLocaleTimeString()}</span>
            <span className="text-positive">● Live</span>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicator</TableHead>
                <TableHead className="w-24 text-right">Current</TableHead>
                <TableHead className="w-24 text-right">Previous</TableHead>
                <TableHead className="w-24 text-right">Change</TableHead>
                <TableHead className="w-24">Trend</TableHead>
                <TableHead className="w-28">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.indicator}>
                  <TableCell className="font-medium">{item.indicator}</TableCell>
                  <TableCell className="font-semibold tabular-nums text-right">
                    {formatValue(item.current, item.unit)}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted text-right">
                    {formatValue(item.previous, item.unit)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-medium tabular-nums text-right",
                      item.trend === "up" && "text-positive",
                      item.trend === "down" && "text-negative",
                      item.trend === "neutral" && "text-muted"
                    )}
                  >
                    {formatChange(item.change, item.unit, item.trend)}
                  </TableCell>
                  <TableCell className="text-center">{getTrendBadge(item.trend)}</TableCell>
                  <TableCell className="text-muted text-xs">{item.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}