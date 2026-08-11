---
name: frontend-page-workflow
description: Use when implementing a single frontend page, screen, or feature in this project's terminal UI (e.g. stock analysis, screener, sector heatmap). Covers per-page steps: inspect existing code, reuse components, information hierarchy, loading/error/empty/stale states, typed data, realistic-volume testing. Source: docs/DESIGN.md §71-72.
---

# Frontend Page Workflow

## Overview

One page at a time, built to the terminal design system. Every page is a
decision-support screen, not decoration. Source of truth for look/feel:
`docs/DESIGN.md` §71 (agent prompt) and §72 (definition of done).

## When to use

- Implementing any page from the page map (DESIGN §68): dashboard, market,
  screener, stocks/[ticker], compare, sectors, macro, calendar, news,
  portfolio, backtest, alerts, research, data-quality, settings
- Building a new screen or major component

## Steps

1. **Inspect existing code.** Read neighboring pages/components first. Follow
   existing patterns. Identify reusable components before writing new ones.
2. **Understand tokens.** Use the design tokens and primitives
   (see `uiux-design` skill). No hardcoded colors/sizes.
3. **Define the information hierarchy** (DESIGN §2.3): market state → price/
   liquidity → opportunity/risk → scores → evidence → news → AI. LLM output
   never overpowers quantitative evidence.
4. **Implement states explicitly**:
   - loading → layout skeletons (not full-page spinners)
   - error → what happened, last valid data, retry action
   - empty → current filters + suggested relaxations
   - stale → `DATA STALE` + last update time
   - unavailable → ML/LLM panels show `Unavailable — disabled in
     configuration; quantitative scoring remains fully operational`
5. **Connect typed data.** Typed API contracts only (Pydantic → OpenAPI →
   TS types). Never hardcode scores, prices, or market data.
6. **Optimize rendering.** Virtualize large tables (screener = full universe).
   Keep panels resizable, sorting/filtering working, keyboard accessible.
7. **Test with realistic data volumes.** Full-universe screener tables, 5y
   charts. Never test only with 3 fake rows.
8. **Verify responsive layouts.** Desktop (primary) ≥1440px, tablet
   collapses, mobile = focused monitoring (market status, watchlist, score,
   price chart, alerts, news).
9. **Preserve visual consistency** with the terminal system across pages.

## Definition of done (DESIGN §72)

- **Visual:** terminal-consistent, dark theme polished, correct density, no
  decoration.
- **Data:** real typed data, correct formatting, freshness visible, missing
  data handled.
- **Interaction:** sort/filter/navigate/keyboard/charts all work.
- **Engineering:** reusable components, no duplicated business logic,
  TypeScript-safe, responsive, performant, testable.
- **Quant UX:** scores explainable, risk visible, source/freshness clear, AI
  secondary, no unsupported claims.

## Do not

- Build the whole app as one giant page — modular feature architecture
- Duplicate an existing component instead of reusing it
- Introduce unnecessary UI libraries
- Ship a page without its loading/error/empty/stale states
- Place business logic inside UI components
