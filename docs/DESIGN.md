# DESIGN.md

# IHSG Quant Trading Terminal — Product & UI Design Specification

## 1. Purpose

This document defines the visual, interaction, information-architecture, and frontend implementation standards for the IHSG Quantitative Analytics & Decision Intelligence Platform.

The application must feel like a **professional quantitative trading terminal**, not a generic SaaS dashboard.

The product is a decision-support system built around:

> Market Data → Data Quality → Features → Quantitative Analysis → Market Regime → Scoring → Risk → ML Support → Optional LLM Explanation

The UI must make that analytical pipeline visible and understandable while remaining fast, dense, precise, and readable.

The source PRD explicitly requires a modern analytics dashboard with high information density, meaningful charts, and pages for Dashboard, Screener, Stock Analysis, Compare, Market, Sector, Macro, Economic Calendar, Portfolio, Backtest, Alerts, and Research. It also requires the quantitative engine to remain functional without LLM/ML components. See the source PRD for the full system requirements.

---

# 2. Product Design Principles

## 2.1 Terminal-first, SaaS-second

Do not design this like:

- a marketing website
- a generic admin panel
- a consumer finance app
- a card-heavy CRM dashboard

Design it like a serious trading/research workstation.

The visual language should resemble a modern combination of:

- Bloomberg-style information density
- TradingView-style chart interaction
- institutional research terminals
- modern quant research platforms
- professional portfolio/risk terminals

Do not copy any proprietary interface. Use the principles of professional terminals while creating an original design system.

---

## 2.2 Information density

The user should be able to understand the market state within seconds.

Prefer:

- compact tables
- dense but readable layouts
- inline metrics
- small sparkline charts
- compact badges
- sortable columns
- heatmaps
- split panels
- contextual tooltips
- keyboard navigation
- resizable panels

Avoid:

- huge empty spaces
- oversized cards
- excessive rounded containers
- decorative illustrations
- unnecessary gradients
- excessive animations
- giant headings
- marketing-style hero sections

Every pixel should provide analytical value.

---

## 2.3 Hierarchy of information

The interface should visually prioritize:

1. Market state
2. Price and liquidity
3. Opportunity/risk
4. Quantitative scores
5. Supporting evidence
6. News/events
7. AI interpretation

Never allow the LLM explanation to visually overpower the quantitative evidence.

---

## 2.4 Quantitative transparency

Every score must be explainable.

For example:

```text
OPPORTUNITY
86 / 100

Technical      88
Fundamental    91
Momentum       84
Smart Money    79
Sector         87
Macro          72
Risk           76
ML             81
```

The user must be able to drill down into why a score exists.

Avoid black-box UI such as:

```text
AI says BUY
```

Instead:

```text
Opportunity Score: 86

Primary drivers:
+ Strong relative strength
+ Improving momentum
+ Strong fundamentals

Risks:
- High valuation
- Macro sensitivity

Invalidation:
- Price breaks defined support
- Sector relative strength deteriorates
```

---

# 3. Visual Direction

## 3.1 Default theme

The primary interface should use a **dark professional trading-terminal theme**.

Recommended foundation:

```text
Background:
#0B0F14

Panel:
#10161D

Elevated Panel:
#151C24

Border:
#25303B

Primary Text:
#E6EDF3

Secondary Text:
#8B98A7

Muted Text:
#5F6B78
```

Do not hardcode these values throughout components. Define them as design tokens.

---

## 3.2 Semantic colors

Color must communicate financial meaning.

```text
Positive:
#22C55E

Negative:
#EF4444

Warning:
#F59E0B

Neutral:
#94A3B8

Info:
#38BDF8

Accent:
#8B5CF6
```

Use semantic colors consistently:

- Green = positive / improving / bullish
- Red = negative / deteriorating / bearish
- Amber = warning / elevated risk
- Blue = informational
- Purple = selected/analytical/AI state
- Gray = neutral/inactive

Do not use green/red as the only way to communicate information. Always pair color with text, icons, arrows, or values.

---

# 4. Typography

Use a professional UI font such as:

- Inter
- Geist
- IBM Plex Sans

For numerical market data, use a tabular/monospaced-friendly font treatment where useful.

Recommended hierarchy:

```text
Terminal Title:       18–22px
Section Title:        14–16px
Body:                 13–14px
Secondary:            11–12px
Dense Table:          12–13px
Micro Label:          10–11px
Large Metric:         24–32px
```

Numbers should align cleanly.

Examples:

```text
1,284.50
+1.84%
1.24T
86/100
```

Do not mix inconsistent number formatting.

---

# 5. Layout System

Use a desktop-first responsive architecture.

Primary breakpoint strategy:

```text
Desktop:
>= 1440px

Laptop:
1024–1439px

Tablet:
768–1023px

Mobile:
< 768px
```

The primary experience is desktop because professional trading analysis requires dense information.

Mobile should become a focused monitoring experience rather than attempting to reproduce the full terminal.

---

# 6. Global Application Shell

