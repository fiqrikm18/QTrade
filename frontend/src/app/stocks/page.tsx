"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { getStocks, type StockListItem } from "@/lib/api";

const PAGE_SIZE = 20;

export default function StocksPage() {
  const router = useRouter();
  const [items, setItems] = useState<StockListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(searchQuery.trim()),
      300,
    );
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  useEffect(() => {
    let cancelled = false;
    async function fetchPage() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getStocks(
          page,
          PAGE_SIZE,
          debouncedSearch || undefined,
        );
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load stocks");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void fetchPage();
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading universe...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertTriangle className="h-10 w-10 text-negative" />
        <div className="ml-4">
          <h2 className="text-base font-semibold">Failed to load stocks</h2>
          <p className="text-xs text-muted">{error}</p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => {
              setPage(1);
              setIsLoading(true);
              setError(null);
              void getStocks(1, PAGE_SIZE, debouncedSearch || undefined)
                .then((data) => {
                  setItems(data.items);
                  setTotal(data.total);
                })
                .catch((err) =>
                  setError(
                    err instanceof Error ? err.message : "Failed to load stocks",
                  ),
                )
                .finally(() => setIsLoading(false));
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Stock Universe</h1>
          <p className="text-xs text-muted">
            {total.toLocaleString("en-US")} listed stocks
          </p>
        </div>
        <Input
          placeholder="Search ticker or name..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full sm:w-72"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6 text-muted text-center text-sm">
              No stocks match the current search.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Board</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.ticker}
                    className="cursor-pointer"
                    onClick={() => router.push(`/stocks/${item.ticker}`)}
                  >
                    <TableCell className="font-medium">{item.ticker}</TableCell>
                    <TableCell>{item.name ?? "--"}</TableCell>
                    <TableCell>{item.board ?? "--"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="xs"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="xs"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
