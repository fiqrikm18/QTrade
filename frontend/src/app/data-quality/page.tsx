"use client";

import { useState, useEffect } from "react";
import { RefreshCw, AlertCircle, Clock, Database, TrendingUp, Calendar, Newspaper, FileText, Zap } from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { getDataQuality, type DataQualityReport } from "@/lib/api";

type DomainKey = "ohlcv" | "macro" | "calendar" | "news" | "fundamentals" | "technical_features";

interface DomainInfo {
  key: DomainKey;
  label: string;
  icon: React.ReactNode;
  getCount: (report: DataQualityReport) => number;
  getCountLabel: (report: DataQualityReport) => string;
  getGaps?: (report: DataQualityReport) => string[];
}

const DOMAINS: DomainInfo[] = [
  {
    key: "ohlcv",
    label: "OHLCV",
    icon: <Database className="h-4 w-4" />,
    getCount: (r) => r.ohlcv.row_count,
    getCountLabel: (r) => `${r.ohlcv.tickers} tickers`,
    getGaps: (r) => r.ohlcv.gaps,
  },
  {
    key: "macro",
    label: "Macro",
    icon: <TrendingUp className="h-4 w-4" />,
    getCount: (r) => r.macro.row_count,
    getCountLabel: (r) => `${r.macro.indicators} indicators`,
  },
  {
    key: "calendar",
    label: "Calendar",
    icon: <Calendar className="h-4 w-4" />,
    getCount: (r) => r.calendar.row_count,
    getCountLabel: (r) => `${r.calendar.events} events`,
  },
  {
    key: "news",
    label: "News",
    icon: <Newspaper className="h-4 w-4" />,
    getCount: (r) => r.news.row_count,
    getCountLabel: (r) => `${r.news.articles} articles`,
  },
  {
    key: "fundamentals",
    label: "Fundamentals",
    icon: <FileText className="h-4 w-4" />,
    getCount: (r) => r.fundamentals.row_count,
    getCountLabel: (r) => `${r.fundamentals.tickers} tickers`,
  },
  {
    key: "technical_features",
    label: "Technical Features",
    icon: <Zap className="h-4 w-4" />,
    getCount: (r) => r.technical_features.row_count,
    getCountLabel: (r) => `${r.technical_features.tickers} tickers`,
  },
];

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DataQualityReport };

function formatLastUpdate(lastUpdate: string | null): string {
  if (!lastUpdate) return "Never";
  try {
    return new Date(lastUpdate).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return lastUpdate;
  }
}

function getFreshness(lastUpdate: string | null): "fresh" | "stale" | "old" {
  if (!lastUpdate) return "old";
  const diffMs = Date.now() - new Date(lastUpdate).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1) return "fresh";
  if (diffHours < 24) return "stale";
  return "old";
}

function getFreshnessBadge(freshness: "fresh" | "stale" | "old") {
  switch (freshness) {
    case "fresh":
      return <Badge variant="success" className="text-[10px]">Fresh</Badge>;
    case "stale":
      return <Badge variant="warning" className="text-[10px]">Stale</Badge>;
    case "old":
      return <Badge variant="destructive" className="text-[10px]">Old</Badge>;
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export default function DataQualityPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    try {
      setState({ status: "loading" });
      const data = await getDataQuality();
      setState({ status: "ready", data });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load data quality report",
      });
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function initialLoad() {
      try {
        const data = await getDataQuality();
        if (!cancelled) setState({ status: "ready", data });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load data quality report",
          });
        }
      }
    }
    void initialLoad();
    return () => { cancelled = true; };
  }, []);

  async function refresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {DOMAINS.map((domain) => (
        <Card key={domain.key}>
          <CardContent className="p-4">
            <LoadingSkeleton variant="card" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderError = (message: string) => (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-negative" aria-hidden="true" />
            <p className="text-sm font-medium">Failed to load data quality report</p>
            <p className="text-xs text-muted max-w-sm">{message}</p>
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-1">
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderEmpty = () => (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-12">
          <EmptyState
            title="No data quality data available"
            description="No data quality report found in the database."
            icon="database"
          />
        </CardContent>
      </Card>
    </div>
  );

  if (state.status === "loading") {
    return <div className="space-y-4">{renderSkeleton()}</div>;
  }

  if (state.status === "error") {
    return <div className="space-y-4">{renderError(state.message)}</div>;
  }

  const { data } = state;

  const hasData = DOMAINS.some((domain) => {
    const domainData = data[domain.key];
    return domainData && (domainData.row_count > 0 || (domainData.last_update && domainData.last_update !== "null"));
  });

  if (!hasData) {
    return <div className="space-y-4">{renderEmpty()}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Data Quality Report</h1>
          <p className="text-xs text-muted">Monitor data freshness and completeness across all domains</p>
        </div>
        <div className="flex items-center gap-2">
          {data.asof && (
            <div className="flex items-center gap-1 text-xs text-muted">
              <Clock className="h-3 w-3" aria-hidden="true" />
              <span>As of {new Date(data.asof).toLocaleTimeString()}</span>
            </div>
          )}
          <Button variant="outline" size="sm" disabled={refreshing} onClick={() => void refresh()}>
            <RefreshCw className="mr-2 h-3 w-3" aria-hidden="true" />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DOMAINS.map((domain) => {
          const domainData = data[domain.key];
          const freshness = getFreshness(domainData.last_update);
          const gaps = domain.getGaps?.(data) ?? [];

          return (
            <Card key={domain.key}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded bg-accent/50 text-accent">{domain.icon}</span>
                    <CardTitle className="text-sm">{domain.label}</CardTitle>
                  </div>
                  {getFreshnessBadge(freshness)}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Last Updated</span>
                    <span className="font-mono font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {formatLastUpdate(domainData.last_update)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Rows</span>
                    <span className="font-mono font-medium tabular-nums">{formatNumber(domain.getCount(data))}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">{domain.getCountLabel(data).split(" ")[1] || "Count"}</span>
                    <span className="font-mono font-medium tabular-nums">{domain.getCountLabel(data)}</span>
                  </div>
                  {gaps.length > 0 && (
                    <div className="flex items-start justify-between border-t border-border pt-2">
                      <span className="text-muted">Gaps</span>
                      <span className="font-mono text-xs text-muted max-w-[60%] truncate">{gaps.join(", ")}</span>
                    </div>
                  )}
                  {gaps.length === 0 && domain.getGaps && (
                    <div className="flex items-center justify-between border-t border-border pt-2">
                      <span className="text-muted">Gaps</span>
                      <span className="font-mono text-xs text-muted">None</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}