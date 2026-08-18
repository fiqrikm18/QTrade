"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Banknote,
  Coins,
  Target,
  ArrowUp,
  ArrowDown,
  Loader2,
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
import { getMacroIndicators, getCalendarEvents, type MacroIndicator, type CalendarEvent } from "@/lib/api";

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export default function MacroPage() {
  const [macroState, setMacroState] = useState<LoadState<MacroIndicator[]>>({ status: "loading" });
  const [calendarState, setCalendarState] = useState<LoadState<CalendarEvent[]>>({ status: "loading" });

  useEffect(() => {
    async function fetchMacro() {
      try {
        const data = await getMacroIndicators();
        setMacroState({ status: "ready", data });
      } catch (err) {
        setMacroState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load macro data",
        });
      }
    }
    fetchMacro();
  }, []);

  useEffect(() => {
    async function fetchCalendar() {
      try {
        const data = await getCalendarEvents();
        setCalendarState({ status: "ready", data });
      } catch (err) {
        setCalendarState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load calendar data",
        });
      }
    }
    fetchCalendar();
  }, []);

  const renderError = (message: string) => (
    <Card>
      <CardContent className="pt-6">
        <p className="text-negative">Failed to load data</p>
        <p className="text-sm text-muted">{message}</p>
      </CardContent>
    </Card>
  );

  const renderLoading = () => (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
    </div>
  );

  if (macroState.status === "loading" || calendarState.status === "loading") {
    return <div className="space-y-4">{renderLoading()}</div>;
  }

  if (macroState.status === "error") {
    return <div className="space-y-4">{renderError(macroState.message)}</div>;
  }

  const macroData = macroState.data;
  const calendarData = calendarState.status === "ready" ? calendarState.data : [];

  const keyRates = [
    { label: "BI Rate", value: macroData.find(m => m.indicator === "BI Rate")?.current ?? 5.75, unit: "%", icon: Banknote, change: macroData.find(m => m.indicator === "BI Rate")?.change ?? 0, trend: macroData.find(m => m.indicator === "BI Rate")?.trend ?? "neutral" },
    { label: "Inflation (CPI YoY)", value: macroData.find(m => m.indicator === "Inflation (CPI YoY)")?.current ?? 2.4, unit: "%", icon: TrendingUp, change: macroData.find(m => m.indicator === "Inflation (CPI YoY)")?.change ?? 0.3, trend: macroData.find(m => m.indicator === "Inflation (CPI YoY)")?.trend ?? "up" },
    { label: "USD/IDR", value: macroData.find(m => m.indicator === "USD/IDR")?.current ?? 15650, unit: "", icon: Coins, change: macroData.find(m => m.indicator === "USD/IDR")?.change ?? 70, trend: macroData.find(m => m.indicator === "USD/IDR")?.trend ?? "up" },
    { label: "10Y IDN Bond", value: macroData.find(m => m.indicator === "10Y IDN Bond")?.current ?? 6.65, unit: "%", icon: Target, change: macroData.find(m => m.indicator === "10Y IDN Bond")?.change ?? 0.07, trend: macroData.find(m => m.indicator === "10Y IDN Bond")?.trend ?? "up" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Macro Dashboard</h1>
        <p className="text-xs text-muted">Indonesia & Global macroeconomic indicators</p>
      </div>

      {/* Key Rates Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {keyRates.map((rate) => (
          <Card key={rate.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium text-muted">{rate.label}</CardTitle>
              <rate.icon className="h-4 w-4 text-muted" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {rate.value.toLocaleString()}{rate.unit}
              </div>
              <p className={cn(
                "text-xs mt-1",
                rate.trend === "up" && "text-positive",
                rate.trend === "down" && "text-negative",
                rate.trend === "neutral" && "text-muted"
              )}>
                {rate.trend === "up" && (
                  <>
                    <ArrowUp className="inline h-3 w-3" aria-hidden="true" />
                    +{rate.change}{rate.unit}
                  </>
                )}
                {rate.trend === "down" && (
                  <>
                    <ArrowDown className="inline h-3 w-3" aria-hidden="true" />
                    {rate.change}{rate.unit}
                  </>
                )}
                {rate.trend === "neutral" && "Unchanged"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Indicators Table */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicator</TableHead>
                <TableHead className="w-24">Current</TableHead>
                <TableHead className="w-24">Previous</TableHead>
                <TableHead className="w-24">Change</TableHead>
                <TableHead className="w-24">Trend</TableHead>
                <TableHead className="w-20">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {macroData.map((item) => (
                <TableRow key={item.indicator}>
                  <TableCell className="font-medium">{item.indicator}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{item.current.toLocaleString()}{item.unit}</TableCell>
                  <TableCell className="tabular-nums text-muted">{item.previous.toLocaleString()}{item.unit}</TableCell>
                  <TableCell className={cn(
                    "font-medium tabular-nums",
                    item.trend === "up" && "text-positive",
                    item.trend === "down" && "text-negative",
                    item.trend === "neutral" && "text-muted"
                  )}>
                    {item.trend === "up" && "+"}{item.change}{item.unit}
                    {item.trend === "neutral" && " ↔"}
                  </TableCell>
                  <TableCell>
                    {item.trend === "up" && (
                      <TrendingUp className="h-4 w-4 text-positive mx-auto" aria-hidden="true" />
                    )}
                    {item.trend === "down" && (
                      <TrendingDown className="h-4 w-4 text-negative mx-auto" aria-hidden="true" />
                    )}
                    {item.trend === "neutral" && (
                      <div className="w-4 h-4 mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-muted text-xs">{item.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Upcoming Schedule */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Upcoming Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-20">Time</TableHead>
                <TableHead className="w-16">Country</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="w-20">Impact</TableHead>
                <TableHead className="w-24">Estimate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calendarData.map((event) => (
                <TableRow key={`${event.date}-${event.time}-${event.event}`}>
                  <TableCell className="text-xs">{event.date}</TableCell>
                  <TableCell className="text-xs">{event.time}</TableCell>
                  <TableCell className="text-center text-xs font-medium">{event.country}</TableCell>
                  <TableCell className="font-medium">{event.event}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        event.impact === "HIGH" ? "destructive" :
                        event.impact === "MEDIUM" ? "warning" : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {event.impact}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{event.consensus}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
