"use client";

import { useState } from "react";
import {
  User,
  Bell,
  Shield,
  Palette,
  Database,
  Globe,
  Key,
  Save,
  RefreshCw,
  Download,
  Upload,
  Moon,
  Sun,
  Monitor,
  Smartphone,
  Tablet,
  CreditCard,
  Mail,
  Lock,
  Copy,
  FileText,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TabValue = "general" | "appearance" | "notifications" | "data" | "advanced";

type NotificationSettings = {
  email: boolean;
  priceAlerts: boolean;
  newsAlerts: boolean;
  portfolioAlerts: boolean;
  macroAlerts: boolean;
  push: boolean;
};

const emailNotificationItems = [
  { id: "email", label: "Email notifications", desc: "Receive notifications via email" },
  { id: "priceAlerts", label: "Price alerts", desc: "Price crossing thresholds" },
  { id: "newsAlerts", label: "News alerts", desc: "Breaking news and announcements" },
  { id: "portfolioAlerts", label: "Portfolio alerts", desc: "Portfolio value changes" },
  { id: "macroAlerts", label: "Macro alerts", desc: "Macroeconomic events" },
] as const;

const pushNotificationItems = [
  { id: "push", label: "Push notifications", desc: "Receive push notifications" },
  { id: "priceAlerts", label: "Price alerts", desc: "Price crossing thresholds" },
  { id: "newsAlerts", label: "News alerts", desc: "Breaking news and announcements" },
  { id: "portfolioAlerts", label: "Portfolio alerts", desc: "Portfolio value changes" },
  { id: "macroAlerts", label: "Macro alerts", desc: "Macroeconomic events" },
] as const;

const dataRetentionOptions = [
  { value: "1month", label: "1 Month", desc: "Delete data after 1 month" },
  { value: "3months", label: "3 Months", desc: "Delete data after 3 months" },
  { value: "1year", label: "1 Year", desc: "Delete data after 1 year (recommended)" },
  { value: "forever", label: "Forever", desc: "Keep data indefinitely" },
] as const;

const themeOptions = [
  { value: "light" as const, label: "Light", icon: Sun, desc: "Always use light mode" },
  { value: "dark" as const, label: "Dark", icon: Moon, desc: "Always use dark mode" },
  { value: "system" as const, label: "System", icon: Monitor, desc: "Match system preference" },
] as const;

const densityOptions = [
  { value: "compact", label: "Compact", desc: "Maximum information density" },
  { value: "default", label: "Default", desc: "Balanced density" },
  { value: "comfortable", label: "Comfortable", desc: "More whitespace" },
] as const;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabValue>("general");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [notifications, setNotifications] = useState<NotificationSettings>({
    email: true,
    push: true,
    priceAlerts: true,
    newsAlerts: true,
    portfolioAlerts: true,
    macroAlerts: false,
  });
  const [dataRetention, setDataRetention] = useState("1year");

  const tabs: { value: TabValue; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "general", label: "General", icon: User },
    { value: "appearance", label: "Appearance", icon: Palette },
    { value: "notifications", label: "Notifications", icon: Bell },
    { value: "data", label: "Data & Privacy", icon: Database },
    { value: "advanced", label: "Advanced", icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and application preferences</p>
        </div>
      </div>

      <div className="space-y-6">
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

        {activeTab === "general" && (
          <div className="space-y-6" role="tabpanel" aria-label="General settings">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profile</CardTitle>
                <CardDescription>Manage your profile information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                    <Input id="name" defaultValue="John Doe" className="w-full" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                    <Input id="email" type="email" defaultValue="john.doe@example.com" className="w-full" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                    <Input id="phone" type="tel" defaultValue="+62 812-3456-7890" className="w-full" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company" className="text-sm font-medium">Company</Label>
                    <Input id="company" defaultValue="Quant Analytics Ltd." className="w-full" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone" className="text-sm font-medium">Timezone</Label>
                  <Select defaultValue="Asia/Jakarta">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Jakarta">Asia/Jakarta (WIB)</SelectItem>
                      <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                      <SelectItem value="Asia/Shanghai">Asia/Shanghai (CST)</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => {}}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "appearance" && (
          <div className="space-y-6" role="tabpanel" aria-label="Appearance settings">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Theme</CardTitle>
                <CardDescription>Choose your preferred color theme</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {themeOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={theme === option.value ? "default" : "outline"}
                      className="h-24 flex-col items-start justify-between p-4 text-left"
                      onClick={() => setTheme(option.value)}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <option.icon className="h-6 w-6" />
                        <span className="font-medium">{option.label}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{option.desc}</p>
                      <div className="mt-2 w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/20"
                          style={{
                            width:
                              option.value === "light"
                                ? "100%"
                                : option.value === "dark"
                                ? "50%"
                                : "33%",
                          }}
                        />
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Density</CardTitle>
                <CardDescription>Adjust the density of the interface</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {densityOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant="outline"
                      className="h-24 flex-col items-start justify-between p-4 text-left"
                    >
                      <span className="font-medium">{option.label}</span>
                      <p className="text-sm text-muted-foreground">{option.desc}</p>
                      <div className="mt-2 w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/20"
                          style={{
                            width:
                              option.value === "compact"
                                ? "100%"
                                : option.value === "default"
                                ? "66%"
                                : "33%",
                          }}
                        />
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sidebar</CardTitle>
                <CardDescription>Configure sidebar behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Auto-collapse</Label>
                    <p className="text-sm text-muted-foreground">Collapse sidebar on mobile</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Show icons only when collapsed</Label>
                    <p className="text-sm text-muted-foreground">Show only icons when sidebar is collapsed</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Persistent on desktop</Label>
                    <p className="text-sm text-muted-foreground">Keep sidebar open on desktop</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="space-y-6" role="tabpanel" aria-label="Notifications settings">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Email Notifications</CardTitle>
                <CardDescription>Configure email notification preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {emailNotificationItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={notifications[item.id as keyof NotificationSettings]}
                        onCheckedChange={(checked) =>
                          setNotifications((prev) => ({ ...prev, [item.id]: checked }))
                        }
                      />
                      <div>
                        <Label className="text-sm font-medium">{item.label}</Label>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Push Notifications</CardTitle>
                <CardDescription>Configure push notification preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pushNotificationItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={notifications[item.id as keyof NotificationSettings]}
                        onCheckedChange={(checked) =>
                          setNotifications((prev) => ({ ...prev, [item.id]: checked }))
                        }
                      />
                      <div>
                        <Label className="text-sm font-medium">{item.label}</Label>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "data" && (
          <div className="space-y-6" role="tabpanel" aria-label="Data & Privacy settings">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Retention</CardTitle>
                <CardDescription>How long to keep your data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {dataRetentionOptions.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    >
                      <input
                        type="radio"
                        name="dataRetention"
                        value={option.value}
                        checked={dataRetention === option.value}
                        onChange={() => setDataRetention(option.value)}
                        className="h-4 w-4"
                      />
                      <div>
                        <p className="font-medium">{option.label}</p>
                        <p className="text-sm text-muted-foreground">{option.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Export</CardTitle>
                <CardDescription>Export your data in various formats</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button variant="outline" className="h-20 flex-col items-start justify-between p-4">
                    <Download className="h-6 w-6 mb-2" />
                    <span className="font-medium">CSV Export</span>
                    <p className="text-sm text-muted-foreground">Export as CSV file</p>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col items-start justify-between p-4">
                    <FileText className="h-6 w-6 mb-2" />
                    <span className="font-medium">JSON Export</span>
                    <p className="text-sm text-muted-foreground">Export as JSON file</p>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col items-start justify-between p-4">
                    <Download className="h-6 w-6 mb-2" />
                    <span className="font-medium">Full Backup</span>
                    <p className="text-sm text-muted-foreground">Complete data backup</p>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Deletion</CardTitle>
                <CardDescription>Permanently delete your account and all data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border border-destructive bg-destructive/10 rounded-lg">
                  <p className="text-sm text-destructive">
                    This action is irreversible. All your data, including portfolio, alerts, and research, will be
                    permanently deleted.
                  </p>
                </div>
                <Button variant="destructive" onClick={() => {}}>
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "advanced" && (
          <div className="space-y-6" role="tabpanel" aria-label="Advanced settings">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">API Keys</CardTitle>
                <CardDescription>Manage your API access keys</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <p className="font-medium">Default API Key</p>
                    <p className="text-sm text-muted-foreground font-mono">ihsg_quant_sk_live_****1234</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Copy className="h-4 w-4" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Generate New Key
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Webhooks</CardTitle>
                <CardDescription>Configure webhook endpoints for real-time events</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">No webhooks configured</p>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Webhook
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cache Management</CardTitle>
                <CardDescription>Manage application cache</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button variant="outline" onClick={() => {}}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Clear Cache
                  </Button>
                  <Button variant="outline" onClick={() => {}}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Data
                  </Button>
                  <Button variant="outline" onClick={() => {}}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Cache
                  </Button>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-1">Cache Statistics</p>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Size</p>
                      <p className="font-mono">245 MB</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Entries</p>
                      <p className="font-mono">12,847</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Hit Rate</p>
                      <p className="font-mono">94.2%</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}