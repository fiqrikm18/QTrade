"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BarChart3,
  Search,
  List,
  Compare,
  BarChart2,
  Globe,
  Calendar,
  Briefcase,
  Activity,
  AlertTriangle,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Market", href: "/market", icon: BarChart3 },
  { name: "Screener", href: "/screener", icon: Search },
  { name: "Stocks", href: "/stocks", icon: List },
  { name: "Compare", href: "/compare", icon: Compare },
  { name: "Sectors", href: "/sectors", icon: BarChart2 },
  { name: "Macro", href: "/macro", icon: Globe },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Portfolio", href: "/portfolio", icon: Briefcase },
  { name: "Backtest", href: "/backtest", icon: Activity },
  { name: "Alerts", href: "/alerts", icon: AlertTriangle },
  { name: "Research", href: "/research", icon: Settings },
];

const macroNavigation = [
  { name: "Macro", href: "/macro", icon: Globe },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "News", href: "/news", icon: Settings },
];

const portfolioNavigation = [
  { name: "Portfolio", href: "/portfolio", icon: Briefcase },
  { name: "Risk", href: "/risk", icon: AlertTriangle },
  { name: "Alerts", href: "/alerts", icon: AlertTriangle },
];

const researchNavigation = [
  { name: "Backtest", href: "/backtest", icon: Activity },
  { name: "Research", href: "/research", icon: Settings },
];

const systemNavigation = [
  { name: "Data Quality", href: "/data-quality", icon: Settings },
  { name: "Models", href: "/models", icon: Settings },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-panel border-r border-border transition-all duration-300 ease-in-out",
        isOpen ? "w-64" : "w-16",
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo & Brand */}
        <div
          className={cn(
            "flex h-16 items-center justify-between px-4 border-b border-border",
            isOpen && "px-4",
          )}
        >
          {isOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">
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
            className="h-10 w-10"
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
          <NavSection
            title="OVERVIEW"
            items={[
              { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
              { name: "Market", href: "/market", icon: BarChart3 },
            ]}
          />

          <NavSection
            title="ANALYSIS"
            items={[
              { name: "Screener", href: "/screener", icon: Search },
              { name: "Stocks", href: "/stocks", icon: List },
              { name: "Compare", href: "/compare", icon: Compare },
              { name: "Sectors", href: "/sectors", icon: BarChart2 },
            ]}
          />

          <NavSection title="MACRO" items={macroNavigation} />

          <NavSection title="PORTFOLIO" items={portfolioNavigation} />

          <NavSection title="RESEARCH" items={researchNavigation} />

          <NavSection title="SYSTEM" items={systemNavigation} />
        </nav>

        {/* Status Bar */}
        <div className="border-t border-border p-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>MARKET OPEN</span>
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Last update: 09:24:31 WIB
          </div>
        </div>
      </div>
    </aside>
  );
}

interface NavSectionProps {
  title: string;
  items: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

function NavSection({ title, items }: NavSectionProps) {
  return (
    <div className="space-y-1">
      <h3 className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      {items.map((item) => (
        <a
          key={item.name}
          href={item.href}
          className={cn(
            "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-accent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
          href={item.href}
        >
          <item.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{item.name}</span>
        </a>
      ))}
    </div>
  );
}
