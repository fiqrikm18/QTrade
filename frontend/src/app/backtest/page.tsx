"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Target,
  AlertTriangle,
  Clock,
  Zap,
  Eye,
  ExternalLink,
  Download,
  RefreshCw,
  Play,
  X,
  Settings,
  Trash2,
  Edit,
  Plus,
  Filter,
  RotateCcw,
  ChevronUp,
  ChevronDown,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function BacktestPage() {
  const [activeStrategy, setActiveStrategy] = useState("momentum");
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<typeof mockResults.momentum | null>(null);

  const strategies = [
    {
      id: "momentum",
      name: "Momentum Strategy",
      description: "Buy stocks with strong 12-month momentum, rebalance monthly",
    },
    {
      id: "mean_reversion",
      name: "Mean Reversion",
      description: "Buy oversold stocks (RSI < 30), sell overbought (RSI > 70)",
    },
    {
      id: "breakout",
      name: "Breakout Strategy",
      description: "Buy on 20-day high breakout with volume confirmation",
    },
    {
      id: "factor_multi",
      name: "Multi-Factor",
      description: "Combined Value, Momentum, Quality factors with risk parity",
    },
    {
      id: "smart_money",
      name: "Smart Money Flow",
      description: "Follow institutional accumulation/distribution signals",
    },
  ];

  const mockResults = {
    momentum: {
      metrics: {
        cagr: 18.5,
        sharpe: 1.34,
        sortino: 1.89,
        maxDD: -14.2,
        calmar: 1.3,
        winRate: 58.3,
        profitFactor: 2.14,
        expectancy: 2.45,
        avgHold: 28,
        turnover: 1.45,
      },
      equity: [
        100, 102, 98, 105, 108, 112, 115, 110, 118, 122, 128, 135, 142, 145,
        148, 152, 155, 158, 162, 158, 165, 170, 175, 178, 182,
      ],
      trades: [
        {
          date: "2023-01-15",
          ticker: "BBCA",
          type: "BUY",
          price: 8500,
          shares: 1000,
          pnl: 500000,
        },
        {
          date: "2023-02-20",
          ticker: "BMRI",
          type: "BUY",
          price: 5800,
          shares: 2000,
          pnl: 800000,
        },
        {
          date: "2023-03-15",
          ticker: "TLKM",
          type: "SELL",
          price: 3200,
          shares: 5000,
          pnl: -150000,
        },
        {
          date: "2023-04-10",
          ticker: "BBRI",
          type: "BUY",
          price: 5200,
          shares: 3000,
          pnl: 250000,
        },
        {
          date: "2023-05-15",
          ticker: "BBCA",
          type: "SELL",
          price: 9200,
          shares: 1000,
          pnl: 700000,
        },
      ],
    },
  };

  const strategy = mockResults[activeStrategy as keyof typeof mockResults];

  const runBacktest = async () => {
    setIsRunning(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsRunning(false);
    setResults(strategy);
  };

  const metricCards = [
    { label: "CAGR", value: "18.5%", color: "text-green-600" },
    { label: "Sharpe", value: "1.34", color: "text-blue-600" },
    { label: "Sortino", value: "1.89", color: "text-purple-600" },
    { label: "Max DD", value: "-14.2%", color: "text-red-600" },
    { label: "Calmar", value: "1.30", color: "text-blue-600" },
    { label: "Win Rate", value: "58.3%", color: "text-green-600" },
    { label: "Profit Factor", value: "2.14", color: "text-blue-600" },
    { label: "Expectancy", value: "2.45", color: "text-green-600" },
    { label: "Avg Hold", value: "28 days", color: "text-muted-foreground" },
    { label: "Turnover", value: "1.45x", color: "text-muted-foreground" },
  ];

  const tradeLogData = [
    {
      date: "2023-01-15",
      ticker: "BBCA",
      type: "BUY",
      price: 8500,
      shares: 1000,
      pnl: 500000,
      ret: 5.9,
      days: 45,
    },
    {
      date: "2023-02-20",
      ticker: "BMRI",
      type: "BUY",
      price: 5800,
      shares: 2000,
      pnl: 800000,
      ret: 13.8,
      days: 62,
    },
    {
      date: "2023-03-15",
      ticker: "TLKM",
      type: "SELL",
      price: 3200,
      shares: 5000,
      pnl: -150000,
      ret: -4.7,
      days: 28,
    },
    {
      date: "2023-04-10",
      ticker: "BBRI",
      type: "BUY",
      price: 5200,
      shares: 3000,
      pnl: 250000,
      ret: 8.2,
      days: 18,
    },
    {
      date: "2023-05-15",
      ticker: "BBCA",
      type: "SELL",
      price: 9200,
      shares: 1000,
      pnl: 700000,
      ret: 8.2,
      days: 62,
    },
  ];

  const monthlyData = [
    { month: "Jan 2023", port: 2.45, bench: 1.82, excess: 0.63, cum: 2.45 },
    { month: "Feb 2023", port: 1.87, bench: 1.45, excess: 0.42, cum: 4.36 },
    { month: "Mar 2023", port: -0.85, bench: -1.12, excess: 0.27, cum: 3.48 },
    { month: "Apr 2023", port: 3.12, bench: 2.67, excess: 0.45, cum: 6.71 },
    { month: "May 2023", port: 1.23, bench: 0.89, excess: 0.34, cum: 7.98 },
    { month: "Jun 2023", port: 2.01, bench: 1.78, excess: 0.23, cum: 10.16 },
    { month: "Jul 2023", port: -0.45, bench: -0.67, excess: 0.22, cum: 9.65 },
    { month: "Aug 2023", port: 1.56, bench: 1.23, excess: 0.33, cum: 11.87 },
    { month: "Sep 2023", port: 2.34, bench: 1.89, excess: 0.45, cum: 14.52 },
    { month: "Oct 2023", port: 0.78, bench: 0.56, excess: 0.22, cum: 15.41 },
    { month: "Nov 2023", port: -0.32, bench: -0.78, excess: 0.46, cum: 14.98 },
    { month: "Dec 2023", port: 1.45, bench: 1.12, excess: 0.33, cum: 16.89 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Backtesting Lab</h1>
          <p className="text-muted-foreground">
            Test and validate quantitative strategies on historical data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setResults(null)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={() => setResults(strategy)}>
            <Download className="mr-2 h-4 w-4" />
            Export Results
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={activeStrategy} onValueChange={setActiveStrategy}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select strategy" />
              </SelectTrigger>
              <SelectContent>
                {strategies.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              {strategies.find((s) => s.id === activeStrategy)?.description}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Start Date
                </label>
                <Input type="date" defaultValue="2022-01-01" className="h-9" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  End Date
                </label>
                <Input type="date" defaultValue="2024-12-31" className="h-9" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Universe</CardTitle>
          </CardHeader>
          <CardContent>
            <Select defaultValue="idx_all">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select universe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="idx_all">All IDX Stocks</SelectItem>
                <SelectItem value="idx_lq45">LQ45</SelectItem>
                <SelectItem value="idx30">IDX30</SelectItem>
                <SelectItem value="custom">Custom Watchlist</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">~800 stocks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Capital</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input type="number" defaultValue="1000000000" className="w-32" />
              <span className="text-muted-foreground">IDR</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" className="rounded" defaultChecked />
                Fees (0.15%+0.25%)
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" className="rounded" defaultChecked />
                Slippage (0.1%)
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2 mb-6">
        <Button
          variant="outline"
          size="lg"
          onClick={runBacktest}
          disabled={isRunning}
          className="w-48"
        >
          {isRunning ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Backtest
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => setResults(null)}
          disabled={isRunning}
          className="w-48"
        >
          <X className="mr-2 h-4 w-4" />
          Stop
        </Button>
      </div>

      {strategy && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Performance Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {metricCards.map((metric) => (
                <Card key={metric.label} className="bg-muted/50">
                  <CardContent className="p-4">
                    <p
                      className="text-2xl font-bold"
                      style={{ color: metric.color }}
                    >
                      {metric.value}
                    </p>
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Equity Curve</h2>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Equity Curve</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground">
                  [Equity Curve Chart - Integrate Recharts or Chart.js]
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Equity Curve</p>
                    <p className="text-xs text-muted-foreground">
                      Starting: 100 → Ending: 182 (+82%)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Drawdown</h2>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Drawdown Chart</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground">
                  [Drawdown Chart - Peak to Valley]
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Max DD: -14.2%</p>
                    <p className="text-xs text-muted-foreground">
                      Avg DD Duration: 45 days
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Recovery Time: 67 days avg
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Trade Log</h2>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Trade Log</CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Ticker</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Shares</TableHead>
                        <TableHead className="text-right">P&L</TableHead>
                        <TableHead className="text-right">Return</TableHead>
                        <TableHead className="text-center">Hold Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tradeLogData.map((trade) => (
                        <TableRow key={trade.date}>
                          <TableCell>{trade.date}</TableCell>
                          <TableCell className="font-medium">{trade.ticker}</TableCell>
                          <TableCell>
                            <Badge
                              variant={trade.type === "BUY" ? "success" : "destructive"}
                              className="text-xs"
                            >
                              {trade.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {trade.price.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {trade.shares.toLocaleString()}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              trade.pnl >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {trade.pnl >= 0 ? "+" : ""}{trade.pnl.toLocaleString()}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              trade.ret >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {trade.ret >= 0 ? "+" : ""}{trade.ret}%
                          </TableCell>
                          <TableCell className="text-center">{trade.days}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Monthly Returns</h2>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly Returns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-center">Portfolio</TableHead>
                        <TableHead className="text-center">Benchmark</TableHead>
                        <TableHead className="text-center">Excess</TableHead>
                        <TableHead className="text-center">Cumulative</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyData.map((m) => (
                        <TableRow key={m.month}>
                          <TableCell className="font-medium">{m.month}</TableCell>
                          <TableCell className="text-center">
                            {m.port >= 0 ? "+" : ""}{m.port}%
                          </TableCell>
                          <TableCell className="text-center">
                            {m.bench >= 0 ? "+" : ""}{m.bench}%
                          </TableCell>
                          <TableCell
                            className={`text-center font-medium ${
                              m.excess >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {m.excess >= 0 ? "+" : ""}{m.excess}%
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {m.cum >= 0 ? "+" : ""}{m.cum}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}