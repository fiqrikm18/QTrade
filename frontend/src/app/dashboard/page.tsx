"use client";

import { AppShell } from "@/components/ui/appshell";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  LayoutDashboard,
  BarChart3,
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

export default function DashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Mock data for the dashboard
  const marketData = {
    ihsg: { price: 7812.45, change: 95.22, changePct: 1.24 },
    regime: "BULLISH",
    confidence: 82,
  };

  const breadthData = {
    advance: 312,
    decline: 184,
    aboveSma20: 64,
    aboveSma50: 58,
  };

  const topOpportunities = [
    { rank: 1, ticker: "BBCA", score: 92 },
    { rank: 2, ticker: "BMRI", score: 89 },
    { rank: 3, ticker: "TLKM", score: 86 },
    { rank: 4, ticker: "BBRI", score: 84 },
    { rank: 5, ticker: "TLKM", score: 81 },
  ];

  const topGainers = [
    { ticker: "BBCA", price: 9125, change: 1.42 },
    { ticker: "BMRI", price: 6250, change: 2.13 },
    { ticker: "BBRI", price: 5180, change: 0.97 },
  ];

  const topLosers = [
    { ticker: "TLKM", price: 3010, change: -0.33 },
    { ticker: "ASII", price: 5200, change: -1.12 },
    { ticker: "UNTR", price: 23400, change: -2.05 },
  ];

  const sectorRotation = [
    {
      sector: "BANKING",
      perf1d: 2.1,
      perf5d: 4.2,
      perf20d: 7.8,
      rs: 91,
      score: 89,
    },
    {
      sector: "ENERGY",
      perf1d: 1.7,
      perf5d: 5.8,
      perf20d: 3.1,
      rs: 84,
      score: 82,
    },
    {
      sector: "TELCO",
      perf1d: -0.3,
      perf5d: 1.1,
      perf20d: 2.4,
      rs: 63,
      score: 65,
    },
    {
      sector: "PROPERTY",
      perf1d: -1.2,
      perf5d: -2.4,
      perf20d: -4.8,
      rs: 42,
      score: 44,
    },
  ];

  const macroEvents = [
    {
      time: "09:00",
      country: "ID",
      event: "CPI",
      impact: "HIGH",
      prev: "2.1%",
      consensus: "2.3%",
      actual: "2.4%",
    },
    {
      time: "19:30",
      country: "US",
      event: "CPI",
      impact: "HIGH",
      prev: "3.0%",
      consensus: "2.9%",
      actual: "--",
    },
    {
      time: "21:00",
      country: "US",
      event: "Fed Decision",
      impact: "HIGH",
      prev: "5.25",
      consensus: "5.25",
      actual: "--",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Market Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">IHSG</p>
              <p className="text-3xl font-bold">
                {marketData.ihsg.price.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-500">
                +{marketData.ihsg.changePct}%
              </p>
              <p className="text-sm text-green-500">
                +{marketData.ihsg.change.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
              {marketData.regime}
            </span>
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
              Risk-On
            </span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Volume</p>
          <p className="text-2xl font-bold">12.4T</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Turnover</p>
          <p className="text-2xl font-bold">842.3B</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Market Regime */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Market Regime</CardTitle>
              <Badge variant="success" className="text-xs">
                {marketData.regime}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{marketData.confidence}%</div>
              <p className="text-sm text-muted-foreground">Confidence</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Trend</span>
                  <span className="font-medium">Strong</span>
                </div>
                <div className="flex justify-between">
                  <span>Breadth</span>
                  <span className="font-medium">Positive</span>
                </div>
                <div className="flex justify-between">
                  <span>Momentum</span>
                  <span className="font-medium">Positive</span>
                </div>
                <div className="flex justify-between">
                  <span>Volatility</span>
                  <span className="font-medium">Normal</span>
                </div>
                <div className="flex justify-between">
                  <span>Macro</span>
                  <span className="font-medium text-green-600">Supportive</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Market Breadth */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Market Breadth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {breadthData.advance}
                  </p>
                  <p className="text-xs text-muted-foreground">Advance</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">
                    {breadthData.decline}
                  </p>
                  <p className="text-xs text-muted-foreground">Decline</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {breadthData.aboveSma20}%
                  </p>
                  <p className="text-xs text-muted-foreground">Above SMA20</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">
                    {breadthData.aboveSma50}%
                  </p>
                  <p className="text-xs text-muted-foreground">Above SMA50</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Above SMA200</span>
                  <span className="font-medium">{breadthData.aboveSma50}%</span>
                </div>
                <div className="flex justify-between">
                  <span>RSI Breadth</span>
                  <span className="font-medium">62%</span>
                </div>
                <div className="flex justify-between">
                  <span>Volume Breadth</span>
                  <span className="font-medium">58%</span>
                </div>
                <div className="flex justify-between">
                  <span>Breakout Breadth</span>
                  <span className="font-medium">45%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Opportunities / Sector Rotation */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Top Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead className="w-20">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topOpportunities.map((item) => (
                    <TableRow key={item.ticker}>
                      <TableCell className="font-medium">{item.rank}</TableCell>
                      <TableCell className="font-medium">
                        {item.ticker}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{item.score}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Sector Rotation</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sector</TableHead>
                    <TableHead className="w-20">1D</TableHead>
                    <TableHead className="w-20">5D</TableHead>
                    <TableHead className="w-20">20D</TableHead>
                    <TableHead className="w-20">RS</TableHead>
                    <TableHead className="w-20">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectorRotation.map((sector) => (
                    <TableRow key={sector.sector}>
                      <TableCell className="font-medium">
                        {sector.sector}
                      </TableCell>
                      <TableCell
                        className={
                          sector.perf1d >= 0 ? "text-green-600" : "text-red-600"
                        }
                      >
                        {sector.perf1d > 0 ? "+" : ""}
                        {sector.perf1d}%
                      </TableCell>
                      <TableCell
                        className={
                          sector.perf5d >= 0 ? "text-green-600" : "text-red-600"
                        }
                      >
                        {sector.perf5d > 0 ? "+" : ""}
                        {sector.perf5d}%
                      </TableCell>
                      <TableCell
                        className={
                          sector.perf20d >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {sector.perf20d > 0 ? "+" : ""}
                        {sector.perf20d}%
                      </TableCell>
                      <TableCell className="font-medium">{sector.rs}</TableCell>
                      <TableCell>
                        <Badge variant="default">{sector.score}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Gainers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Top Gainers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead className="w-24">Price</TableHead>
                  <TableHead className="w-24">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topGainers.map((item) => (
                  <TableRow key={item.ticker}>
                    <TableCell className="font-medium">{item.ticker}</TableCell>
                    <TableCell>{item.price.toLocaleString()}</TableCell>
                    <TableCell className="text-green-600 font-medium">
                      +{item.change}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top Losers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Top Losers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead className="w-24">Price</TableHead>
                  <TableHead className="w-24">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topLosers.map((item) => (
                  <TableRow key={item.ticker}>
                    <TableCell className="font-medium">{item.ticker}</TableCell>
                    <TableCell>{item.price.toLocaleString()}</TableCell>
                    <TableCell className="text-red-600 font-medium">
                      {item.change}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Macro Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Macro Events</CardTitle>
          </CardHeader>
          <CardContent>
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
                    <TableCell className="text-center">
                      {event.country}
                    </TableCell>
                    <TableCell className="font-medium">{event.event}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          event.impact === "HIGH"
                            ? "destructive"
                            : event.impact === "MEDIUM"
                              ? "warning"
                              : "secondary"
                        }
                        className="text-xs"
                      >
                        {event.impact}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{event.prev}</TableCell>
                    <TableCell className="text-right">
                      {event.consensus}
                    </TableCell>
                    <TableCell className="text-right">{event.actual}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