The application shell should consist of:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR                                                                    │
│ Logo | Market Status | Search | Command | Notifications | Profile          │
├───────────────┬────────────────────────────────────────────────────────────┤
│               │                                                            │
│ LEFT NAV      │ MAIN WORKSPACE                                            │
│               │                                                            │
│ Dashboard     │                                                            │
│ Market        │                                                            │
│ Screener      │                                                            │
│ Stocks        │                                                            │
│ Compare       │                                                            │
│ Sectors       │                                                            │
│ Macro         │                                                            │
│ Calendar      │                                                            │
│ Portfolio     │                                                            │
│ Backtest      │                                                            │
│ Alerts        │                                                            │
│ Research      │                                                            │
│               │                                                            │
├───────────────┴────────────────────────────────────────────────────────────┤
│ STATUS BAR: Data freshness | Market session | Jobs | API | Provider health │
└────────────────────────────────────────────────────────────────────────────┘
```

The shell must remain stable while the workspace changes.

---

# 7. Top Navigation

The top bar is a permanent terminal control area.

Include:

### Left

- Product logo
- Application name
- Market/session indicator

Example:

```text
QX
IHSG QUANT

● MARKET OPEN
```

### Center

Global search / command palette:

```text
Search ticker, company, metric, sector...
```

Support:

- ticker lookup
- company lookup
- navigation
- screener commands
- saved screens
- research queries

Example:

```text
BBCA
Bank Central Asia
```

### Right

- notifications
- data status
- AI/LLM status
- settings
- user menu

---

# 8. Market Session Indicator

The terminal must clearly communicate market state.

Examples:

```text
● MARKET OPEN
● PRE-MARKET
● MARKET CLOSED
● DATA DELAYED
● DATA STALE
```

Include:

```text
Last update
09:24:31 WIB
```

Never make stale market data look live.

---

# 9. Left Navigation

Navigation should be compact.

Recommended structure:

```text
OVERVIEW
  Dashboard
  Market

ANALYSIS
  Screener
  Stocks
  Compare
  Sectors

MACRO
  Macro
  Economic Calendar
  News

PORTFOLIO
  Portfolio
  Risk
  Alerts

RESEARCH
  Backtest
  Research

SYSTEM
  Data Quality
  Models
  Settings
```

Use icons plus labels.

Allow collapsed mode:

```text
[icon]
[icon]
[icon]
```

Expanded mode:

```text
▣ Dashboard
◈ Market
⌕ Screener
▤ Stocks
⇄ Compare
```

---

# 10. Dashboard

The Dashboard is the primary market command center.

## 10.1 Dashboard structure

```text
┌─────────────────────────────────────────────────────────────────────┐
│ MARKET HEADER                                                       │
│ IHSG 7,xxx.xx   +1.24%   BULLISH   Risk-On                        │
├───────────────────────────┬─────────────────────────────────────────┤
│ MARKET REGIME              │ MARKET BREADTH                         │
│                           │                                         │
│ BULLISH                    │ Advance  312                          │
│ Confidence 82%             │ Decline  184                          │
│                           │ Above SMA20 64%                        │
│                           │ Above SMA50 58%                        │
├───────────────────────────┴─────────────────────────────────────────┤
│ IHSG PRICE / REGIME CHART                                           │
├───────────────────────────┬─────────────────────────────────────────┤
│ TOP OPPORTUNITIES          │ SECTOR ROTATION                        │
│ #  Ticker Score            │ Heatmap                                 │
│ 1  BBCA   92               │                                         │
│ 2  BMRI   89               │                                         │
│ 3  TLKM   86               │                                         │
├───────────────────────────┼─────────────────────────────────────────┤
│ TOP GAINERS / LOSERS       │ VOLUME / FLOW ANOMALIES                 │
├───────────────────────────┴─────────────────────────────────────────┤
│ MACRO & ECONOMIC EVENTS                                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

# 11. Dashboard Components

## 11.1 Market Header

Show:

- IHSG price
- daily change
- percentage change
- volume
- turnover
- market regime
- volatility regime
- last update

Example:

```text
IHSG
7,812.45

+1.24%
+95.22

BULLISH
Risk-On
```

---

## 11.2 Market Regime Card

Display:

```text
MARKET REGIME

BULLISH

Confidence
82%

Trend       Strong
Breadth     Positive
Momentum    Positive
Volatility  Normal
Macro       Supportive
```

Use a compact visual score rather than a decorative gauge.

---

## 11.3 Breadth Panel

Show:

- Advance / Decline
- New highs
- New lows
- % above SMA20
- % above SMA50
- % above SMA200
- breakout breadth
- volume breadth

Use:

- horizontal bars
- small charts
- trend arrows

---

# 12. Market Chart

The primary chart should feel like a professional trading chart.

Required capabilities:

- candlestick
- line
- area
- volume
- multiple indicators
- crosshair
- tooltip
- zoom
- pan
- timeframe switching
- drawing support where appropriate
- overlays

Timeframes:

```text
1D
5D
1M
3M
6M
1Y
3Y
5Y
MAX
```

Intervals:

