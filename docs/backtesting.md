# Backtesting

Lightweight but honest strategy evaluation (PRD §27). The #1 goal is
**no look-ahead bias**. The #2 goal is honest costs.

## 1. Scope

Backtest these artifacts:
- scoring model (`opportunity_score` + threshold → ranked long book)
- screener model (filter → positions)
- ML ranking (`docs/ml.md` §6) — model predictions as signal
- explicit rule strategies (e.g. RSI < 30 → buy, SMA50 cross)

Long-only for v1. Position sizing, stop loss, take profit, trailing stop,
fees, slippage, liquidity constraints supported (below).

`ponytail:` Shorts/fractional/multi-asset — add when portfolio engine and
data coverage justify it.

## 2. Engine design

Vectorized-lite: event-driven at daily granularity over Parquet OHLCV + cached
feature/scores tables via DuckDB. Daily bar granularity is the default; intraday
backtests explicitly out of scope for v1.

Evaluation loop:

```
for each trading day d in [start, end]:
    asof features/scores = snapshot at d (point-in-time tables, no future)
    signals = strategy(universe_at_d, features_at_d)
    target weights = position_sizing(signals, risk_params)
    fills = simulate_orders(targets, prices_at_d, costs)
    update positions, equity, trade log
    daily portfolio value → metrics
```

Universe at `d` = `universe_history` membership (survivorship-safe),
intersected with traded/liquid screen.

## 3. Anti-look-ahead rules (mandatory, unit-tested)

1. **Point-in-time data only.** Fundamentals via `available_at <= d`;
   features/scores from the versioned tables as they existed at `d`;
   ML predictions stored at their `prediction_timestamp`.
2. **Signal at close of `d`, fill at close of `d` or open of `d+1`**
   (configurable; default next-open). Never fill on a bar whose close is
   already known to contain the signal.
3. **No future universe.** Universe resolved per-date.
4. **No future revision.** Restatements and updated scores are never applied
   retroactively (append-only history).
5. **Costs always on.** Fees + slippage modeled from `d` bar data (typical
   spread proxy), never zero.
6. **Adjacency check in tests:** a test asserts `backtest_trades` never
   reference any value from `> exit_date`.

## 4. Costs & constraints

| Model | Default | Notes |
|---|---|---|
| Brokerage fee | buy 0.15%, sell 0.25% (configurable) | IDX convention incl. taxes |
| Slippage | fraction of bar range, e.g. 0.10 × (high−low) | or fixed bps, configurable |
| Liquidity | cap position ≤ X% of daily volume (default 10%); reject fills above cap | |
| Min lot | IDX lots of 100 shares (configurable) | |

Stop loss / take profit / trailing stop evaluated on intraday high/low of each
bar after entry (worst-case: stop on low, tp on high same bar — conservative
and bias-safe).

## 5. Position sizing

- Equal weight within ranked top-N, or
- Risk parity: `weight ∝ 1 / σ_ticker` (configurable), or
- Vol targeting: scale book to target portfolio vol (e.g. 15% annual).
- Per-position max weight cap (configurable).

## 6. Metrics (PRD §27)

Per backtest run, stored in `backtests.metrics`:

- CAGR, Sharpe (annualized, RF configurable), Sortino, Max Drawdown, Calmar
  (CAGR/MaxDD), Win Rate, Profit Factor, Expectancy, Average holding period,
  Turnover, plus per-trade distribution.
- Portfolio-level risk: portfolio vol, beta, correlation of positions,
  sector concentration (risk overlap with `docs/scoring.md` §5 risk score).
- Always report **net of costs**; also report gross for diagnosis.

## 7. Walk-forward integration

For ML-driven backtests, evaluation uses the **deployed model version's
predictions** at each date (already stored append-only in `ml_predictions`).
Never retrain inside the backtest window and evaluate on the same window.
For strategy parameter tuning: nested walk-forward — outer window tunes, inner
window evaluates.

## 8. Reproducibility

- `backtests` row stores full config: strategy jsonb, universe jsonb,
  `start`, `end`, `feature_version`, `scoring_version`, `model_version`,
  cost params, sizing params, seed.
- Same config ⇒ same result (deterministic; seed recorded).
- `backtest_trades` append-only.

## 9. Bias audit report

Every backtest emits a `bias_audit` jsonb: confirmations that
- fundamentals used only `<= d`,
- universe resolved per date,
- no post-`d` score revisions used,
- fills at/after signal bar.

Test suite asserts these invariants programmatically (see §3.6 and PRD §51
backtesting tests).
