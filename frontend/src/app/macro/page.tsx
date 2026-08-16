"use client"

import { AppShell } from "@/components/ui/appshell"
import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Globe, AlertTriangle, Clock, Zap, Target, AlertCircle, ArrowUp, ArrowDown, DollarSign as DollarSignIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useState } from "react"

export default function MacroPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const indonesiaMacro = [
    { indicator: "BI Rate", current: 5.75, previous: 5.75, change: 0, unit: "%", trend: "neutral", source: "BI" },
    { indicator: "Inflation (CPI YoY)", current: 2.4, previous: 2.1, change: 0.3, unit: "%", trend: "up", source: "BPS" },
    { indicator: "GDP (YoY)", current: 5.05, previous: 5.11, change: -0.06, unit: "%", trend: "down", source: "BPS" },
    { indicator: "PMI Manufacturing", current: 52.1, previous: 51.8, change: 0.3, unit: "", trend: "up", source: "BPS" },
    { indicator: "Trade Balance", current: 3.2, previous: 2.8, change: 0.4, unit: "B USD", trend: "up", source: "BPS" },
    { indicator: "Current Account", current: -0.8, previous: -1.2, change: 0.4, unit: "% GDP", trend: "up", source: "BI" },
    { indicator: "USD/IDR", current: 15650, previous: 15580, change: 70, unit: "", trend: "up", source: "BI" },
    { indicator: "10Y IDN Bond", current: 6.65, previous: 6.58, change: 0.07, unit: "%", trend: "up", source: "BI" },
  ]

  const globalMacro = [
    { indicator: "Fed Funds Rate", current: 5.25, previous: 5.25, change: 0, unit: "%", trend: "neutral", source: "Fed" },
    { indicator: "US CPI YoY", current: 3.1, previous: 3.2, change: -0.1, unit: "%", trend: "down", source: "BLS" },
    { indicator: "US Nonfarm Payrolls", current: 275, previous: 216, change: 59, unit: "K", trend: "up", source: "BLS" },
    { indicator: "US 10Y Yield", current: 4.12, previous: 4.08, change: 0.04, unit: "%", trend: "up", source: "US Treasury" },
    { indicator: "DXY", current: 103.45, previous: 102.8, change: 0.65, unit: "", trend: "up", source: "ICE" },
    { indicator: "S&P 500", current: 4850, previous: 4780, change: 70, unit: "", trend: "up", source: "S&P" },
    { indicator: "China PMI", current: 50.8, previous: 50.5, change: 0.3, unit: "", trend: "up", source: "NBS" },
    { indicator: "China GDP", current: 5.2, previous: 4.9, change: 0.3, unit: "%", trend: "up", source: "NBS" },
  ]

  const commodities = [
    { name: "Oil (Brent)", price: 82.50, change: 1.20, unit: "USD/bbl", trend: "up" },
    { name: "Gold", price: 2035, change: -5.50, unit: "USD/oz", trend: "down" },
    { name: "Coal", price: 135, change: 2.5, unit: "USD/t", trend: "up" },
    { name: "CPO", price: 3950, change: -25, unit: "MYR/t", trend: "down" },
    { name: "Nickel", price: 16500, change: 150, unit: "USD/t", trend: "up" },
    { name: "Copper", price: 8450, change: 45, unit: "USD/t", trend: "up" },
  ]

  const macroEvents = [
    { time: "09:00", country: "ID", event: "CPI YoY", impact: "HIGH", prev: "2.1%", consensus: "2.3%", actual: "2.4%" },
    { time: "19:30", country: "US", event: "CPI YoY", impact: "HIGH", prev: "3.0%", consensus: "2.9%", actual: "--" },
    { time: "21:00", country: "US", event: "Fed Decision", impact: "HIGH", prev: "5.25%", consensus: "5.25%", actual: "--" },
    { time: "20:30", country: "CN", event: "Industrial Production", impact: "MEDIUM", prev: "6.2%", consensus: "6.5%", actual: "--" },
    { time: "08:30", country: "ID", event: "Trade Balance", impact: "MEDIUM", prev: "$2.8B", consensus: "$3.0B", actual: "--" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Macro Dashboard</h1>
          <p className="text-muted-foreground">Indonesia & Global macroeconomic indicators</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Indonesia Macro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {indonesiaMacro.map((item) => (
                <div key={item.indicator} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.indicator}</p>
                    <p className="text-xs text-muted-foreground">{item.source}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold">
                      {item.current.toLocaleString()}{item.unit}
                    </p>
                    <p className={`text-xs ${item.trend === "up" ? "text-green-600" : item.trend === "down" ? "text-red-600" : "text-muted-foreground"}`}>
                      {item.trend === "up" && "+"}{item.change}{item.trend === "up" || item.trend === "down" ? item.unit : ""}
                      {item.trend === "neutral" && " ↔"}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Global Macro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {globalMacro.map((item) => (
                <div key={item.indicator} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.indicator}</p>
                    <p className="text-xs text-muted-foreground">{item.source}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold">
                      {item.current.toLocaleString()}{item.unit}
                    </p>
                    <p className={`text-xs ${item.trend === "up" ? "text-green-600" : item.trend === "down" ? "text-red-600" : "text-muted-foreground"}`}>
                      {item.trend === "up" && "+"}{item.change}{item.trend === "up" || item.trend === "down" ? item.unit : ""}
                      {item.trend === "neutral" && " ↔"}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Commodities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {commodities.map((item) => (
                <div key={item.name} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold">
                      {item.price.toLocaleString()}{item.unit}
                    </p>
                    <p className={`text-xs ${item.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                      {item.change > 0 ? "+" : ""}{item.change}{item.unit}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Economic Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Time</TableHead>
                    <TableHead className="w-16">Country</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead className="w-16">Impact</TableHead>
                    <TableHead className="w-20">Prev</TableHead>
                    <TableHead className="w-20">Consensus</TableHead>
                    <TableHead className="w-20">Actual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {macroEvents.map((event) => (
                    <TableRow key={event.event}>
                      <TableCell>{event.time}</TableCell>
                      <TableCell className="text-center">{event.country}</TableCell>
                      <TableCell className="font-medium">{event.event}</TableCell>
                      <TableCell>
                        <Badge variant={
                          event.impact === "HIGH" ? "destructive" :
                          event.impact === "MEDIUM" ? "warning" : "secondary"
                        } className="text-xs">
                          {event.impact}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{event.prev}</TableCell>
                      <TableCell className="text-right">{event.consensus}</TableCell>
                      <TableCell className="text-right">{event.actual}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Macro Risk / Support Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="text-base text-red-700">Macro Risk Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-red-600">68</div>
                  <p className="text-sm text-muted-foreground">Elevated risk</p>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span>USD/IDR depreciation</span><span className="text-red-600">High</span></div>
                    <div className="flex justify-between"><span>US yield rise</span><span className="text-red-600">High</span></div>
                    <div className="flex justify-between"><span>Commodity volatility</span><span className="text-yellow-600">Medium</span></div>
                    <div className="flex justify-between"><span>Global equity volatility</span><span className="text-yellow-600">Medium</span></div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="text-base text-green-700">Macro Support Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-green-600">42</div>
                  <p className="text-sm text-muted-foreground">Limited support</p>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span>BI rate stance</span><span className="text-yellow-600">Neutral</span></div>
                    <div className="flex justify-between"><span>Trade balance</span><span className="text-green-600">Positive</span></div>
                    <div className="flex justify-between"><span>Current account</span><span className="text-red-600">Deficit</span></div>
                    <div className="flex justify-between"><span>Global growth</span><span className="text-yellow-600">Moderate</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}