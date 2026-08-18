"use client";

import { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPortfolio, type PortfolioItem } from "@/lib/api";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: PortfolioItem[] };

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getPortfolio();
        setState({ status: "ready", data });
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load portfolio data",
        });
      }
    }
    fetchData();
  }, []);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load portfolio data</p>
            <p className="text-sm text-muted">{state.message}</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const positions = state.data;

  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalCost = positions.reduce((sum, p) => sum + p.avgPrice * p.quantity, 0);
  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const sectorAllocation = positions.reduce((acc, p) => {
    const sector = p.sector || "UNKNOWN";
    acc[sector] = (acc[sector] || 0) + p.marketValue;
    return acc;
  }, {} as Record<string, number>);

  const sectorData = Object.entries(sectorAllocation).map(([sector, value]) => ({
    sector,
    value,
    pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
  }));

  return (
    <div className="space-y-4">
      {/* Portfolio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Portfolio Analytics</h1>
          <p className="text-muted">Portfolio performance, risk, and attribution analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">Rp {(totalValue / 1e9).toFixed(2)}B</div>
            <p className="text-sm text-muted">Total portfolio value</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-positive">+Rp {(totalPnL / 1e6).toFixed(1)}M</div>
            <p className="text-sm text-positive">+{totalPnLPct.toFixed(2)}% since inception</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted">Daily P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-positive">--</div>
            <p className="text-sm text-muted">Requires daily price feed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted">Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{positions.length}</div>
            <p className="text-sm text-muted">Active holdings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted">Sectors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{sectorData.length}</div>
            <p className="text-sm text-muted">Diversified sectors</p>
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

        <TabsContent value="overview" className="space-y-4">
          {/* Sector Allocation & Top Holdings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Sector Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sectorData.map((item) => (
                    <div key={item.sector} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-info" />
                        <span className="text-sm font-medium">{item.sector}</span>
                      </div>
                      <span className="font-medium">{item.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Top Holdings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {positions
                    .sort((a, b) => b.marketValue - a.marketValue)
                    .slice(0, 5)
                    .map((holding) => (
                      <div key={holding.ticker} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{holding.ticker}</span>
                          <span className="text-sm text-muted">{holding.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-medium">{(holding.marketValue / totalValue * 100).toFixed(1)}%</span>
                          <Badge variant={holding.pnl >= 0 ? "success" : "destructive"} className="text-xs">
                            {holding.pnl >= 0 ? "+" : ""}{holding.pnlPct.toFixed(2)}%
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
              <CardTitle className="text-sm">Risk Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-elevated-panel/50 rounded-md">
                  <p className="text-2xl font-bold">--</p>
                  <p className="text-sm text-muted">Portfolio Volatility</p>
                  <p className="text-xs text-muted">Annualized (requires history)</p>
                </div>
                <div className="p-4 bg-elevated-panel/50 rounded-md">
                  <p className="text-2xl font-bold">--</p>
                  <p className="text-sm text-muted">Portfolio Beta</p>
                  <p className="text-xs text-muted">vs IHSG (requires history)</p>
                </div>
                <div className="p-4 bg-elevated-panel/50 rounded-md">
                  <p className="text-2xl font-bold">--</p>
                  <p className="text-sm text-muted">VaR 95%</p>
                  <p className="text-xs text-muted">1-day (requires history)</p>
                </div>
                <div className="p-4 bg-elevated-panel/50 rounded-md">
                  <p className="text-2xl font-bold">--</p>
                  <p className="text-sm text-muted">Max Drawdown</p>
                  <p className="text-xs text-muted">Historical (requires history)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Correlation Matrix Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Correlation Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-elevated-panel/30 rounded-md flex items-center justify-center text-muted">
                [Correlation Matrix - Requires historical price data]
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holdings" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Holdings Detail</CardTitle>
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
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Avg Price</TableHead>
                      <TableHead className="text-right">Current</TableHead>
                      <TableHead className="text-right">Market Value</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">P&L</TableHead>
                      <TableHead className="text-right">P&L %</TableHead>
                      <TableHead className="text-right">Weight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((holding) => (
                      <TableRow key={holding.ticker}>
                        <TableCell className="font-medium">{holding.ticker}</TableCell>
                        <TableCell>{holding.name}</TableCell>
                        <TableCell className="text-right">{holding.quantity.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{holding.avgPrice.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{holding.currentPrice.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{holding.marketValue.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{(holding.avgPrice * holding.quantity).toLocaleString()}</TableCell>
                        <TableCell className={`text-right font-medium ${holding.pnl >= 0 ? "text-positive" : "text-negative"}`}>
                          {holding.pnl >= 0 ? "+" : ""}{holding.pnl.toLocaleString()}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${holding.pnlPct >= 0 ? "text-positive" : "text-negative"}`}>
                          {holding.pnlPct >= 0 ? "+" : ""}{holding.pnlPct.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right font-medium">{(holding.marketValue / totalValue * 100).toFixed(1)}%</TableCell>
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
              <CardTitle className="text-sm">Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted">
                Performance analytics require historical price data.
                <br />
                <span className="text-sm">Connect a price history feed to enable this tab.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-elevated-panel/50">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-info">--</p>
                <p className="text-sm text-muted">Portfolio Volatility</p>
                <p className="text-xs text-muted">Annualized</p>
              </CardContent>
            </Card>
            <Card className="bg-elevated-panel/50">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-info">--</p>
                <p className="text-sm text-muted">Portfolio Beta</p>
                <p className="text-xs text-muted">vs IHSG</p>
              </CardContent>
            </Card>
            <Card className="bg-elevated-panel/50">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-negative">--</p>
                <p className="text-sm text-muted">VaR 95% (1-day)</p>
                <p className="text-xs text-muted">1-day</p>
              </CardContent>
            </Card>
            <Card className="bg-elevated-panel/50">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-negative">--</p>
                <p className="text-sm text-muted">Max Drawdown</p>
                <p className="text-xs text-muted">Historical</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Correlation Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-elevated-panel/30 rounded-md flex items-center justify-center text-muted">
                [Correlation Matrix - Requires historical price data]
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Factor Attribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted">
                Factor attribution requires historical returns data.
                <br />
                <span className="text-sm">Connect a price history feed to enable this tab.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Transaction History</CardTitle>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted">
                Transaction history requires a transactions table in the database.
                <br />
                <span className="text-sm">This feature will be available when transaction logging is implemented.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}