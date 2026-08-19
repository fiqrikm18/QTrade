"use client";

import { useEffect, useState } from "react";
import {
  Database,
  Zap,
  Bot,
  Clock,
  Info,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getSettings, type BackendSettings } from "@/lib/api";

type TabValue = "providers" | "schedules" | "llm";

const providerItems = [
  { key: "macro_provider", label: "Macro Provider", desc: "Macroeconomic data source", icon: Database },
  { key: "news_provider", label: "News Provider", desc: "News data source", icon: Zap },
  { key: "fundamental_provider", label: "Fundamental Provider", desc: "Fundamental data source", icon: Bot },
] as const;

const scheduleItems = [
  { key: "ingest_macro_cron", label: "Macro Ingestion", desc: "Macro data ingestion schedule" },
  { key: "ingest_news_cron", label: "News Ingestion", desc: "News data ingestion schedule" },
  { key: "ingest_fundamentals_cron", label: "Fundamentals Ingestion", desc: "Fundamentals data ingestion schedule" },
  { key: "ingest_cron", label: "OHLCV Ingestion", desc: "OHLCV data ingestion schedule (trading days)" },
  { key: "watchdog_cron", label: "Watchdog", desc: "System health check schedule" },
] as const;

const llmFeatureItems = [
  { key: "llm_analysis_enabled", label: "Analysis", desc: "AI-powered stock analysis" },
  { key: "llm_news_summary_enabled", label: "News Summary", desc: "AI-generated news summaries" },
  { key: "llm_stock_explanation_enabled", label: "Stock Explanation", desc: "AI explanations for stock scores" },
  { key: "llm_macro_summary_enabled", label: "Macro Summary", desc: "AI macroeconomic summaries" },
  { key: "llm_nl_screener_enabled", label: "NL Screener", desc: "Natural language screening queries" },
  { key: "llm_research_enabled", label: "Research", desc: "AI-generated research memos" },
] as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<BackendSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>("providers");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getSettings();
        if (!cancelled) {
          setSettings(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load settings");
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs: { value: TabValue; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "providers", label: "Data Providers", icon: Database },
    { value: "schedules", label: "Ingestion Schedules", icon: Clock },
    { value: "llm", label: "LLM Features", icon: Bot },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading settings...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load settings</p>
            <p className="text-sm text-muted">{error}</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!settings) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="text-muted">Backend configuration (read-only)</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Settings sections">
          {tabs.map((tab) => (
            <Button
              key={tab.value}
              role="tab"
              aria-selected={activeTab === tab.value}
              variant={activeTab === tab.value ? "default" : "outline"}
              className="flex items-center gap-2"
              onClick={() => setActiveTab(tab.value)}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          ))}
        </div>

        {activeTab === "providers" && (
          <div className="space-y-4" role="tabpanel" aria-label="Data providers">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Data Providers</CardTitle>
                <CardDescription>
                  Configured data sources for each category. These are set via environment variables.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {providerItems.map((item) => {
                  const value = settings[item.key as keyof BackendSettings] as string;
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-4 border border-border rounded-md"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-5 w-5 text-muted" />
                        <div>
                          <Label className="text-sm font-medium">{item.label}</Label>
                          <p className="text-sm text-muted">{item.desc}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {value}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "schedules" && (
          <div className="space-y-4" role="tabpanel" aria-label="Ingestion schedules">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ingestion Schedules</CardTitle>
                <CardDescription>
                  Cron expressions for automated data ingestion jobs. All times in UTC.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {scheduleItems.map((item) => {
                  const value = settings[item.key as keyof BackendSettings] as string;
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-4 border border-border rounded-md"
                    >
                      <div>
                        <Label className="text-sm font-medium">{item.label}</Label>
                        <p className="text-sm text-muted">{item.desc}</p>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs px-3 py-1">
                        {value}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "llm" && (
          <div className="space-y-4" role="tabpanel" aria-label="LLM features">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">LLM Configuration</CardTitle>
                <CardDescription>
                  LLM provider and model settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Provider</Label>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {settings.llm_provider}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Model</Label>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {settings.llm_model}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">LLM Enabled</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={settings.llm_enabled}
                        disabled
                      />
                      <span className="text-sm text-muted">
                        {settings.llm_enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">LLM Feature Toggles</CardTitle>
                <CardDescription>
                  Per-feature AI capabilities. Requires LLM provider to be configured with API key.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {llmFeatureItems.map((item) => {
                  const enabled = settings[item.key as keyof BackendSettings] as boolean;
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-4 border border-border rounded-md"
                    >
                      <div className="flex items-center gap-3">
                        <Switch checked={enabled} disabled />
                        <div>
                          <Label className="text-sm font-medium">{item.label}</Label>
                          <p className="text-sm text-muted">{item.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={enabled ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {enabled ? "Enabled" : "Disabled"}
                        </Badge>
{!settings.llm_enabled && (
              <Info className="h-3.5 w-3.5 text-muted" />
            )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {!settings.llm_enabled && (
              <Card className="border-destructive/50 bg-destructive/10">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 p-4">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-medium text-destructive">AI Features Unavailable</p>
                      <p className="text-sm text-muted">
                        LLM provider is not configured (missing API key). Set <code className="font-mono text-xs bg-muted px-1 rounded">LLM_API_KEY</code>
                        in environment variables to enable AI features.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}