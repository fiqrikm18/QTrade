"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { filterStocks } from "@/lib/stocks";
import type { StockListItem } from "@/lib/api";

interface TickerSelectProps {
  options: StockListItem[];
  value: string;
  onSelect: (ticker: string) => void;
}

export function TickerSelect({ options, value, onSelect }: TickerSelectProps) {
  const [query, setQuery] = useState("");
  const filtered = filterStocks(options, query);

  return (
    <Select value={value} onValueChange={onSelect}>
      <SelectTrigger className="w-56" data-testid="ticker-select-trigger">
        <SelectValue placeholder="Select stock" />
      </SelectTrigger>
      <SelectContent>
        <div className="px-1 pb-1">
          <Input
            placeholder="Search ticker or name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted">No matches</p>
        ) : (
          filtered.map((item) => (
            <SelectItem key={item.ticker} value={item.ticker}>
              <span className="font-medium">{item.ticker}</span>
              {item.name ? (
                <span className="ml-2 text-xs text-muted">{item.name}</span>
              ) : null}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}