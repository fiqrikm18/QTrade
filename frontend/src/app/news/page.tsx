"use client"

import { useState, useEffect } from "react"
import { Search, Download, Settings, Eye, Copy, Bookmark, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getNews, type NewsItem } from "@/lib/api"

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: NewsItem[] };

export default function NewsPage() {
  const [filterCategory, setFilterCategory] = useState("All")
  const [filterSource, setFilterSource] = useState("All")
  const [filterImpact, setFilterImpact] = useState<"all" | Exclude<NewsItem["impact"], null>>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getNews();
        setState({ status: "ready", data });
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load news",
        });
      }
    }
    fetchData();
  }, []);

  const categories = ["All", "Earnings", "Macro", "Monetary Policy", "Corporate Action", "Trade", "Regulation", "Commodities"]
  const sources = ["All", "Bisnis Indonesia", "Kontan", "Reuters", "Bloomberg", "BPS", "Bank Indonesia", "CNBC Indonesia", "Investor Daily"]

  const impactVariant = (impact: NewsItem["impact"]): "destructive" | "warning" | "secondary" => {
    if (!impact) return "secondary"
    switch (impact) {
      case "HIGH":
        return "destructive"
      case "MEDIUM":
        return "warning"
      case "LOW":
        return "secondary"
    }
  }

  const sentimentClass = (sentiment: NewsItem["sentiment"]): string => {
    if (!sentiment) return "bg-muted/10 text-muted border-muted/40"
    switch (sentiment) {
      case "POSITIVE":
        return "bg-positive/10 text-positive border-positive/40"
      case "NEGATIVE":
        return "bg-negative/10 text-negative border-negative/40"
      case "NEUTRAL":
        return "bg-neutral/10 text-neutral border-neutral/40"
    }
  }

  const filteredNews = state.status === "ready" ? state.data.filter((item) => {
    if (filterCategory !== "All" && item.category !== filterCategory) return false
    if (filterSource !== "All" && item.source !== filterSource) return false
    if (filterImpact !== "all" && item.impact !== filterImpact) return false
    if (
      searchQuery &&
      !item.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.summary.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false
    }
    return true
  }) : [];

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
            <p className="text-destructive">Failed to load news</p>
            <p className="text-sm text-muted">{state.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-lg font-semibold">Financial News</h1>
            <p className="text-muted">Real-time financial news and market-moving events</p>
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

        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-muted mb-1">Category</label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-muted mb-1">Source</label>
                <Select value={filterSource} onValueChange={setFilterSource}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-medium text-muted mb-1">Impact</label>
                <Select value={filterImpact} onValueChange={(v) => setFilterImpact(v as "all" | "HIGH" | "MEDIUM" | "LOW")}>
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
                <label className="block text-xs font-medium text-muted mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <Input
                    className="pl-8"
                    placeholder="Search news..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Latest News ({filteredNews.length} articles)</CardTitle>
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
                  {filteredNews.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{item.date}</TableCell>
                      <TableCell className="font-mono text-xs">{item.time}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-medium">
                          {item.tickers[0]?.slice(0, 2) ?? "--"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-medium" title={item.title}>
                        {item.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant={impactVariant(item.impact)}>{item.impact}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={sentimentClass(item.sentiment)}>
                          {item.sentiment}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.tickers.map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{item.source}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Read more">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Copy link">
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Save">
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
        </Card>
    </div>
  )
}