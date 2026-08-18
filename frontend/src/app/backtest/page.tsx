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
  Loader2,
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
import { runBacktest, getBacktest, type BacktestRunRequest, type BacktestDetail } from "@/lib/api";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: BacktestDetail };

export default function BacktestPage() {
  const [activeStrategy, setActiveStrategy] = useState("momentum");
  const [isRunning, setIsRunning] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [backtestId, setBacktestId] = useState<number | null>(null);

  const strategies = [
    {
      id: "momentum",
      name: "Momentum Strategy",
      description: "Buy stocks with strong 12-month momentum, rebalance monthly",
      strategy: { type: "momentum", lookback: 252, rebalance: "monthly" },
      universe: { type: "idx_all" },
    },
    {
      id: "mean_reversion",
      name: "Mean Reversion",
      description: "Buy oversold stocks (RSI < 30), sell overbought (RSI > 70)",
      strategy: { type: "mean_reversion", rsi_period: 14, oversold: 30, overbought: 70 },
      universe: { type: "idx_all" },
    },
    {
      id: "breakout",
      name: "Breakout Strategy",
      description: "Buy on 20-day high breakout with volume confirmation",
      strategy: { type: "breakout", lookback: 20, volume_mult: 1.5 },
      universe: { type: "idx_all" },
    },
    {
      id: "factor_multi",
      name: "Multi-Factor",
      description: "Combined Value, Momentum, Quality factors with risk parity",
      strategy: { type: "factor_multi", factors: ["value", "momentum", "quality"], weighting: "risk_parity" },
      universe: { type: "idx_all" },
    },
    {
      id: "smart_money",
      name: "Smart Money Flow",
      description: "Follow institutional accumulation/distribution signals",
      strategy: { type: "smart_money", threshold: 70 },
      universe: { type: "idx_all" },
    },
  ];

  const runBacktestHandler = async () => {
    const selectedStrategy = strategies.find((s) => s.id === activeStrategy);
    if (!selectedStrategy) return;

    setIsRunning(true);
    setState({ status: "loading" });

    const requestData: BacktestRunRequest = {
      strategy: selectedStrategy.strategy,
      universe: selectedStrategy.universe,
      start: "2022-01-01",
      end: "2024-12-31",
      scoring_version: "v1",
      model_version: null,
      buy_fee: 0.0015,
      sell_fee: 0.0025,
      top_n: 5,
      max_weight: 0.2,
      seed: 42,
    };

    try {
      const result = await runBacktest(requestData);
      setBacktestId(result.backtest_id);
      const detail = await getBacktest(result.backtest_id);
      setState({ status: "ready", data: detail });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to run backtest",
      });
    } finally {
      setIsRunning(false);
    }
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
          <Button variant="outline" size="sm" onClick={() => { setState({ status: "idle" }); setBacktestId(null); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button variant="outline" size="sm" disabled={state.status !== "ready"}>
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
          onClick={runBacktestHandler}
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
          onClick={() => { setState({ status: "idle" }); setBacktestId(null); }}
          disabled={isRunning}
          className="w-48"
        >
          <X className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>

      {state.status === "loading" && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {state.status === "error" && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to run backtest</p>
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Button className="mt-4" onClick={runBacktestHandler}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {state.status === "ready" && (() => {
        const data = state.data;
        const metrics = data.metrics || {};
        const trades = data.trades || [];
        
        const metricCards = [
          { label: "CAGR", value: `${(metrics.cagr ?? 0).toFixed(1)}%`, color: "text-green-600" },
          { label: "Sharpe", value: (metrics.sharpe ?? 0).toFixed(2), color: "text-blue-600" },
          { label: "Sortino", value: (metrics.sortino ?? 0).toFixed(2), color: "text-purple-600" },
          { label: "Max DD", value: `${(metrics.max_drawdown ?? metrics.maxDD ?? 0).toFixed(1)}%`, color: "text-red-600" },
          { label: "Calmar", value: (metrics.calmar ?? 0).toFixed(2), color: "text-blue-600" },
          { label: "Win Rate", value: `${(metrics.win_rate ?? metrics.winRate ?? 0).toFixed(1)}%`, color: "text-green-600" },
          { label: "Profit Factor", value: (metrics.profit_factor ?? metrics.profitFactor ?? 0).toFixed(2), color: "text-blue-600" },
          { label: "Expectancy", value: (metrics.expectancy ?? 0).toFixed(2), color: "text-green-600" },
          { label: "Avg Hold", value: `${metrics.avg_hold ?? metrics.avgHold ?? 0} days`, color: "text-muted-foreground" },
          { label: "Turnover", value: `${(metrics.turnover ?? 0).toFixed(2)}x`, color: "text-muted-foreground" },
        ];

        return (
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
                        {metrics.equity_curve ? `Points: ${metrics.equity_curve.length}` : 'No equity curve data'}
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
                      <p className="text-sm text-muted-foreground">Max DD: {(metrics.max_drawdown ?? metrics.maxDD ?? 0).toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">
                        Avg DD Duration: {metrics.avg_dd_duration ?? 'N/A'} days
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Recovery Time: {metrics.recovery_time ?? 'N/A'} days avg
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
                        {trades.map((trade, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{trade.entry_date}</TableCell>
                            <TableCell className="font-medium">{trade.ticker}</TableCell>
                            <TableCell>
                              <Badge
                                variant={trade.exit_reason === "take_profit" ? "success" : trade.exit_reason === "stop_loss" ? "destructive" : "default"}
                                className="text-xs"
                              >
                                {trade.exit_reason ?? "CLOSE"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {trade.entry_price?.toLocaleString() ?? "--"}
                            </TableCell>
                            <TableCell className="text-right">
                              {trade.shares?.toLocaleString() ?? "--"}
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${
                                (trade.pnl ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {(trade.pnl ?? 0) >= 0 ? "+" : ""}{(trade.pnl ?? 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              --%
                            </TableCell>
                            <TableCell className="text-center">
                              {trade.entry_date && trade.exit_date 
                                ? Math.ceil((new Date(trade.exit_date).getTime() - new Date(trade.entry_date).getTime()) / (1000 * 60 * 60 * 24))
                                : "--"}
                            </TableCell>
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
                        {(metrics.monthly_returns || []).map((m: {month: string, portfolio: number, benchmark: number, excess: number, cumulative: number}) => (
                          <TableRow key={m.month}>
                            <TableCell className="font-medium">{m.month}</TableCell>
                            <TableCell className="text-center">{m.portfolio >= 0 ? "+" : ""}{m.portfolio.toFixed(2)}%</TableCell>
                            <TableCell className="text-center">{m.benchmark >= 0 ? "+" : ""}{m.benchmark.toFixed(2)}%</TableCell>
                            <TableCell className={`text-center font-medium ${m.excess >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {m.excess >= 0 ? "+" : ""}{m.excess.toFixed(2)}%
                            </TableCell>
                            <TableCell className="text-center font-medium">{m.cumulative >= 0 ? "+" : ""}{m.cumulative.toFixed(2)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      })()}
    </div>
  );
}