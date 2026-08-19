"use client";

import { useState, useEffect } from "react";
import { Filter, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImpactBadge } from "@/components/ui/impact-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getCalendarEvents, type CalendarEvent } from "@/lib/api";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: CalendarEvent[]; asof: string | null };

type ImpactFilter = "all" | "HIGH" | "MEDIUM" | "LOW";

const COUNTRIES = [
  { value: "all", label: "All Countries" },
  { value: "ID", label: "🇮🇩 Indonesia" },
  { value: "US", label: "🇺🇸 United States" },
  { value: "CN", label: "🇨🇳 China" },
  { value: "EU", label: "🇪🇺 Eurozone" },
  { value: "JP", label: "🇯🇵 Japan" },
  { value: "GB", label: "🇬🇧 United Kingdom" },
  { value: "DE", label: "🇩🇪 Germany" },
  { value: "FR", label: "🇫🇷 France" },
  { value: "AU", label: "🇦🇺 Australia" },
  { value: "CA", label: "🇨🇦 Canada" },
] as const;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getCountryFlag(country: string): string {
  const flags: Record<string, string> = {
    ID: "🇮🇩", US: "🇺🇸", CN: "🇨🇳", EU: "🇪🇺", JP: "🇯🇵", GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷", AU: "🇦🇺", CA: "🇨🇦"
  };
  return flags[country] || "";
}

export default function CalendarPage() {
  const [filterImpact, setFilterImpact] = useState<ImpactFilter>("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const data = await getCalendarEvents();
      setState({ status: "ready", data, asof: new Date().toISOString() });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load calendar data",
      });
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function initialLoad() {
      try {
        const data = await getCalendarEvents();
        if (cancelled) return;
        setState({ status: "ready", data, asof: new Date().toISOString() });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load calendar data",
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

  const filteredEvents = state.status === "ready" ? state.data.filter(event => {
    if (filterImpact !== "all" && event.impact !== filterImpact) return false;
    if (filterCountry !== "all" && event.country !== filterCountry) return false;
    if (dateFrom && event.date < dateFrom) return false;
    if (dateTo && event.date > dateTo) return false;
    return true;
  }) : [];

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}`).getTime();
    const dateB = new Date(`${b.date}T${b.time}`).getTime();
    return dateA - dateB;
  });

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Economic Calendar</h1>
            <p className="text-muted">Track global economic events and their market impact</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead className="w-20">Time</TableHead>
                  <TableHead className="w-16">Country</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="w-20">Impact</TableHead>
                  <TableHead className="w-24">Previous</TableHead>
                  <TableHead className="w-24">Consensus</TableHead>
                  <TableHead className="w-24">Actual</TableHead>
                  <TableHead className="w-20">Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs"><div className="h-4 w-20 bg-elevated-panel/50 animate-pulse rounded" /></TableCell>
                    <TableCell className="font-mono text-xs"><div className="h-4 w-14 bg-elevated-panel/50 animate-pulse rounded" /></TableCell>
                    <TableCell className="text-center"><div className="h-4 w-10 bg-elevated-panel/50 animate-pulse rounded mx-auto" /></TableCell>
                    <TableCell><div className="h-4 w-48 bg-elevated-panel/50 animate-pulse rounded" /></TableCell>
                    <TableCell className="text-center"><div className="h-4 w-16 bg-elevated-panel/50 animate-pulse rounded mx-auto" /></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-18 bg-elevated-panel/50 animate-pulse rounded" /></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-18 bg-elevated-panel/50 animate-pulse rounded" /></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-18 bg-elevated-panel/50 animate-pulse rounded" /></TableCell>
                    <TableCell className="text-center"><div className="h-4 w-16 bg-elevated-panel/50 animate-pulse rounded mx-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Economic Calendar</h1>
            <p className="text-muted">Track global economic events and their market impact</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              <div className="flex-1">
                <p className="text-destructive font-medium">Failed to load calendar data</p>
                <p className="text-sm text-muted">{state.message}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>
                <RefreshCw className="h-4 w-4 mr-2" /> {refreshing ? "Retrying..." : "Retry"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { asof } = state;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-lg font-semibold">Economic Calendar</h1>
          <p className="text-muted">Track global economic events and their market impact</p>
        </div>
        <div className="flex items-center gap-2">
          {asof && (
            <span className="text-xs text-muted flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              Data as of {new Date(asof).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm">Economic Events ({sortedEvents.length} events)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-3 border-b border-border bg-elevated-panel/30 flex flex-wrap gap-2 items-center">
            <Select value={filterImpact} onValueChange={(val) => setFilterImpact(val as ImpactFilter)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Impact" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Impact</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCountry} onValueChange={(val) => setFilterCountry(val)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="From"
                className="w-36 text-xs"
                aria-label="Date from"
              />
              <span className="text-muted text-xs">–</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="To"
                className="w-36 text-xs"
                aria-label="Date to"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => { setFilterImpact("all"); setFilterCountry("all"); setDateFrom(""); setDateTo(""); }} className="ml-auto">
              <Filter className="h-3.5 w-3.5 mr-1.5" /> Clear
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead className="w-20">Time</TableHead>
                  <TableHead className="w-16">Country</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="w-20">Impact</TableHead>
                  <TableHead className="w-24">Previous</TableHead>
                  <TableHead className="w-24">Consensus</TableHead>
                  <TableHead className="w-24">Actual</TableHead>
                  <TableHead className="w-20">Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8">
                      <EmptyState
                        title="No calendar events"
                        description="No events match the current filters. Try adjusting the impact, country, or date range."
                        icon="filter"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedEvents.map((event, index) => (
                    <TableRow key={`${event.date}-${event.time}-${event.event}-${index}`} className="hover:bg-elevated-panel/50">
                      <TableCell className="font-mono text-xs">{formatDate(event.date)}</TableCell>
                      <TableCell className="font-mono text-xs">{event.time}</TableCell>
                      <TableCell className="text-center text-sm">
                        <span className="inline-flex items-center gap-1">
                          <span>{getCountryFlag(event.country)}</span>
                          <span className="text-xs font-medium uppercase">{event.country}</span>
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{event.event}</TableCell>
                      <TableCell className="text-center">
                        <ImpactBadge impact={event.impact} />
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted">{event.prev ?? null}</TableCell>
                      <TableCell className="text-right text-sm text-muted">{event.consensus ?? null}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{event.actual ?? null}</TableCell>
                      <TableCell className="text-center text-sm text-muted capitalize">{event.category.toLowerCase()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}