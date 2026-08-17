"use client"

import { AppShell } from "@/components/ui/appshell"
import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { ChevronLeft, ChevronRight, Calendar, Filter, Search, Download, Calendar as CalendarIcon, Flag, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function CalendarPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [view, setView] = useState<"month" | "week" | "list">("month")
  const [filterImpact, setFilterImpact] = useState<"all" | "high" | "medium" | "low">("all")
  const [filterCountry, setFilterCountry] = useState("all")

  const events = [
    { date: "2024-01-15", time: "09:00", country: "ID", event: "CPI YoY", impact: "HIGH", prev: "2.1%", consensus: "2.3%", actual: "2.4%", category: "Inflation" },
    { date: "2024-01-15", time: "10:00", country: "ID", event: "Core CPI YoY", impact: "MEDIUM", prev: "1.8%", consensus: "1.9%", actual: "2.0%", category: "Inflation" },
    { date: "2024-01-15", time: "19:30", country: "US", event: "CPI YoY", impact: "HIGH", prev: "3.0%", consensus: "2.9%", actual: "2.9%", category: "Inflation" },
    { date: "2024-01-15", time: "19:30", country: "US", event: "Core CPI YoY", impact: "HIGH", prev: "3.5%", consensus: "3.4%", actual: "3.3%", category: "Inflation" },
    { date: "2024-01-16", time: "08:30", country: "ID", event: "Trade Balance", impact: "MEDIUM", prev: "$2.8B", consensus: "$3.0B", actual: "$3.2B", category: "Trade" },
    { date: "2024-01-17", time: "09:00", country: "ID", event: "BI Rate Decision", impact: "HIGH", prev: "5.75%", consensus: "5.75%", actual: "5.75%", category: "Monetary" },
    { date: "2024-01-18", time: "08:30", country: "ID", event: "GDP QoQ", impact: "HIGH", prev: "1.55%", consensus: "1.60%", actual: "1.57%", category: "Growth" },
    { date: "2024-01-18", time: "19:30", country: "US", event: "Retail Sales", impact: "MEDIUM", prev: "0.2%", consensus: "0.3%", actual: "0.4%", category: "Consumption" },
    { date: "2024-01-19", time: "21:00", country: "US", event: "Fed Minutes", impact: "HIGH", prev: "--", consensus: "--", actual: "--", category: "Monetary" },
    { date: "2024-01-22", time: "08:30", country: "CN", event: "GDP QoQ", impact: "HIGH", prev: "1.2%", consensus: "1.1%", actual: "1.2%", category: "Growth" },
    { date: "2024-01-22", time: "08:30", country: "CN", event: "Industrial Production", impact: "HIGH", prev: "6.2%", consensus: "6.0%", actual: "6.1%", category: "Industrial" },
    { date: "2024-01-22", time: "08:30", country: "CN", event: "Retail Sales", impact: "HIGH", prev: "9.5%", consensus: "8.5%", actual: "9.2%", category: "Consumption" },
    { date: "2024-01-22", time: "10:00", country: "EU", event: "ECB Rate Decision", impact: "HIGH", prev: "3.75%", consensus: "3.75%", actual: "--", category: "Monetary" },
    { date: "2024-01-23", time: "19:30", country: "US", event: "Initial Jobless Claims", impact: "MEDIUM", prev: "210K", consensus: "215K", actual: "212K", category: "Labor" },
    { date: "2024-01-24", time: "19:30", country: "US", event: "PMI Manufacturing", impact: "MEDIUM", prev: "49.5", consensus: "49.8", actual: "50.1", category: "PMI" },
    { date: "2024-01-24", time: "21:00", country: "US", event: "Existing Home Sales", impact: "LOW", prev: "3.82M", consensus: "3.80M", actual: "3.78M", category: "Housing" },
    { date: "2024-01-25", time: "19:30", country: "US", event: "GDP QoQ (Advance)", impact: "HIGH", prev: "4.9%", consensus: "4.7%", actual: "--", category: "Growth" },
    { date: "2024-01-26", time: "19:30", country: "US", event: "Core PCE Price Index", impact: "HIGH", prev: "2.8%", consensus: "2.7%", actual: "--", category: "Inflation" },
    { date: "2024-01-29", time: "19:30", country: "US", event: "Personal Income", impact: "MEDIUM", prev: "0.4%", consensus: "0.3%", actual: "--", category: "Income" },
    { date: "2024-01-29", time: "19:30", country: "US", event: "Personal Spending", impact: "MEDIUM", prev: "0.5%", consensus: "0.4%", actual: "--", category: "Consumption" },
    { date: "2024-01-30", time: "19:30", country: "US", event: "Employment Cost Index", impact: "MEDIUM", prev: "1.1%", consensus: "1.0%", actual: "--", category: "Labor" },
    { date: "2024-01-30", time: "21:00", country: "US", event: "Fed Decision", impact: "HIGH", prev: "5.25%", consensus: "5.25%", actual: "--", category: "Monetary" },
    { date: "2024-01-31", time: "09:00", country: "ID", event: "Money Supply M2", impact: "MEDIUM", prev: "8.5%", consensus: "8.3%", actual: "--", category: "Monetary" },
  ]

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "HIGH": return "destructive"
      case "MEDIUM": return "warning"
      case "LOW": return "secondary"
      default: return "secondary"
    }
  }

  const getCountryFlag = (country: string) => {
    const flags: Record<string, string> = {
      ID: "��������", US: "��������", CN: "��������", EU: "��������", JP: "��������", GB: "��������", DE: "��������", FR: "��������", AU: "��������", CA: "��������"
    }
    return flags[country] || country
  }

  const filteredEvents = events.filter(event => {
    if (filterImpact !== "all" && event.impact !== filterImpact) return false
    if (filterCountry !== "all" && event.country !== filterCountry) return false
    return true
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Economic Calendar</h1>
          <p className="text-muted-foreground">Track global economic events and their market impact</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setView("month")} className="mr-2">
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
              <line x1="16" y1="2" x2="16" y2="22" strokeWidth={2} />
              <line x1="8" y1="2" x2="8" y2="22" strokeWidth={2} />
              <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} />
            </svg>
            Month
          </Button>
          <Button variant="outline" size="sm" className="mr-2">
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
              <line x1="16" y1="2" x2="16" y2="22" strokeWidth={2} />
              <line x1="8" y1="2" x2="8" y2="22" strokeWidth={2} />
              <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} />
            </svg>
            Week
          </Button>
          <Button variant="outline" size="sm">
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 000 4h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            List
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <Select value={""} onValueChange={(val) => setFilterImpact(val as "all" | "high" | "medium" | "low")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Impact" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Impact</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={""} onValueChange={(val) => setFilterCountry(val)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              <SelectItem value="ID">�������� Indonesia</SelectItem>
              <SelectItem value="US">�������� United States</SelectItem>
              <SelectItem value="CN">�������� China</SelectItem>
              <SelectItem value="EU">�������� Eurozone</SelectItem>
              <SelectItem value="JP">�������� Japan</SelectItem>
              <SelectItem value="GB">�������� United Kingdom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time (WIB)</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Impact</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Previous</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Consensus</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((event, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {new Date(event.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{event.time}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    <span className="inline-flex items-center gap-1">
                      <span>{event.country === "ID" ? "��������" : event.country === "US" ? "��������" : event.country === "CN" ? "��������" : event.country === "EU" ? "��������" : event.country}</span>
                      <span className="text-xs font-medium uppercase">{event.country}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{event.event}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${event.impact === "HIGH" ? "bg-red-100 text-red-800" : event.impact === "MEDIUM" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"}`}>
                      {event.impact}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-500">{event.prev}</td>
                  <td className="px-6 py-4 text-right text-sm text-gray-500">{event.consensus}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">{event.actual}</td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500 capitalize">{event.category.toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}