# Macro Engine

Macro conditions provide **context**, not directives (PRD §15, §16). The
regime engine may tilt on macro; it may never be overridden by macro. No
hardcoded "USD/IDR ↑ ⇒ exporters good" rules — relationships come from
historical correlation and configurable mappings (PRD §15).

## 1. Data

`economic_indicators` time series (IDR central, global context). Core set:

**Indonesia:** BI rate, inflation (CPI YoY), GDP (YoY), PMI (manufacturing),
trade balance, current account, USD/IDR, 10Y IDN bond yield, 10Y-2Y curve.

**Global:** Fed funds rate + FOMC calendar, US CPI, US nonfarm payrolls,
US Treasury yields (2Y/10Y), DXY, S&P 500, Nasdaq, Dow Jones, China PMI,
China GDP, commodity prices: oil (Brent), gold, coal, CPO, nickel, copper.

Sources via `MacroEconomicProvider` / `EconomicCalendarProvider`
(`docs/data-pipeline.md` §1). Each point carries `asof_date`, `source`,
`available_at` (macro is also point-in-time for backtests).

## 2. Economic calendar

`economic_events` rows: event, country, scheduled_time, importance (1-3),
previous, consensus, actual, unit, status.

After release: `surprise = (actual − consensus) / |consensus|` for
percentage-type; for absolute, standardized z-score against history. Store
`surprise` on the event row.

## 3. Event impact engine (PRD §16)

For each (event type, country, importance) compute over history:

- IHSG average reaction and volatility over `impact_horizon` (default 1D, 5D)
  after release time
- sector average reactions (per sector)
- stock average reactions (top-N movers, volume response)

Store in `economic_impact` with `sample_size`, `historical_probability`,
`confidence` (= f(sample_size, dispersion)). **Presented as
"historically, X happened in N samples" — never as a prediction.**

## 4. Macro scores

### `macro_risk_score` (0-100, higher = riskier)
Components (weighted, configurable):
- USD/IDR trend and volatility (depreciation = risk)
- DXY trend
- US real yield change
- commodity volatility
- global equity momentum (S&P/Nasdaq trend)
- IDN yield rise / curve steepening
- China PMI/GDP momentum
- events week risk (sum of importance × proximity of upcoming high-importance
  events)

### `macro_support_score` (0-100)
Mirror: accommodative BI rate trend, falling inflation, strong IDR, firm PMI,
stable yields, positive global equity momentum, positive trade balance.

Both are **cross-time percentile scores** (rank current value among trailing
252/756d history) to stay stationary across regimes. Record component
percentiles in `score_components`-style jsonb for explainability.

### Tilt into regime
`docs/technical-analysis.md` §9: macro scores contribute a small configurable
weight to regime classification (e.g. 10-15%) and are excluded when macro data
is stale/missing (per `data_freshness`).

## 5. Sector mapping

`macro_sector_map` config table: indicator code → sector → sign → strength,
e.g. `{"indicator":"usd_idr","sector":"EXPORTERS","sign":1,"strength":0.6}`.

This is **configurable data**, not code. Sector macro-sensitivity scores are
computed as correlation of sector index returns vs indicator changes over a
rolling window (e.g. 252d), replacing/augmenting the static map. The macro
engine exposes "which sectors is this macro event likely to touch, based on
history".

## 6. Outputs

- Macro dashboard data: latest indicator values, trends, percentiles,
  risk/support scores, upcoming calendar, recent surprises, event impacts.
- `macro_features` per date (shared across stocks) consumed by
  `docs/scoring.md` (macro_score component) and `docs/ml.md` (macro feature
  block).
- Backtest-friendly: macro features are timestamped with `available_at` and
  consumed only at their availability date.