```text
1m
5m
15m
30m
1h
4h
1D
1W
1M
```

Only expose intervals supported by the data provider.

---

# 13. Chart Layout

Use a multi-pane structure.

```text
┌──────────────────────────────────────────────┐
│ BBCA                         9,125 +1.42%    │
│                                              │
│ Candlestick Chart                            │
│                                              │
│     ─ EMA20                                  │
│     ─ EMA50                                  │
│     ─ EMA200                                 │
│                                              │
├──────────────────────────────────────────────┤
│ Volume                                       │
├──────────────────────────────────────────────┤
│ RSI                                          │
└──────────────────────────────────────────────┘
```

The user should be able to toggle indicators.

---

# 14. Stock Analysis Terminal

This is the most important analytical screen.

Use a dense workstation layout.

```text
┌────────────────────────────────────────────────────────────────────┐
│ BBCA  Bank Central Asia                               9,125 +1.42%│
│ Banking | Large Cap | Liquidity: Very High                          │
├───────────────────────┬────────────────────────────────────────────┤
│ OPPORTUNITY SCORE     │ PRICE CHART                                │
│                       │                                            │
│ 86 / 100              │                                            │
│                       │                                            │
│ Risk: Medium          │                                            │
│ Regime: Bullish       │                                            │
├───────────────────────┤                                            │
│ COMPONENT SCORES      │                                            │
│ Technical      88     │                                            │
│ Fundamental    91     │                                            │
│ Momentum       84     │                                            │
│ Smart Money    79     │                                            │
│ Sector         87     │                                            │
│ Macro          72     │                                            │
│ Risk           76     │                                            │
│ ML             81     │                                            │
├───────────────────────┴────────────────────────────────────────────┤
│ TECHNICAL │ FUNDAMENTAL │ VALUATION │ FLOW │ RISK │ NEWS           │
├────────────────────────────────────────────────────────────────────┤
│ Detailed analytical workspace                                      │
└────────────────────────────────────────────────────────────────────┘
```

---

# 15. Stock Header

The header should always expose:

```text
Ticker
Company
Sector
Industry
Price
Change
Volume
Market Cap
Liquidity
Market Regime
Risk Level
Opportunity Score
```

Example:

```text
BBCA
Bank Central Asia

9,125
+128 (+1.42%)

BANKING
LARGE CAP

Opportunity
86

Risk
MEDIUM
```

---

# 16. Opportunity Score

Use a prominent but restrained score component.

Recommended design:

```text
┌──────────────────────────┐
│ OPPORTUNITY              │
│                          │
│ 86 / 100                 │
│                          │
│ HIGH QUALITY             │
│                          │
│ Confidence 78%           │
└──────────────────────────┘
```

The score must not look like a guaranteed return forecast.

Include:

- score
- classification
- confidence
- primary drivers
- risks
- invalidation conditions

---

# 17. Score Breakdown

Use compact horizontal score bars.

```text
Technical       █████████████████ 88
Fundamental     ██████████████████ 91
Momentum        ████████████████ 84
Smart Money     ███████████████ 79
Sector          █████████████████ 87
Macro           █████████████ 72
Risk            ███████████████ 76
ML              ████████████████ 81
```

Clicking a score opens detailed factors.

---

# 18. Stock Analysis Tabs

Recommended tabs:

```text
Overview
Technical
Fundamental
Valuation
Smart Money
Factors
Sector
Macro
Risk
ML
News
Scenarios
```

Do not put every section into one endlessly scrolling page.

Use tabs to preserve density.

---

# 19. Fundamental Workspace

Display compact financial tables.

Example:

```text
PROFITABILITY

ROE          23.4%     ↑
ROIC         18.7%     ↑
NPM          28.2%     →
GPM          52.1%     ↑

GROWTH

Revenue      +12.4%
EPS          +15.8%
FCF          +10.7%

FINANCIAL HEALTH

D/E          0.18x
Current      1.42x
Interest     9.4x
```

Use historical mini-charts when useful.

---

# 20. Valuation Workspace

Show:

- PER
- PBV
- PSR
- EV/EBITDA
- FCF Yield
- Dividend Yield

Always provide context:

```text
BBCA PER
23.4x

Historical:
20.1x ───── 25.8x

Sector:
21.8x

Market:
17.4x

Status:
EXPENSIVE vs 5Y history
```

Never show a valuation ratio without context if context is available.

---

# 21. Smart Money Workspace

Use careful terminology.

Never claim:

```text
Institutional buying confirmed
```

unless the underlying data supports it.

Instead use:

```text
ACCUMULATION PROXY
78 / 100
```

Show:

- accumulation
- distribution
- volume anomaly
- price-volume divergence
- structure
- liquidity sweep
- BOS
- CHoCH
- Wyckoff-inspired phase

Clearly label proxy-derived signals.

---

# 22. Screener

The screener should feel like an institutional stock scanner.

## Layout

