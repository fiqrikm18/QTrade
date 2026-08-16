"use client"

import { AppShell } from "@/components/ui/appshell"
import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { ChevronLeft, ChevronRight, Search, Download, Filter, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useState } from "react"

export default function ComparePage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [tickers, setTickers] = useState<string[]>(["BBCA", "BBRI", "BMRI", "BBNI"])
  const [activeTab, setActiveTab] = useState("overview")

  // Mock data for comparison
  const comparisonData = [
    { ticker: "BBCA", name: "Bank Central Asia", sector: "BANKING", price: 9125, change: 1.42, volume: 1500000, turnover: 13.7, marketCap: 175000000, technical: 88, fundamental: 91, momentum: 84, smartMoney: 79, sector: 87, risk: 76, ml: 81, opportunity: 92 },
    { rank: 2, ticker: "BMRI", company: "Bank Mandiri", price: 6250, change: 2.13, volume: 2100000, turnover: 13.1, marketCap: 290000000, technical: 90, fundamental: 86, momentum: 92, smartMoney: 88, sector: 82, risk: 77, ml: 89, opportunity: 89 },
    { rank: 3, ticker: "TLKM", company: "Telkom Indonesia", price: 3010, change: -0.33, volume: 800000, turnover: 2.4, marketCap: 298000000, technical: 84, fundamental: 79, momentum: 82, smartMoney: 77, sector: 65, risk: 72, ml: 75, opportunity: 79 },
    { rank: 4, ticker: "BBRI", company: "Bank Rakyat Indonesia", price: 5180, change: 0.97, volume: 1800000, turnover: 9.3, marketCap: 765000000, technical: 82, fundamental: 85, momentum: 80, smartMoney: 85, sector: 80, risk: 75, ml: 80, opportunity: 84 },
  ]

  const handleAddTicker = () => {
    const newTicker = prompt("Enter ticker to add:")
    if (newTicker && !tickers.includes(newTicker.toUpperCase())) {
      setTickers([...tickers, newTicker.toUpperCase()])
    }
  }

  const handleRemoveTicker = (ticker: string) => {
    setTickers(tickers.filter(t => t !== ticker))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Compare Stocks</h1>
          <p className="text-muted-foreground">Side-by-side quantitative comparison</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Add ticker..."
            className="w-40 px-3 py-2 border border-border rounded-md bg-background text-sm"
            onKeyDown={e => e.key === "Enter" && handleAddTicker()}
          />
          <Button onClick={handleAddTicker} size="sm">
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add
          </Button>
        </div>
      </div>

      {/* Ticker chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tickers.map((ticker, index) => (
          <div key={ticker} className="flex items-center gap-1 px-3 py-1 bg-muted rounded-full text-sm">
            <span className="font-medium">{ticker}</span>
            <button
              onClick={() => handleRemoveTicker(ticker)}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={handleAddTicker}
          className="px-3 py-1 text-sm text-muted-foreground border border-dashed border-border rounded-full hover:bg-accent transition-colors"
        >
          + Add Ticker
        </button>
      </div>

      {/* Comparison Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Quantitative Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  {comparisonData.map(item => (
                    <TableHead key={item.ticker} className="text-center">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{item.ticker}</span>
                        <span className="text-xs text-muted-foreground">{item.company}</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableHead className="font-medium">Opportunity Score</TableHead>
                  {comparisonData.map(item => (
                    <TableCell key={item.ticker} className="text-center font-bold">
                      <Badge variant={item.opportunity >= 85 ? "success" : item.opportunity >= 70 ? "default" : "destructive"}>
                        {item.opportunity}
                      </Badge>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="font-medium">Technical</TableHead>
                  {comparisonData.map(item => (
                    <TableCell key={item.ticker} className="text-center">
                      <Badge variant="default">{item.technical}</Badge>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="font-medium">Fundamental</TableHead>
                  {comparisonData.map(item => (
                    <TableCell key={item.ticker} className="text-center">
                      <Badge variant="default">{item.fundamental}</Badge>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="font-medium">Momentum</TableHead>
                  {comparisonData.map(item => (
                    <TableCell key={item.ticker} className="text-center">
                      <Badge variant="default">{item.momentum}</Badge>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="font-medium">Smart Money</TableHead>
                  {comparisonData.map(item => (
                    <TableCell key={item.ticker} className="text-center">
                      <Badge variant="default">{item.smartMoney}</Badge>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="font-medium">Sector</TableHead>
                  {comparisonData.map(item => (
                    <TableCell key={item.ticker} className="text-center">
                      <Badge variant="default">{item.sector}</Badge>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="font-medium">Risk</TableHead>
                  {comparisonData.map(item => (
                    <TableCell key={item.ticker} className="text-center">
                      <Badge variant="default">{item.risk}</Badge>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="font-medium">ML</TableHead>
                  {comparisonData.map(item => (
                    <TableCell key={item.ticker} className="text-center">
                      <Badge variant="default">{item.ml}</Badge>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="font-medium">Price</TableHead>
                  {comparisonData.map(item => (
                    <TableCell key={item.ticker} className="text-right font-medium">
                      {item.price.toLocaleString()}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="font-medium">Change</TableHead>
                  {comparisonData.map(item => (
                    <TableCell key={item.ticker} className={`text-right font-medium ${item.change >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {item.change >= 0 ? "+" : ""}{item.change}%
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="font-medium">Volume</TableHead>
                  {comparisonData.map(item => (
                    <TableCell key={item.ticker} className="text-right">
                      {item.volume.toLocaleString()}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="font-medium">Turnover</TableHead>
                  {comparisonData.map(item => (
                    <TableCell key={item.ticker} className="text-right">
                      {item.turnover}B
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="font-medium">Mkt Cap</TableHead>
                  {comparisonData.map(item => (
                    <TableCell key={item.ticker} className="text-right">
                      {(item.marketCap / 1e12).toFixed(1)}T
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const comparisonData = [
  { ticker: "BBCA", company: "Bank Central Asia", sector: "BANKING", price: 9125, change: 1.42, volume: 1500000, turnover: 13.7, marketCap: 175000000, technical: 88, fundamental: 91, momentum: 84, smartMoney: 79, sector: 87, risk: 76, ml: 81, opportunity: 92 },
  { rank: 2, ticker: "BMRI", company: "Bank Mandiri", price: 6250, change: 2.13, volume: 2100000, turnover: 13.1, marketCap: 290000000, technical: 90, fundamental: 86, momentum: 92, smartMoney: 88, sector: 82, risk: 77, ml: 89, opportunity: 89 },
  { rank: 3, ticker: "TLKM", company: "Telkom Indonesia", price: 3010, change: -0.33, volume: 800000, turnover: 2.4, marketCap: 298000000, technical: 84, fundamental: 79, momentum: 82, smartMoney: 77, sector: 65, risk: 72, ml: 75, opportunity: 79 },
  { rank: 4, ticker: "BBRI", company: "Bank Rakyat Indonesia", price: 5180, change: 0.97, volume: 1800000, turnover: 9.3, marketCap: 765000000, technical: 82, fundamental: 85, momentum: 80, smartMoney: 85, sector: 80, risk: 75, ml: 80, opportunity: 84 },
]