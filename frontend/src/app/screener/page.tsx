"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Filter,
  X,
  Search,
  ChevronDown,
  Download,
  SlidersHorizontal,
  ChevronUp,
  ArrowUp,
  ArrowDown,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StockData {
  rank: number;
  ticker: string;
  company: string;
  price: number;
  change: number;
  volume: number;
  turnover: number;
  marketCap: number;
  technical: number;
  fundamental: number;
  momentum: number;
  smartMoney: number;
  sector: number;
  risk: number;
  ml: number;
  opportunity: number;
}

const screenerData: StockData[] = [
  { rank: 1, ticker: "BBCA", company: "Bank Central Asia", price: 9125, change: 1.42, volume: 1500000, turnover: 13.7, marketCap: 175000000, technical: 88, fundamental: 91, momentum: 84, smartMoney: 79, sector: 87, risk: 76, ml: 81, opportunity: 92 },
  { rank: 2, ticker: "BMRI", company: "Bank Mandiri", price: 6250, change: 2.13, volume: 2100000, turnover: 13.1, marketCap: 290000000, technical: 90, fundamental: 86, momentum: 92, smartMoney: 88, sector: 82, risk: 77, ml: 89, opportunity: 89 },
  { rank: 3, ticker: "TLKM", company: "Telkom Indonesia", price: 3010, change: -0.33, volume: 800000, turnover: 2.4, marketCap: 298000000, technical: 84, fundamental: 79, momentum: 82, smartMoney: 77, sector: 65, risk: 72, ml: 75, opportunity: 79 },
  { rank: 4, ticker: "BBRI", company: "Bank Rakyat Indonesia", price: 5180, change: 0.97, volume: 1800000, turnover: 9.3, marketCap: 765000000, technical: 82, fundamental: 85, momentum: 80, smartMoney: 85, sector: 80, risk: 75, ml: 80, opportunity: 84 },
];

const sectors = ["BANKING", "ENERGY", "TELCO", "PROPERTY", "CONSUMER", "HEALTHCARE", "TECHNOLOGY", "INFRASTRUCTURE"];

