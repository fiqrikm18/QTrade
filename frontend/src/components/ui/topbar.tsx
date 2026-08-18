"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Search,
  Bell,
  Sun,
  Menu,
  Zap,
} from "lucide-react";

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-30 h-14 bg-panel/95 backdrop-blur-sm border-b border-border",
        "transition-all duration-200 ease-in-out",
      )}
    >
      <div className="flex h-full items-center justify-between px-3 lg:px-4">
        {/* Left: Menu button + Market status */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="h-9 w-9"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>

          {/* Market Status */}
          <div className="hidden sm:flex items-center gap-2.5 px-2.5 py-1 rounded-md bg-elevated-panel border border-border">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
              <span className="text-[11px] font-medium text-positive">
                MARKET OPEN
              </span>
            </div>
            <span className="text-[11px] text-muted">09:24:31 WIB</span>
          </div>
        </div>

        {/* Center: Global Search / Command Palette */}
        <div className="flex-1 flex items-center justify-center max-w-xl mx-4 lg:mx-8">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <input
              type="text"
              placeholder="Search ticker, company, metric, sector... (⌘K)"
              className="w-full h-9 pl-9 pr-10 bg-background border border-border rounded-md text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:block px-1.5 py-0.5 text-[10px] font-mono text-muted bg-elevated-panel border border-border rounded">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Right: Notifications, AI Status, Theme, User */}
        <div className="flex items-center gap-1">
          {/* AI/LLM Status */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-elevated-panel border border-border">
            <Zap className="h-3.5 w-3.5 text-accent" />
            <span className="text-[11px] font-medium text-accent">LLM ON</span>
          </div>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-90 text-muted" />
          </Button>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-destructive rounded-full text-[10px] text-white flex items-center justify-center">
              3
            </span>
          </Button>

          {/* User Menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full p-0"
              aria-label="User menu"
            >
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                <span className="text-accent-foreground font-bold text-sm">
                  QX
                </span>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
