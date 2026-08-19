"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, Edit, ChevronLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PriceChange } from "@/components/ui/price-change";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getPortfolio,
  createPortfolio,
  getPortfolioDetail,
  addPosition,
  updatePosition,
  deletePosition,
  deletePortfolio,
  type PortfolioItem,
  type PortfolioResponse,
  type PositionCreate,
} from "@/lib/api";

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

type ViewMode = "list" | "detail";

interface PortfolioSummary {
  id: string;
  name: string;
  created_at: string;
  totalMarketValue: number;
  totalPnL: number;
  totalPnLPct: number;
  positionsCount: number;
}

export default function PortfolioPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [listState, setListState] = useState<LoadState<PortfolioItem[]>>({ status: "loading" });
  const [detailState, setDetailState] = useState<LoadState<PortfolioResponse>>({ status: "loading" });
  const [createPortfolioOpen, setCreatePortfolioOpen] = useState(false);
  const [addPositionOpen, setAddPositionOpen] = useState(false);
  const [deletePositionId, setDeletePositionId] = useState<string | null>(null);
  const [deletePortfolioId, setDeletePortfolioId] = useState<string | null>(null);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [newPosition, setNewPosition] = useState<PositionCreate>({ ticker: "", quantity: 0, avg_price: 0 });
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ quantity: number; avg_price: number }>({ quantity: 0, avg_price: 0 });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchPortfolios = useCallback(async () => {
    setListState({ status: "loading" });
    try {
      const data = await getPortfolio();
      setListState({ status: "ready", data });
    } catch (err) {
      setListState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load portfolios",
      });
    }
  }, []);

  const fetchPortfolioDetail = useCallback(async (id: string) => {
    setDetailState({ status: "loading" });
    try {
      const data = await getPortfolioDetail(id);
      setDetailState({ status: "ready", data });
    } catch (err) {
      setDetailState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load portfolio detail",
      });
    }
  }, []);

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;
    try {
      await createPortfolio({ name: newPortfolioName.trim() });
      showToast("Portfolio created", "success");
      setCreatePortfolioOpen(false);
      setNewPortfolioName("");
      fetchPortfolios();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create portfolio", "error");
    }
  };

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPosition.ticker || newPosition.quantity <= 0 || newPosition.avg_price <= 0) return;
    if (!selectedPortfolioId) return;
    try {
      await addPosition(selectedPortfolioId, newPosition);
      showToast("Position added", "success");
      setAddPositionOpen(false);
      setNewPosition({ ticker: "", quantity: 0, avg_price: 0 });
      fetchPortfolioDetail(selectedPortfolioId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to add position", "error");
    }
  };

  const handleUpdatePosition = async (positionId: string) => {
    if (!selectedPortfolioId) return;
    try {
      await updatePosition(selectedPortfolioId, positionId, editValues);
      showToast("Position updated", "success");
      setEditingPositionId(null);
      fetchPortfolioDetail(selectedPortfolioId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update position", "error");
    }
  };

  const handleDeletePosition = async () => {
    if (!selectedPortfolioId || !deletePositionId) return;
    try {
      await deletePosition(selectedPortfolioId, deletePositionId);
      showToast("Position deleted", "success");
      setDeletePositionId(null);
      fetchPortfolioDetail(selectedPortfolioId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete position", "error");
    }
  };

  const handleDeletePortfolio = async () => {
    if (!deletePortfolioId) return;
    try {
      await deletePortfolio(deletePortfolioId);
      showToast("Portfolio deleted", "success");
      setDeletePortfolioId(null);
      if (selectedPortfolioId === deletePortfolioId) {
        setSelectedPortfolioId(null);
        setViewMode("list");
      }
      fetchPortfolios();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete portfolio", "error");
    }
  };

  const handleCardClick = (portfolio: PortfolioSummary) => {
    setSelectedPortfolioId(portfolio.id);
    setViewMode("detail");
    fetchPortfolioDetail(portfolio.id);
  };

  const handleBackToList = () => {
    setViewMode("list");
    setSelectedPortfolioId(null);
  };

  const startEditPosition = (position: PortfolioItem) => {
    setEditingPositionId(position.ticker);
    setEditValues({ quantity: position.quantity, avg_price: position.avgPrice });
  };

  const computeSummary = (positions: PortfolioItem[]): PortfolioSummary[] => {
    const grouped = new Map<string, PortfolioItem[]>();
    for (const pos of positions) {
      const key = pos.ticker;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(pos);
    }
    return Array.from(grouped.entries()).map(([ticker, positions]) => {
      const totalMarketValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
      const totalCost = positions.reduce((sum, p) => sum + p.avgPrice * p.quantity, 0);
      const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
      const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
      return {
        id: ticker,
        name: ticker,
        created_at: "",
        totalMarketValue,
        totalPnL,
        totalPnLPct,
        positionsCount: positions.length,
      };
    });
  };

  if (listState.status === "loading" && viewMode === "list") {
    return (
      <div className="space-y-4">
        <LoadingSkeleton variant="card" rows={5} />
      </div>
    );
  }

  if (listState.status === "error" && viewMode === "list") {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load portfolios</p>
            <p className="text-sm text-muted">{listState.message}</p>
            <Button className="mt-4" onClick={fetchPortfolios}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (detailState.status === "loading" && viewMode === "detail") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={handleBackToList}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <LoadingSkeleton variant="table" rows={5} columns={10} />
      </div>
    );
  }

  if (detailState.status === "error" && viewMode === "detail") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={handleBackToList}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load portfolio detail</p>
            <p className="text-sm text-muted">{detailState.message}</p>
            <Button className="mt-4" onClick={() => selectedPortfolioId && fetchPortfolioDetail(selectedPortfolioId)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const positions = listState.status === "ready" ? listState.data : [];
  const portfolioDetail = detailState.status === "ready" ? detailState.data : null;

  const summaries = computeSummary(positions);

  if (viewMode === "list") {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Portfolios</h1>
            <p className="text-muted">Manage your investment portfolios</p>
          </div>
          <Dialog open={createPortfolioOpen} onOpenChange={setCreatePortfolioOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create Portfolio
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Portfolio</DialogTitle>
                <DialogDescription>Enter a name for your new portfolio</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreatePortfolio}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="portfolioName">Portfolio Name</Label>
                    <Input
                      id="portfolioName"
                      value={newPortfolioName}
                      onChange={(e) => setNewPortfolioName(e.target.value)}
                      placeholder="My Portfolio"
                      autoFocus
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreatePortfolioOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {summaries.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <EmptyState
                title="No portfolios yet"
                description="Create your first portfolio to start tracking investments"
                action={{ label: "Create Portfolio", onClick: () => setCreatePortfolioOpen(true) }}
                icon="folder"
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {summaries.map((summary) => (
              <Card
                key={summary.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => handleCardClick(summary)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{summary.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Positions</span>
                    <span className="font-medium">{summary.positionsCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold tabular-nums">
                        Rp {(summary.totalMarketValue / 1e9).toFixed(2)}B
                      </p>
                      <p className="text-xs text-muted">Total Market Value</p>
                    </div>
                    <div className="text-right">
                      <PriceChange changePct={summary.totalPnLPct} />
                      <p className="text-xs text-muted">Total P&L</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {toast && (
          <div
            className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-md text-sm font-medium shadow-lg animate-in slide-in-from-bottom-4 ${
              toast.type === "success" ? "bg-positive text-white" : "bg-negative text-white"
            }`}
            role="alert"
          >
            {toast.message}
          </div>
        )}
      </div>
    );
  }

  if (!portfolioDetail) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={handleBackToList}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              title="Portfolio not found"
              description="This portfolio may have been deleted"
              action={{ label: "Back to Portfolios", onClick: handleBackToList, variant: "outline" }}
              icon="folder"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { id, name, created_at, positions: detailPositions } = portfolioDetail;
  const totalValue = detailPositions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalCost = detailPositions.reduce((sum, p) => sum + p.avgPrice * p.quantity, 0);
  const totalPnL = detailPositions.reduce((sum, p) => sum + p.pnl, 0);
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleBackToList}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{name}</h1>
            <p className="text-sm text-muted">Created {new Date(created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={addPositionOpen} onOpenChange={setAddPositionOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Position
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Position</DialogTitle>
                <DialogDescription>Add a new position to this portfolio</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddPosition}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="ticker">Ticker</Label>
                    <Input
                      id="ticker"
                      value={newPosition.ticker}
                      onChange={(e) => setNewPosition({ ...newPosition, ticker: e.target.value.toUpperCase() })}
                      placeholder="BBCA"
                      autoFocus
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      step="1"
                      value={newPosition.quantity}
                      onChange={(e) => setNewPosition({ ...newPosition, quantity: Number(e.target.value) })}
                      placeholder="100"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="avg_price">Average Price</Label>
                    <Input
                      id="avg_price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={newPosition.avg_price}
                      onChange={(e) => setNewPosition({ ...newPosition, avg_price: Number(e.target.value) })}
                      placeholder="5000"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddPositionOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Position</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={!!deletePortfolioId} onOpenChange={(open) => !open && setDeletePortfolioId(null)}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" onClick={() => setDeletePortfolioId(id)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Portfolio
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Portfolio</DialogTitle>
<DialogDescription>
                Are you sure you want to delete &ldquo;{name}&rdquo;? This action cannot be undone.
              </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeletePortfolioId(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeletePortfolio}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">Rp {(totalValue / 1e9).toFixed(2)}B</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              <PriceChange changePct={totalPnLPct} />
            </div>
            <p className="text-sm text-muted">Rp {totalPnL >= 0 ? "+" : ""}{(totalPnL / 1e6).toFixed(1)}M</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted">Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{detailPositions.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm">Positions</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {detailPositions.length === 0 ? (
            <EmptyState
              title="No positions"
              description="Add your first position to start tracking"
              action={{ label: "Add Position", onClick: () => setAddPositionOpen(true) }}
              icon="chart"
              className="py-8"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Avg Price</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Market Value</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead className="text-right">P&L %</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead className="text-right w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailPositions.map((position) => {
                    const isEditing = editingPositionId === position.ticker;
                    const weight = totalValue > 0 ? (position.marketValue / totalValue) * 100 : 0;
                    return (
                      <TableRow key={position.ticker}>
                        <TableCell className="font-medium">{position.ticker}</TableCell>
                        <TableCell>{position.name}</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={editValues.quantity}
                              onChange={(e) => setEditValues({ ...editValues, quantity: Number(e.target.value) })}
                              className="w-24"
                              autoFocus
                            />
                          ) : (
                            position.quantity.toLocaleString()
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={editValues.avg_price}
                              onChange={(e) => setEditValues({ ...editValues, avg_price: Number(e.target.value) })}
                              className="w-28"
                            />
                          ) : (
                            position.avgPrice.toLocaleString()
                          )}
                        </TableCell>
                        <TableCell className="text-right">{position.currentPrice.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          Rp {(position.marketValue / 1e6).toFixed(1)}M
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {position.pnl >= 0 ? "+" : ""}Rp {(position.pnl / 1e6).toFixed(1)}M
                        </TableCell>
                        <TableCell className="text-right">
                          <PriceChange changePct={position.pnlPct} />
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {weight.toFixed(1)}%
                        </TableCell>
                        <TableCell>{position.sector || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isEditing ? (
                              <>
                                <Button
                                  size="xs"
                                  variant="secondary"
                                  onClick={() => handleUpdatePosition(position.ticker)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => setEditingPositionId(null)}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => startEditPosition(position)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive hover:bg-negative/10"
                                  onClick={() => setDeletePositionId(position.ticker)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {deletePositionId && (
        <Dialog open onOpenChange={() => setDeletePositionId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Position</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this position? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletePositionId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeletePosition}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-md text-sm font-medium shadow-lg animate-in slide-in-from-bottom-4 ${
            toast.type === "success" ? "bg-positive text-white" : "bg-negative text-white"
          }`}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}