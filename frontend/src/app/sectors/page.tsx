"use client"

import { AppShell } from "@/components/ui/appshell"
import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { TrendingUp, TrendingDown, BarChart2, ArrowUp, ArrowDown, Target, AlertTriangle, Clock, Zap, Eye, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useState } from "react"

export default function SectorsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const sectorData = [
    { sector: "BANKING", perf1d: 2.1, perf5d: 4.2, perf20d: 7.8, rs: 91, score: 89, rotation: "LEADING", momentum: 88, breadth: 72, volume: 1.2, valuation: 78 },
    { sector: "ENERGY", perf1d: 1.7, perf5d: 5.8, perf20d: 3.1, rs: 84, score: 82, rotation: "IMPROVING", momentum: 79, breadth: 68, volume: 0.9, valuation: 85 },
    { sector: "TELCO", perf1d: -0.3, perf5d: 1.1, perf20d: 2.4, rs: 63, score: 65, rotation: "WEAKENING", momentum: 65, breadth: 58, volume: 0.7, valuation: 72 },
    { sector: "PROPERTY", perf1d: -1.2, perf5d: -2.4, perf20d: -4.8, rs: 42, score: 44, rotation: "LAGGING", momentum: 45, breadth: 38, volume: 0.5, valuation: 58 },
    { sector: "ENERGY", perf1d: 2.3, perf5d: 6.2, perf20d: 4.1, rs: 87, score: 85, rotation: "LEADING", momentum: 91, breadth: 75, volume: 1.1, valuation: 79 },
    { sector: "CONSUMER", perf1d: 0.8, perf5d: 2.1, perf20d: 1.8, rs: 71, score: 68, rotation: "IMPROVING", momentum: 72, breadth: 62, volume: 0.8, valuation: 75 },
    { sector: "HEALTHCARE", perf1d: 0.5, perf5d: -0.2, perf20d: -1.2, rs: 58, score: 61, rotation: "WEAKENING", momentum: 55, breadth: 52, volume: 0.6, valuation: 70 },
    { sector: "INFRASTRUCTURE", perf1d: 1.1, perf5d: 2.8, perf20d: 3.5, rs: 76, score: 73, rotation: "IMPROVING", momentum: 78, breadth: 66, volume: 0.9, valuation: 80 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sector Analysis</h1>
          <p className="text-muted-foreground">Sector rotation, performance, and rotation matrix</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Sector Rotation Matrix */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Rotation Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground">
              [Rotation Matrix Chart - Momentum vs Relative Strength]
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-green-50 rounded"><span className="font-medium text-green-600">LEADING</span><br/>High Mom, High RS</div>
              <div className="p-2 bg-blue-50 rounded"><span className="font-medium text-blue-600">IMPROVING</span><br/>Low Mom, High RS</div>
              <div className="p-2 bg-yellow-50 rounded"><span className="font-medium text-yellow-600">WEAKENING</span><br/>High Mom, Low RS</div>
              <div className="p-2 bg-red-50 rounded"><span className="font-medium text-red-600">LAGGING</span><br/>Low Mom, Low RS</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {/* Sector Performance Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Sector Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sector</TableHead>
                    <TableHead className="w-20">1D</TableHead>
                    <TableHead className="w-20">5D</TableHead>
                    <TableHead className="w-20">20D</TableHead>
                    <TableHead className="w-20">RS</TableHead>
                    <TableHead className="w-20">Momentum</TableHead>
                    <TableHead className="w-20">Breadth</TableHead>
                    <TableHead className="w-20">Volume</TableHead>
                    <TableHead className="w-20">Valuation</TableHead>
                    <TableHead className="w-20">Rotation</TableHead>
                    <TableHead className="w-20">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectorData.map((sector) => (
                    <TableRow key={sector.sector} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{sector.sector}</TableCell>
                      <TableCell className={sector.perf1d >= 0 ? "text-green-600" : "text-red-600"}>
                        {sector.perf1d > 0 ? "+" : ""}{sector.perf1d}%
                      </TableCell>
                      <TableCell className={sector.perf5d >= 0 ? "text-green-600" : "text-red-600"}>
                        {sector.perf5d > 0 ? "+" : ""}{sector.perf5d}%
                      </TableCell>
                      <TableCell className={sector.perf20d >= 0 ? "text-green-600" : "text-red-600"}>
                        {sector.perf20d > 0 ? "+" : ""}{sector.perf20d}%
                      </TableCell>
                      <TableCell className="font-medium">{sector.rs}</TableCell>
                      <TableCell>
                        <Badge variant={sector.momentum >= 70 ? "success" : sector.momentum >= 50 ? "default" : "destructive"}>
                          {sector.momentum}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sector.breadth >= 60 ? "success" : sector.breadth >= 40 ? "default" : "destructive"}>
                          {sector.breadth}%
                        </Badge>
                      </TableCell>
                      <TableCell>{sector.volume}x</TableCell>
                      <TableCell>
                        <Badge variant={sector.valuation >= 70 ? "success" : sector.valuation >= 50 ? "default" : "destructive"}>
                          {sector.valuation}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          sector.rotation === "LEADING" ? "success" :
                          sector.rotation === "IMPROVING" ? "default" :
                          sector.rotation === "WEAKENING" ? "warning" : "destructive"
                        }>
                          {sector.rotation}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold">
                        <Badge variant={sector.score >= 80 ? "success" : sector.score >= 60 ? "default" : "destructive"}>
                          {sector.score}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Sector Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sector Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {sectorData.map((sector) => (
                <div key={sector.sector} className={`p-4 rounded-lg text-center ${sector.perf1d >= 0 ? "bg-green-50 border-l-4 border-green-500" : "bg-red-50 border-l-4 border-red-500"}`}>
                  <p className="font-bold text-sm">{sector.sector}</p>
                  <p className={`text-2xl font-bold ${sector.perf1d >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {sector.perf1d > 0 ? "+" : ""}{sector.perf1d}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    5D: {sector.perf5d > 0 ? "+" : ""}{sector.perf5d}% | 20D: {sector.perf20d > 0 ? "+" : ""}{sector.perf20d}%
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-2 text-xs">
                    <Badge variant={sector.rotation === "LEADING" ? "success" : sector.rotation === "IMPROVING" ? "default" : sector.rotation === "WEAKENING" ? "warning" : "destructive"} className="text-xs">
                      {sector.rotation}
                    </Badge>
                    <Badge variant="outline">{sector.score}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}