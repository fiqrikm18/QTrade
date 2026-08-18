"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      <Topbar onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
      <main className={cn(
        "pt-14 transition-all duration-200 ease-in-out",
        "lg:pl-64",
      )}>
        <div className="h-full">
          <div className="p-3 lg:p-4">
            <div className="h-full">{children}</div>
          </div>
        </div>
      </main>
      {/* Status Bar */}
      <footer className={cn(
        "fixed bottom-0 left-0 right-0 z-20 h-8 bg-panel border-t border-border",
        "transition-all duration-200 ease-in-out",
        "lg:pl-64",
      )}>
        <div className="flex h-full items-center justify-between px-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-positive" />
              <span>API Connected</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-positive" />
              <span>WS Connected</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-warning" />
              <span>1 Job Running</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Data: Fresh</span>
            <span>Provider: Yahoo Finance</span>
            <span>v0.1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}