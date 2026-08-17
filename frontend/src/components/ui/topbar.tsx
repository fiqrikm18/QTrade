"use client"

import { cn } from "@/lib/utils"

interface TopbarProps {
  onMenuClick: () => void
  isSidebarOpen: boolean
}

export function Topbar({ onMenuClick, isSidebarOpen }: TopbarProps) {
  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-30 h-16 bg-panel/95 backdrop-blur-sm border-b border-border",
      "transition-all duration-300 ease-in-out",
    )}
    >
      <div className="flex h-full items-center justify-between px-4">
        {/* Left: Menu button + Market status */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={onMenuClick}
            className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2" />
              <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2" />
              <line x1="3" y1="18" x2="21" y2="18" strokeWidth="2" />
            </svg>
          </button>

          {/* Market Status */}
          <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-600 dark:text-green-400">MARKET OPEN</span>
            </div>
            <span className="text-xs text-muted-foreground">09:24:31 WIB</span>
          </div>
        </div>

        {/* Center: Global Search */}
        <div className="flex-1 flex items-center justify-center max-w-xl mx-8">
          <div className="relative w-full max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search ticker, company, metric, sector..."
              className="w-full h-9 pl-10 pr-4 bg-background border border-border rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
        </div>

        {/* Right: Notifications, Theme, User */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <button
            className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Toggle theme"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M17.657 17.657l.707.707M4 12a8 8 0 1116 0 8 8 0 01-16 0z" strokeWidth="1.5" />
            </svg>
          </button>

          {/* Notifications */}
          <button className="relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeWidth="2" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeWidth="2" />
            </svg>
            <span className="absolute top-1 right-1 w-4 h-4 bg-destructive rounded-full text-xs text-white flex items-center justify-center">3</span>
          </button>

          {/* User Menu */}
          <div className="relative">
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:opacity-80">
              <span className="text-sm font-medium">QX</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}