```text
┌────────────────────────────────────────────────────────────────────┐
│ SCREENER                                                           │
├──────────────────────┬─────────────────────────────────────────────┤
│ FILTERS              │ RESULTS                                     │
│                      │                                             │
│ Universe              │ Ticker Score Technical Fundamental         │
│ Sector                │ BBCA   92    88        91                 │
│ Market Cap            │ BMRI   89    90        86                 │
│ Liquidity             │ TLKM   86    84        79                 │
│ RSI                   │ ...                                         │
│ Momentum               │                                             │
│ Valuation              │                                             │
│ Quality                │                                             │
│ Smart Money            │                                             │
│ Risk                   │                                             │
│ ML                     │                                             │
└──────────────────────┴─────────────────────────────────────────────┘
```

---

# 23. Screener Interaction

Filters should support:

- sliders
- min/max inputs
- dropdowns
- multi-select
- toggle conditions
- saved presets

Examples:

```text
RSI: 45–70
ROE: > 15%
Revenue Growth: > 10%
Relative Strength: > 70
Opportunity Score: > 75
Average Turnover: > 10B
```

The results table must update efficiently.

---

# 24. Screener Table

Columns should be configurable.

Default:

```text
Rank
Ticker
Company
Price
Change
Volume
Turnover
Market Cap
Technical
Fundamental
Momentum
Smart Money
Sector
Risk
ML
Opportunity
```

Features:

- sorting
- column resizing
- column visibility
- pinned columns
- row density
- pagination or virtual scrolling
- export
- saved views

---

# 25. Market Page

The Market page provides full-universe analytics.

Sections:

```text
IHSG
Market Breadth
Market Regime
Top Gainers
Top Losers
Volume Leaders
Breakouts
Breakdowns
New Highs
New Lows
Relative Strength
Volatility
Market Correlation
```

Use compact widgets rather than oversized cards.

---

# 26. Sector Page

Primary visualization:

## Sector Heatmap

Represent:

```text
Sector       1D       5D       20D      RS      Score

BANKING      +2.1%    +4.2%    +7.8%    91      89
ENERGY       +1.7%    +5.8%    +3.1%    84      82
TELCO        -0.3%    +1.1%    +2.4%    63      65
PROPERTY     -1.2%    -2.4%    -4.8%    42      44
```

Add a sector rotation matrix:

```text
                 MOMENTUM
                    ↑
                    │
        IMPROVING   │   LEADING
                    │
────────────────────┼──────────────────→ RS
                    │
        LAGGING     │   WEAKENING
                    │
```

---

# 27. Macro Terminal

Macro should look like an economic research workstation.

Sections:

```text
INDONESIA
BI Rate
Inflation
GDP
PMI
USD/IDR
Bond Yield

GLOBAL
Fed
US CPI
US Jobs
DXY
US Treasury
S&P 500
Nasdaq
China PMI
Commodities
```

Each metric should show:

```text
Current
Previous
Change
Trend
Last Updated
Source
```

---

# 28. Economic Calendar

Use a dense event table.

```text
TIME      COUNTRY  EVENT              IMPACT    PREV   CONSENSUS  ACTUAL
09:00     ID       CPI                HIGH      2.1%   2.3%       2.4%
19:30     US       CPI                HIGH      3.0%   2.9%       --
21:00     US       Fed Decision        HIGH      5.25   5.25       --
```

Use importance markers:

```text
● HIGH
● MEDIUM
● LOW
```

Events should be sortable and filterable.

---

# 29. Portfolio Terminal

Portfolio should resemble an institutional risk monitor.

Top row:

```text
Portfolio Value
Daily P&L
Total Return
Volatility
Beta
Sharpe
Max Drawdown
```

Then:

```text
Allocation
Sector Exposure
Factor Exposure
Correlation
Risk Contribution
Positions
Performance
```

Example:

```text
SECTOR EXPOSURE

Banking       52%
Technology    18%
Telco         15%
Consumer      10%
Other          5%
```

---

# 30. Risk Visualization

Important charts:

- drawdown curve
- volatility curve
- correlation matrix
- sector concentration
- factor exposure
- contribution to risk

Risk must be visually prominent.

A portfolio with high opportunity but dangerous concentration should make that risk obvious.

---

# 31. Backtest Workspace

Backtesting should feel like a research terminal.

Layout:

```text
┌──────────────────────┬─────────────────────────────────────────────┐
│ STRATEGY             │ PERFORMANCE                                 │
│                      │                                             │
│ Universe             │ Equity Curve                                │
│ Entry                │                                             │
│ Exit                 │                                             │
│ Position Size        │                                             │
│ Stop Loss            │                                             │
│ Take Profit          │                                             │
│ Fees                 │                                             │
│ Slippage              │                                             │
│                      │                                             │
│ [RUN BACKTEST]       │                                             │
├──────────────────────┴─────────────────────────────────────────────┤
│ CAGR | Sharpe | Sortino | MDD | Win Rate | PF | Turnover           │
├────────────────────────────────────────────────────────────────────┤
│ Trades | Drawdown | Monthly Returns | Attribution                   │
└────────────────────────────────────────────────────────────────────┘
```

Never hide transaction costs, slippage, or drawdown.

