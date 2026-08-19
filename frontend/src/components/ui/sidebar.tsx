"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  BarChart3,
  Search,
  List,
  GitCompare,
  BarChart2,
  Globe,
  Calendar,
  Briefcase,
  Activity,
  AlertTriangle,
  Settings,
  Menu,
  ChevronLeft,
  LineChart,
  BookOpen,
  Database,
} from "lucide-react";

const overviewNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Market", href: "/market", icon: BarChart3 },
];

const analysisNavigation = [
  { name: "Screener", href: "/screener", icon: Search },
  { name: "Stocks", href: "/stocks", icon: List },
  { name: "Compare", href: "/compare", icon: GitCompare },
  { name: "Sectors", href: "/sectors", icon: BarChart2 },
];

const macroNavigation = [
  { name: "Macro", href: "/macro", icon: Globe },
  { name: "Economic Calendar", href: "/calendar", icon: Calendar },
  { name: "News", href: "/news", icon: LineChart },
];

const portfolioNavigation = [
  { name: "Portfolio", href: "/portfolio", icon: Briefcase },
  { name: "Alerts", href: "/alerts", icon: AlertTriangle },
];

const researchNavigation = [
  { name: "Backtest", href: "/backtest", icon: Activity },
  { name: "Research", href: "/research", icon: BookOpen },
];

const systemNavigation = [
  { name: "Data Quality", href: "/data-quality", icon: Database },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface NavSectionProps {
  title: string;
  items: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
  isOpen: boolean;
}

function NavSection({ title, items, isOpen }: NavSectionProps) {
  return (
    <div className="space-y-1">
      {isOpen && (
        <h3 className="px-3 py-1.5 text-[10px] font-semibold text-muted uppercase tracking-wider">
          {title}
        </h3>
      )}
      {items.map((item) => (
        <a
          key={item.name}
          href={item.href}
          className={cn(
            "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
            "text-muted hover:text-foreground hover:bg-elevated-panel",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            isOpen ? "justify-start" : "justify-center",
          )}
          title={isOpen ? undefined : item.name}
        >
          <item.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {isOpen && <span className="truncate">{item.name}</span>}
        </a>
      ))}
    </div>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-panel border-r border-border transition-all duration-200 ease-in-out",
        isOpen ? "w-64" : "w-16",
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo & Brand */}
        <div
          className={cn(
            "flex h-14 items-center justify-between px-3 border-b border-border",
            isOpen && "px-4",
          )}
        >
          {isOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <span className="text-accent-foreground font-bold text-sm">
                  QX
                </span>
              </div>
              <span className="font-semibold text-foreground">IHSG QUANT</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-9 w-9"
            aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto p-2 space-y-1"
          role="navigation"
          aria-label="Main navigation"
        >
          <NavSection title="OVERVIEW" items={overviewNavigation} isOpen={isOpen} />
          <NavSection title="ANALYSIS" items={analysisNavigation} isOpen={isOpen} />
          <NavSection title="MACRO" items={macroNavigation} isOpen={isOpen} />
          <NavSection title="PORTFOLIO" items={portfolioNavigation} isOpen={isOpen} />
          <NavSection title="RESEARCH" items={researchNavigation} isOpen={isOpen} />
          <NavSection title="SYSTEM" items={systemNavigation} isOpen={isOpen} />
        </nav>

        {/* Status Bar */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
              <span className="font-medium text-positive">MARKET OPEN</span>
            </span>
          </div>
          <div className="mt-1 text-xs text-muted">
            Last update: 09:24:31 WIB
          </div>
        </div>
      </div>
    </aside>
  );
}