"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Calendar, Filter, Search, Download, Flag, Circle, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getCalendarEvents, type CalendarEvent } from "@/lib/api"

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: CalendarEvent[] };

export default function CalendarPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [view, setView] = useState<"month" | "week" | "list">("month")
  const [filterImpact, setFilterImpact] = useState<"all" | "HIGH" | "MEDIUM" | "LOW">("all")
  const [filterCountry, setFilterCountry] = useState("all")
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getCalendarEvents();
        setState({ status: "ready", data });
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load calendar data",
        });
      }
    }
    fetchData();
  }, []);

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "HIGH": return "destructive"
      case "MEDIUM": return "warning"
      case "LOW": return "secondary"
      default: return "secondary"
    }
  }

  const getCountryFlag = (country: string) => {
    const flags: Record<string, string> = {
      ID: "🇮🇩", US: "🇺🇸", CN: "🇨🇳", EU: "🇪🇺", JP: "🇯🇵", GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷", AU: "🇦🇺", CA: "🇨🇦"
    }
    return flags[country] || country
  }

  const filteredEvents = state.status === "ready" ? state.data.filter(event => {
    if (filterImpact !== "all" && event.impact !== filterImpact) return false
    if (filterCountry !== "all" && event.country !== filterCountry) return false
    return true
  }) : [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  }

  if (state.status === "loading") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <AlertTriangle className="h-12 w-12 text-red-600" />
          <div className="ml-4">
            <h2 className="text-xl font-bold">Failed to load calendar data</h2>
            <p className="text-muted-foreground">{state.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Economic Calendar</h1>
          <p className="text-muted-foreground">Track global economic events and their market impact</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setView("month")} className="mr-2">
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
              <line x1="16" y1="2" x2="16" y2="22" strokeWidth={2} />
              <line x1="8" y1="2" x2="8" y2="22" strokeWidth={2} />
              <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} />
            </svg>
            Month
          </Button>
          <Button variant="outline" size="sm" className="mr-2">
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
              <line x1="16" y1="2" x2="16" y2="22" strokeWidth={2} />
              <line x1="8" y1="2" x2="8" y2="22" strokeWidth={2} />
            </svg>
            Week
          </Button>
          <Button variant="outline" size="sm">
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 000 4h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            List
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <Select value={filterImpact} onValueChange={(val) => setFilterImpact(val as "all" | "HIGH" | "MEDIUM" | "LOW")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Impact" />
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
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              <SelectItem value="ID">🇮🇩 Indonesia</SelectItem>
              <SelectItem value="US">🇺🇸 United States</SelectItem>
              <SelectItem value="CN">🇨🇳 China</SelectItem>
              <SelectItem value="EU">🇪🇺 Eurozone</SelectItem>
              <SelectItem value="JP">🇯🇵 Japan</SelectItem>
              <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Economic Events ({filteredEvents.length} events)</CardTitle>
        </CardHeader>
        <CardContent>
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
                {filteredEvents.map((event, index) => (
                  <TableRow key={index} className="hover:bg-muted/50">
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
                      <Badge variant={getImpactColor(event.impact) as "destructive" | "warning" | "secondary"} className="text-xs">
                        {event.impact}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{event.prev}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{event.consensus}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{event.actual}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground capitalize">{event.category.toLowerCase()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}