---

# 32. Research Workspace

Research should combine:

```text
Natural Language Query
+
Structured Filters
+
Quant Results
+
Charts
+
Notes
```

Example:

```text
Find IDX stocks with:

Momentum > 75
ROE > 15%
Revenue Growth > 10%
Relative Strength > 70
Opportunity > 80
```

The LLM may translate the natural-language request into structured filters, but the backend must execute those filters deterministically.

---

# 33. Optional AI Assistant

The AI assistant should appear as a secondary panel.

Recommended:

```text
┌────────────────────────────────────┐
│ QUANT RESEARCH ASSISTANT           │
├────────────────────────────────────┤
│ Why is BBCA ranked #3?             │
│                                    │
│ Quantitative evidence:             │
│ • Technical 88                     │
│ • Fundamental 91                   │
│ • Momentum 84                      │
│ • Sector 87                         │
│                                    │
│ Main positive drivers...            │
│                                    │
│ Risks...                            │
└────────────────────────────────────┘
```

The AI must reference existing structured analytics.

It must never fabricate:

- price
- indicator
- score
- fundamental number
- economic event
- ML prediction

---

# 34. Command Palette

Implement a keyboard-driven command system.

Shortcut:

```text
⌘K / Ctrl+K
```

Examples:

```text
> Open BBCA
> Screen momentum stocks
> Compare BBCA BBRI BMRI
> Open sector banking
> Show today's economic events
> Run saved screener
> Open portfolio
```

This reinforces the professional terminal experience.

---

# 35. Keyboard Shortcuts

Recommended:

```text
Ctrl/Cmd + K    Command palette
Ctrl/Cmd + /    Search
G D             Dashboard
G M             Market
G S             Screener
G A             Stock Analysis
G C             Compare
G P             Portfolio
G R             Research
```

Stock-specific:

```text
/               Focus ticker search
Esc             Close panel
Enter           Open selected item
```

Document shortcuts in the UI.

---

# 36. Compare Terminal

Allow users to compare 2–10 stocks.

Layout:

```text
              BBCA    BBRI    BMRI    BBNI

Opportunity    92      88      89      81
Technical      88      91      90      82
Fundamental    91      85      86      80
Momentum       84      88      92      77
Quality        94      82      85      78
Valuation      61      76      70      81
Smart Money    79      86      88      73
Risk           76      81      78      69
ML             81      84      89      75
```

Use subtle heatmap highlighting for relative strengths.

---

# 37. Data Freshness

Every data-heavy screen should expose freshness.

Example:

```text
Market Data
Updated 09:24:31

Fundamentals
Updated Aug 9, 2026

Macro
Updated Aug 10, 2026

News
Updated 2 min ago
```

If data is stale:

```text
⚠ DATA STALE
Last update: 47 min ago
```

Never hide data freshness.

---

# 38. Data Quality UI

Create a dedicated Data Quality screen.

Show:

```text
DATA QUALITY

Overall      98/100

Market Data       99
Fundamentals      96
Corporate Action  100
Macro              98
News               97
```

Drill-down:

```text
BBCA

Missing:
2 trading days

Duplicate:
0

Stale:
0

Corporate Action:
VALID
```

---

# 39. Loading States

Avoid generic full-page spinners.

Use skeletons matching the final layout.

For market scanning:

```text
SCANNING IDX UNIVERSE

██████████████░░░░ 74%

Stocks processed:
592 / 800

Features:
Complete

Technical:
Complete

Fundamental:
Running

ML:
Queued
```

---

# 40. Error States

Errors should explain what happened.

Bad:

```text
Something went wrong.
```

Good:

```text
MARKET DATA UNAVAILABLE

Provider did not return today's OHLCV data.

Last valid update:
09 Aug 2026, 16:15 WIB

The application is showing the latest valid dataset.

[Retry] [View Data Status]
```

---

# 41. Empty States

Empty states should remain professional.

Example:

```text
NO STOCKS MATCHED

Current filters:

RSI 45–60
ROE > 20%
Opportunity > 85

Try:
[Relax Opportunity Score]
[Clear Filters]
```

---

# 42. Tables

Tables are core components.

Rules:

- compact row height
- sticky header
- optional sticky first column
- tabular numbers
- right-align numeric values
- left-align text
- consistent decimal precision
- sortable columns
- hover state
- selected row state
- keyboard navigation
- virtualized rendering for large datasets

Recommended density modes:

```text
Compact
Comfortable
Expanded
```

Default:

```text
Compact
```

---

# 43. Charts

Charts must answer questions.

Good:

```text
Relative Strength vs IHSG
```

Good:

```text
Sector Rotation
```

Good:

```text
Portfolio Drawdown
```

Avoid decorative charts such as:

```text
Random donut chart with no decision value
```

Every visualization should have:

- title
- timeframe
- unit
- source/freshness when appropriate
- tooltip
- interpretation where useful

---

# 44. Heatmaps

Use heatmaps for:

- sector performance
- stock ranking
- correlation
- factor exposure
- portfolio concentration

Do not use excessive color gradients.

