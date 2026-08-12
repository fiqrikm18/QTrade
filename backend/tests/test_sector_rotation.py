import datetime as dt

import polars as pl

from app.domain.sector.rotation import sector_membership, sector_score

_START = dt.date(2023, 1, 2)
_DAYS = 70
_REQUIRED = {
    "sector",
    "trade_date",
    "perf_1m",
    "perf_3m",
    "rel_strength",
    "momentum",
    "vol_trend",
    "breadth",
    "sector_score",
    "rotation_class",
}


def _ohlcv(ticker: str, base: float, growth: float) -> pl.DataFrame:
    return pl.DataFrame(
        {
            "ticker": [ticker] * _DAYS,
            "trade_date": [_START + dt.timedelta(days=i) for i in range(_DAYS)],
            "open": [base * growth**i for i in range(_DAYS)],
            "high": [base * growth**i for i in range(_DAYS)],
            "low": [base * growth**i for i in range(_DAYS)],
            "close": [base * growth**i for i in range(_DAYS)],
            "volume": [1_000_000.0] * _DAYS,
        }
    )


def _index(base: float, growth: float) -> pl.DataFrame:
    return pl.DataFrame(
        {
            "trade_date": [_START + dt.timedelta(days=i) for i in range(_DAYS)],
            "close": [base * growth**i for i in range(_DAYS)],
        }
    )


def test_leading_vs_lagging():
    sectors = {
        "tech": _ohlcv("A", 10.0, 1.001),
        "energy": _ohlcv("B", 20.0, 0.999),
    }
    index_df = _index(7000.0, 1.0005)
    out = sector_score(sectors, index_df)
    last = out.group_by("sector").tail(1)
    classes = dict(zip(last["sector"], last["rotation_class"], strict=True))
    assert classes["tech"] == "leading"
    assert classes["energy"] == "lagging"


def test_improving_weakening():
    rising = {"tech": _ohlcv("A", 10.0, 1.001)}
    fast_rising_index = _index(7000.0, 1.002)
    improving = sector_score(rising, fast_rising_index).filter(
        pl.col("sector") == "tech"
    )["rotation_class"].tail(1)[0]
    assert improving == "improving"

    falling = {"energy": _ohlcv("B", 20.0, 0.999)}
    fast_falling_index = _index(7000.0, 0.998)
    weakening = sector_score(falling, fast_falling_index).filter(
        pl.col("sector") == "energy"
    )["rotation_class"].tail(1)[0]
    assert weakening == "weakening"


def test_sector_score_bounded():
    sectors = {
        "tech": _ohlcv("A", 10.0, 1.001),
        "energy": _ohlcv("B", 20.0, 0.999),
        "consumer": _ohlcv("C", 30.0, 1.0),
    }
    out = sector_score(sectors, _index(7000.0, 1.0005))
    scores = out["sector_score"].drop_nulls()
    assert scores.len() > 0
    assert scores.min() >= 0.0
    assert scores.max() <= 100.0


def test_columns_present():
    sectors = {
        "tech": _ohlcv("A", 10.0, 1.001),
        "energy": _ohlcv("B", 20.0, 0.999),
    }
    out = sector_score(sectors, _index(7000.0, 1.0005))
    assert _REQUIRED.issubset(out.columns)
    assert out["sector"].n_unique() == 2


def test_membership():
    frames = {
        "tech": _ohlcv("A", 10.0, 1.001).vstack(_ohlcv("B", 20.0, 0.999)),
        "energy": _ohlcv("C", 30.0, 1.0),
    }
    assert sector_membership(frames) == {
        "tech": ["A", "B"],
        "energy": ["C"],
    }
