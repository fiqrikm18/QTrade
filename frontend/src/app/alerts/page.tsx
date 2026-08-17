"use client";

import { useState } from "react";
import {
  Bell,
  Filter,
  Search,
  Download,
  Settings,
  Plus,
  X,
  Check,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Globe,
  TrendingUp,
  BarChart3,
  Eye,
  Trash2,
  Edit,
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
import { Switch } from "@/components/ui/switch";

interface Alert {
  id: number;
  time: string;
  type: "technical" | "fundamental" | "news" | "macro" | "market";
  ticker: string;
  message: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  status: "active" | "triggered" | "acknowledged" | "resolved";
  trigger: string;
  acknowledged: boolean;
}

const demoAlerts: Alert[] = [
  { id: 1, time: "09:22", type: "technical", ticker: "BBCA", message: "Opportunity Score crossed 85", impact: "HIGH", status: "active", trigger: "score > 85", acknowledged: false },
  { id: 2, time: "09:18", type: "technical", ticker: "BMRI", message: "Relative Volume > 3x", impact: "HIGH", status: "triggered", trigger: "rel_vol > 3", acknowledged: false },
  { id: 3, time: "09:05", type: "market", ticker: "IHSG", message: "Breadth deteriorating", impact: "HIGH", status: "acknowledged", trigger: "breadth_score < 40", acknowledged: true },
  { id: 4, time: "08:55", type: "fundamental", ticker: "TLKM", message: "Earnings surprise +15%", impact: "MEDIUM", status: "active", trigger: "earnings_surprise > 10%", acknowledged: false },
  { id: 5, time: "08:45", type: "macro", ticker: "IDR", message: "USD/IDR broke 15,700 resistance", impact: "HIGH", status: "triggered", trigger: "usd_idr > 15700", acknowledged: false },
  { id: 6, time: "08:30", type: "technical", ticker: "BBRI", message: "RSI crossed below 30", impact: "MEDIUM", status: "active", trigger: "rsi < 30", acknowledged: false },
  { id: 7, time: "08:15", type: "news", ticker: "ASII", message: "Dividend announcement 150/share", impact: "LOW", status: "acknowledged", trigger: "dividend_announced", acknowledged: true },
  { id: 8, time: "08:00", type: "macro", ticker: "IDR", message: "BI Rate Decision today at 15:00", impact: "HIGH", status: "active", trigger: "bi_meeting_today", acknowledged: false },
  { id: 9, time: "07:45", type: "technical", ticker: "BMRI", message: "Price crossed above SMA50", impact: "MEDIUM", status: "resolved", trigger: "price > sma50", acknowledged: true },
  { id: 10, time: "07:30", type: "fundamental", ticker: "BBRI", message: "Earnings beat +12% YoY", impact: "MEDIUM", status: "triggered", trigger: "earnings_surprise > 10%", acknowledged: false },
  { id: 11, time: "07:00", type: "macro", ticker: "USD/IDR", message: "USD/IDR at 15,650 support test", impact: "MEDIUM", status: "active", trigger: "usd_idr < 15600", acknowledged: false },
  { id: 12, time: "06:30", type: "news", ticker: "TLKM", message: "Telkom Q4 revenue beat 5%", impact: "LOW", status: "acknowledged", trigger: "revenue_surprise > 3%", acknowledged: true },
];

const typeIcons = {
  technical: <Zap className="h-3 w-3" />,
  fundamental: <TrendingUp className="h-3 w-3" />,
  news: <AlertTriangle className="h-3 w-3" />,
  macro: <Globe className="h-3 w-3" />,
  market: <BarChart3 className="h-3 w-3" />,
} as const;

const getImpactVariant = (impact: Alert["impact"]): "destructive" | "warning" | "secondary" => {
  switch (impact) {
    case "HIGH": return "destructive";
    case "MEDIUM": return "warning";
    case "LOW": return "secondary";
  }
};

const getStatusBadgeClass = (status: Alert["status"]): string => {
  switch (status) {
    case "active": return "bg-blue-100 text-blue-800";
    case "triggered": return "bg-yellow-100 text-yellow-800";
    case "acknowledged": return "bg-green-100 text-green-800";
    case "resolved": return "bg-gray-100 text-gray-800";
  }
};

const getStatusIcon = (status: Alert["status"]) => {
  switch (status) {
    case "active": return <AlertTriangle className="h-3 w-3" />;
    case "triggered": return <AlertTriangle className="h-3 w-3" />;
    case "acknowledged": return <CheckCircle className="h-3 w-3" />;
    case "resolved": return <XCircle className="h-3 w-3" />;
  }
};

export default function AlertsPage() {
  const [filterImpact, setFilterImpact] = useState<"all" | Alert["impact"]>("all");
  const [filterType, setFilterType] = useState<"all" | Alert["type"]>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | Alert["status"]>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAlerts = demoAlerts.filter((alert) => {
    if (filterImpact !== "all" && alert.impact !== filterImpact) return false;
    if (filterType !== "all" && alert.type !== filterType) return false;
    if (filterStatus !== "all" && alert.status !== filterStatus) return false;
    if (searchQuery && !alert.message.toLowerCase().includes(searchQuery.toLowerCase()) && !alert.ticker.toLowerCase().includes(searchQuery.toLowerCase()) && !alert.trigger.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Alert Center</h1>
          <p className="text-muted-foreground">Monitor and manage real-time alerts</p>
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
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Create Alert
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Filter Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Impact</label>
              <Select value={filterImpact} onValueChange={(v) => setFilterImpact(v as typeof filterImpact)}>
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="fundamental">Fundamental</SelectItem>
                  <SelectItem value="news">News</SelectItem>
                  <SelectItem value="macro">Macro</SelectItem>
                  <SelectItem value="market">Market</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="triggered">Triggered</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
              <Input
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">
            Alerts ({filteredAlerts.length} alerts)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead className="w-20">Time</TableHead>
                  <TableHead className="w-16">Type</TableHead>
                  <TableHead className="w-16">Ticker</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-16">Impact</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24">Trigger</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.map((alert) => (
                  <TableRow key={alert.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs">{alert.id}</TableCell>
                    <TableCell className="font-mono text-xs">{alert.time}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1">
                        {typeIcons[alert.type]}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono font-medium">{alert.ticker}</TableCell>
                    <TableCell className="max-w-xs truncate">{alert.message}</TableCell>
                    <TableCell>
                      <Badge variant={getImpactVariant(alert.impact)} className="text-xs">
                        {alert.impact}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${getStatusBadgeClass(alert.status)} text-xs`}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(alert.status)}
                          {alert.status}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-xs truncate">{alert.trigger}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={alert.acknowledged}
                          onCheckedChange={() => {}}
                          aria-label={alert.acknowledged ? "Mark as active" : "Mark as acknowledged"}
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:bg-muted hover:text-foreground" title="Dismiss">
                          <X className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:bg-muted hover:text-foreground" title="Details">
                          <Eye className="h-3 w-3" />
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
  );
}