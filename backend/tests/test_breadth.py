import datetime as dt

import polars as pl
import pytest

from app.domain.market.breadth import BreadthWeights, market_breadth

_START = dt.date(2023, 1, 2)


def _ohlcv(ticker: str, closes: list[float], start: dt.date = _START) -> pl.DataFrame:
    n = len(closes)
    return pl.DataFrame(
        {
            "ticker": [ticker] * n,
            "trade_date": [start + dt.timedelta(days=i) for i in range(n)],
            "open": closes,
            "high": closes,
            "low": closes,
            "close": closes,
            "volume": [1_000_000.0] * n,
        }
    )


def _index(closes: list[float], start: dt.date = _START) -> pl.DataFrame:
    n = len(closes)
    return pl.DataFrame(
        {
            "trade_date": [start + dt.timedelta(days=i) for i in range(n)],
            "close": closes,
        }
    )


def test_advance_decline():
    frames = [
        _ohlcv("A", [10.0, 11.0, 12.0, 13.0]),
        _ohlcv("B", [20.0, 21.0, 20.0, 21.0]),
        _ohlcv("C", [30.0, 29.0, 30.0, 31.0]),
    ]
    out = market_breadth(frames, _index([7000.0 + i for i in range(4)]))
    day2 = out.filter(pl.col("trade_date") == _START + dt.timedelta(days=1))
    assert day2["advance"][0] == 2
    assert day2["decline"][0] == 1
    day3 = out.filter(pl.col("trade_date") == _START + dt.timedelta(days=2))
    assert day3["advance"][0] == 2
    assert day3["decline"][0] == 1
    day4 = out.filter(pl.col("trade_date") == _START + dt.timedelta(days=3))
    assert day4["advance"][0] == 3
    assert day4["decline"][0] == 0


def test_pct_above_sma20():
    rising = [10.0 + i for i in range(25)]
    frames = [_ohlcv("A", rising), _ohlcv("B", rising), _ohlcv("C", rising)]
    out = market_breadth(frames, _index([7000.0 + i for i in range(25)]))
    assert out["pct_above_sma20"][0] is None
    last = out["pct_above_sma20"].tail(1)[0]
    assert last is not None and last > 0.0


def test_breadth_score_present():
    rising = [10.0 + i for i in range(25)]
    frames = [_ohlcv("A", rising), _ohlcv("B", rising), _ohlcv("C", rising)]
    out = market_breadth(frames, _index([7000.0 + i for i in range(25)]))
    assert "breadth_score" in out.columns
    assert "index_close" in out.columns
    last = out["breadth_score"].tail(1)[0]
    assert last is not None and 0.0 <= last <= 100.0


def test_weights_configurable():
    frames = [
        _ohlcv("A", [10.0 + i for i in range(25)]),
        _ohlcv("B", [30.0 - i for i in range(25)]),
        _ohlcv("C", [15.0] * 25),
    ]
    index_df = _index([7000.0 + i for i in range(25)])
    w_adv = BreadthWeights(
        advance=1.0,
        above_sma20=0.0,
        above_sma50=0.0,
        above_sma200=0.0,
        rsi=0.0,
        volume=0.0,
        breakout=0.0,
        momentum=0.0,
    )
    w_mom = BreadthWeights(
        advance=0.0,
        above_sma20=0.0,
        above_sma50=0.0,
        above_sma200=0.0,
        rsi=0.0,
        volume=0.0,
        breakout=0.0,
        momentum=1.0,
    )
    s_adv = market_breadth(frames, index_df, w_adv)["breadth_score"].tail(1)[0]
    s_mom = market_breadth(frames, index_df, w_mom)["breadth_score"].tail(1)[0]
    assert s_adv is not None and s_mom is not None
    assert s_adv != s_mom
    assert 0.0 <= s_adv <= 100.0 and 0.0 <= s_mom <= 100.0


def test_weights_must_sum_to_one():
    with pytest.raises(ValueError):
        BreadthWeights(
            advance=2.0,
            above_sma20=0.0,
            above_sma50=0.0,
            above_sma200=0.0,
            rsi=0.0,
            volume=0.0,
            breakout=0.0,
            momentum=0.0,
        )


def test_no_lookahead():
    rising = [10.0 + i for i in range(210)]
    frames = [_ohlcv("A", rising), _ohlcv("B", rising), _ohlcv("C", rising)]
    out = market_breadth(frames, _index([7000.0 + i for i in range(210)]))
    assert "pct_above_sma200" in out.columns
    assert out["pct_above_sma200"][0] is None
    last = out["pct_above_sma200"].tail(1)[0]
    assert last is not None and 0.0 <= last <= 1.0
