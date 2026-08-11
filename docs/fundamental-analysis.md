# Fundamental Analysis Engine

Deterministic scoring of financial statements. Source of raw data:
`financial_statements`, `financial_ratios` (see `docs/data-model.md` §5).
Anti-look-ahead rules: `docs/data-pipeline.md` §6.

## 1. Principles

- **Point-in-time only.** Every ratio/feature is computed from statements with
  `available_at <= asof`. The engine never sees statements published after the
  evaluation date.
- **Ratios are inputs, not conclusions.** PRD §10: "Do not simply calculate
  ratios." Scores judge quality, growth, health, profitability, valuation —
  each against appropriate benchmarks.
- **Beware of Indonesian reporting nuance:** most IDX issuers report
  **annual + cumulative quarterly** (laporan keuangan interim). Never mix
  cumulative and single-quarter figures in the same metric. Mark statement
  rows `is_annual` and normalize:
  - single-quarter value = cumulative − prior cumulative for same year.
  - YoY growth compares like-for-like (cumulative to cumulative).
- Units: values in IDR. Ratios dimensionless or times; percentages 0-100.

## 2. Ratio definitions

Let `NI`=net income, `EBIT`, `EBITDA`, `S`=revenue, `TP`=total assets,
`TL`=total liabilities, `E`=equity (attributable), `D`=interest-bearing debt,
`C`=cash, `SO`=shares outstanding (latest, split-adjusted), `MktCap`,
`OCF`=operating cash flow, `FCF=OCF−capex`, `Div/share`.

| Ratio | Formula |
|---|---|
| PER | `MktCap / NI_ttm` (or `price / eps_ttm`) |
| PBV | `MktCap / E` |
| PSR | `MktCap / S_ttm` |
| EV/EBITDA | `(MktCap + D − C) / EBITDA_ttm` |
| ROE | `NI_ttm / avg(E)` |
| ROA | `NI_ttm / avg(TP)` |
| ROIC | `NOPAT / invested_capital`, `NOPAT=EBIT_ttm*(1−tax_est)`, `invested_capital=E+D−C` |
| NPM / GPM / OPM | `NI/S`, `gross_profit/S`, `EBIT/S` (ttm) |
| Debt/Equity | `D / E` |
| Current ratio | `current_assets / current_liabilities` |
| Interest coverage | `EBIT_ttm / interest_expense_ttm` |
| FCF yield | `FCF_ttm / MktCap` |
| Dividend yield | `Div_per_share_ttm / price` |
| Earnings quality | `OCF_ttm / NI_ttm` (sustainable if ≥ ~0.8) |
| FCF conversion | `FCF_ttm / NI_ttm` |

Growth (YoY, like-for-like, ttm or annual):
`revenue_growth`, `earnings_growth`, `eps_growth`, `fcf_growth`,
`book_value_growth` = `(current/prior)−1` per period alignment.

`ttm` = trailing twelve months from latest available statement, respecting
`available_at`. If only annual exists, use annual (label `annual`).

## 3. Scoring framework

Each sub-score 0-100, computed with **percentile ranks within the comparable
group** (IDX universe, and/or sector) using the latest point-in-time values,
then mapped to 0-100. Percentile method is robust to regime drift and unit
differences; use cross-sectional rank at each `asof`.

### profitability_score
- ROE, ROIC, margins (GPM/OPM/NPM), earnings quality (OCF/NI).
- Penalty for negative or volatile margins.

### growth_score
- Revenue, EPS, FCF, book value growth.
- Weight recent (1y) > older (3y); penalize negative growth; consistency bonus
  (growth in ≥ 3 of 5 years).

### financial_health_score
- Leverage (D/E), liquidity (current ratio), interest coverage, debt quality
  (share of D that is long-term/cost-effective), FCF conversion.
- Bank financials: substitute capital adequacy/quality metrics where provider
  data allows; otherwise mark components `N/A` and renormalize weights.

### valuation_score
- Relative to own history (5y percentile of PER/PBV/EV-EBITDA) and vs sector
  median. Lower percentile = cheaper = higher score. Cross-check FCF yield and
  dividend yield. Warn when a "cheap" value is explained by deteriorating
  quality (don't reward value traps).

### quality_score
- Composite of profitability + health + earnings quality + consistency.

### Composite guidance (weights configurable):
```
fundamental_score = 0.30*profitability + 0.25*growth
                  + 0.25*financial_health + 0.20*valuation
```
`quality_score` stored alongside; used by factor model (`docs/scoring.md`).

## 4. Valuation cross-reference

Valuation must be judged in context (PRD §10): own-history percentile, sector,
industry, and market median. Store the benchmark percentiles in
`score_components` so the number is explainable:
`{"valuation_score": 72, "per_hist_pct": 34, "per_sector_pct": 28, ...}`.

## 5. Output

- `financial_ratios` (per statement period) and `fundamental_features`
  (per `asof`, per `feature_version`) hold ratio values and z-scores.
- `score_components` in `stock_scores` holds the sub-scores with their
  rationale and benchmark percentiles.
- Every row tagged with `available_at` and `feature_version`.

## 6. Edge cases

- Negative equity / negative earnings: scores default to low bands, components
  labeled with the reason (`negative_equity`, `negative_ni`).
- Missing statement coverage: score from available components with
  `coverage_pct` recorded; scores with coverage < threshold are flagged `N/A`
  and excluded from ranking unless configured otherwise.
- Financial institutions and property companies have different capital
  structures: use sector-aware component weights (config), never hardcoded
  per-ticker.
