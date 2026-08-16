 "use client"

import { AppShell } from "@/components/ui/appshell"
import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Filter, Search, ChevronDown, Download, Calendar, Tag, Clock, Globe, Zap, FileText, X, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Filter, Search, ChevronDown, Download, Calendar, Tag, Clock, Globe } from "lucide-react"

interface NewsItem {
  id: number
  date: string
  time: string
  title: string
  source: string
  category: string
  impact: "HIGH" | "MEDIUM" | "LOW"
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL"
  tickers: string[]
  summary: string
}

const newsData = [
  {
    id: 1,
    date: "2024-01-15",
    time: "09:00",
    title: "BBCA Q4 2023 Net Profit Rises 15% YoY",
    source: "Bisnis Indonesia",
    category: "Earnings",
    impact: "HIGH",
    sentiment: "POSITIVE",
    tickers: ["BBCA"],
    summary: "Bank Central Asia reported Q4 2023 net profit of IDR 8.2 trillion, up 15% YoY driven by strong loan growth and lower provisions. NIM expanded to 5.2% from 4.9% YoY."
  },
  {
    id: 2,
    date: "2024-01-15",
    time: "09:30",
    title: "BMRI: Q4 Net Profit Beats Estimates",
    source: "Kontan",
    category: "Earnings",
    impact: "HIGH",
    sentiment: "POSITIVE",
    tickers: ["BMRI"],
    summary: "Bank Mandiri reported Q4 net profit of IDR 12.5T, beating consensus of IDR 11.8T. NIM improved to 5.1% from 4.8% QoQ."
  },
  {
    id: 3,
    date: "2024-01-15",
    time: "19:30",
    title: "US CPI Comes in at 3.1% YoY",
    source: "Reuters",
    category: "Macro",
    impact: "HIGH",
    sentiment: "NEUTRAL",
    tickers: ["US_IDX"],
    summary: "US CPI came in at 3.1% YoY vs 2.9% consensus. Core CPI at 3.9% vs 3.7% expected. Dollar strengthens on sticky inflation."
  },
  {
    id: 4,
    date: "2024-01-15",
    time: "19:30",
    title: "Fed Holds Rates at 5.25-5.50%",
    source: "Bloomberg",
    category: "Monetary Policy",
    impact: "HIGH",
    sentiment: "NEUTRAL",
    tickers: ["US_IDX"],
    summary: "FOMC maintains federal funds rate at 5.25-5.50%. Powell indicates rate cuts unlikely before March. Dot plot shows three cuts in 2024."
  },
  {
    id: 5,
    date: "2024-01-16",
    time: "08:30",
    title: "ID Trade Surplus Widens to $3.2B",
    source: "BPS",
    category: "Trade",
    impact: "MEDIUM",
    sentiment: "POSITIVE",
    tickers: ["IDX"],
    summary: "Indonesia trade surplus widened to $3.2B in Dec from $2.8B prior. Exports rose 8.5% YoY while imports grew 5.2%."
  },
  {
    id: 6,
    date: "2024-01-15",
    time: "10:00",
    title: "TLKM Q4 Revenue Beats on Data Growth",
    source: "Kontan",
    category: "Earnings",
    impact: "MEDIUM",
    sentiment: "POSITIVE",
    tickers: ["TLKM"],
    summary: "Telkom Indonesia Q4 revenue grew 5.2% YoY to IDR 38.2T driven by mobile data revenue growth of 12.3%. EBITDA margin expanded to 52.1%."
  },
  {
    id: 7,
    date: "2024-01-15",
    time: "14:00",
    title: "ASII Declares Dividend of IDR 150/share",
    source: "CNBC Indonesia",
    category: "Corporate Action",
    impact: "MEDIUM",
    sentiment: "POSITIVE",
    tickers: ["ASII"],
    summary: "Astra International declares cash dividend of IDR 150/share, payable March 15. Payout ratio at 45%. Ex-date Feb 20."
  },
  {
    id: 8,
    date: "2024-01-15",
    time: "11:00",
    title: "BI Maintains BI Rate at 5.75%",
    source: "Bank Indonesia",
    category: "Monetary Policy",
    impact: "HIGH",
    sentiment: "NEUTRAL",
    tickers: ["IDX"],
    summary: "BI keeps policy rate at 5.75% for 5th straight meeting. Governor signals data-dependent approach. Rupiah stable at 15,650."
  },
  {
    id: 9,
    date: "2024-01-14",
    time: "08:30",
    title: "BBRI Q4 Net Income Beats Estimates",
    source: "Investor Daily",
    category: "Earnings",
    impact: "HIGH",
    sentiment: "POSITIVE",
    tickers: ["BBRI"],
    summary: "Bank Rakyat Indonesia Q4 net profit of IDR 11.2T beats consensus of IDR 10.5T. Asset quality improves with NPL at 2.8%."
  },
  {
    id: 10,
    date: "2024-01-15",
    time: "09:00",
    title: "BBNI Q4 NPL Improves to 1.8%",
    source: "Bisnis Indonesia",
    category: "Earnings",
    impact: "MEDIUM",
    sentiment: "POSITIVE",
    tickers: ["BBNI"],
    summary: "Bank Negara Indonesia Q4 NPL ratio improves to 1.8% from 2.1% QoQ. Loan growth accelerates to 11% YoY driven by corporate segment."
  }
]