export default function ScreenerPage() {
  const [filters, setFilters] = useState({
    sector: "",
    minPrice: "",
    maxPrice: "",
    rsiMin: "",
    rsiMax: "",
    minOpportunity: "",
    maxOpportunity: "",
  });
  const [sortConfig, setSortConfig] = useState<{ key: keyof StockData; direction: "asc" | "desc" }>({ key: "opportunity", direction: "desc" });

  const handleSort = (key: keyof StockData) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortIcon = (key: keyof StockData) => {
    if (sortConfig.key !== key) return <ChevronDown className="h-4 w-4 text-muted-foreground" />;
    return sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  const filteredData = [...screenerData].sort((a, b) => {
    const aVal = a[sortConfig.key] as number | string;
    const bVal = b[sortConfig.key] as number | string;
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const scoreColor = (score: number) => {
    if (score >= 80) return "success";
    if (score >= 60) return "warning";
    return "destructive";
  };

  const changeColor = (change: number) => (change >= 0 ? "text-green-600" : "text-red-600");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Screener</h1>
          <p className="text-muted-foreground">Filter and rank stocks across the IDX universe</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Save Screen
          </Button>
          <Button>
            <Filter className="mr-2 h-4 w-4" />
            Run Screener
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setFilters({
            sector: "",
            minPrice: "",
            maxPrice: "",
            rsiMin: "",
            rsiMax: "",
            minOpportunity: "",
            maxOpportunity: "",
          })}>
            <X className="mr-2 h-4 w-4" />
            Clear All
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Sector</label>
              <Select value={filters.sector} onValueChange={(value) => setFilters((prev) => ({ ...prev, sector: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Sectors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Sectors</SelectItem>
                  {sectors.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Min Price</label>
              <Input
                type="number"
                placeholder="0"
                value={filters.minPrice}
                onChange={(e) => setFilters((prev) => ({ ...prev, minPrice: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Max Price</label>
              <Input
                type="number"
                placeholder="100000"
                value={filters.maxPrice}
                onChange={(e) => setFilters((prev) => ({ ...prev, maxPrice: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">RSI Min</label>
              <Input
                type="number"
                placeholder="0"
                value={filters.rsiMin}
                onChange={(e) => setFilters((prev) => ({ ...prev, rsiMin: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">RSI Max</label>
              <Input
                type="number"
                placeholder="100"
                value={filters.rsiMax}
                onChange={(e) => setFilters((prev) => ({ ...prev, rsiMax: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Min Opportunity</label>
              <Input
                type="number"
                placeholder="0"
                value={filters.minOpportunity}
                onChange={(e) => setFilters((prev) => ({ ...prev, minOpportunity: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Max Opportunity</label>
              <Input
                type="number"
                placeholder="100"
                value={filters.maxOpportunity}
                onChange={(e) => setFilters((prev) => ({ ...prev, maxOpportunity: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button>Apply Filters</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 cursor-pointer" onClick={() => handleSort("rank")}>
                  # {getSortIcon("rank")}
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("ticker")}>
                  Ticker {getSortIcon("ticker")}
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("company")}>
                  Company {getSortIcon("company")}
                </TableHead>
                <TableHead className="w-24 text-right cursor-pointer" onClick={() => handleSort("price")}>
                  Price {getSortIcon("price")}
                </TableHead>
                <TableHead className="w-24 text-right cursor-pointer" onClick={() => handleSort("change")}>
                  Change% {getSortIcon("change")}
                </TableHead>
                <TableHead className="w-28 text-right cursor-pointer" onClick={() => handleSort("volume")}>
                  Volume {getSortIcon("volume")}
                </TableHead>
                <TableHead className="w-24 text-right cursor-pointer" onClick={() => handleSort("turnover")}>
                  Turnover {getSortIcon("turnover")}
                </TableHead>
                <TableHead className="w-24 text-right cursor-pointer" onClick={() => handleSort("marketCap")}>
                  Mkt Cap {getSortIcon("marketCap")}
                </TableHead>
                <TableHead className="w-20 text-center cursor-pointer" onClick={() => handleSort("technical")}>
                  Technical {getSortIcon("technical")}
                </TableHead>
                <TableHead className="w-20 text-center cursor-pointer" onClick={() => handleSort("fundamental")}>
                  Fundamental {getSortIcon("fundamental")}
                </TableHead>
                <TableHead className="w-20 text-center cursor-pointer" onClick={() => handleSort("momentum")}>
                  Momentum {getSortIcon("momentum")}
                </TableHead>
                <TableHead className="w-20 text-center cursor-pointer" onClick={() => handleSort("smartMoney")}>
                  Smart Money {getSortIcon("smartMoney")}
                </TableHead>
                <TableHead className="w-20 text-center cursor-pointer" onClick={() => handleSort("sector")}>
                  Sector {getSortIcon("sector")}
                </TableHead>
                <TableHead className="w-20 text-center cursor-pointer" onClick={() => handleSort("risk")}>
                  Risk {getSortIcon("risk")}
                </TableHead>
                <TableHead className="w-20 text-center cursor-pointer" onClick={() => handleSort("ml")}>
                  ML {getSortIcon("ml")}
                </TableHead>
                <TableHead className="w-24 text-center cursor-pointer" onClick={() => handleSort("opportunity")}>
                  Opportunity {getSortIcon("opportunity")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => (
                <TableRow key={item.ticker}>
                  <TableCell className="font-medium">{item.rank}</TableCell>
                  <TableCell className="font-medium">{item.ticker}</TableCell>
                  <TableCell>{item.company}</TableCell>
                  <TableCell className="text-right">{item.price.toLocaleString()}</TableCell>
                  <TableCell className={cn("text-right font-medium", changeColor(item.change))}>
                    {item.change > 0 ? "+" : ""}{item.change}%
                  </TableCell>
                  <TableCell className="text-right">{item.volume.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{item.turnover}B</TableCell>
                  <TableCell className="text-right">{(item.marketCap / 1e12).toFixed(0)}T</TableCell>
                  <TableCell className="text-center font-medium">{item.technical}</TableCell>
                  <TableCell className="text-center font-medium">{item.fundamental}</TableCell>
                  <TableCell className="text-center font-medium">{item.momentum}</TableCell>
                  <TableCell className="text-center font-medium">{item.smartMoney}</TableCell>
                  <TableCell className="text-center font-medium">{item.sector}</TableCell>
                  <TableCell className="text-center font-medium">{item.risk}</TableCell>
                  <TableCell className="text-center font-medium">{item.ml}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={scoreColor(item.opportunity)}>{item.opportunity}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}