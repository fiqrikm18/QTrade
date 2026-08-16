"use client"

import { AppShell } from "@/components/ui/appshell"
import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Filter, X, Search, ChevronDown, Download, SlidersHorizontal, Filter as FilterIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Download, Filter as FilterIcon, Search, ChevronUp, ChevronDown } from "lucide-react"

export default function ScreenerPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [filters, setFilters] = useState({
    sector: "",
    minPrice: "",
    maxPrice: "",
    rsiMin: "",
    rsiMax: "",
    minOpportunity: "",
    maxOpportunity: "",
  })
  const [sortConfig, setSortConfig] = useState({ key: "opportunity", direction: "desc" })

  const screenerData = [
    { rank: 1, ticker: "BBCA", company: "Bank Central Asia", price: 9125, change: 1.42, volume: 1500000, turnover: 13.7, marketCap: 175000000, technical: 88, fundamental: 91, momentum: 84, smartMoney: 79, sector: 87, risk: 76, ml: 81, opportunity: 92 },
    { rank: 2, ticker: "BMRI", company: "Bank Mandiri", price: 6250, change: 2.13, volume: 2100000, turnover: 13.1, marketCap: 290000000, technical: 90, fundamental: 86, momentum: 92, smartMoney: 88, sector: 82, risk: 77, ml: 89, opportunity: 89 },
    { rank: 3, ticker: "TLKM", company: "Telkom Indonesia", price: 3010, change: -0.33, volume: 800000, turnover: 2.4, marketCap: 298000000, technical: 84, fundamental: 79, momentum: 82, smartMoney: 77, sector: 65, risk: 72, ml: 75, opportunity: 79 },
    { rank: 4, ticker: "BBRI", company: "Bank Rakyat Indonesia", price: 5180, change: 0.97, volume: 1800000, turnover: 9.3, marketCap: 765000000, technical: 82, fundamental: 85, momentum: 80, smartMoney: 85, sector: 80, risk: 75, ml: 80, opportunity: 84 },
    { rank: 5, ticker: "TLKM", company: "Telkom Indonesia", price: 3010, change: -0.33, volume: 800000, turnover: 2.4, marketCap: 298000000, technical: 84, fundamental: 79, momentum: 82, smartMoney: 77, sector: 65, risk: 72, ml: 75, opportunity: 79 },
  ]

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }))
  }

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return "���"
    return sortConfig.direction === "asc" ? "��" : "��"
  }

  const filteredData = [...screenerData].sort((a, b) => {
    const aVal = a[sortConfig.key]
    const bVal = b[sortConfig.key]
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1
    return 0
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Screener</h1>
          <p className="text-muted-foreground">Filter and rank stocks across the IDX universe</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </Button>
          <Button variant="outline" size="sm">
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 000 4h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-2 4h2a2 2 0 012 2v4a2 2 0 01-2 2H7a2 2 0 01-2-2v-4" />
            </svg>
            Save Screen
          </Button>
          <Button>
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6V4z" />
            </svg>
            Run Screener
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => {}}>
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear All
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Sector</label>
              <select className="w-full h-9 px-3 border border-border rounded-md bg-background text-sm">
                <option value="">All Sectors</option>
                <option value="BANKING">BANKING</option>
                <option value="ENERGY">ENERGY</option>
                <option value="TELCO">TELCO</option>
                <option value="PROPERTY">PROPERTY</option>
                <option value="CONSUMER">CONSUMER</option>
                <option value="HEALTHCARE">HEALTHCARE</option>
                <option value="TECHNOLOGY">TECHNOLOGY</option>
                <option value="INFRASTRUCTURE">INFRASTRUCTURE</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Min Price</label>
              <input type="number" placeholder="0" className="w-full h-9 px-3 border border-border rounded-md bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Max Price</label>
              <input type="number" placeholder="100000" className="w-full h-9 px-3 border border-border rounded-md bg-background text-sm" />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">RSI Min</label>
              <input type="number" placeholder="0" className="w-full h-9 px-3 border border-border rounded-md bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">RSI Max</label>
              <input type="number" placeholder="100" className="w-full h-9 px-3 border border-border rounded-md bg-background text-sm" />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Min Opportunity</label>
              <input type="number" placeholder="0" className="w-full h-9 px-3 border border-border rounded-md bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Max Opportunity</label>
              <input type="number" placeholder="100" className="w-full h-9 px-3 border border-border rounded-md bg-background text-sm" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
              Apply Filters
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticker</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Volume</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Turnover</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Mkt Cap</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Technical</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Fundamental</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Momentum</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Smart Money</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Sector</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Risk</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">ML</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Opportunity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">1</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">BBCA</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Bank Central Asia</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">9,125</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">+1.42%</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">1,500,000</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">13.7B</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">175T</td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">88</td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">91</td>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">84</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">79</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">87</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">76</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">81</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-green-600">92</th>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">2</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">BMRI</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Bank Mandiri</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">6,250</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">+2.13%</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">2,100,000</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">13.1B</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">290T</td>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">90</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">86</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">92</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">88</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">82</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">77</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">89</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-green-600">89</th>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">3</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">TLKM</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Telkom Indonesia</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">3,010</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-red-600">-0.33%</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">800,000</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">2.4B</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">298T</td>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">84</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">79</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">82</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">77</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">65</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">72</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">75</th>
                <th className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-yellow-600">79</th>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}