Use a restrained semantic scale.

---

# 45. Score Visualization

Use three primary forms:

### Horizontal score bar

Best for component scores.

### Compact ring

Best for one headline score.

### Heatmap

Best for comparison.

Avoid using large circular gauges everywhere.

---

# 46. Alerts

Alerts should be visible but not disruptive.

Example:

```text
ALERTS

● BBCA  Opportunity Score crossed 85
  09:22 WIB

● BMRI  Relative Volume > 3x
  09:18 WIB

● IHSG  Breadth deteriorating
  09:05 WIB
```

Severity:

```text
INFO
WATCH
WARNING
CRITICAL
```

---

# 47. News Interface

News should be contextual.

Instead of a generic news feed:

```text
BBCA
├── Earnings
├── Corporate Actions
├── Regulatory
├── Macro
└── Market
```

Each article should show:

```text
Source
Published time
Related ticker
Sector
Event type
Importance
AI enriched / Raw
```

AI classifications must be visually labeled:

```text
AI ENRICHED
```

---

# 48. Design System Components

Build reusable primitives.

## Layout

- AppShell
- Sidebar
- Topbar
- StatusBar
- Workspace
- SplitPane
- Panel
- PanelHeader

## Data

- DataTable
- Metric
- Score
- ScoreBar
- Sparkline
- Heatmap
- Badge
- StatusIndicator

## Trading

- TickerHeader
- PriceDisplay
- PriceChange
- MarketStatus
- Watchlist
- Order-like interaction components only if needed for simulation/research

## Analytics

- RegimeBadge
- RiskBadge
- FactorScore
- TechnicalSignal
- FundamentalMetric
- ScenarioPanel
- EvidenceList

## Charts

- PriceChart
- VolumeChart
- BreadthChart
- SectorHeatmap
- RotationMatrix
- CorrelationMatrix
- DrawdownChart

## AI

- ResearchAssistant
- ExplanationPanel
- AIStatus
- EvidenceCitation

---

# 49. Component Behavior

Components must be:

- keyboard accessible
- responsive
- reusable
- data-driven
- independently testable

Avoid hardcoding stock names or scores into UI components.

Bad:

```tsx
<Score value={86} />
```

inside a production screen without data context.

Prefer:

```tsx
<OpportunityScore
  score={analysis.opportunityScore}
  confidence={analysis.confidence}
/>
```

---

# 50. Frontend Architecture

Recommended stack from the PRD:

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
Lightweight charting library
```

Suggested structure:

```text
frontend/
  app/
    dashboard/
    market/
    screener/
    stocks/
    compare/
    sectors/
    macro/
    calendar/
    portfolio/
    backtest/
    alerts/
    research/

  components/
    shell/
    charts/
    tables/
    analytics/
    trading/
    ai/

  features/
    market/
    screener/
    stocks/
    portfolio/
    research/

  lib/
    api/
    formatting/
    permissions/
    keyboard/

  hooks/
  types/
```

Keep domain-specific UI logic inside feature modules.

---

# 51. State Management

Separate state into:

### Server state

- market data
- stock analysis
- screener results
- portfolio data
- macro data
- news

Use an appropriate query/cache library.

### UI state

- selected ticker
- active tab
- panel size
- chart settings
- filter drawer
- theme
- density

### URL state

Persist shareable analytical state:

```text
/screener?sector=banking&momentumMin=75&scoreMin=80
```

This makes research reproducible and shareable.

---

# 52. Responsive Behavior

## Desktop

Full terminal.

```text
Sidebar + workspace + optional right assistant
```

## Tablet

Collapse sidebar and reduce secondary panels.

## Mobile

Prioritize:

1. Market status
2. Watchlist
3. Stock score
4. Price chart
5. Key metrics
6. Alerts
7. News

Complex multi-column tables should become horizontally scrollable or transform into compact cards.

---

# 53. Accessibility

Required:

- keyboard navigation
- visible focus states
- sufficient contrast
- semantic HTML
- ARIA labels where necessary
- screen-reader-friendly tables
- no color-only meaning
- reduced-motion support

Professional terminal does not mean inaccessible terminal.

---

# 54. Animation

Animation should communicate state, not decorate the UI.

Allowed:

- panel transitions
- chart loading
- score updates
- alert appearance
- tab transitions
- hover states

Avoid:

- excessive bouncing
- large entrance animations
- parallax
- animated gradients
- constant pulsing

Market data can update frequently, but avoid visually noisy transitions.

---

# 55. Density Modes

Support:

```text
COMPACT
DEFAULT
COMFORTABLE
```

Compact mode:

- smaller row height
- smaller spacing
- more table rows
- ideal for experienced users

Comfortable mode:

- more whitespace
- larger click targets
- ideal for research and beginners

---

# 56. Professional Terminal Details

Add subtle details that improve the terminal feeling:

- ticker search everywhere
- keyboard shortcuts
- persistent watchlist
- pinned stocks
- resizable panels
- split-screen analysis
- saved layouts
- saved screeners
- saved research queries
- synchronized chart/table selection
- synchronized crosshair
- contextual breadcrumbs
- data freshness indicators
- model/version metadata
- compact status bar

---

# 57. Watchlist

Persistent watchlist should be accessible from the shell.

Example:

```text
WATCHLIST

