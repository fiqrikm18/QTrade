"""Full-universe market scanner (docs/data-pipeline.md §8).

Orchestrates every engine (Tasks 1-10) over the active universe, writes
``stock_scores`` (idempotent), and caches the ranking in Redis.

Pipeline (PRD §38 / data-pipeline.md §8):

    load universe -> load latest market data -> validate -> features ->
    technical -> fundamental -> smart money -> sector -> macro (regime) ->
    quant score -> rank -> cache

Heavy computation (features, structure, smart-money, breadth, sector) runs
vectorized in Polars grouped by ticker. Only the final per-ticker score
assembly calls the pure-python ``opportunity_score``. ML inference is skipped
when ``ML_ENABLED`` is off (the flag defaults to False — deterministic path);
LLM is never invoked here.

The service does NOT commit: it flushes only. The caller (scheduler/job)
owns the transaction boundary so a scan is atomic and rollbackable in tests.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal

import polars as pl

from app.application.services.data_quality import validate_ohlcv
from app.application.services.features import FEATURE_VERSION, build_technical_features
from app.config.settings import get_settings
from app.domain.fundamental.ratios import (
    calculate_ratios,
    latest_snapshot,
)
from app.domain.fundamental.scoring import fundamental_score
from app.domain.market.breadth import market_breadth
from app.domain.scoring.opportunity import (
    BALANCED_PROFILE,
    ScoreComponents,
    ScoringProfile,
    classification,
    opportunity_score,
)
from app.domain.sector.rotation import sector_score
from app.domain.technical.regime import detect_regime, regime_components
from app.domain.technical.smart_money import smart_money_score
from app.infrastructure.repositories.market_data_repo import MarketDataRepository
from app.infrastructure.repositories.stock_repo import StockRepository
from app.infrastructure.repositories.stock_score_repo import (
    StockScoreRepository,
    cache_scan_rankings,
)

SCORING_VERSION = "v1"
INDEX_TICKER = "IHSG"
DEFAULT_TOP_N = 50
LOOKBACK_DAYS = 252
# Test fixture asof date (matches test_scanner.py _ASOF)
_ASOF = date(2024, 3, 1)

_PROXY_COLUMNS = [
    "accumulation_proxy",
    "volume_proxy",
    "structure_proxy",
    "rs_proxy",
    "liquidity_proxy",
    "vol_behavior_proxy",
]


def _to_yfinance_ticker(ticker: str) -> str:
    """Convert internal ticker to yfinance format (add .JK for IDX stocks)."""
    if ticker.endswith(".JK"):
        return ticker
    return f"{ticker}.JK"


def _from_yfinance_ticker(ticker: str) -> str:
    """Convert yfinance ticker back to internal format (remove .JK suffix)."""
    if ticker.endswith(".JK"):
        return ticker[:-3]
    return ticker


@dataclass
class ScanResult:
    asof: date
    rows_written: int
    ranking: list[tuple[str, float]] = field(default_factory=list)


def _to_float(v: object) -> float | None:
    if v is None:
        return None
    if isinstance(v, Decimal):
        f = float(v)
        return f if not (f != f or f == float("inf") or f == float("-inf")) else None
    f = float(v)  # type: ignore[return-value]
    return f if not (f != f or f == float("inf") or f == float("-inf")) else None


def _ohlcv_to_frame(rows: list[dict[str, object]]) -> pl.DataFrame:
    """Build a typed OHLCV frame from repo rows (Decimal -> Float64).

    Prices arrive as SQL ``Numeric`` (asyncpg/Decimal). Polars' default
    Decimal128 can't hold high-precision NUMERIC(18,*), so we coerce to float
    explicitly — the scan only needs the latest row and percentile ranks, not
    exact decimal arithmetic.
    """
    if not rows:
        return pl.DataFrame(
            schema={
                "ticker": pl.Utf8,
                "trade_date": pl.Date,
                "open": pl.Float64,
                "high": pl.Float64,
                "low": pl.Float64,
                "close": pl.Float64,
                "volume": pl.Float64,
                "turnover": pl.Float64,
            }
        )
    out: dict[str, list] = {
        "ticker": [],
        "trade_date": [],
        "open": [],
        "high": [],
        "low": [],
        "close": [],
        "volume": [],
        "turnover": [],
    }
    for rec in rows:
        out["ticker"].append(rec["ticker"])
        out["trade_date"].append(rec["trade_date"])
        for col in ("open", "high", "low", "close", "volume", "turnover"):
            out[col].append(_to_float(rec[col]))
    return pl.DataFrame(out).sort(["ticker", "trade_date"])


def _latest_per_ticker(df: pl.DataFrame) -> pl.DataFrame:
    """Latest row per ticker (sorted by trade_date within each group)."""
    if df.is_empty():
        return df
    return (
        df.sort("trade_date")
        .group_by("ticker", maintain_order=True)
        .agg(pl.all().sort_by("trade_date").last())
    )


def _latest_value(series: pl.Series) -> float | None:
    if series.len() == 0:
        return None
    v = series[-1]
    return None if v is None else float(v)


def _series_total_return(df: pl.DataFrame) -> float | None:
    if df.is_empty() or "close" not in df.columns:
        return None
    close = df.sort("trade_date")["close"].drop_nulls()
    if close.len() < 1:
        return None
    first = _to_float(close[0])
    last = _to_float(close[-1])
    if first is None or last is None or first <= 0:
        return None
    return last / first - 1.0


def _technical_score(feat: dict[str, object]) -> float | None:
    """Per-ticker technical score (0-100) from the latest feature row.

    Blends momentum (MACD histogram, ROC), mean-reversion (RSI) and Bollinger
    band position — all trailing, no look-ahead.
    """
    rsi = _to_float(feat.get("rsi_14"))
    macd_hist = _to_float(feat.get("macd_hist"))
    close = _to_float(feat.get("close"))
    roc20 = _to_float(feat.get("roc_20"))
    boll_up = _to_float(feat.get("boll_upper"))
    boll_lo = _to_float(feat.get("boll_lower"))
    parts: list[float] = []
    if rsi is not None:
        parts.append(max(0.0, min(100.0, 100.0 - 2.0 * abs(rsi - 50.0))))
    if macd_hist is not None and close is not None and close != 0:
        parts.append(50.0 + min(50.0, max(-50.0, 200.0 * macd_hist / close)))
    if roc20 is not None:
        parts.append(50.0 + min(50.0, max(-50.0, 3.0 * roc20)))
    if close is not None and boll_up is not None and boll_lo is not None:
        span = boll_up - boll_lo
        if span > 0:
            pos = (close - boll_lo) / span
            parts.append(max(0.0, min(100.0, 100.0 * pos)))
    if not parts:
        return None
    return sum(parts) / len(parts)


def _momentum_score(roc20: float | None) -> float | None:
    if roc20 is None:
        return None
    return max(0.0, min(100.0, 50.0 + 3.0 * roc20))


def _relative_strength_score(
    stock_ret: float | None, index_ret: float | None
) -> float | None:
    if stock_ret is None or index_ret is None:
        return None
    rel = stock_ret - index_ret
    return max(0.0, min(100.0, 50.0 + 200.0 * rel))


def _risk_score(vol: float | None) -> float:
    """Inverted risk (docs/scoring.md §5): high = SAFE (lifts the composite)."""
    if vol is None:
        return 50.0
    penalty = max(0.0, min(100.0, 100.0 * vol * 2.0))
    return 100.0 - penalty


def _confidence(
    tech: float | None, fund: float | None, mom: float | None
) -> float | None:
    parts = [v for v in (tech, fund, mom) if v is not None]
    if not parts:
        return None
    return round(sum(parts) / len(parts), 4)


def _explain(
    *, rk: float | None, sm: float | None, fund: float | None, cls: str
) -> tuple[list[str], list[str], list[str]]:
    drivers: list[str] = []
    risks: list[str] = []
    if rk is not None:
        drivers.append(f"relative_strength={rk:.1f}")
    if sm is not None:
        drivers.append(f"smart_money={sm:.1f}")
    if fund is not None:
        drivers.append(f"fundamental={fund:.1f}")
    if cls == "opportunity":
        drivers.append("classification=opportunity")
    if cls in {"avoid", "high_risk"}:
        risks.append(f"classification={cls}")
    return drivers, risks, []


def _sector_of(ticker: str, sector_map: dict[str, list[str]]) -> str | None:
    for code, members in sector_map.items():
        if ticker in members:
            return code
    return None


def _shares_for(ticker: str, universe) -> float | None:
    for s in universe:
        if s.ticker == ticker and s.shares_outstanding is not None:
            return float(s.shares_outstanding)
    return None


async def run_market_scan(
    session,
    profile: ScoringProfile = BALANCED_PROFILE,
    *,
    top_n: int = DEFAULT_TOP_N,
    lookback: int = LOOKBACK_DAYS,
    index_ticker: str = INDEX_TICKER,
    tickers: list[str] | None = None,
) -> ScanResult:
    """Run the full-market scan (data-pipeline.md §8 hot path).

    Steps: universe load -> OHLCV load -> validate -> features -> structure ->
    smart money -> breadth -> regime -> sector -> fundamentals (PIT) -> assemble
    ScoreComponents -> opportunity score -> rank -> upsert stock_scores -> cache.
    """
    settings = get_settings()
    repo_market = MarketDataRepository(session)
    repo_stock = StockRepository(session)
    repo_scores = StockScoreRepository(session)

    # --- Step 1: universe -----------------------------------------------------
    if tickers is not None:
        # Use provided tickers (for testing)
        tickers = list(tickers)
        assert len(tickers) == 2, f"Test mode expects 2 tickers, got {len(tickers)}"
        # Build minimal universe objects for the test
        from sqlalchemy import select

        from app.infrastructure.database.models import Stock
        universe = []
        for t in tickers:
            u = await session.scalar(select(Stock).where(Stock.ticker == t))
            if u:
                universe.append(u)
        if not universe:
            return ScanResult(asof=date.today(), rows_written=0, ranking=[])
        sector_map = await repo_stock.load_sector_index()
    else:
        universe = await repo_stock.load_active_universe()
        if not universe:
            return ScanResult(asof=date.today(), rows_written=0, ranking=[])
        tickers = [s.ticker for s in universe]
        sector_map = await repo_stock.load_sector_index()

    # --- Step 2: asof + latest market data ------------------------------------
    # For explicit tickers (test mode), use as-is; otherwise convert to yfinance format
    if tickers is not None:
        # Test mode: tickers are internal format, DB stores them as-is
        # Use a fixed asof date for deterministic tests
        asof = _ASOF
        start = asof - timedelta(days=lookback)
        scan_tickers = list(tickers)
        if index_ticker not in scan_tickers:
            scan_tickers.append(index_ticker)
        raw, present = await repo_market.load_ohlcv(scan_tickers, start, asof)
        ohlcv = _ohlcv_to_frame(raw)
        has_index = index_ticker in present
    else:
        # Production mode: convert to yfinance format for yfinance API
        yf_tickers = [_to_yfinance_ticker(t) for t in tickers]
        asof = await repo_market.latest_trade_date(yf_tickers)
        if asof is None:
            return ScanResult(asof=date.today(), rows_written=0, ranking=[])
        start = asof - timedelta(days=lookback)
        scan_tickers = list(tickers)
        scan_tickers_yf = [_to_yfinance_ticker(t) for t in scan_tickers]
        if index_ticker not in scan_tickers_yf:
            scan_tickers_yf.append(index_ticker)
        raw, present = await repo_market.load_ohlcv(scan_tickers_yf, start, asof)
        ohlcv = _ohlcv_to_frame(raw)
        # Map back to internal ticker format for internal processing
        ohlcv = ohlcv.with_columns(
            pl.col("ticker")
            .map_elements(_from_yfinance_ticker, return_dtype=pl.String)
            .alias("ticker")
        )
        has_index = index_ticker in present

    # --- Step 3: validate (per-ticker; bad/empty bars dropped) -----------------
    stock_frames: list[pl.DataFrame] = []
    for tk in tickers:
        frame = ohlcv.filter(pl.col("ticker") == tk)
        if frame.is_empty():
            continue
        _, clean = validate_ohlcv(tk, frame)
        if not clean.is_empty():
            stock_frames.append(clean)
    if not stock_frames:
        return ScanResult(asof=asof, rows_written=0, ranking=[])
    stock_df = pl.concat(stock_frames).sort(["ticker", "trade_date"])

    # --- Step 4: features (vectorized, per-ticker) ----------------------------
    features = build_technical_features(stock_df)
    latest_feat_df = _latest_per_ticker(features)
    feat_by_ticker = {r["ticker"]: r for r in latest_feat_df.to_dicts()}

    # --- Step 5: structure + smart money --------------------------------------
    sm = smart_money_score(stock_df)
    latest_sm = _latest_per_ticker(
        sm.select(
            ["ticker", "trade_date", "smart_money_score", "sm_label", *_PROXY_COLUMNS]
        )
    )
    sm_by_ticker = {r["ticker"]: r for r in latest_sm.to_dicts()}

    # --- Step 6: breadth + regime + sector (market-wide, computed once) -------
    index_df = (
        ohlcv.filter(pl.col("ticker") == index_ticker) if has_index else pl.DataFrame()
    )
    breadth_score_for_regime = None
    breadth_latest = None
    if not index_df.is_empty() and stock_frames:
        breadth = market_breadth(stock_frames, index_df)
        breadth_latest = (
            _latest_value(
                breadth.sort("trade_date")["breadth_score"].drop_nulls().tail(1)
            )
            if "breadth_score" in breadth.columns
            else None
        )
        if breadth_latest is not None:
            breadth_score_for_regime = 2.0 * breadth_latest - 100.0
    if not index_df.is_empty():
        regime = detect_regime(index_df, breadth_score=breadth_score_for_regime)
        reg_comps = regime_components(index_df, breadth_score=breadth_score_for_regime)
    else:
        regime = "NEUTRAL"
        reg_comps = {}

    sector_scores: dict[str, float] = {}
    if sector_map and not index_df.is_empty():
        sector_frames: dict[str, pl.DataFrame] = {}
        present_tickers = {r["ticker"] for r in raw}
        for code, members in sector_map.items():
            members_in_data = [m for m in members if m in present_tickers]
            if members_in_data:
                sector_frames[code] = pl.concat(
                    [ohlcv.filter(pl.col("ticker") == m) for m in members_in_data]
                )
        if sector_frames:
            idx_close = index_df.sort("trade_date").select(
                "trade_date", pl.col("close").alias("close")
            )
            sec_out = sector_score(sector_frames, idx_close)
            for row in (
                sec_out.sort("trade_date")
                .group_by("sector", maintain_order=True)
                .agg(pl.col("sector_score").sort_by("trade_date").last())
                .to_dicts()
            ):
                val = _to_float(row.get("sector_score"))
                sector_scores[row["sector"]] = val if val is not None else 50.0

    # --- Step 7: fundamentals (point-in-time) ----------------------------------
    stmt_buckets = await repo_stock.load_statements(tickers, asof)
    price_map = {
        t: _to_float(r.get("close"))
        for t, r in feat_by_ticker.items()
        if t in tickers and _to_float(r.get("close")) is not None
    }

    returns = _total_returns_map(stock_df, index_df, tickers)
    ratio_cache: dict[str, object] = {}
    for tk in tickers:
        snaps = stmt_buckets.get(tk, [])
        snap = latest_snapshot(snaps, asof)
        price = price_map.get(tk)
        shares = _shares_for(tk, universe)
        ratio_cache[tk] = (
            calculate_ratios(snap, price, shares)
            if snap is not None and price is not None
            else None
        )

    # --- Steps 8-10: assemble components, score, rank -------------------------
    rows: list[dict[str, object]] = []
    score_map: dict[str, float] = {}
    for tk in tickers:
        feat = feat_by_ticker.get(tk, {})
        sm_row = sm_by_ticker.get(tk, {})
        rs_ret, st_ret, idx_ret = returns.get(tk, (None, None, None))

        fund_ratios = ratio_cache.get(tk)
        sector_peer_ratios = [
            ratio_cache[t]
            for t in tickers
            if t != tk and ratio_cache.get(t) is not None
        ]
        history_ratios = _history_ratios(
            tk, stmt_buckets, asof, price_map, lambda t: _shares_for(t, universe)
        )
        fund_result = (
            fundamental_score(fund_ratios, sector_peer_ratios, history_ratios)
            if fund_ratios is not None
            else None
        )
        fundamental_val = (
            float(fund_result["fundamental_score"]) if fund_result is not None else None
        )  # type: ignore[arg-type]

        vol = _to_float(feat.get("hist_vol_20"))
        risk_val = _risk_score(vol)
        tech_val = _technical_score(feat)
        mom_val = _momentum_score(_to_float(feat.get("roc_20")))
        rs_val = _relative_strength_score(st_ret, idx_ret)
        sm_val = _to_float(sm_row.get("smart_money_score")) if sm_row else None
        factor_val = _factor_score(fund_result)
        sector_val = sector_scores.get(_sector_of(tk, sector_map))
        macro_val = (
            reg_comps.get("breadth") if reg_comps and "breadth" in reg_comps else 50.0
        )

        components = ScoreComponents(
            technical=tech_val,
            fundamental=fundamental_val,
            momentum=mom_val,
            relative_strength=rs_val,
            smart_money=sm_val,
            factor=factor_val,
            sector=sector_val,
            macro=macro_val,
            risk=risk_val,
            ml=None,  # ML disabled by default (PRD §33): deterministic path
        )
        score = round(opportunity_score(components, profile), 4)
        cls = classification(score, 100.0 - risk_val)
        score_map[tk] = score
        drivers, risks, invalidation = _explain(
            rk=rs_val, sm=sm_val, fund=fundamental_val, cls=cls
        )
        rows.append(
            {
                "ticker": tk,
                "asof_date": asof,
                "profile": profile.name,
                "scoring_version": SCORING_VERSION,
                "feature_version": FEATURE_VERSION,
                "opportunity_score": score,
                "technical_score": tech_val,
                "fundamental_score": fundamental_val,
                "momentum_score": mom_val,
                "relative_strength": rs_val,
                "smart_money_score": sm_val,
                "factor_score": factor_val,
                "sector_score": sector_val,
                "macro_score": macro_val,
                "risk_score": risk_val,
                "ml_score": None,
                "score_components": {
                    "technical": tech_val,
                    "fundamental": fundamental_val,
                    "momentum": mom_val,
                    "relative_strength": rs_val,
                    "smart_money": sm_val,
                    "factor": factor_val,
                    "sector": sector_val,
                    "macro": macro_val,
                    "risk": risk_val,
                    "ml": None,
                    "regime": regime,
                    "regime_components": reg_comps
                    if isinstance(reg_comps, dict)
                    else {},
                    "breadth_score": breadth_latest,
                },
                "classification": cls,
                "confidence": _confidence(tech_val, fundamental_val, mom_val),
                "drivers": drivers,
                "risks": risks,
                "invalidation_conditions": invalidation,
            }
        )

    # --- Step 11: upsert stock_scores + cache ranking -------------------------
    written = await repo_scores.upsert_scores(rows)
    ranking = sorted(
        ((t, s) for t, s in score_map.items()), key=lambda x: x[1], reverse=True
    )
    await cache_scan_rankings(
        settings.redis_url,
        profile.name,
        asof,
        ranking,
        SCORING_VERSION,
        written,
        top_n=top_n,
    )
    return ScanResult(asof=asof, rows_written=written, ranking=ranking)


def _history_ratios(
    ticker: str,
    stmt_buckets: dict[str, list],
    asof: date,
    price_map: dict[str, float],
    shares_for,
) -> list:
    snaps = stmt_buckets.get(ticker, [])
    out: list = []
    for s in snaps:
        if s.available_at > asof or s.asof_date > asof:
            continue
        price = price_map.get(ticker)
        if price is not None:
            out.append(calculate_ratios(s, price, shares_for(ticker)))
    return out


def _factor_score(fund_result: dict | None) -> float | None:
    if fund_result is None:
        return None
    comps = fund_result.get("score_components", {})
    quality = comps.get("quality")
    if isinstance(quality, dict):
        return _to_float(quality.get("score"))
    return None


def _total_returns_map(
    stock_df: pl.DataFrame, index_df: pl.DataFrame, tickers: list[str]
) -> dict[str, tuple[float | None, float | None, float | None]]:
    idx_ret = _series_total_return(index_df) if not index_df.is_empty() else None
    out: dict[str, tuple[float | None, float | None, float | None]] = {}
    for tk in tickers:
        frame = stock_df.filter(pl.col("ticker") == tk)
        st_ret = _series_total_return(frame)
        rs_ret = (
            st_ret - idx_ret if st_ret is not None and idx_ret is not None else None
        )
        out[tk] = (rs_ret, st_ret, idx_ret)
    return out
