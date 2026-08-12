import math
from datetime import date, timedelta

import polars as pl

from app.domain.technical.structure import detect_structure


def _frame(opens, highs, lows, closes, volumes):
    n = len(closes)
    return pl.DataFrame(
        {
            "trade_date": pl.Series(
                [date(2024, 1, 1) + timedelta(days=i) for i in range(n)]
            ),
            "open": pl.Series(opens, dtype=pl.Float64),
            "high": pl.Series(highs, dtype=pl.Float64),
            "low": pl.Series(lows, dtype=pl.Float64),
            "close": pl.Series(closes, dtype=pl.Float64),
            "volume": pl.Series(volumes, dtype=pl.Float64),
        }
    )


def test_uptrend_has_hh_hl():
    prices = []
    p = 100.0
    for _ in range(80):
        p += 1.2 if len(prices) % 16 < 8 else -0.8
        prices.append(p)
    out = detect_structure(
        _frame(
            prices,
            [p + 0.5 for p in prices],
            [p - 0.5 for p in prices],
            prices,
            [1000.0] * 80,
        )
    )
    assert out["hh"].any()
    assert out["hl"].any()


def test_breakout_detected():
    n = 30
    closes, opens, highs, lows, vols = [], [], [], [], []
    for i in range(n):
        r = 100.0 + math.sin(i) * 0.8
        closes.append(r)
        opens.append(r - 0.1)
        highs.append(r + 0.8)
        lows.append(r - 0.8)
        vols.append(100.0)
    closes.append(103.0)
    opens.append(102.0)
    highs.append(103.5)
    lows.append(102.0)
    vols.append(300.0)
    out = detect_structure(_frame(opens, highs, lows, closes, vols))
    assert out["breakout"].sum() == 1
    assert out["breakout"][-1]


def test_breakdown_detected():
    n = 30
    closes, opens, highs, lows, vols = [], [], [], [], []
    for i in range(n):
        r = 100.0 + math.sin(i) * 0.8
        closes.append(r)
        opens.append(r - 0.1)
        highs.append(r + 0.8)
        lows.append(r - 0.8)
        vols.append(100.0)
    closes.append(97.0)
    opens.append(97.0)
    highs.append(97.8)
    lows.append(96.8)
    vols.append(300.0)
    out = detect_structure(_frame(opens, highs, lows, closes, vols))
    assert out["breakdown"].sum() == 1
    assert out["breakdown"][-1]


def test_no_nan():
    prices = []
    p = 100.0
    for _ in range(60):
        p += 1.2 if len(prices) % 16 < 8 else -0.8
        prices.append(p)
    out = detect_structure(
        _frame(
            prices,
            [p + 0.5 for p in prices],
            [p - 0.5 for p in prices],
            prices,
            [1000.0] * 60,
        )
    )
    bool_cols = [
        "swing_high",
        "swing_low",
        "hh",
        "hl",
        "lh",
        "ll",
        "breakout",
        "breakdown",
        "consolidation",
        "gap_up",
        "gap_down",
    ]
    for c in bool_cols:
        assert out[c].null_count() == 0, c
    for c in ("support_levels", "resistance_levels"):
        exploded = out[c].explode(empty_as_null=False)
        assert exploded.null_count() == 0, c
        assert not exploded.is_nan().any(), c


def test_consolidation_detected():
    out = detect_structure(
        _frame([100.0] * 20, [100.5] * 20, [99.5] * 20, [100.0] * 20, [100.0] * 20)
    )
    assert out["consolidation"].sum() > 0
    assert out["consolidation"][-1]


def test_gap_up_detected():
    out = detect_structure(
        _frame(
            [99.0, 101.0], [100.0, 102.0], [98.0, 100.5], [99.0, 101.5], [100.0, 100.0]
        )
    )
    assert out["gap_up"][1]
    assert not out["gap_down"][1]
