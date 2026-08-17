"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Globe,
  AlertTriangle,
  Clock,
  Zap,
  Target,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Banknote,
  Coins,
  Calendar,
  FileText,
  Building2,
  Landmark,
  ExternalLink,
} from "lucide-react";
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

export default function MacroPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const indonesiaMacro = [
    { indicator: "BI Rate", current: 5.75, previous: 5.75, change: 0, unit: "%", trend: "neutral", source: "BI" },
    { indicator: "Inflation (CPI YoY)", current: 2.4, previous: 2.1, change: 0.3, unit: "%", trend: "up", source: "BPS" },
    { indicator: "GDP (YoY)", current: 5.05, previous: 5.11, change: -0.06, unit: "%", trend: "down", source: "BPS" },
    { indicator: "PMI Manufacturing", current: 52.1, previous: 51.8, change: 0.3, unit: "", trend: "up", source: "BPS" },
    { indicator: "Trade Balance", current: 3.2, previous: 2.8, change: 0.4, unit: "B USD", trend: "up", source: "BPS" },
    { indicator: "Current Account", current: -0.8, previous: -1.2, change: 0.4, unit: "% GDP", trend: "up", source: "BI" },
    { indicator: "USD/IDR", current: 15650, previous: 15580, change: 70, unit: "", trend: "up", source: "BI" },
    { indicator: "10Y IDN Bond", current: 6.65, previous: 6.58, change: 0.07, unit: "%", trend: "up", source: "BI" },
  ];

  const globalMacro = [
    { indicator: "Fed Funds Rate", current: 5.25, previous: 5.25, change: 0, unit: "%", trend: "neutral", source: "Fed" },
    { indicator: "US CPI YoY", current: 3.1, previous: 3.2, change: -0.1, unit: "%", trend: "down", source: "BLS" },
    { indicator: "US Nonfarm Payrolls", current: 275, previous: 216, change: 59, unit: "K", trend: "up", source: "BLS" },
    { indicator: "US 10Y Yield", current: 4.12, previous: 4.08, change: 0.04, unit: "%", trend: "up", source: "US Treasury" },
    { indicator: "DXY", current: 103.45, previous: 102.8, change: 0.65, unit: "", trend: "up", source: "ICE" },
    { indicator: "S&P 500", current: 4850, previous: 4780, change: 70, unit: "", trend: "up", source: "S&P" },
    { indicator: "China PMI", current: 50.8, previous: 50.5, change: 0.3, unit: "", trend: "up", source: "NBS" },
    { indicator: "China GDP", current: 5.2, previous: 4.9, change: 0.3, unit: "%", trend: "up", source: "NBS" },
  ];

  const commodities = [
    { name: "Oil (Brent)", price: 82.50, change: 1.20, unit: "USD/bbl", trend: "up" },
    { name: "Gold", price: 2035, change: -5.50, unit: "USD/oz", trend: "down" },
    { name: "Coal", price: 135, change: 2.5, unit: "USD/t", trend: "up" },
    { name: "CPO", price: 3950, change: -25, unit: "MYR/t", trend: "down" },
    { name: "Nickel", price: 16500, change: 150, unit: "USD/t", trend: "up" },
    { name: "Copper", price: 8450, change: 45, unit: "USD/t", trend: "up" },
  ];

  const macroEvents = [
    { time: "09:00", country: "ID", event: "CPI YoY", impact: "HIGH", prev: "2.1%", consensus: "2.3%", actual: "2.4%" },
    { time: "19:30", country: "US", event: "CPI YoY", impact: "HIGH", prev: "3.0%", consensus: "2.9%", actual: "--" },
    { time: "21:00", country: "US", event: "Fed Decision", impact: "HIGH", prev: "5.25%", consensus: "5.25%", actual: "--" },
    { time: "20:30", country: "CN", event: "Industrial Production", impact: "MEDIUM", prev: "6.2%", consensus: "6.5%", actual: "--" },
    { time: "08:30", country: "ID", event: "Trade Balance", impact: "MEDIUM", prev: "$2.8B", consensus: "$3.0B", actual: "--" },
  ];

  const keyRates = [
    { label: "BI Rate", value: 5.75, unit: "%", icon: Banknote, change: 0, trend: "neutral" },
    { label: "Inflation (CPI YoY)", value: 2.4, unit: "%", icon: TrendingUp, change: 0.3, trend: "up" },
    { label: "USD/IDR", value: 15650, unit: "", icon: Coins, change: 70, trend: "up" },
    { label: "10Y IDN Bond", value: 6.65, unit: "%", icon: Target, change: 0.07, trend: "up" },
  ];

  const indicatorsTable = [
    { indicator: "BI Rate", current: 5.75, previous: 5.75, change: 0, unit: "%", trend: "neutral", source: "BI" },
    { indicator: "Inflation (CPI YoY)", current: 2.4, previous: 2.1, change: 0.3, unit: "%", trend: "up", source: "BPS" },
    { indicator: "GDP (YoY)", current: 5.05, previous: 5.11, change: -0.06, unit: "%", trend: "down", source: "BPS" },
    { indicator: "PMI Manufacturing", current: 52.1, previous: 51.8, change: 0.3, unit: "", trend: "up", source: "BPS" },
    { indicator: "Trade Balance", current: 3.2, previous: 2.8, change: 0.4, unit: "B USD", trend: "up", source: "BPS" },
    { indicator: "Current Account", current: -0.8, previous: -1.2, change: 0.4, unit: "% GDP", trend: "up", source: "BI" },
    { indicator: "USD/IDR", current: 15650, previous: 15580, change: 70, unit: "", trend: "up", source: "BI" },
    { indicator: "10Y IDN Bond", current: 6.65, previous: 6.58, change: 0.07, unit: "%", trend: "up", source: "BI" },
  ];

  const upcomingSchedule = [
    { date: "2024-01-15", time: "09:00", country: "ID", event: "CPI YoY", impact: "HIGH", estimate: "2.3%" },
    { date: "2024-01-15", time: "19:30", country: "US", event: "CPI YoY", impact: "HIGH", estimate: "2.9%" },
    { date: "2024-01-15", time: "21:00", country: "US", event: "Fed Decision", impact: "HIGH", estimate: "5.25%" },
    { date: "2024-01-16", time: "20:30", country: "CN", event: "Industrial Production", impact: "MEDIUM", estimate: "6.5%" },
    { date: "2024-01-16", time: "08:30", country: "ID", event: "Trade Balance", impact: "MEDIUM", estimate: "$3.0B" },
    { date: "2024-01-17", time: "14:00", country: "ID", event: "BI Rate Decision", impact: "HIGH", estimate: "5.75%" },
    { date: "2024-01-18", time: "20:30", country: "US", event: "Retail Sales", impact: "MEDIUM", estimate: "0.3%" },
    { date: "2024-01-19", time: "09:30", country: "CN", event: "GDP QoQ", impact: "HIGH", estimate: "1.2%" },
  ];

  const newsList = [
    { date: "2024-01-15", title: "BI Holds Rate Steady at 5.75% Amid Stable Inflation", source: "Bloomberg", category: "Central Bank" },
    { date: "2024-01-14", title: "Indonesia Inflation Accelerates to 2.4% in December", source: "Reuters", category: "Inflation" },
    { date: "2024-01-13", title: "Rupiah Weakens Past 15,600 on Strong Dollar", source: "Financial Times", category: "FX" },
    { date: "2024-01-12", title: "Indonesia Trade Surplus Widens to $3.2B in November", source: "Nikkei Asia", category: "Trade" },
    { date: "2024-01-11", title: "Fed Minutes Signal Patience on Rate Cuts", source: "Wall Street Journal", category: "Global Macro" },
    { date: "2024-01-10", title: "Indonesia Q4 GDP Growth Beats Estimates at 5.05%", source: "The Jakarta Post", category: "GDP" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Macro Dashboard</h1>
        <p className="text-muted-foreground">Indonesia & Global macroeconomic indicators</p>
      </div>

      {/* Key Rates Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {keyRates.map((rate) => (
          <Card key={rate.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{rate.label}</CardTitle>
              <rate.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">
                {rate.value.toLocaleString()}{rate.unit}
              </div>
              <p className={cn(
                "text-sm mt-1",
                rate.trend === "up" && "text-green-600",
                rate.trend === "down" && "text-red-600",
                rate.trend === "neutral" && "text-muted-foreground"
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
        <CardHeader>
          <CardTitle className="text-base">Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
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
                {indicatorsTable.map((item) => (
                  <TableRow key={item.indicator}>
                    <TableCell className="font-medium">{item.indicator}</TableCell>
                    <TableCell className="font-mono font-semibold">{item.current.toLocaleString()}{item.unit}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{item.previous.toLocaleString()}{item.unit}</TableCell>
                    <TableCell className={cn(
                      "font-mono font-medium",
                      item.trend === "up" && "text-green-600",
                      item.trend === "down" && "text-red-600",
                      item.trend === "neutral" && "text-muted-foreground"
                    )}>
                      {item.trend === "up" && "+"}{item.change}{item.unit}
                      {item.trend === "neutral" && " ↔"}
                    </TableCell>
                    <TableCell>
                      {item.trend === "up" && (
                        <TrendingUp className="h-4 w-4 text-green-600 mx-auto" aria-hidden="true" />
                      )}
                      {item.trend === "down" && (
                        <TrendingDown className="h-4 w-4 text-red-600 mx-auto" aria-hidden="true" />
                      )}
                      {item.trend === "neutral" && (
                        <div className="w-4 h-4 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{item.source}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming Schedule</CardTitle>
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
                  <TableHead className="w-24">Estimate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingSchedule.map((event) => (
                  <TableRow key={`${event.date}-${event.time}-${event.event}`}>
                    <TableCell className="text-sm">{event.date}</TableCell>
                    <TableCell className="text-sm">{event.time}</TableCell>
                    <TableCell className="text-center text-sm font-medium">{event.country}</TableCell>
                    <TableCell className="font-medium">{event.event}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          event.impact === "HIGH" ? "destructive" :
                          event.impact === "MEDIUM" ? "warning" : "secondary"
                        }
                        className="text-xs"
                      >
                        {event.impact}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{event.estimate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* News List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">News</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {newsList.map((news) => (
              <div
                key={`${news.date}-${news.title}`}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex-shrink-0">
                  <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="sr-only">{news.date}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{news.title}</p>
                  <p className="text-xs text-muted-foreground">{news.source} • {news.category}</p>
                </div>
                <Button variant="ghost" size="sm" className="flex-shrink-0">
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  <span className="sr-only">Read more</span>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}