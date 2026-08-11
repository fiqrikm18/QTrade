---
name: quant-finance-rules
description: Use when writing or editing quantitative logic in this project — indicators, features, fundamentals, scoring, ML, backtesting, risk, or data pipelines. Enforces point-in-time data, no look-ahead bias, versioning, and proxy labeling. Sources: docs/PRD.md, docs/data-pipeline.md, docs/ml.md, docs/backtesting.md.
---

# Quant Finance Rules

## Overview

Quantitative correctness outranks impressive AI demos. Every artifact must be
**measurable, explainable, reproducible, timestamped, testable, backtestable,
configurable** (PRD §72).

## The pipeline

`DATA → DATA QUALITY → FEATURES → TECHNICAL → FUNDAMENTAL → FLOW/SMART MONEY
→ MACRO → REGIME → SCORING → ML SUPPORT → OPTIONAL LLM → DECISION SUPPORT`

LLM never creates numbers. ML is support, not authority. Deterministic models
run with ML/LLM/internet all off.

## Rules

### 1. Point-in-time data (no look-ahead)

- Feature rows carry `timestamp`, `effective_timestamp`, `source_timestamp`
  where applicable.
- Fundamentals carry `reported_at`, `period_start`, `period_end`,
  `available_at`. **`available_at` is the gate**: consumers filter
  `available_at <= asof`, never `reported_at`/`period_end`.
- Restatements are new rows, never retroactive edits.

### 2. No bias

- No survivorship bias: backtests resolve the universe per-date from
  `universe_history`, never current `is_active`.
- No future information: ML uses walk-forward / expanding window only. Random
  train/test splits are forbidden.
- Adjusted prices: store raw OHLC + cumulative `adjustment_factor`; compute
  adjusted series, never mutate raw prices. Corporate actions build factors
  backwards from ex-dates.

### 3. Versioning

- `feature_version`, `scoring_version`, `model_version` on every derived
  artifact. Bump on any formula/weight/feature change; recompute forward.
- `ml_predictions` is append-only. Never overwrite or delete historical
  predictions.
- Reproducibility contract (PRD §55): given `(ticker, timestamp,
  scoring_profile, feature_version)` the system reconstructs score, factors,
  model prediction, supporting data.

### 4. Explainability

- No bare `score = 87`. Every score stores `score_components` with named
  drivers and benchmark percentiles.
- ML exposes feature importance, SHAP where appropriate, model version,
  training period, validation metrics.

### 5. Proxy labeling

- Smart-money / institutional-flow signals are labeled **`proxy`** — never
  claimed as factual institutional positions (PRD §8).
- AI-enriched classifications are labeled `AI_ENRICHED`, not raw facts.

### 6. Valuation & scoring honesty

- Valuation judged vs own-history + sector + market percentiles; warn on
  value traps. Macro relationships come from historical correlation +
  configurable mappings, never hardcoded "USD/IDR ↑ ⇒ exporters" rules.
- Recommendations use `opportunity / watchlist / neutral / high_risk / avoid`
  with drivers, risks, invalidation conditions. Never "buy this stock".

### 7. ML evaluation

- Judge by IC, Brier score, calibration, and financial metrics (CAGR,
  Sharpe, Sortino, MaxDD, turnover, costs) — never accuracy alone.
- Walk-forward / expanding-window validation; features timestamp-aware;
  normalization fit inside the train window only.

## Checklist before finishing any quant code

- [ ] Every output row timestamped + versioned
- [ ] No future data reachable from any code path (unit-test the adjacency)
- [ ] `available_at` filter present wherever fundamentals are read
- [ ] Universe resolved per-date in any backtest
- [ ] Scores carry components; ML carries model metadata
- [ ] Deterministic path still works with ML/LLM disabled
