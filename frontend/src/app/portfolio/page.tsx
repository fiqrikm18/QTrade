"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUp,
  ArrowDown,
  Target,
  AlertTriangle,
  Clock,
  Zap,
  Shield,
  RefreshCw,
  Plus,
  Minus,
  Settings,
  Download,
  PieChart,
  Trash2,
  Edit,
  Activity,
  Wallet,
  GitCompare,
  Search,
  List,
  Globe,
  Calendar,
  Briefcase,
  FileText,
  Tag,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Eye,
  Copy,
  Bookmark,
  Sparkles,
  Gauge,
  Percent,
  Building2,
  Landmark,
  Scale,
  Layers,
  Database,
  Save,
  User,
  Mail,
  Lock,
  Key,
  MoreHorizontal,
  LineChart,
  Coins,
  Banknote,
  Columns2,
  Crosshair,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState("overview");

  // Mock portfolio data
  const portfolio = {
    totalValue: 1250000000,
    totalCost: 1100000000,
    totalPnL: 150000000,
    totalPnLPct: 13.64,
    dailyPnL: 2500000,
    dailyPnLPct: 0.20,
    cash: 50000000,
    positions: [
      { ticker: "BBCA", name: "Bank Central Asia", shares: 50000, avgCost: 8500, currentPrice: 9125, marketValue: 456250000, cost: 425000000, pnl: 31250000, pnlPct: 7.35, weight: 36.5, sector: "BANKING", beta: 1.12, sharpe: 1.45, var95: 2.8 },
      { ticker: "BMRI", name: "Bank Mandiri", shares: 80000, avgCost: 5800, currentPrice: 6250, marketValue: 500000000, cost: 464000000, pnl: 36000000, pnlPct: 7.76, weight: 40.0, sector: "BANKING", beta: 1.15, sharpe: 1.38, var95: 3.1 },
      { ticker: "TLKM", name: "Telkom Indonesia", shares: 30000, avgCost: 3200, currentPrice: 3010, marketValue: 90300000, cost: 96000000, pnl: -5700000, pnlPct: -5.94, weight: 7.2, sector: "TELCO", beta: 0.85, sharpe: 0.92, var95: 1.9 },
      { ticker: "BBRI", name: "Bank Rakyat Indonesia", shares: 60000, avgCost: 4800, currentPrice: 5180, marketValue: 310800000, cost: 288000000, pnl: 22800000, pnlPct: 7.92, weight: 24.8, sector: "BANKING", beta: 1.08, sharpe: 1.32, var95: 2.5 },
      { ticker: "ASII", name: "Astra International", shares: 20000, avgCost: 5500, currentPrice: 5200, marketValue: 104000000, cost: 110000000, pnl: -6000000, pnlPct: -5.45, weight: 8.3, sector: "AUTOMOTIVE", beta: 1.25, sharpe: 0.88, var95: 3.2 },
    ],
  };

  const sectorAllocation = [
    { sector: "BANKING", value: 1267050000, pct: 92.5, color: "bg-blue-500" },
    { sector: "TELCO", value: 90300000, pct: 6.6, color: "bg-green-500" },
    { sector: "AUTOMOTIVE", value: 104000000, pct: 7.6, color: "bg-yellow-500" },
    { sector: "CASH", value: 50000000, pct: 3.7, color: "bg-gray-500" },
  ];

  const factorExposure = [
    { factor: "Market", exposure: 1.05, contrib: 0.85, color: "bg-blue-500" },
    { factor: "Size", exposure: -0.15, contrib: -0.08, color: "bg-red-500" },
    { factor: "Value", exposure: 0.25, contrib: 0.18, color: "bg-green-500" },
    { factor: "Momentum", exposure: 0.35, contrib: 0.28, color: "bg-blue-500" },
    { factor: "Quality", exposure: 0.45, contrib: 0.32, color: "bg-purple-500" },
    { factor: "Volatility", exposure: -0.10, contrib: -0.05, color: "bg-red-500" },
    { factor: "Liquidity", exposure: 0.20, contrib: 0.12, color: "bg-yellow-500" },
  ];

  const riskMetrics = {
    portfolioVol: 14.2,
    portfolioBeta: 1.08,
    var95: 2.8,
    var99: 4.2,
    maxDrawdown: 12.4,
    sharpeRatio: 1.24,
    sortinoRatio: 1.68,
    trackingError: 3.2,
    infoRatio: 0.45,
  };

  const correlationMatrix = [
    { asset: "BBCA", BBCA: 1.00, BMRI: 0.85, TLKM: 0.35, BBRI: 0.78, ASII: 0.42 },
    { asset: "BMRI", BBCA: 0.85, BMRI: 1.00, TLKM: 0.28, BBRI: 0.82, ASII: 0.38 },
    { asset: "TLKM", BBCA: 0.35, BMRI: 0.28, TLKM: 1.00, BBRI: 0.22, ASII: 0.15 },
    { asset: "BBRI", BBCA: 0.78, BMRI: 0.82, TLKM: 0.22, BBRI: 1.00, ASII: 0.35 },
    { asset: "ASII", BBCA: 0.42, BMRI: 0.38, TLKM: 0.15, BBRI: 0.35, ASII: 1.00 },
  ];

  const monthlyReturns = [
    { month: "Jan 2024", port: 2.45, bench: 1.82, excess: 0.63, cum: 2.45 },
    { month: "Feb 2024", port: 1.87, bench: 1.45, excess: 0.42, cum: 4.36 },
    { month: "Mar 2024", port: -0.85, bench: -1.12, excess: 0.27, cum: 3.48 },
    { month: "Apr 2024", port: 3.12, bench: 2.67, excess: 0.45, cum: 6.71 },
    { month: "May 2024", port: 1.23, bench: 0.89, excess: 0.34, cum: 7.98 },
    { month: "Jun 2024", port: 2.01, bench: 1.78, excess: 0.23, cum: 10.16 },
  ];

  const transactions = [
    { date: "2024-01-15", ticker: "BBCA", type: "BUY", shares: 5000, price: 9000, value: 45000000, fees: 45000, net: 45045000 },
    { date: "2024-01-10", ticker: "BMRI", type: "BUY", shares: 10000, price: 6100, value: 61000000, fees: 61000, net: 61061000 },
    { date: "2024-01-08", ticker: "TLKM", type: "SELL", shares: 5000, price: 3050, value: 15250000, fees: 15250, net: 15234750 },
    { date: "2024-01-05", ticker: "BBRI", type: "BUY", shares: 8000, price: 5050, value: 40400000, fees: 40400, net: 40440400 },
    { date: "2024-01-03", ticker: "ASII", type: "SELL", shares: 3000, price: 5300, value: 15900000, fees: 15900, net: 15884100 },
  ];

  const topHoldings = [
    { ticker: "BBCA", name: "Bank Central Asia", weight: 36.5, pnl: 7.35 },
    { ticker: "BMRI", name: "Bank Mandiri", weight: 40.0, pnl: 7.76 },
    { ticker: "TLKM", name: "Telkom Indonesia", weight: 7.2, pnl: -5.94 },
    { ticker: "BBRI", name: "Bank Rakyat Indonesia", weight: 24.8, pnl: 7.92 },
    { ticker: "ASII", name: "Astra International", weight: 7.6, pnl: -5.45 },
  ];

  return (
    <div className="space-y-6">
      {/* Portfolio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Portfolio Analytics</h1>
          <p className="text-muted-foreground">Portfolio performance, risk, and attribution analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Position
          </Button>
        </div>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">Rp 1.25B</div>
            <p className="text-sm text-muted-foreground">Cash: Rp 50M</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">+Rp 150.0M</div>
            <p className="text-sm text-green-600">+13.64% since inception</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Daily P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">+Rp 2.5M</div>
            <p className="text-sm text-green-600">+0.20% today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sharpe Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1.24</div>
            <p className="text-sm text-muted-foreground">Sortino: 1.68</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Max Drawdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">12.4%</div>
            <p className="text-sm text-muted-foreground">VaR 95%: 2.8%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="holdings">Holdings</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Sector Allocation & Top Holdings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Sector Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sectorAllocation.map((item) => (
                    <div key={item.sector} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color.replace("bg-", "").replace("-500", "") }} />
                        <span className="text-sm font-medium">{item.sector}</span>
                      </div>
                      <span className="font-medium">{item.pct}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Top Holdings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topHoldings.map((holding) => (
                    <div key={holding.ticker} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{holding.ticker}</span>
                        <span className="text-sm text-muted-foreground">{holding.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-medium">{holding.weight}%</span>
                        <Badge variant={holding.pnl >= 0 ? "success" : "destructive"} className="text-xs">
                          {holding.pnl >= 0 ? "+" : ""}{holding.pnl}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Risk Metrics */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Risk Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Portfolio Volatility", value: "14.2%", desc: "Annualized" },
                  { label: "Portfolio Beta", value: "1.08", desc: "vs IHSG" },
                  { label: "VaR 95%", value: "2.8%", desc: "1-day" },
                  { label: "VaR 99%", value: "4.2%", desc: "1-day" },
                  { label: "Max Drawdown", value: "12.4%", desc: "Historical" },
                  { label: "Sharpe Ratio", value: "1.24", desc: "Annualized" },
                  { label: "Sortino Ratio", value: "1.68", desc: "Downside only" },
                  { label: "Tracking Error", value: "3.2%", desc: "vs Benchmark" },
                ].map((metric) => (
                  <div key={metric.label} className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{metric.value}</p>
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className="text-xs text-muted-foreground">{metric.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Correlation Matrix */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Correlation Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead className="text-center">BBCA</TableHead>
                      <TableHead className="text-center">BMRI</TableHead>
                      <TableHead className="text-center">TLKM</TableHead>
                      <TableHead className="text-center">BBRI</TableHead>
                      <TableHead className="text-center">ASII</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {correlationMatrix.map((row) => (
                      <TableRow key={row.asset}>
                        <TableHead className="font-medium">{row.asset}</TableHead>
                        <TableCell className="text-center">{row.BBCA.toFixed(2)}</TableCell>
                        <TableCell className="text-center">{row.BMRI.toFixed(2)}</TableCell>
                        <TableCell className="text-center">{row.TLKM.toFixed(2)}</TableCell>
                        <TableCell className="text-center">{row.BBRI.toFixed(2)}</TableCell>
                        <TableCell className="text-center">{row.ASII.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holdings" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Holdings Detail</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Avg Cost</TableHead>
                      <TableHead className="text-right">Current</TableHead>
                      <TableHead className="text-right">Market Value</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">P&L</TableHead>
                      <TableHead className="text-right">P&L %</TableHead>
                      <TableHead className="text-right">Weight</TableHead>
                      <TableHead className="text-center">Beta</TableHead>
                      <TableHead className="text-center">VaR 95%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.positions.map((holding) => (
                      <TableRow key={holding.ticker}>
                        <TableCell className="font-medium">{holding.ticker}</TableCell>
                        <TableCell>{holding.name}</TableCell>
                        <TableCell className="text-right">{holding.shares.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{holding.avgCost.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{holding.currentPrice.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{holding.marketValue.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{holding.cost.toLocaleString()}</TableCell>
                        <TableCell className={`text-right font-medium ${holding.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {holding.pnl >= 0 ? "+" : ""}{holding.pnl.toLocaleString()}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${holding.pnlPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {holding.pnlPct >= 0 ? "+" : ""}{holding.pnlPct}%
                        </TableCell>
                        <TableCell className="text-right font-medium">{holding.weight}%</TableCell>
                        <TableCell className="text-center">{holding.beta}</TableCell>
                        <TableCell className="text-center">{holding.var95}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance Attribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-sm text-green-700">Selection Effect</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">+0.85%</div>
                    <p className="text-sm text-muted-foreground">Stock selection added 85bps</p>
                  </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-sm text-blue-700">Allocation Effect</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">+0.32%</div>
                    <p className="text-sm text-muted-foreground">Sector allocation added 32bps</p>
                  </CardContent>
                </Card>
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardHeader>
                    <CardTitle className="text-sm text-yellow-700">Interaction Effect</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">+0.12%</div>
                    <p className="text-sm text-muted-foreground">Interaction added 12bps</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

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
                    {monthlyReturns.map((m) => (
                      <TableRow key={m.month}>
                        <TableCell className="font-medium">{m.month}</TableCell>
                        <TableCell className="text-center">{m.port >= 0 ? "+" : ""}{m.port}%</TableCell>
                        <TableCell className="text-center">{m.bench >= 0 ? "+" : ""}{m.bench}%</TableCell>
                        <TableCell className={`text-center font-medium ${m.excess >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {m.excess >= 0 ? "+" : ""}{m.excess}%
                        </TableCell>
                        <TableCell className="text-center font-medium">{m.cum >= 0 ? "+" : ""}{m.cum}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Portfolio Volatility", value: "14.2%", desc: "Annualized", color: "text-blue-600" },
              { label: "Portfolio Beta", value: "1.08", desc: "vs IHSG", color: "text-blue-600" },
              { label: "VaR 95% (1-day)", value: "2.8%", desc: "1-day", color: "text-red-600" },
              { label: "VaR 99% (1-day)", value: "4.2%", desc: "1-day", color: "text-red-600" },
              { label: "Max Drawdown", value: "12.4%", desc: "Historical", color: "text-red-600" },
              { label: "Sharpe Ratio", value: "1.24", desc: "Annualized", color: "text-green-600" },
              { label: "Sortino Ratio", value: "1.68", desc: "Downside only", color: "text-green-600" },
              { label: "Tracking Error", value: "3.2%", desc: "vs Benchmark", color: "text-blue-600" },
            ].map((metric) => (
              <Card key={metric.label} className="bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-2xl font-bold" style={{ color: metric.color }}>{metric.value}</p>
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p className="text-xs text-muted-foreground">{metric.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Correlation Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead className="text-center">BBCA</TableHead>
                      <TableHead className="text-center">BMRI</TableHead>
                      <TableHead className="text-center">TLKM</TableHead>
                      <TableHead className="text-center">BBRI</TableHead>
                      <TableHead className="text-center">ASII</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {correlationMatrix.map((row) => (
                      <TableRow key={row.asset}>
                        <TableHead className="font-medium">{row.asset}</TableHead>
                        <TableCell className="text-center">{row.BBCA.toFixed(2)}</TableCell>
                        <TableCell className="text-center">{row.BMRI.toFixed(2)}</TableCell>
                        <TableCell className="text-center">{row.TLKM.toFixed(2)}</TableCell>
                        <TableCell className="text-center">{row.BBRI.toFixed(2)}</TableCell>
                        <TableCell className="text-center">{row.ASII.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Factor Attribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {factorExposure.map((factor) => (
                  <Card key={factor.factor} className={`border-l-4 ${factor.contrib >= 0 ? "border-l-green-500" : "border-l-red-500"}`}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{factor.factor}</span>
                        <span className={`font-bold ${factor.contrib >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {factor.contrib >= 0 ? "+" : ""}{factor.contrib}%
                        </span>
                      </div>
                      <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${factor.contrib >= 0 ? "bg-green-500" : "bg-red-500"}`}
                          style={{ width: `${Math.abs(factor.contrib) * 200}%` }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex justify-between">
                        <span>Exposure: {factor.exposure >= 0 ? "+" : ""}{factor.exposure}</span>
                        <span>Contribution: {factor.contrib >= 0 ? "+" : ""}{factor.contrib}%</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Transaction History</CardTitle>
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
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Fees</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.date}>
                        <TableCell>{tx.date}</TableCell>
                        <TableCell className="font-medium">{tx.ticker}</TableCell>
                        <TableCell>
                          <Badge variant={tx.type === "BUY" ? "success" : "destructive"} className="text-xs">
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{tx.shares.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{tx.price.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">Rp {tx.value.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-muted-foreground">Rp {tx.fees.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">Rp {tx.net.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}