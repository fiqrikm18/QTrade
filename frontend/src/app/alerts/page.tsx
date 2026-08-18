"use client";

import { useState, useEffect } from "react";
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
  Loader2,
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
import { getAlerts, type Alert } from "@/lib/api";

const typeIcons = {
  technical: <Zap className="h-3 w-3" />,
  fundamental: <TrendingUp className="h-3 w-3" />,
  news: <AlertTriangle className="h-3 w-3" />,
  macro: <Globe className="h-3 w-3" />,
  market: <BarChart3 className="h-3 w-3" />,
} as const;

const getImpactVariant = (
  impact: Alert["impact"],
): "destructive" | "warning" | "secondary" => {
  switch (impact) {
    case "HIGH":
      return "destructive";
    case "MEDIUM":
      return "warning";
    case "LOW":
      return "secondary";
  }
};

const getStatusBadgeClass = (status: Alert["status"]): string => {
  switch (status) {
    case "active":
      return "bg-info/10 text-info border-info/40";
    case "triggered":
      return "bg-warning/10 text-warning border-warning/40";
    case "acknowledged":
      return "bg-positive/10 text-positive border-positive/40";
    case "resolved":
      return "bg-neutral/10 text-neutral border-neutral/40";
  }
};

const getStatusIcon = (status: Alert["status"]) => {
  switch (status) {
    case "active":
      return <AlertTriangle className="h-3 w-3" />;
    case "triggered":
      return <AlertTriangle className="h-3 w-3" />;
    case "acknowledged":
      return <CheckCircle className="h-3 w-3" />;
    case "resolved":
      return <XCircle className="h-3 w-3" />;
  }
};

export default function AlertsPage() {
  const [filterImpact, setFilterImpact] = useState<"all" | Alert["impact"]>(
    "all",
  );
  const [filterType, setFilterType] = useState<"all" | Alert["type"]>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | Alert["status"]>(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const data = await getAlerts();
        setAlerts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load alerts");
      } finally {
        setIsLoading(false);
      }
    }
    fetchAlerts();
  }, []);

  const filteredAlerts = alerts.filter((alert) => {
    if (filterImpact !== "all" && alert.impact !== filterImpact) return false;
    if (filterType !== "all" && alert.type !== filterType) return false;
    if (filterStatus !== "all" && alert.status !== filterStatus) return false;
    if (
      searchQuery &&
      !alert.message.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !alert.ticker.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !alert.trigger.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Alert Center</h1>
          <p className="text-muted">
            Monitor and manage real-time alerts
          </p>
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
          <CardTitle className="text-sm">Filter Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-muted mb-1">
                Impact
              </label>
              <Select
                value={filterImpact}
                onValueChange={(v) => setFilterImpact(v as typeof filterImpact)}
              >
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
              <label className="block text-xs font-medium text-muted mb-1">
                Type
              </label>
              <Select
                value={filterType}
                onValueChange={(v) => setFilterType(v as typeof filterType)}
              >
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
              <label className="block text-xs font-medium text-muted mb-1">
                Status
              </label>
              <Select
                value={filterStatus}
                onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
              >
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
              <label className="block text-xs font-medium text-muted mb-1">
                Search
              </label>
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
          <CardTitle className="text-sm">
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
                  <TableRow key={alert.id} className="hover:bg-elevated-panel/50">
                    <TableCell className="font-mono text-xs">
                      {alert.id}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {alert.time}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1">
                        {typeIcons[alert.type]}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {alert.ticker}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {alert.message}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getImpactVariant(alert.impact)}
                        className="text-xs"
                      >
                        {alert.impact}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${getStatusBadgeClass(alert.status)} text-xs`}
                      >
                        <span className="flex items-center gap-1">
                          {getStatusIcon(alert.status)}
                          {alert.status}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-xs truncate">
                      {alert.trigger}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={alert.acknowledged}
                          onCheckedChange={() => {}}
                          aria-label={
                            alert.acknowledged
                              ? "Mark as active"
                              : "Mark as acknowledged"
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted hover:bg-elevated-panel hover:text-foreground"
                          title="Dismiss"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted hover:bg-elevated-panel hover:text-foreground"
                          title="Details"
                        >
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
