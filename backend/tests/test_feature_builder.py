from datetime import date, timedelta

import polars as pl

from app.application.services.features import build_technical_features

INDICATOR_COLUMNS = [
    "rsi_14",
    "macd",
    "macd_signal",
    "macd_hist",
    "sma_20",
    "sma_50",
    "sma_200",
    "ema_20",
    "atr_14",
    "boll_upper",
    "boll_mid",
    "boll_lower",
    "roc_20",
    "adx_14",
    "rel_volume",
    "hist_vol_20",
    "stoch_k",
    "stoch_d",
]
BASE_COLUMNS = ["ticker", "trade_date", "open", "high", "low", "close", "volume"]
N_DAYS = 250


def _frame(
    rising: tuple[str, ...] = ("T1",), falling: tuple[str, ...] = ("T2",)
) -> pl.DataFrame:
    start = date(2020, 1, 1)
    rows: list[dict] = []
    for i in range(N_DAYS):
        day = start + timedelta(days=i)
        for tk in rising + falling:
            base = 100.0
            growth = 1.0008 if tk in rising else 0.9992
            close = base * growth ** (i + 1)
            open_ = base * growth**i
            high = max(open_, close) * 1.01
            low = min(open_, close) * 0.99
            rows.append(
                {
                    "ticker": tk,
                    "trade_date": day,
                    "open": open_,
                    "high": high,
                    "low": low,
                    "close": close,
                    "volume": 1_000_000.0,
                }
            )
    return pl.DataFrame(rows)


def _last_n(df: pl.DataFrame, ticker: str, n: int) -> pl.DataFrame:
    return df.filter(pl.col("ticker") == ticker).sort("trade_date").tail(n)


def test_build_technical_features_has_expected_columns():
    df = _frame()
    out = build_technical_features(df)

    assert out.columns[:7] == BASE_COLUMNS
    for col in INDICATOR_COLUMNS:
        assert col in out.columns
    assert "feature_version" in out.columns

    assert (out["feature_version"] == "v1").all()
    assert out["ticker"].n_unique() == 2
    assert out.height == len(df)

    for col in BASE_COLUMNS:
        assert out[col].null_count() == 0

    for tk in ("T1", "T2"):
        tail = _last_n(out, tk, 10)
        for col in INDICATOR_COLUMNS:
            assert tail[col].null_count() == 0, f"{tk}.{col} has nulls in mature region"


def test_features_are_per_ticker_not_global():
    df = _frame()
    out = build_technical_features(df)

    rsi_t1 = _last_n(out, "T1", 10)["rsi_14"].drop_nulls()
    rsi_t2 = _last_n(out, "T2", 10)["rsi_14"].drop_nulls()
    assert rsi_t1.mean() > 50
    assert rsi_t2.mean() < 50
