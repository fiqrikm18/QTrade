"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ImpactBadge } from "@/components/ui/impact-badge";
import { SentimentBadge } from "@/components/ui/sentiment-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { getNews, type NewsItem } from "@/lib/api";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: NewsItem[]; total: number; page: number };

type FilterImpact = "all" | "HIGH" | "MEDIUM" | "LOW";
type FilterSentiment = "all" | "POSITIVE" | "NEGATIVE" | "NEUTRAL";

export default function NewsPage() {
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterSource, setFilterSource] = useState("All");
  const [filterImpact, setFilterImpact] = useState<FilterImpact>("all");
  const [filterSentiment, setFilterSentiment] = useState<FilterSentiment>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const fetchNews = useCallback(async (page = 1, append = false) => {
    if (!append) setState({ status: "loading" });
    else setIsFetchingMore(true);

    try {
      const data = await getNews();
      const total = data.length;
      const start = (page - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      const pageData = data.slice(start, end);

      setLastFetched(new Date().toISOString());

      if (append) {
        setState((prev) =>
          prev.status === "ready"
            ? { status: "ready", data: [...prev.data, ...pageData], total, page }
            : { status: "ready", data: pageData, total, page }
        );
      } else {
        setState({ status: "ready", data: pageData, total, page });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load news";
      if (append) {
        setIsFetchingMore(false);
      } else {
        setState({ status: "error", message });
      }
    } finally {
      if (append) setIsFetchingMore(false);
    }
  }, []);

  useEffect(() => {
    async function loadInitial() {
      await fetchNews(1, false);
    }
    loadInitial();
  }, [fetchNews]);

  const handleRetry = () => {
    fetchNews(1, false);
  };

  const handleLoadMore = () => {
    if (state.status === "ready" && !isFetchingMore) {
      const nextPage = state.page + 1;
      fetchNews(nextPage, true);
    }
  };

  const categories = [
    "All",
    "Earnings",
    "Macro",
    "Monetary Policy",
    "Corporate Action",
    "Trade",
    "Regulation",
    "Commodities",
  ];
  const sources = [
    "All",
    "Bisnis Indonesia",
    "Kontan",
    "Reuters",
    "Bloomberg",
    "BPS",
    "Bank Indonesia",
    "CNBC Indonesia",
    "Investor Daily",
  ];

  const filteredNews = state.status === "ready"
    ? state.data.filter((item) => {
        if (filterCategory !== "All" && item.category !== filterCategory) return false;
        if (filterSource !== "All" && item.source !== filterSource) return false;
        if (filterImpact !== "all" && item.impact !== filterImpact) return false;
        if (filterSentiment !== "all" && item.sentiment !== filterSentiment) return false;
        if (
          searchQuery &&
          !item.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !item.summary.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
    : [];

  const hasMore = state.status === "ready" && state.data.length < state.total;

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Financial News</h1>
            <p className="text-muted">Real-time financial news and market-moving events</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <LoadingSkeleton variant="table" rows={8} columns={8} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Financial News</h1>
            <p className="text-muted">Real-time financial news and market-moving events</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 text-negative">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold">Failed to load news</h2>
                <p className="text-sm text-muted mt-1">{state.message}</p>
                <Button size="sm" variant="outline" onClick={handleRetry} className="mt-3">
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Financial News</h1>
          <p className="text-muted">
            Real-time financial news and market-moving events
            {lastFetched && (
              <span className="ml-2 text-xs text-muted">
                (Updated: {new Date(lastFetched).toLocaleTimeString()})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={isFetchingMore} onClick={handleLoadMore}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isFetchingMore && "animate-spin")} />
            {isFetchingMore ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[180px]">
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
            <div className="flex-1 min-w-[180px]">
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
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-muted mb-1">Impact</label>
              <Select value={filterImpact} onValueChange={(v) => setFilterImpact(v as FilterImpact)}>
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
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-muted mb-1">Sentiment</label>
              <Select value={filterSentiment} onValueChange={(v) => setFilterSentiment(v as FilterSentiment)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Sentiment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sentiment</SelectItem>
                  <SelectItem value="POSITIVE">Positive</SelectItem>
                  <SelectItem value="NEGATIVE">Negative</SelectItem>
                  <SelectItem value="NEUTRAL">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-muted mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <Input
                  className="pl-8"
                  placeholder="Search title or summary..."
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
          <CardTitle className="text-sm">
            Latest News ({filteredNews.length} of {state.total} articles)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredNews.length === 0 ? (
            <EmptyState
              title="No news articles"
              description={searchQuery || filterCategory !== "All" || filterSource !== "All" || filterImpact !== "all" || filterSentiment !== "all"
                ? "Try adjusting your filters or search query"
                : "No news articles available at this time"}
              icon="folder"
              action={{
                label: "Clear filters",
                onClick: () => {
                  setFilterCategory("All");
                  setFilterSource("All");
                  setFilterImpact("all");
                  setFilterSentiment("all");
                  setSearchQuery("");
                },
                variant: "outline",
              }}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead className="w-20">Date</TableHead>
                      <TableHead className="w-16">Time</TableHead>
                      <TableHead className="w-24">Category</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-16">Impact</TableHead>
                      <TableHead className="w-20">Sentiment</TableHead>
                      <TableHead className="w-24">Source</TableHead>
                      <TableHead className="w-32">Tickers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNews.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs text-muted">{index + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{item.date}</TableCell>
                        <TableCell className="font-mono text-xs">{item.time}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-medium">
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate font-medium" title={item.title}>
                          {item.title}
                        </TableCell>
                        <TableCell>
                          <ImpactBadge impact={item.impact} />
                        </TableCell>
                        <TableCell>
                          <SentimentBadge sentiment={item.sentiment} />
                        </TableCell>
                        <TableCell className="text-sm font-medium">{item.source}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.tickers.length > 0 ? (
                              item.tickers.map((t) => (
                                <Badge key={t} variant="secondary" className="text-xs">
                                  {t}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {hasMore && (
                <div className="p-3 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleLoadMore}
                    disabled={isFetchingMore}
                  >
                    {isFetchingMore ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      `Load more (${state.data.length} / ${state.total})`
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}