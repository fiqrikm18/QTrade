"use client"

import { AppShell } from "@/components/ui/appshell"
import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Database, AlertCircle, CheckCircle, XCircle, AlertTriangle, RefreshCw, Download, Settings, Clock, Shield, Search, Filter, Trash2, Edit, Plus, Eye, BarChart3, Database as DatabaseIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Download, Filter, Search, ChevronDown, ChevronUp, Settings, Database, AlertCircle, CheckCircle, XCircle, AlertTriangle, RefreshCw, Shield, Clock, Search, Filter, Trash2, Edit, Plus, Eye, BarChart3, Database as DatabaseIcon } from "lucide-react"

export default function DataQualityPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  const qualityMetrics = [
    { name: "Market Data", score: 99, status: "excellent", issues: 2, lastUpdate: "2024-01-15 09:24:31" },
    { metric: "Fundamentals", score: 96, status: "good", issues: 8, lastUpdate: "2024-01-14 16:20:15" },
    { metric: "Corporate Actions", score: 100, status: "excellent", issues: 0, lastUpdate: "2024-01-15 06:00:00" },
    { metric: "Macro", score: 98, status: "excellent", issues: 1, lastUpdate: "2024-01-15 08:30:00" },
    { metric: "News", score: 97, status: "good", issues: 3, lastUpdate: "2024-01-15 09:15:00" },
  ]

  const issues = [
    { id: 1, table: "ohlcv_daily", ticker: "BBCA", issue: "Missing trading day", severity: "medium", detected: "2024-01-15 09:00:00", status: "open" },
    { id: 2, table: "ohlcv_daily", ticker: "TLKM", issue: "Negative volume", severity: "high", detected: "2024-01-15 09:00:00", status: "in_progress" },
    { id: 3, table: "financial_statements", ticker: "ASII", issue: "Missing Q4 2023 report", severity: "medium", detected: "2024-01-14 16:20:00", status: "open" },
    { id: 4, table: "ohlcv_daily", ticker: "BBRI", issue: "Duplicate row", severity: "low", detected: "2024-01-15 09:00:00", status: "resolved" },
    { id: 5, table: "financial_ratios", ticker: "BMRI", issue: "Stale data (3 days old)", severity: "medium", detected: "2024-01-15 09:00:00", status: "in_progress" },
    { id: 6, table: "ohlcv_daily", ticker: "TLKM", issue: "Price gap > 10%", severity: "high", detected: "2024-01-14 16:20:00", status: "in_progress" },
  ]

  const freshnessData = [
    { table: "ohlcv_daily", lastUpdate: "2024-01-15 09:24:31", maxDate: "2024-01-12", rows: 48000, cadence: "Daily (15:50 WIB)", status: "fresh" },
    { table: "financial_statements", lastUpdate: "2024-01-14 16:20:00", maxDate: "2023-12-31", rows: 12000, cadence: "Quarterly", status: "stale" },
    { table: "corporate_actions", lastUpdate: "2024-01-15 06:00:00", maxDate: "2024-01-15", rows: 1200, cadence: "Daily", status: "fresh" },
    { table: "economic_indicators", lastUpdate: "2024-01-15 08:30:00", maxDate: "2024-01-12", rows: 500, cadence: "Daily", status: "fresh" },
    { table: "economic_events", lastUpdate: "2024-01-15 06:00:00", maxDate: "2024-01-31", rows: 450, cadence: "Daily", status: "fresh" },
    { table: "news", lastUpdate: "2024-01-15 09:15:00", maxDate: "2024-01-15", rows: 2500, cadence: "15 min", status: "fresh" },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "excellent": return <Badge variant="success">Excellent</Badge>
      case "good": return <Badge variant="default">Good</Badge>
      case "fair": return <Badge variant="warning">Fair</Badge>
      case "poor": return <Badge variant="destructive">Poor</Badge>
      case "fresh": return <Badge variant="success">Fresh</Badge>
      case "stale": return <Badge variant="warning">Stale</Badge>
      case "open": return <Badge variant="destructive">Open</Badge>
      case "in_progress": return <Badge variant="warning">In Progress</Badge>
      case "resolved": return <Badge variant="success">Resolved</Badge>
      default: return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "high": return <Badge variant="destructive">High</Badge>
      case "medium": return <Badge variant="warning">Medium</Badge>
      case "low": return <Badge variant="secondary">Low</Badge>
      default: return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const getIssueStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <Badge variant="destructive">Open</Badge>
      case "in_progress": return <Badge variant="warning">In Progress</Badge>
      case "resolved": return <Badge variant="success">Resolved</Badge>
      default: return <Badge variant="secondary">Unknown</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Data Quality Monitor</h1>
          <p className="text-muted-foreground">Monitor and maintain data integrity across all sources</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {}}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh All
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Check
          </Button>
        </div>
      </div>

      {/* Overall Quality Score */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {qualityMetrics.map((metric) => (
          <Card key={metric.name} className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-muted/50 rounded-tr-lg" />
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">{metric.name}</span>
                {getStatusBadge(metric.status || metric.metric)}
              </div>
              <div className="text-3xl font-bold">{metric.score}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {metric.issues} issues • Updated {metric.lastUpdate}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="freshness">Freshness</TabsTrigger>
          <TabsTrigger value="checks">Quality Checks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quality Score Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {qualityMetrics.map((metric) => (
                    <div key={metric.name} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: metric.status === "excellent" ? "#22c55e" : metric.status === "good" ? "#3b82f6" : metric.status === "fair" ? "#f59e0b" : "#ef4444" }} />
                        <span className="text-sm font-medium">{metric.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{metric.score}</span>
                        {getStatusBadge(metric.status || metric.metric)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Freshness Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {freshnessData.map((item) => (
                    <div key={item.table} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.status === "fresh" ? "#22c55e" : "#ef4444" }} />
                        <span className="font-medium font-mono text-sm">{item.table}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="font-mono">{item.rows.toLocaleString()} rows</span>
                        <span>{item.cadence}</span>
                        <Badge variant={item.status === "fresh" ? "success" : "warning"}>
                          {item.status === "fresh" ? "Fresh" : "Stale"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Data Quality Issues</CardTitle>
              <div className="flex items-center gap-2">
                <Select value="all" onValueChange={() => {}} className="w-40">
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value="all" onValueChange={() => {}} className="w-40">
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead className="w-24">Severity</TableHead>
                      <TableHead className="w-32">Detected</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell className="font-mono text-xs">{issue.id}</TableCell>
                        <TableCell>{issue.table}</TableCell>
                        <TableCell className="font-mono">{issue.ticker}</TableCell>
                        <TableCell className="max-w-xs truncate">{issue.issue}</TableCell>
                        <TableCell>{getSeverityBadge(issue.severity)}</TableCell>
                        <TableCell className="font-mono text-xs">{issue.detected}</TableCell>
                        <TableCell>{getIssueStatusBadge(issue.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6"><Eye className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6"><Edit className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="freshness" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Data Freshness</CardTitle>
                <Button variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh All
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Table</TableHead>
                        <TableHead className="w-40">Last Updated</TableHead>
                        <TableHead className="w-28">Max Date</TableHead>
                        <TableHead className="w-20">Rows</TableHead>
                        <TableHead className="w-32">Cadence</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead className="w-24">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {freshnessData.map((item) => (
                        <TableRow key={item.table}>
                          <TableCell className="font-mono text-sm">{item.table}</TableCell>
                          <TableCell className="font-mono text-xs">{item.lastUpdate}</TableCell>
                          <TableCell className="font-mono text-xs">{item.maxTradeDate}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{item.rowCount.toLocaleString()}</TableCell>
                          <TableCell>{item.cadence}</TableCell>
                          <TableCell>{item.status === "fresh" ? <Badge variant="success">Fresh</Badge> : <Badge variant="warning">Stale</Badge>}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6" title="Refresh">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checks" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Quality Checks</CardTitle>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Check
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { name: "OHLCV Missing Days Check", table: "ohlcv_daily", schedule: "Daily 16:15", status: "active", lastRun: "2024-01-15 16:15:00", nextRun: "2024-01-16 16:15:00" },
                    { name: "OHLCV Anomaly Detection", table: "ohlcv_daily", schedule: "Daily 16:30", status: "active", lastRun: "2024-01-15 16:30:00", nextRun: "2024-01-16 16:30:00" },
                    { name: "Fundamental Data Completeness", table: "financial_statements", schedule: "Daily 17:00", status: "active", lastRun: "2024-01-15 17:00:00", nextRun: "2024-01-16 17:00:00" },
                    { name: "Corporate Actions Validation", table: "corporate_actions", schedule: "Daily 16:30", status: "active", lastRun: "2024-01-15 16:30:00", nextRun: "2024-01-16 16:30:00" },
                    { name: "Macro Data Freshness", table: "economic_indicators", schedule: "Daily 18:00", status: "active", lastRun: "2024-01-15 18:00:00", nextRun: "2024-01-16 18:00:00" },
                    { name: "News Deduplication", table: "news", schedule: "Every 15 min", status: "active", lastRun: "2024-01-15 09:15:00", nextRun: "2024-01-15 09:30:00" },
                    { name: "Corporate Actions Validation", table: "corporate_actions", schedule: "Daily 16:30", status: "paused", lastRun: "2024-01-14 16:30:00", nextRun: "Paused" },
                    { name: "Index Constituency Check", table: "stocks", schedule: "Weekly Mon 06:00", status: "active", lastRun: "2024-01-15 06:00:00", nextRun: "2024-01-22 06:00:00" },
                  ].map((check) => (
                    <div key={check.name} className="flex items-center justify-between p-4 border-b border-border/50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{check.name}</span>
                          <Badge variant={check.status === "active" ? "success" : "secondary"} className="text-xs">
                            {check.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{check.table} • {check.schedule}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Last: {check.lastRun}</span>
                        <span>Next: {check.nextRun}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Run now"><RefreshCw className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit"><Edit className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-50" title="Delete"><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </Tabs>
    </div>
  )
}