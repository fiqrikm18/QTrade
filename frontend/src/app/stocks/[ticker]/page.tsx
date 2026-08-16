"use client"

import { AppShell } from "@/components/ui/appshell"
import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minimize, Maximize, Download, Share, AlertTriangle, Eye, ArrowUp, ArrowDown, BarChart2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface StockPageProps {
  params: { ticker: string }
}

export default function StockPage({ params }: StockPageProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  const ticker = params.ticker

  // Mock data for the stock
  const stockData = {
    ticker: "BBCA",
    name: "Bank Central Asia",
    sector: "BANKING",
    price: 9125,
    change: 128,
    changePct: 1.42,
    volume: 1500000,
    turnover: 13.7,
    marketCap: 175000000,
    opportunityScore: 86,
    classification: "OPPORTUNITY",
    confidence: 78,
    riskLevel: "MEDIUM",
    regime: "BULLISH",
    components: {
      technical: 88,
      fundamental: 91,
      momentum: 84,
      relativeStrength: 87,
      smartMoney: 79,
      factor: 82,
      sector: 87,
      macro: 72,
      risk: 76,
      ml: 81,
    },
    drivers: ["Strong relative strength", "Improving momentum", "Strong fundamentals", "Sector leadership"],
    risks: ["High valuation", "Macro sensitivity"],
    invalidation: ["Break below defined support", "Sector relative strength deterioration", "Fundamental deterioration"],
    featureVersion: "v1",
    scoringVersion: "v1",
  }

  const priceHistory = [
    { date: "2024-01-01", open: 9000, high: 9100, low: 8950, close: 9050, volume: 1200000 },
    { date: "2024-01-02", open: 9050, high: 9150, low: 9000, close: 9100, volume: 1100000 },
    { date: "2024-01-03", open: 9100, high: 9200, low: 9050, close: 9150, volume: 1300000 },
    { date: "2024-01-04", open: 9150, high: 9250, low: 9100, close: 9200, volume: 1400000 },
    { date: "2024-01-05", open: 9200, high: 9250, low: 9150, close: 9125, volume: 1500000 },
  }

  const fundamentalData = {
    profitability: { roe: 23.4, roic: 18.7, npm: 28.2, gpm: 52.1 },
    growth: { revenue: 12.4, eps: 15.8, fcf: 10.7 },
    health: { debtEquity: 0.18, currentRatio: 1.42, interestCoverage: 9.4 },
    valuation: { per: 23.4, pbv: 2.8, psr: 5.2, evEbitda: 12.5, fcfYield: 4.2, divYield: 1.8 },
  }

  const technicalData = {
    rsi: 64,
    macd: 0.45,
    sma20: 9080,
    sma50: 8950,
    sma200: 8500,
    ema20: 9100,
    atr: 85,
    adx: 28,
    bollUpper: 9200,
    bollMid: 9080,
    bollLower: 8960,
  }

  return (
    <div className="space-y-6">
      {/* Stock Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">{params.ticker}</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold">{params.ticker}</h1>
            <p className="text-muted-foreground">{stockData.name}</p>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <Badge variant="default">{stockData.sector}</Badge>
              <Badge variant="secondary">Large Cap</Badge>
              <Badge variant="outline">Liquidity: Very High</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          <div className="text-right">
            <p className="text-3xl font-bold">{stockData.price.toLocaleString()}</p>
            <p className="text-green-600 font-medium">+{stockData.changePct}%</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={stockData.classification === "OPPORTUNITY" ? "success" : stockData.classification === "WATCHLIST" ? "default" : "destructive"} className="text-sm">
              {stockData.classification}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Risk: {stockData.riskLevel}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Regime: {stockData.regime}
            </Badge>
          </div>
        </div>
      </div>

      {/* Opportunity Score */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Opportunity Score</CardTitle>
            <Badge variant="success" className="text-xs">{stockData.classification}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stockData.opportunityScore}</div>
            <p className="text-sm text-muted-foreground">Confidence {stockData.confidence}%</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>Drivers</span><span className="font-medium">{stockData.drivers.length} factors</span></div>
              <div className="flex justify-between"><span>Risks</span><span className="font-medium">{stockData.risks.length} factors</span></div>
              <div className="flex justify-between"><span>Invalidation</span><span className="font-medium">{stockData.invalidation.length} conditions</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Technical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: "RSI (14)", value: 64, status: "neutral" },
                { label: "MACD", value: 0.45, status: "bullish" },
                { label: "Price vs SMA20", value: "+0.5%", status: "bullish" },
                { label: "Price vs SMA50", value: "+1.2%", status: "bullish" },
                { label: "Price vs SMA200", value: "+7.4%", status: "bullish" },
                { label: "ATR (14)", value: 85, status: "neutral" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{typeof item.value === "number" ? item.value : item.value} <span className={`ml-1 ${item.status === "bullish" ? "text-green-600" : item.status === "bearish" ? "text-red-600" : "text-muted-foreground"}`}>{item.status === "bullish" ? "��" : item.status === "bearish" ? "��" : "●"}</span></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Fundamental</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">ROE</p>
                  <p className="text-lg font-bold">23.4%</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">ROIC</p>
                  <p className="text-lg font-bold">18.7%</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">NPM</p>
                  <p className="text-lg font-bold">28.2%</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">GPM</p>
                  <p className="text-lg font-bold">52.1%</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Revenue Growth</p>
                  <p className="text-lg font-bold text-green-600">+12.4%</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">EPS Growth</p>
                  <p className="text-lg font-bold text-green-600">+15.8%</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">FCF Growth</p>
                  <p className="text-lg font-bold text-green-600">+10.7%</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">D/E</p>
                  <p className="text-lg font-bold">0.18x</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Valuation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">PER</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">23.4x</span>
                  <Badge variant="warning">Expensive</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Hist: 20.1x ──●── 25.8x | Sector: 21.8x</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">PBV</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">2.8x</span>
                  <Badge variant="default">Fair</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Hist: 2.2x ──●── 3.1x | Sector: 2.5x</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">EV/EBITDA</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">12.5x</span>
                  <Badge variant="default">Fair</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Sector: 11.8x</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Smart Money</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Accumulation Proxy</span>
                <Badge variant="success">78</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Volume Anomaly</span>
                <Badge variant="default">72</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Structure Score</span>
                <Badge variant="success">81</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Volume-Price Agreement</span>
                <Badge variant="success">76</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Volatility (20D)</span>
                <span className="font-medium">18.5%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Max Drawdown (250D)</span>
                <span className="font-medium">12.4%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Beta vs IHSG</span>
                <span className="font-medium">1.12</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Liquidity Risk</span>
                <Badge variant="success">Low</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Price Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground">
              [Price Chart - Integrate lightweight-charts]
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="technical" className="space-y-4">
          <TabsList>
            <TabsTrigger value="technical">Technical</TabsTrigger>
            <TabsTrigger value="fundamental">Fundamental</TabsTrigger>
            <TabsTrigger value="valuation">Valuation</TabsTrigger>
            <TabsTrigger value="smart-money">Smart Money</TabsTrigger>
            <TabsTrigger value="factors">Factors</TabsTrigger>
            <TabsTrigger value="risk">Risk</TabsTrigger>
            <TabsTrigger value="news">News</TabsTrigger>
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
          </TabsList>

          <TabsContent value="technical">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle>RSI (14)</CardTitle></CardHeader>
                <CardContent><div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground">[RSI Chart]</div></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>MACD</CardTitle></CardHeader>
                <CardContent><div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground">[MACD Chart]</div></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Bollinger Bands</CardTitle></CardHeader>
                <CardContent><div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground">[Bollinger Chart]</div></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Volume Profile</CardTitle></CardHeader>
                <CardContent><div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground">[Volume Chart]</div></CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="fundamental">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader><CardTitle>Profitability</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between"><span>ROE</span><span className="font-bold">23.4%</span></div>
                    <div className="flex justify-between"><span>ROIC</span><span className="font-bold">18.7%</span></div>
                    <div className="flex justify-between"><span>NPM</span><span className="font-bold">28.2%</span></div>
                    <div className="flex justify-between"><span>GPM</span><span className="font-bold">52.1%</span></div>
                    <div className="flex justify-between"><span>OPM</span><span className="font-bold">38.5%</span></div>
                    <div className="flex justify-between"><span>Earnings Quality</span><span className="font-bold">1.12x</span></div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Growth</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between"><span>Revenue Growth</span><span className="font-bold text-green-600">+12.4%</span></div>
                    <div className="flex justify-between"><span>EPS Growth</span><span className="font-bold text-green-600">+15.8%</span></div>
                    <div className="flex justify-between"><span>FCF Growth</span><span className="font-bold text-green-600">+10.7%</span></div>
                    <div className="flex justify-between"><span>Book Value Growth</span><span className="font-bold text-green-600">+8.9%</span></div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Financial Health</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between"><span>Debt/Equity</span><span className="font-bold">0.18x</span></div>
                    <div className="flex justify-between"><span>Current Ratio</span><span className="font-bold">1.42x</span></div>
                    <div className="flex justify-between"><span>Interest Coverage</span><span className="font-bold">9.4x</span></div>
                    <div className="flex justify-between"><span>FCF Conversion</span><span className="font-bold">1.08x</span></div>
                    <div className="flex justify-between"><span>Dividend Yield</span><span className="font-bold">1.8%</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="valuation">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader><CardTitle>Valuation Metrics</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 bg-muted/50 rounded-lg"><p className="text-xs text-muted-foreground">PER</p><div className="flex justify-between"><span className="text-2xl font-bold">23.4x</span><Badge variant="warning">Expensive</Badge></div><p className="text-xs text-muted-foreground mt-1">Hist: 20.1x ──●── 25.8x | Sector: 21.8x</p></div>
                    <div className="p-3 bg-muted/50 rounded-lg"><p className="text-xs text-muted-foreground">PBV</p><div className="flex justify-between"><span className="text-2xl font-bold">2.8x</span><Badge variant="default">Fair</Badge></div><p className="text-xs text-muted-foreground mt-1">Hist: 2.2x ──●── 3.1x | Sector: 2.5x</p></div>
                    <div className="p-3 bg-muted/50 rounded-lg"><p className="text-xs text-muted-foreground">EV/EBITDA</p><div className="flex justify-between"><span className="text-2xl font-bold">12.5x</span><Badge variant="default">Fair</Badge></div><p className="text-xs text-muted-foreground mt-1">Sector: 11.8x</p></div>
                    <div className="p-3 bg-muted/50 rounded-lg"><p className="text-xs text-muted-foreground">PSR</p><div className="flex justify-between"><span className="text-2xl font-bold">5.2x</span><Badge variant="warning">Rich</Badge></div></div>
                    <div className="p-3 bg-muted/50 rounded-lg"><p className="text-xs text-muted-foreground">FCF Yield</p><div className="flex justify-between"><span className="text-2xl font-bold">4.2%</span><Badge variant="success">Good</Badge></div></div>
                    <div className="p-3 bg-muted/50 rounded-lg"><p className="text-xs text-muted-foreground">Dividend Yield</p><div className="flex justify-between"><span className="text-2xl font-bold">1.8%</span><Badge variant="default">Fair</Badge></div></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="smart-money">
            <Card>
              <CardHeader><CardTitle>Smart Money Proxies</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg"><p className="text-xs text-muted-foreground">Accumulation Proxy</p><p className="text-3xl font-bold text-green-600">78</p></div>
                  <div className="p-4 bg-blue-50 rounded-lg"><p className="text-xs text-muted-foreground">Volume Behavior</p><p className="text-3xl font-bold text-blue-600">72</p></div>
                  <div className="p-4 bg-green-50 rounded-lg"><p className="text-xs text-muted-foreground">Price Structure</p><p className="text-3xl font-bold text-green-600">81</p></div>
                  <div className="p-4 bg-yellow-50 rounded-lg"><p className="text-xs text-muted-foreground">Relative Strength</p><p className="text-3xl font-bold text-yellow-600">68</p></div>
                  <div className="p-4 bg-purple-50 rounded-lg"><p className="text-xs text-muted-foreground">Liquidity</p><p className="text-3xl font-bold text-purple-600">85</p></div>
                  <div className="p-4 bg-red-50 rounded-lg"><p className="text-xs text-muted-foreground">Volatility Behavior</p><p className="text-3xl font-bold text-red-600">65</p></div>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span>Wyckoff Phase</span><Badge variant="success">Phase C (Spring)</Badge></div>
                  <div className="flex justify-between"><span>Break of Structure</span><Badge variant="success">Bullish</Badge></div>
                  <div className="flex justify-between"><span>Change of Character</span><Badge variant="default">Not Detected</Badge></div>
                  <div className="flex justify-between"><span>Liquidity Sweep</span><Badge variant="warning">Recent (Low)</Badge></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="factors">
            <Card>
              <CardHeader><CardTitle>Factor Scores</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { name: "Value", score: 78 },
                    { name: "Momentum", score: 91 },
                    { name: "Quality", score: 83 },
                    { name: "Growth", score: 72 },
                    { name: "Low Vol", score: 61 },
                    { name: "Size", score: 95 },
                    { name: "Liquidity", score: 95 },
                    { name: "Rel Strength", score: 87 },
                  ].map((factor) => (
                    <div key={factor.name} className="p-4 bg-muted/50 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">{factor.name}</p>
                      <p className="text-3xl font-bold">{factor.score}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risk">
            <Card>
              <CardHeader><CardTitle>Risk Metrics</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-red-50 rounded-lg"><p className="text-xs text-muted-foreground">Volatility (20D)</p><p className="text-2xl font-bold text-red-600">18.5%</p></div>
                  <div className="p-4 bg-red-50 rounded-lg"><p className="text-xs text-muted-foreground">Max Drawdown (250D)</p><p className="text-2xl font-bold text-red-600">12.4%</p></div>
                  <div className="p-4 bg-yellow-50 rounded-lg"><p className="text-xs text-muted-foreground">Beta vs IHSG</p><p className="text-2xl font-bold text-yellow-600">1.12</p></div>
                  <div className="p-4 bg-green-50 rounded-lg"><p className="text-xs text-muted-foreground">Liquidity Risk</p><p className="text-2xl font-bold text-green-600">Low</p></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="news">
            <Card>
              <CardHeader><CardTitle>Latest News & Events</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-l-4 border-blue-500 pl-4 py-2"><p className="font-medium">BBCA: Q4 2023 Net Profit Rises 15% YoY</p><p className="text-sm text-muted-foreground text-sm">Jan 15, 2024 | Bisnis Indonesia</p></div>
                  <div className="border-l-4 border-green-500 pl-4 py-2"><p className="font-medium">BBCA: Digital Banking Users Reach 25M</p><p className="text-sm text-muted-foreground text-sm">Jan 10, 2024 | Kontan</p></div>
                  <div className="border-l-4 border-yellow-500 pl-4 py-2"><p className="font-medium">BI Rate Decision: Policy Rate Maintained at 5.75%</p><p className="text-sm text-muted-foreground text-sm">Jan 18, 2024 | Reuters</p></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scenarios">
            <Card>
              <CardHeader><CardTitle>Scenario Analysis</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scenario</TableHead>
                      <TableHead>Probability</TableHead>
                      <TableHead>Target Price</TableHead>
                      <TableHead>Upside/Downside</TableHead>
                      <TableHead>Key Drivers</TableHead>
                      <TableHead>Invalidation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell><Badge variant="success">Bullish</Badge></TableCell>
                      <TableCell>35%</TableCell>
                      <TableCell>10,500</TableCell>
                      <TableCell className="text-green-600">+15%</TableCell>
                      <TableCell>Strong earnings, sector rotation, foreign inflows</TableCell>
                      <TableCell>Break below 8,800 support</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="default">Base</Badge></TableCell>
                      <TableCell>45%</TableCell>
                      <TableCell>9,500</TableCell>
                      <TableCell className="text-green-600">+4%</TableCell>
                      <TableCell>Steady earnings, stable NIM, moderate loan growth</TableCell>
                      <TableCell>Break below 8,500 support</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="destructive">Bearish</Badge></TableCell>
                      <TableCell>20%</TableCell>
                      <TableCell>8,200</TableCell>
                      <TableCell className="text-red-600">-10%</TableCell>
                      <TableCell>Macro shock, NPL spike, capital outflow</TableCell>
                      <TableCell>Break below 8,000 support</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}