BBCA   9,125   +1.42%   92
BBRI   5,180   +0.97%   88
BMRI   6,250   +2.13%   89
TLKM   3,010   -0.33%   76
```

Columns:

```text
Ticker
Price
Change
Opportunity
Risk
```

Clicking a ticker opens the stock terminal.

---

# 58. Split View

Professional users should be able to open:

```text
BBCA
+
Market
+
Sector
```

Example:

```text
┌──────────────────────┬─────────────────────────────┐
│ BBCA                 │ BANKING SECTOR             │
│ Price Chart          │ Sector Relative Strength   │
├──────────────────────┼─────────────────────────────┤
│ BBCA Scores          │ Peer Ranking               │
└──────────────────────┴─────────────────────────────┘
```

This is especially valuable for relative analysis.

---

# 59. Saved Workspace

Allow users to save layouts:

```text
My Layouts

Morning Scan
Swing Trading
Long Term
Banking Research
Macro Monitor
Portfolio Risk
```

A workspace stores:

- panels
- selected ticker
- chart indicators
- filters
- table columns
- timeframe
- watchlist
- panel sizes

---

# 60. Trading-Terminal Visual Rules

Follow these strict rules:

### DO

- dark neutral background
- thin borders
- compact spacing
- dense tables
- precise numbers
- subtle semantic colors
- clear hierarchy
- professional charts
- contextual information
- keyboard-first interaction

### DON'T

- giant cards
- excessive rounded corners
- huge gradients
- excessive glassmorphism
- decorative illustrations
- marketing copy
- excessive whitespace
- emoji-heavy UI
- fake real-time animations
- fake trading data

---

# 61. Financial Data Formatting

Standardize formatting globally.

Price:

```text
9,125.00
```

Percentage:

```text
+1.42%
-0.84%
```

Large numbers:

```text
1.24T
842.3B
12.4M
```

Ratio:

```text
23.4x
```

Score:

```text
86/100
```

Probability:

```text
78%
```

Never display inconsistent precision across tables.

---

# 62. Status Language

Use precise terminology.

Preferred:

```text
BULLISH
BEARISH
NEUTRAL
RISK-ON
RISK-OFF
ELEVATED VOLATILITY
ACCUMULATION PROXY
DISTRIBUTION PROXY
OPPORTUNITY
WATCHLIST
HIGH RISK
```

Avoid:

```text
Guaranteed
Sure Buy
Will Rise
Guaranteed Profit
AI Knows
```

---

# 63. Explainability UX

When a user clicks a score:

```text
Technical Score 88

Contributors

Trend                  +18
Momentum               +17
Volume                  +15
Structure               +14
Volatility              +12
Support/Resistance      +12

Evidence

EMA20 > EMA50
RSI = 64
Relative Volume = 1.8x
Breakout probability = ...
```

If a factor cannot be calculated because data is missing, say so.

---

# 64. Model Transparency

For ML:

```text
MODEL
LightGBM

VERSION
v1.4

TRAINING PERIOD
2021–2025

FEATURE VERSION
v3

VALIDATION
Walk-forward

ROC-AUC
0.67

Rank IC
0.08
```

For LLM:

```text
AI ENRICHED

Provider:
Configured Provider

Model:
Configured Model

Generated:
09:24 WIB
```

Do not present AI-generated analysis as raw market data.

---

# 65. Empty / Partial Data Strategy

The UI must gracefully handle missing modules.

Example:

```text
ML
────────────────
Unavailable

ML is disabled in the current configuration.

Quantitative scoring remains fully operational.
```

This reinforces the PRD principle that ML and LLM are optional.

---

# 66. Performance UX

The frontend must support the backend's full-universe scanning model.

For long-running operations:

```text
Market Scan
Running...

Feature Calculation       ✓
Technical Analysis        ✓
Fundamental Analysis      ✓
Sector Analysis           ✓
Macro Context             ✓
ML Inference              ...
Ranking                   ...
```

Do not block the entire interface.

Allow users to continue browsing while background jobs execute.

---

# 67. Data Source Transparency

Where useful, expose source information:

```text
Source:
IDX

Last Updated:
09 Aug 2026 16:15 WIB
```

For macro:

```text
Source:
BI

Source:
BPS