const categories = ["All", "Earnings", "Macro", "Monetary Policy", "Corporate Action", "Trade", "Regulation", "Commodities"]
const sources = ["All", "Bisnis Indonesia", "Kontan", "Reuters", "Bloomberg", "BPS", "Bank Indonesia", "CNBC Indonesia", "Investor Daily", "Kontan"]

const getImpactColor = (impact: string) => {
  switch (impact) {
    case "HIGH": return "destructive"
    case "MEDIUM": return "warning"
    case "LOW": return "secondary"
    default: return "secondary"
  }
}

const getSentimentColor = (sentiment: string) => {
  switch (sentiment) {
    case "POSITIVE": return "bg-green-100 text-green-800"
    case "NEGATIVE": return "bg-red-100 text-red-800"
    case "NEUTRAL": return "bg-gray-100 text-gray-800"
    default: return "bg-gray-100 text-gray-800"
  }
}

export default function NewsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [filterCategory, setFilterCategory] = useState("All")
  const [filterSource, setFilterSource] = useState("All")
  const [filterImpact, setFilterImpact] = useState<"all" | "HIGH" | "MEDIUM" | "LOW">("all")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredNews = newsData.filter(item => {
    if (filterCategory !== "All" && item.category !== filterCategory) return false
    if (filterSource !== "All" && item.source !== filterSource) return false
    if (filterImpact !== "all" && item.impact !== filterImpact) return false
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.summary.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "HIGH": return "destructive"
      case "MEDIUM": return "warning"
      case "LOW": return "secondary"
      default: return "secondary"
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "POSITIVE": return "bg-green-100 text-green-800"
      case "NEGATIVE": return "bg-red-100 text-red-800"
      case "NEUTRAL": return "bg-gray-100 text-gray-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Financial News</h1>
          <p className="text-muted-foreground">Real-time financial news and market-moving events</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Categories</SelectItem>
                  <SelectItem value="Earnings">Earnings</SelectItem>
                  <SelectItem value="Macro">Macro</SelectItem>
                  <SelectItem value="Monetary Policy">Monetary Policy</SelectItem>
                  <SelectItem value="Corporate Action">Corporate Action</SelectItem>
                  <SelectItem value="Trade">Trade</SelectItem>
                  <SelectItem value="Regulation">Regulation</SelectItem>
                  <SelectItem value="Commodities">Commodities</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Source</label>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Sources</SelectItem>
                  <SelectItem value="Bisnis Indonesia">Bisnis Indonesia</SelectItem>
                  <SelectItem value="Kontan">Kontan</SelectItem>
                  <SelectItem value="Reuters">Reuters</SelectItem>
                  <SelectItem value="Bloomberg">Bloomberg</SelectItem>
                  <SelectItem value="BPS">BPS</SelectItem>
                  <SelectItem value="Bank Indonesia">Bank Indonesia</SelectItem>
                  <SelectItem value="CNBC Indonesia">CNBC Indonesia</SelectItem>
                  <SelectItem value="Investor Daily">Investor Daily</SelectItem>
                  <SelectItem value="Kontan">Kontan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Impact</label>
              <Select value={filterImpact} onValueChange={setFilterImpact}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Impact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Impact</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
              <Input placeholder="Search news..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Latest News ({newsData.length} articles)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead className="w-20">Date</TableHead>
                  <TableHead className="w-16">Time</TableHead>
                  <TableHead className="w-16">Country</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-16">Impact</TableHead>
                  <TableHead className="w-16">Sentiment</TableHead>
                  <TableHead className="w-16">Tickers</TableHead>
                  <TableHead className="w-16">Source</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {newsData.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{item.date}</TableCell>
                    <TableHead className="text-center">{item.time}</TableHead>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        <span>{{
                          ID: "ID",
                          US: "US",
                          CN: "CN",
                          EU: "EU",
                          JP: "JP",
                          GB: "GB",
                          DE: "DE",
                          FR: "FR",
                          AU: "AU",
                          CA: "CA"
                        }[item.tickers[0]?.slice(0,2)] || "XX"}</span>
                        <span className="text-xs font-medium uppercase">{item.tickers[0]?.slice(0,2)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-medium">{item.title}</TableCell>
                    <TableCell>
                      <Badge variant={getImpactColor(item.impact)}>{item.impact}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={getSentimentColor(item.sentiment)}>
                        {item.sentiment}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.tickers.map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{item.source}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Read more">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-4 w-4" title="Copy link">
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-4 w-4" title="Save">
                          <Bookmark className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Table>
    </div>
  )
}

const getImpactColor = (impact: string) => {
  switch (impact) {
    case "HIGH": return "destructive"
    case "MEDIUM": return "warning"
    case "LOW": return "secondary"
    default: return "secondary"
  }
}

const getSentimentColor = (sentiment: string) => {
  switch (sentiment) {
    case "POSITIVE": return "bg-green-100 text-green-800"
    case "NEGATIVE": return "bg-red-100 text-red-800"
    case "NEUTRAL": return "bg-gray-100 text-gray-800"
    default: return "bg-gray-100 text-gray-800"
  }
}
