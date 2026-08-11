# ML Engine

ML is a **support tool**, never an autonomous trader and never the final
authority (PRD §24). It augments deterministic scoring; `ml_score` is at most
5% of `opportunity_score` (default), and the deterministic system runs
identically with ML disabled.

## 1. Scope & constraints

- Start simple: Logistic Regression → Random Forest → LightGBM/XGBoost.
  No deep learning unless data size + out-of-sample performance justify it.
- Targets are forward-looking labels **derived from data, never from the
  future** at prediction time.
- Every model is time-series validated (walk-forward / expanding window).
  **Random train/test splits are forbidden** (PRD §26).
- Models judged by financial metrics (IC, Sharpe, hit ratio, turnover-adjusted)
  and calibration, not raw accuracy.
- Everything versioned: model, features, training window.

## 2. Targets

### Classification (primary)
```text
P(return_ticker[asof+5D] > X)     horizon 5D
P(return_ticker[asof+10D] > X)    horizon 10D
P(return_ticker[asof+20D] > X)    horizon 20D
```
`X` default = median forward return of universe (configurable), so the
positive class is balanced cross-sectionally.

### Regression
`forward_return` over horizon (predicting a number, ranked by IC).

### Ranking
Sort by predicted expected risk-adjusted return. Expose:
`probability`, `expected_return`, `confidence`, `model_version`.

## 3. Features (`docs/data-model.md` §9, PRD §25)

Technical (RSI, MACD, SMA/EMA distance, ATR, volatility, momentum), volume
(relative volume, acceleration, OBV, CMF), fundamental (ROE, ROIC, EPS growth,
revenue growth, valuation), market (IHSG return, sector return, breadth),
macro (USD/IDR, yields, commodities, macro regime), alternative (news
sentiment, event surprise).

Rules:

- All features are **point-in-time** (available_at-aware) — same anti-leakage
  rule as fundamentals (`docs/data-pipeline.md` §6).
- Feature set is fixed per `feature_version`; a feature-set change bumps it.
- Features are built by the same `calculate_features` job used by scoring —
  **no separate feature pipeline for ML**, to keep versions aligned.
- Store `features_hash` (hash of column names + versions) on the model row to
  detect drift between training and inference features.

## 4. Training protocol

1. Build labeled dataset: features at each `asof` joined with forward label at
   `asof + horizon`. Labels reference only data available at label date.
2. Split by **time** only: expanding-window or walk-forward with
   `train/validation/test` boundaries on dates. Never shuffle across time.
3. Train on train window; tune on validation; evaluate once on test.
4. Record metrics on the test (held-out, most recent) window.
5. Calibrate probabilities (Platt/isotonic) on validation, apply at inference.
6. Store model + metadata in `ml_models`; artifact under `models/`.

Prevent leakage: drop features computed with data after `asof`; ensure
normalization/scaling is fit **inside** the train window only; no universe
filters using future membership; no sector/macro aggregates computed with
future revisions.

## 5. Validation metrics (PRD §26)

- Classification: accuracy, precision, recall, F1, ROC-AUC, Brier score,
  calibration curve (reliability), hit ratio.
- Ranking/regression: Information Coefficient (Spearman IC), Rank IC, ICIR.
- **Financial:** backtest the model-driven ranking via `docs/backtesting.md`:
  CAGR, Sharpe, Sortino, Max Drawdown, turnover, transaction costs.
- Never judge by accuracy alone; report Brier + IC + Sharpe.

## 6. Inference & `ml_score`

- Run after each market scan if `ML_ENABLED` (feature flag). Predict for the
  full universe on latest features; store in `ml_predictions` (append-only).
- `ml_score` = blend of calibrated `probability`, model `confidence`, and
  (if regression/ranking available) expected-return percentile. Formula
  versioned; default:
  ```text
  ml_score = clamp(0, 100, 50 + 50*(2*(probability − 0.5)) ) * confidence_factor
  ```
  `ponytail:` Replace with calibrated expected-utility mapping once a
  production model with validated IC exists.
- No ML results: `ml_score = N/A` (renormalized away in scoring).

## 7. Model registry & versioning

`ml_models` columns: `model_name`, `model_version`, `target`, `horizon`,
`feature_version`, `features_hash`, `training_start`, `training_end`,
`metrics` jsonb, `artifact_path`, `status` (staging/production/retired).

- Predictions store `model_name`, `model_version`, `feature_version`,
  `prediction_timestamp`. **Historical predictions are never overwritten.**
- A model is promotable to production only after passing thresholds
  (e.g. test-window IC > baseline and non-negative Sharpe after costs).
- Model retraining creates a new version; production inference pins the
  deployed version.

## 8. Explainability

- Feature importance (permutation or gain) stored per model.
- SHAP for a sample of predictions where feasible (top candidates only —
  expensive on full universe).
- API exposes `feature_importance`, `model_version`, `training period`,
  `validation metrics` with every prediction (PRD §36).

## 9. Offline & experimentation

- Notebooks (`notebooks/`) run against DuckDB + Parquet feature matrices;
  read-only against PG.
- Experiment tracking: `ml_models` rows + a `ml_experiments` table
  (config, params, metrics, artifact path). Plain and sufficient at this
  scale; `ponytail:` add MLflow when experiment count demands it.