Source:
Federal Reserve
```

The exact provider should come from backend metadata.

---

# 68. Recommended Page Map

```text
/
├── dashboard
├── market
│   ├── overview
│   ├── breadth
│   ├── regime
│   └── volatility
├── screener
├── stocks
│   └── [ticker]
│       ├── overview
│       ├── technical
│       ├── fundamental
│       ├── valuation
│       ├── factors
│       ├── smart-money
│       ├── risk
│       ├── ml
│       ├── news
│       └── scenarios
├── compare
├── sectors
├── macro
├── economic-calendar
├── news
├── portfolio
├── backtest
├── alerts
├── research
├── data-quality
└── settings
```

---

# 69. MVP UI Priority

Do not implement every screen simultaneously.

## Phase 1

Build:

1. App shell
2. Dashboard
3. Market overview
4. Screener
5. Stock analysis
6. Basic sector page
7. Basic chart system
8. Watchlist
9. Data freshness
10. Basic score visualization

## Phase 2

Add:

1. Smart Money
2. Factor analysis
3. Macro
4. Economic calendar
5. News
6. Alerts
7. Compare

## Phase 3

Add:

1. ML
2. Backtesting
3. Risk
4. Portfolio analytics
5. Model transparency

## Phase 4

Add:

1. LLM research assistant
2. Natural-language screener
3. Research reports
4. AI explanations

---

# 70. Design-to-Implementation Rules for AI Agents

When implementing this design, the AI coding agent MUST:

1. Inspect the existing repository before changing architecture.
2. Reuse existing components and dependencies where appropriate.
3. Avoid replacing working infrastructure without a clear reason.
4. Build reusable components instead of page-specific duplicates.
5. Keep business logic out of UI components.
6. Use typed API contracts.
7. Use real API data when available.
8. Never invent market data.
9. Never hardcode scores in production components.
10. Make loading, error, stale, and empty states explicit.
11. Keep charts accessible and responsive.
12. Keep the UI fast with virtualization where required.
13. Preserve the professional terminal visual language across all pages.
14. Avoid introducing unnecessary UI libraries.
15. Keep styling centralized through design tokens.
16. Ensure dark mode is the primary optimized experience.
17. Test components with realistic data volumes.
18. Test large screener tables with the full supported universe.
19. Keep AI features optional.
20. Never allow LLM output to replace deterministic quantitative calculations.

---

# 71. AI Agent Prompt

Use the following rules while implementing the frontend:

```text
You are implementing a professional quantitative trading terminal.

The product is an IHSG/IDX quantitative decision-support platform.

Do not build a generic SaaS dashboard.

Build the UI like a professional trading/research terminal:
- dense
- precise
- data-first
- dark
- fast
- keyboard-friendly
- analytical
- highly interactive
- visually restrained

Prioritize:
1. market state
2. price
3. opportunity
4. risk
5. quantitative evidence
6. supporting context
7. optional AI explanation

Use:
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- reusable chart components
- typed API contracts

Design requirements:
- dark terminal theme
- compact spacing
- thin borders
- high information density
- professional tables
- semantic colors
- excellent numeric formatting
- responsive split panels
- keyboard navigation
- command palette
- watchlist
- resizable panels
- saved layouts
- data freshness indicators

Do not:
- use giant dashboard cards
- use excessive gradients
- use decorative illustrations
- use excessive glassmorphism
- make everything rounded
- create fake market data
- hardcode stock scores
- make LLM the primary analytical source

Every chart must answer a meaningful financial question.

Every score must be explainable.

Every market-data screen must expose freshness where relevant.

When data is unavailable, show a precise data state instead of fabricated values.

When implementing a page:
1. inspect existing code
2. understand existing design tokens/components
3. identify reusable components
4. implement the information hierarchy
5. implement loading/error/empty/stale states
6. connect real typed data
7. optimize rendering
8. test with realistic data volumes
9. verify desktop and responsive layouts
10. keep visual consistency with the terminal system

Do not implement the entire application as one giant page.

Use modular feature architecture.

The frontend is a decision-support interface, not an autonomous trading system.
```

---

# 72. Definition of Done

A page is considered complete when:

### Visual

- consistent with the terminal design
- dark theme polished
- correct information density
- clear hierarchy
- no unnecessary decoration

### Data

- real typed data
- correct formatting
- freshness visible
- missing data handled

### Interaction

- sorting works
- filtering works
- navigation works
- keyboard interaction works where applicable
- charts respond correctly

### Engineering

- reusable components
- no duplicated business logic
- TypeScript-safe
- responsive
- performant
- testable

### Quant UX

- scores are explainable
- risk is visible
- data source/freshness is clear
- AI is secondary
- no unsupported claims

---

# 73. Final Design Goal

The final product should feel like a serious workstation for an Indonesian quantitative investor.

The user should be able to open the application and immediately answer:

```text
What is happening in IHSG?
        ↓
What is the current market regime?
        ↓
Which sectors are leading?
        ↓
Which stocks have the strongest quantitative setup?
        ↓
Why are they ranked highly?
        ↓
What are the risks?
        ↓
What does the historical evidence say?
        ↓
Does the strategy backtest well?
```

The visual experience should communicate:

> **Professional market intelligence, not AI stock guessing.**

The core design principle is:

```text
DATA
  ↓
ANALYTICS
  ↓
EVIDENCE
  ↓
RISK
  ↓
DECISION SUPPORT
  ↓
OPTIONAL AI EXPLANATION
```

The terminal must remain useful even when ML and LLM are completely disabled.

The UI should make quantitative reasoning visible rather than hiding it behind a polished AI interface.
