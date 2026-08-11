---
name: uiux-design
description: Use when implementing or editing this project's frontend — any page, component, table, chart, color, typography, or layout decision in ihsg-quant. Front-load the terminal-first design system from docs/DESIGN.md: dark theme tokens, semantic colors, density rules, formatting, explainability UX.
---

# UI/UX Design — Trading Terminal

## Overview

This project is a **professional quantitative trading terminal**, not a
generic SaaS dashboard. Full spec: `docs/DESIGN.md` (authoritative). This
skill is the binding quick-reference; where they differ, DESIGN.md wins.

## Core principle

`DATA → ANALYTICS → EVIDENCE → RISK → DECISION SUPPORT → OPTIONAL AI EXPLANATION`

The UI makes quantitative reasoning visible. It must stay fully useful with
ML and LLM disabled.

## When to use

- Building/editing any page in the page map (`docs/DESIGN.md` §68)
- Creating components, tables, charts, badges, score visualizations
- Choosing colors, typography, spacing, density
- Wiring loading / error / empty / stale / unavailable states

## Design tokens (dark theme primary)

```
Background        #0B0F14
Panel             #10161D
Elevated Panel    #151C24
Border            #25303B
Primary Text      #E6EDF3
Secondary Text    #8B98A7
Muted Text        #5F6B78

Positive          #22C55E   (green = improving/bullish)
Negative          #EF4444   (red = deteriorating/bearish)
Warning           #F59E0B   (amber = elevated risk)
Neutral           #94A3B8
Info              #38BDF8   (blue = informational)
Accent            #8B5CF6   (purple = selected/analytical/AI)
```

Define as design tokens, never hardcoded in components. Semantic colors must
be **paired with text/icons/values** — never color-only.

## Typography & formatting

- Professional UI font (Inter / Geist / IBM Plex Sans); tabular numbers for
  market data.
- Sizes: Title 18–22px, Section 14–16px, Body 13–14px, Secondary 11–12px,
  Dense table 12–13px, Micro 10–11px, Large metric 24–32px.
- Consistent precision globally (DESIGN §61):
  `9,125.00` · `+1.42%` · `1.24T` · `23.4x` · `86/100` · `78%`.

## Layout & density

- Desktop-first (primary ≥1440px); dense tables, thin borders, compact
  spacing, split/resizable panels, keyboard navigation.
- Shell (DESIGN §6-9): top bar (logo, market session indicator, search /
  command palette `⌘K`, notifications, profile), collapsible left nav,
  stable status bar (data freshness, jobs, provider health).
- Show market session honestly: `MARKET OPEN / PRE-MARKET / MARKET CLOSED /
  DATA DELAYED / DATA STALE` with last-update time. Never make stale data
  look live.

## Tables & charts

- Tables: compact rows (default), sticky header, tabular right-aligned
  numbers, left-aligned text, sortable, virtualized for large sets, density
  modes (compact/default/comfortable).
- Charts: every chart answers an analytical question. Price/candles via
  `lightweight-charts`, dashboards via `recharts`. Score forms: horizontal
  bars, compact ring, heatmap — no oversized gauges.
- Heatmaps for: sector performance, ranking, correlation, factor exposure,
  concentration. Restrained semantic scale, no excessive gradients.

## Explainability & transparency (mandatory)

- Every score is click-through: `score → contributors → evidence` (e.g.
  `EMA20 > EMA50`, `RSI = 64`). If a factor can't be calculated, say so.
- Model transparency: model, version, training period, feature version,
  validation, ROC-AUC, Rank IC (DESIGN §64).
- Data source + freshness visible on data-heavy screens.
- AI output labeled `AI ENRICHED` with provider/model/generated time; AI
  renders in a **secondary panel**, never over quantitative evidence.

## Status language

Use: `BULLISH / BEARISH / NEUTRAL / RISK-ON / RISK-OFF / ELEVATED
VOLATILITY / ACCUMULATION PROXY / DISTRIBUTION PROXY / OPPORTUNITY /
WATCHLIST / HIGH RISK`.
Never: `Guaranteed / Sure Buy / Will Rise / AI Knows`.

## DO / DON'T

**DO:** dark neutral background, thin borders, compact spacing, dense tables,
precise numbers, subtle semantic colors, clear hierarchy, keyboard-first.
**DON'T:** giant cards, excessive rounded corners, big gradients,
glassmorphism, decorative illustrations, marketing copy, excessive whitespace,
emoji-heavy UI, fake real-time animations, fake trading data, hardcoded
scores.

## States

- Loading: layout skeletons matching final UI, not full-page spinners. Scan
  progress streams pipeline stages (DESIGN §66).
- Error: explain what happened + last valid data + retry (DESIGN §40).
- Empty: show current filters + suggested relaxations (DESIGN §41).
- Unavailable: explicit `Unavailable — disabled in configuration;
  quantitative scoring remains fully operational` for ML/LLM panels
  (DESIGN §65).

## Data

Typed API contracts only. Never invent market data, never hardcode scores in
production components (DESIGN §70).
