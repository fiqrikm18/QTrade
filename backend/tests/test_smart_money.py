from datetime import date, timedelta

import polars as pl

from app.domain.technical.smart_money import (
    SmartMoneyConfig,
    smart_money_score,
)

TOTAL = 120

COMPONENT_COLUMNS = [
    "accumulation_proxy",
    "volume_proxy",
    "structure_proxy",
    "rs_proxy",
    "liquidity_proxy",
    "vol_behavior_proxy",
]


def _frame(
    phase: str,
    start: float | None = None,
) -> pl.DataFrame:
    n = TOTAL
    i = pl.Series("i", range(n), dtype=pl.Int64)
    accumulation = phase == "accumulation"
    drift = 0.5 if accumulation else -0.5
    start_px = 80.0 if accumulation else 120.0
    if start is not None:
        start_px = start
    sin_i = i.cast(pl.Float64).sin()
    close = (start_px + drift * i + 1.5 * sin_i).cast(pl.Float64)
    prev = close.shift(1)
    up = (close > prev).fill_null(False)
    smooth_up = up.cast(pl.Float64).rolling_mean(7, min_samples=1)
    half_band = (0.4 + 2.6 * i / n) if accumulation else (1.0 + 4.0 * i / n)
    high = close + half_band
    low = close - half_band
    if accumulation:
        vol = (6000.0 * (1.0 + i / n) ** 2) * (1.0 + 1.8 * smooth_up)
    else:
        vol = (20000.0 / (1.0 + 1.2 * i / n)) * (1.0 + 1.8 * (1.0 - smooth_up))
    return pl.DataFrame(
        {
            "trade_date": [date(2024, 1, 1) + timedelta(days=1) * k for k in range(n)],
            "open": close,
            "high": high,
            "low": low,
            "close": close,
            "volume": vol,
        }
    )


def _last_non_null(out: pl.DataFrame, col: str) -> float:
    return out[col].drop_nulls()[-1]


def test_accumulation_scores_high():
    out = smart_money_score(_frame("accumulation"))
    assert _last_non_null(out, "smart_money_score") > 60


def test_distribution_scores_low():
    out = smart_money_score(_frame("distribution"))
    assert _last_non_null(out, "smart_money_score") < 40


def test_label_is_proxy():
    out = smart_money_score(_frame("accumulation"))
    labels = out["sm_label"].drop_nulls()
    assert labels.len() > 0
    assert labels.str.starts_with("proxy").all()


def test_components_present():
    out = smart_money_score(_frame("accumulation"))
    for col in COMPONENT_COLUMNS:
        assert col in out.columns, col
    assert "sm_components" in out.columns


def test_score_bounded():
    out = smart_money_score(_frame("accumulation"))
    non_null = out["smart_money_score"].drop_nulls()
    assert non_null.is_between(0, 100).all()


def test_configurable_weights_change_score():
    df = _frame("accumulation")
    base = _last_non_null(smart_money_score(df), "smart_money_score")
    biased = SmartMoneyConfig(
        accumulation=1.0,
        volume_behavior=0.0,
        price_structure=0.0,
        relative_strength=0.0,
        liquidity=0.0,
        volatility_behavior=0.0,
    )
    changed = _last_non_null(smart_money_score(df, biased), "smart_money_score")
    assert changed != base


def test_multi_ticker_per_ticker_metrics():
    acc = _frame("accumulation")
    dis = _frame("distribution")
    stacked = pl.concat(
        [
            acc.with_columns(pl.lit("ACC").alias("ticker")),
            dis.with_columns(pl.lit("DIS").alias("ticker")),
        ]
    )
    out = smart_money_score(stacked)
    assert out["ticker"].n_unique() == 2
    assert out.height == 2 * TOTAL
    for tk in ("ACC", "DIS"):
        tail = out.filter(pl.col("ticker") == tk).sort("trade_date")
        single = smart_money_score(
            _frame("accumulation" if tk == "ACC" else "distribution")
        )
        assert tail["smart_money_score"].drop_nulls()[-1] == _last_non_null(
            single, "smart_money_score"
        )


def test_turnover_column_respected():
    df = _frame("distribution").with_columns(
        (pl.col("close") * pl.col("volume")).alias("turnover")
    )
    out = smart_money_score(df)
    assert "turnover" in out.columns
    assert _last_non_null(out, "smart_money_score") < 40
