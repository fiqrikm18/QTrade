# Technical Analysis Engine

Deterministic, vectorized, Polars-based. No LLM anywhere in this engine
(PRD §7, §14, §34).

## 1. Design

- Pure functions of `(ohlcv_frame, params) -> feature_frame`.
- All indicators computed via Polars expressions on group_by(ticker) frames.
- Warm-up: compute with full history; emit `null` until enough data.
- Parameters come from config; every window is a parameter (no magic numbers).
- Every output row tagged `asof_date` + `feature_version`.

Module: `app/domain/technical/`. Indicator catalog mirrors PRD §7.

## 2. Trend

| Indicator | Formula (defaults) |
|---|---|
| SMA(n) | rolling mean of close, n ∈ {5,10,20,50,100,200} |
| EMA(n) | `alpha=2/(n+1)`; seed = SMA(n) of first n |
| WMA(n) | weighted mean, weights = n..1 |
| VWAP(day) | `cumsum(typical*volume)/cumsum(volume)` within session; typical = (H+L+C)/3 |
| Anchored VWAP | VWAP from a configurable anchor date (e.g. IPO, swing low, event) |
| ADX(n=14) | true range → `+DM/-DM` smoothed (Wilder) → `DX=100*|+DI−−DI|/(+DI+−DI)` → `ADX=WMA(DX)` |
| Supertrend(period=10, mult=3) | bands from ATR; flips trend when close crosses band |
| Ichimoku(9,26,52) | Tenkan, Kijun, Senkou A/B (displacement), Chikou; cloud state (price above/below/inside) |

Trend state per stock: `uptrend / downtrend / ranging` from composite of
SMA50/SMA200 alignment, ADX threshold, and Supertrend direction.

## 3. Momentum

| Indicator | Formula |
|---|---|
| RSI(14) | Wilder-smoothed avg gain/loss; `100 − 100/(1+RS)` |
| Stochastic(14,3,3) | `%K=100*(C−LL14)/(HH14−LL14)`; `%D=SMA(%K,3)` |
| MACD(12,26,9) | EMA12−EMA26; signal=EMA9 of MACD; histogram |
| ROC(n) | `100*(C/C_{n} − 1)` |
| CCI(20) | `(TP−SMA(TP))/(0.015*MAD(TP))` |
| Williams %R(14) | `−100*(HH14−C)/(HH14−LL14)` |

Momentum score inputs: RSI zone, MACD histogram slope, ROC n-day sign.

## 4. Volatility

| Indicator | Formula |
|---|---|
| ATR(14) | Wilder smoothing of TR |
| Historical vol(20) | std of log returns × √252 |
| Bollinger(20, 2) | SMA ± 2×std |
| Keltner(20, 2×ATR) | EMA ± 2×ATR |
| Vol percentile | rank of current HV among trailing 252 values (0-100) |

## 5. Volume

| Indicator | Formula |
|---|---|
| Volume SMA(n) | rolling mean volume |
| Relative Volume | `volume / SMA(volume,20)`, often vs same weekday |
| OBV | cumsum(sign(close diff) × volume) |
| MFI(14) | `100 − 100/(1 + positive_money_flow/negative_money_flow)` |
| CMF(20) | `sum(MFV)/sum(volume)`, MFV = MFV multiplier × volume |
| Volume breakout | volume > SMA20 × threshold (default 2.0) |
| Volume acceleration | `(V_t/V_{t−1})` rising over n sessions |

## 6. Price structure

Detect (PRD §7): Higher High / Higher Low / Lower High / Lower Low,
support/resistance, breakout/breakdown, consolidation, range, gap, gap fill.

Rules (vectorized over swing points):

- Swing high/low: fractal of window `k` (default 5): `H_t` is a swing high if
  `H_t > max(H_{t−k..t−1})` and `H_t ≥ max(H_{t+1..t+k})`.
- HH/HL/LL/LH: compare consecutive swing highs/lows.
- Support/resistance: recent swing extremes clustered within tolerance
  (`~1.5×ATR`); keep levels with most touches.
- Breakout: close beyond resistance with `relative_volume > 1.5`; breakdown is
  the mirror.
- Consolidation: range within `~1.5×ATR` for ≥ 10 sessions, volume contracting.
- Gap: `low_t > high_{t−1}` (up) / `high_t < low_{t−1}` (down); gap fill = price
  returns into gap zone within configurable horizon.

## 7. Smart money / market structure (proxies)

PRD §8. **Every output is labeled `proxy`**, not claimed institutional fact.

Components feeding `smart_money_score` (0-100):

| Component | Basis |
|---|---|
| accumulation | price range compression + above-average volume near support; close in upper part of range |
| volume_behavior | relative volume + volume acceleration + volume-price agreement |
| price_structure | break of structure (HH+HL on swings), change of character (regime flip) |
| relative_strength | vs IHSG / sector (see `docs/scoring.md`) |
| liquidity | average turnover percentile |
| volatility_behavior | vol percentile trend (contracting vol + rising price = accumulation proxy) |

Also computed, proxy-labeled:

- **Accumulation/distribution phase** (Wyckoff-inspired): phase A-E heuristics
  from swing structure + volume.
- **Liquidity sweep**: price wicks beyond prior swing level then closes back.
- **Large volume anomaly**: volume z-score > threshold with price move.

## 8. Market breadth

Per session across universe (PRD §13):

- Advance/Decline, New Highs / New Lows (vs 52w), % above SMA20/50/200,
  RSI breadth (% RSI>50), volume breadth (advancing volume share), breakout
  breadth, momentum breadth (% stocks with 20D ROC>0).
- `market_breadth_score` = weighted composite (weights configurable).
- Contributes to regime; stored per date (`market_breadth`).

## 9. Market regime

Deterministic only (PRD §14). Classes:
`STRONG_BULLISH, BULLISH, NEUTRAL, WEAK_BEARISH, BEARISH, HIGH_VOLATILITY,
RISK_ON, RISK_OFF`.

Inputs (weighted):
- IHSG trend (SMA50/200 + slope) and momentum (20D/60D returns)
- IHSG volatility regime (HV percentile)
- Breadth score
- Sector rotation breadth (% sectors in uptrend)
- Index volume trend
- Cross-asset correlation (USD/IDR, DXY, global indices) — configurable,
  data-dependent
- Macro conditions feed a tilt, never override (see `docs/macro.md`)

Classification = highest-weighting rule set from these signals, thresholded.
`regime_score` jsonb stores each input's contribution for explainability.

## 10. Output

`technical_features` table (per `data-model.md` §9) stores indicators + flags +
`feature_version`. Engine is pure: same inputs ⇒ same outputs. Bump
`feature_version` on any formula/parameter change. Never mutate history;
recompute forward with new version.
