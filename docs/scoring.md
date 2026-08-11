# Scoring

Composes features and sub-scores into the `opportunity_score` and produces
ranking, recommendations, and screeners. Deterministic. Explainable.
Versioned. (PRD §19, §20, §21, §35, §36, §47.)

## 1. Opportunity score

Default weights (PRD §19) — **always** configurable per `ScoringProfile`:

| Component | Weight | Source |
|---|---|---|
| technical_score | 20% | `docs/technical-analysis.md` |
| fundamental_score | 20% | `docs/fundamental-analysis.md` |
| momentum_score | 15% | technical momentum section |
| relative_strength | 10% | below |
| smart_money_score | 10% | `docs/technical-analysis.md` §7 |
| factor_score | 5% | §4 |
| sector_score | 5% | §5 |
| macro_score | 5% | `docs/macro.md` |
| risk_score | 5% | §6 |
| ml_score | 5% | `docs/ml.md` (0 if `ML_ENABLED=false`) |

```text
opportunity_score = Σ (weight_i × score_i) / Σ weight_i
```

- Weights must sum to 100; missing/`N/A` components renormalize the rest.
- Scores are 0-100. Raw 0-100 for technical/fundamental; relative strength,
  momentum etc. are mapped to 0-100 internally.
- **Risk is inverted:** high risk lowers the composite (a 95 `risk_score` means
  LOW risk; risk scoring below yields "risk_score = 100 − risk_penalty").

### ScoringProfile

Stored in `scoring_profiles` (jsonb `weights`, `version`, `is_default`).
Seeded profiles (PRD §19):

| Profile | Bent | Example weights |
|---|---|---|
| aggressive | momentum + technical | tech 25, fund 10, mom 25, rs 10, sm 15, ... |
| balanced | default weights | as above |
| conservative | quality + low risk | fund 30, risk 20, tech 15, ... |
| value | valuation + fundamentals | fund 35, factor(value) 15, ... |
| momentum | momentum + relative strength | mom 30, rs 20, tech 15, ... |
| swing | technical + smart money | tech 25, sm 25, mom 15, ... |
| long_term | fundamentals + quality | fund 40, factor 15, risk 10, ... |

Profiles stored in DB so operators tune without redeploy. A profile change
bumps `scoring_version`.

## 2. Relative strength (PRD §9)

For each stock, returns vs IHSG and vs sector index over
`20D / 60D / 120D`:

```text
RS_20D = return_stock_20D − return_benchmark_20D   (per period)
```

- `relative_strength_score` = percentile rank of blended RS (weights e.g.
  0.2/0.3/0.5) across universe at each `asof`, mapped 0-100.
- Class: `outperforming / neutral / underperforming` by threshold bands.
- Benchmarks configurable (default IHSG; sector index when sector data
  available).

## 3. Sector rotation score (PRD §12)

Per sector at each date:

- performance (1M/3M), relative strength vs IHSG, momentum, volume trend,
  breadth (% members above SMA50), aggregate valuation percentile,
  aggregate fundamentals.
- `sector_score` = weighted blend, 0-100.
- Rotation class: `leading / improving / weakening / lagging` from a 2D
  (momentum × relative strength) rotation matrix.
- A stock's `sector_score` = its sector's rotation score, optionally blended
  with stock-level factor scores. Stored in `sector_scores`.

## 4. Factor model (PRD §11)

Cross-sectional factor scores (0-100) per stock per date, via percentile rank:

| Factor | Basis |
|---|---|
| Value | PER/PBV/EV-EBITDA/FCF-yield blend, percentile |
| Momentum | 12-1M return, 1M reversed (avoid short-term reversal) |
| Quality | `quality_score` (fundamental engine) |
| Growth | revenue/EPS/FCF growth |
| Low Volatility | inverse of HV percentile |
| Size | inverse log market cap (small premium) — configurable on/off |
| Liquidity | turnover percentile |
| Relative Strength | `relative_strength_score` |

`factor_score` = weighted blend (weights per profile). Expose the factor
vector in `score_components` for the radar chart.

## 5. Risk score (PRD §28)

Inputs (latest, per stock):
- realized volatility (20D, 60D) and HV percentile
- max drawdown (250D)
- beta vs IHSG
- liquidity risk (turnover percentile; low = risky)
- price/mcap size tier
- (portfolio-level risk lives in `docs/backtesting.md` / portfolio domain)

`risk_penalty` 0-100 (higher = riskier); `risk_score = 100 − risk_penalty`.
Blend weights configurable. Record component values for explainability.

## 6. Explainability (PRD §36, §63)

Every score stored with `score_components` jsonb:

```json
{
  "opportunity_score": 86,
  "components": {
    "technical": {"score": 88, "drivers": ["RSI>70", "price>EMA50", "breakout"]},
    "fundamental": {"score": 91, "drivers": ["ROE_pctile_92", "growth_yoy_0.18"]},
    "momentum": {"score": 84, "drivers": ["roc_20d_0.06"]},
    "risk": {"score": 76, "drivers": ["hv_pctile_61", "beta_1.1"]}
  },
  "profile": "balanced",
  "scoring_version": "v3",
  "coverage": {"fundamental": 0.9}
}
```

- Drivers = named reasons, not blobs. Rules: top-3 contributors to each
  sub-score and to the composite.
- `GET /api/v1/stocks/{ticker}/analysis` returns components + drivers.
- `GET /api/v1/llm/explain` feeds ONLY these structured components to the LLM
  (`docs/llm.md`).

## 7. Classification & recommendation (PRD §35)

From `opportunity_score` + risk + confidence thresholds:

| Class | Meaning | Guidance |
|---|---|---|
| `opportunity` | high score, acceptable risk | positive but caveated |
| `watchlist` | improving / moderate | monitor |
| `neutral` | middle | no lean |
| `high_risk` | elevated risk components | caution |
| `avoid` | poor scores or critical flags | avoid |

Each recommendation carries `drivers`, `risks`, `invalidation_conditions`
(break of defined support, sector RS deterioration, fundamental
deterioration), `confidence`, `feature_version`, `scoring_version`.
Wording rule: decision support, never "buy this stock".

## 8. Ranking (PRD §20)

Scan output ranks full universe by `opportunity_score` per profile.
Support top N (5/10/20/50), bottom 10, sector-specific, and any saved
screener. Persist to `stock_scores`, cache in Redis. The API serves cached
rankings; recompute only via scan job.

## 9. Screener (PRD §21)

Deterministic filter engine over the latest feature/scores tables. Operators:
`> >= < <= between in`, on numeric scores, ratios, indicators, and categorical
fields (sector, board, class). Combined with AND/OR.

Prebuilt example filters: `high_quality_momentum`
(momentum>75, fundamental>70, RS>70, liquidity>60 — PRD §45). Users save
screener definitions (JSON rule trees) to `saved_screeners` (see
`docs/data-model.md` § "User terminal state"); results are computed by the
engine, not by LLM.

NL → filters is an LLM feature (`docs/llm.md` §6); the **execution is always
deterministic**.

## 10. Data quality gating

`opportunity_score` for a stock with `quality_score < 60` is flagged
`low_data_quality` and excluded from default rankings (configurable). The
gate is recorded in `score_components`, never silently applied.

## 11. Versioning

- Any formula/weight/threshold change bumps `scoring_version`.
- All scores and recommendations store `(asof_date, profile, scoring_version,
  feature_version)` for audit reconstruction (PRD §55).
- Historical score rows are never mutated; recompute with new version.
