"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  Download,
  FileText,
  Lightbulb,
  Brain,
  Zap,
  ChevronDown,
  ChevronUp,
  Settings,
  BookOpen,
  Sparkles,
  MessageSquare,
  Send,
  Copy,
  Check,
  X,
  Loader2,
  Eye,
  Trash2,
  BarChart2,
  TrendingUp,
  Target,
  Calendar,
  Globe,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface ResearchMemo {
  id: number;
  title: string;
  tickers: string[];
  date: string;
  thesis: string;
  scores: {
    technical: number;
    smartMoney: number;
    fundamental: number;
    structure: number;
    regime: number;
    breadth: number;
  };
}

interface HistoryItem {
  id: number;
  query: string;
  response: string;
  timestamp: string;
}

interface SavedReport {
  id: number;
  title: string;
  date: string;
  tags: string[];
  content: string;
}

interface TemplateItem {
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
}

interface QuickTemplate {
  title: string;
  desc: string;
  category: string;
}

export default function ResearchPage() {
  const [activeTab, setActiveTab] = useState("workspace");
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([
    { id: 1, query: "Why is BBCA ranked #3?", response: "Based on the quantitative analysis...", timestamp: "2 min ago" },
    { id: 2, query: "Find stocks with strong momentum and improving fundamentals", response: "Screened 960 stocks...", timestamp: "15 min ago" },
    { id: 3, query: "Compare BBCA, BBRI, BMRI, BBNI", response: "Comparison complete...", timestamp: "1 hour ago" },
  ]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([
    { id: 1, title: "Banking Sector Deep Dive", date: "2024-01-15", tags: ["BANKING", "SECTOR"], content: "..." },
    { id: 2, title: "Momentum Strategy Backtest", date: "2024-01-10", tags: ["MOMENTUM", "BACKTEST"], content: "..." },
    { id: 3, title: "Telkom Fundamental Analysis", date: "2024-01-10", tags: ["TLKM", "FUNDAMENTAL"], content: "..." },
  ]);

  const researchMemos: ResearchMemo[] = [
    {
      id: 1,
      title: "Banking Sector Deep Dive",
      tickers: ["BBCA", "BBRI", "BMRI", "BBNI"],
      date: "2024-01-15",
      thesis: "Banking sector shows strong fundamentals with improving NIM trends and controlled asset quality. BBCA leads with best-in-class ROE and digital adoption.",
      scores: { technical: 88, smartMoney: 79, fundamental: 91, structure: 85, regime: 82, breadth: 78 },
    },
    {
      id: 2,
      title: "Momentum Strategy Backtest",
      tickers: ["TLKM", "ASII", "UNTR", "INCO"],
      date: "2024-01-10",
      thesis: "Cross-sectional momentum factor remains robust in IDX. 12-1 monthly rebalance captures trending names while avoiding reversals.",
      scores: { technical: 92, smartMoney: 74, fundamental: 68, structure: 88, regime: 79, breadth: 71 },
    },
    {
      id: 3,
      title: "Telkom Fundamental Analysis",
      tickers: ["TLKM"],
      date: "2024-01-10",
      thesis: "TLKM offers defensive characteristics with tower monetization upside. FCF yield attractive vs peers. Regulatory risk on tariff caps.",
      scores: { technical: 71, smartMoney: 65, fundamental: 84, structure: 76, regime: 80, breadth: 69 },
    },
  ];

  const templates: TemplateItem[] = [
    { title: "Stock Deep Dive", desc: "Full fundamental & technical analysis", icon: Zap, prompt: "Analyze {TICKER} comprehensively" },
    { title: "Sector Comparison", desc: "Compare stocks within a sector", icon: BarChart2, prompt: "Compare {SECTOR} stocks" },
    { title: "Momentum Screen", desc: "Find high momentum stocks", icon: TrendingUp, prompt: "Find stocks with strong momentum" },
    { title: "Value Screen", desc: "Find undervalued quality stocks", icon: Target, prompt: "Find undervalued quality stocks" },
    { title: "Earnings Preview", desc: "Upcoming earnings analysis", icon: Calendar, prompt: "Preview earnings for {TICKER}" },
    { title: "Macro Impact", desc: "Assess macro impact on portfolio", icon: Globe, prompt: "How does {MACRO_EVENT} affect my portfolio?" },
  ];

  const quickTemplates: QuickTemplate[] = [
    { title: "Stock Deep Dive", desc: "Complete fundamental & technical analysis template", category: "Analysis" },
    { title: "Sector Rotation Report", desc: "Weekly sector rotation analysis template", category: "Sector" },
    { title: "Earnings Preview", desc: "Pre-earnings analysis checklist", category: "Events" },
    { title: "Macro Impact Assessment", desc: "Macro event impact on portfolio", category: "Macro" },
    { title: "Risk Budget Report", desc: "Portfolio risk budget allocation", category: "Risk" },
    { title: "Rebalancing Plan", desc: "Portfolio rebalancing execution plan", category: "Operations" },
  ];

  const handleAnalyze = () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setTimeout(() => {
      setResponse(
        "Based on the quantitative analysis, BBCA ranks #3 due to:\n" +
        "1. Strong technical score (88) driven by positive momentum and bullish trend structure\n" +
        "2. Excellent fundamental score (91) with ROE of 23.4% and low D/E of 0.18\n" +
        "3. Positive momentum (84) with strong relative strength vs sector\n" +
        "4. Smart money accumulation signals (79)\n" +
        "5. Sector leadership in BANKING (score 89)\n\n" +
        "Main risks: High valuation (PER 23.4x vs sector 21.8x), macro sensitivity to USD/IDR"
      );
      setIsLoading(false);
    }, 1500);
  };

  const handleTemplateClick = (prompt: string) => {
    setQuery(
      prompt
        .replace("{TICKER}", "BBCA")
        .replace("{SECTOR}", "BANKING")
        .replace("{MACRO_EVENT}", "BI Rate Decision")
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Research Workspace</h1>
          <p className="text-muted-foreground">Quantitative research with AI assistance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Research
          </Button>
        </div>
      </div>

      <Tabs defaultValue="workspace" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="nlq">Natural Language Query</TabsTrigger>
          <TabsTrigger value="reports">Saved Reports</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Research Query</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">AI Powered</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Ask a research question... e.g., 'Why is BBCA ranked #3?' or 'Find stocks with strong momentum and improving fundamentals'"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="min-h-[120px] resize-none"
                  rows={6}
                />
                <div className="flex items-center gap-2">
                  <Button onClick={handleAnalyze} disabled={isLoading || !query.trim()}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Brain className="mr-2 h-4 w-4" />
                        Analyze
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => { setQuery(""); setResponse("") }}>
                    <X className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>

                {response && (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">AI Analysis</h4>
                        <Badge variant="outline" className="text-xs">AI Generated</Badge>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{response}</p>
                      <div className="flex gap-2 pt-2 border-t border-border">
                        <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(response)}>
                          <Copy className="mr-1 h-3 w-3" />
                          Copy
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="mr-1 h-3 w-3" />
                          Export
                        </Button>
                        <Button variant="ghost" size="sm">
                          <BookOpen className="mr-1 h-3 w-3" />
                          Save Report
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Research Templates</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {templates.map((template) => (
                  <Button
                    key={template.title}
                    variant="outline"
                    className="h-20 flex-col items-start justify-between p-4 text-left hover:bg-accent"
                    onClick={() => handleTemplateClick(template.prompt)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <template.icon className="h-5 w-5 text-primary" />
                      <span className="font-medium">{template.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground flex-1">{template.desc}</p>
                    <Button variant="ghost" size="sm" className="mt-2" onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handleTemplateClick(template.prompt); }}>
                      Use Template
                    </Button>
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Recent Queries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {history.map((item) => (
                    <div key={item.id} className="p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.query}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.response.substring(0, 100)}...</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>{item.timestamp}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="nlq" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Natural Language Query</CardTitle>
              <CardDescription>Type your question in plain English</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="e.g., 'Which banking stocks have the best risk-adjusted returns?' or 'Show me stocks with RSI < 30 and ROE > 15%'"
                className="min-h-[100px] resize-none"
              />
              <div className="flex gap-2">
                <Button onClick={() => {}}>
                  <Zap className="mr-2 h-4 w-4" />
                  Run Query
                </Button>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Convert to Filters
                </Button>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export Results
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  "Top 10 momentum stocks",
                  "Stocks with RSI < 30",
                  "High ROE + low debt",
                  "Earnings surprises this week",
                  "Sector rotation leaders",
                  "Dividend aristocrats",
                  "Breakout candidates",
                  "Value traps to avoid",
                ].map((example) => (
                  <Button key={example} variant="ghost" size="sm" className="h-auto p-3 text-left text-xs" onClick={() => {}}>
                    {example}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Saved Reports ({savedReports.length})</h3>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export All
            </Button>
          </div>
          <div className="space-y-3">
            {savedReports.map((report) => (
              <Card key={report.id} className="hover:bg-muted/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{report.title}</h4>
                        <div className="flex gap-1">
                          {report.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{report.date}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickTemplates.map((template) => (
              <Card key={template.title} className="h-full flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{template.title}</CardTitle>
                    <Badge variant="secondary" className="text-xs">{template.category}</Badge>
                  </div>
                  <CardDescription>{template.desc}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground mb-4">
                    Pre-configured template with data sources, calculations, and visualization templates.
                  </p>
                </CardContent>
                <CardFooter className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">Template</Badge>
                  <Button size="sm" className="w-full">Use Template</Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}