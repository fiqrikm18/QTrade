"""Full-universe market scanner (docs/data-pipeline.md §8).

Real DB (rolled-back transaction) + real Redis. Two synthetic tickers with
OHLCV, fundamentals, and an index frame. Asserts: 2 score rows with
components, ranking by score, idempotent re-run, Redis cache with 24h TTL.
"""

import json
from datetime import date, timedelta

import polars as pl
import redis.asyncio as redis
from sqlalchemy import func, insert, select

from app.application.services.scanner import (
    SCORING_VERSION,
    ScanResult,
    run_market_scan,
)
from app.domain.scoring.opportunity import BALANCED_PROFILE
from app.infrastructure.database.models import (
    FinancialStatement,
    OhlcvDaily,
    Sector,
    Stock,
    StockScore,
)
from app.infrastructure.database.session import get_session

TICKER_A = "TSCAN.A"
TICKER_B = "TSCAN.B"
INDEX_TICKER = "IHSG"

_START = date(2024, 1, 2)  # 60 trading-ish days -> asof 2024-03-01
_N_STOCKS = 60
_N_INDEX = 252

_ASOF = _START + timedelta(days=_N_STOCKS - 1)


def _stock_frame(ticker: str, base: float, daily: float, n: int) -> pl.DataFrame:
    dates = [_START + timedelta(days=i) for i in range(n)]
    closes = [base * (1 + daily) ** i for i in range(n)]
    opens = [c * 0.998 for c in closes]
    highs = [c * 1.01 for c in closes]
    lows = [c * 0.99 for c in closes]
    vol = [1_000_000 + i * 1000 for i in range(n)]
    return pl.DataFrame(
        {
            "ticker": [ticker] * n,
            "trade_date": dates,
            "open": opens,
            "high": highs,
            "low": lows,
            "close": closes,
            "volume": vol,
        }
    )


def _index_frame(n: int) -> pl.DataFrame:
    dates = [_ASOF - timedelta(days=n - 1 - i) for i in range(n)]
    closes = [7000.0 * (1.0005) ** i for i in range(n)]
    opens = [c * 0.998 for c in closes]
    highs = [c * 1.005 for c in closes]
    lows = [c * 0.995 for c in closes]
    return pl.DataFrame(
        {
            "ticker": [INDEX_TICKER] * n,
            "trade_date": dates,
            "open": opens,
            "high": highs,
            "low": lows,
            "close": closes,
            "volume": [2_000_000.0] * n,
        }
    )


def _ohlcv_records(ticker: str, frame: pl.DataFrame) -> list[dict]:
    rows = []
    for rec in frame.to_dicts():
        rows.append(
            {
                "ticker": ticker,
                "trade_date": rec["trade_date"],
                "open": rec["open"],
                "high": rec["high"],
                "low": rec["low"],
                "close": rec["close"],
                "volume": rec["volume"],
                "turnover": rec["close"] * rec["volume"],
                "adjustment_factor": 1.0,
                "split_factor": 1.0,
                "provider": "test",
                "source_timestamp": rec["trade_date"],
            }
        )
    return rows


def _strong_items() -> dict[str, float]:
    return {
        "revenue": 2000.0,
        "gross_profit": 1200.0,
        "ebitda": 1100.0,
        "ebit": 1000.0,
        "net_income": 500.0,
        "eps": 10.0,
        "bvps": 20.0,
        "operating_cash_flow": 700.0,
        "free_cash_flow": 600.0,
        "total_assets": 8000.0,
        "total_liabilities": 2400.0,
        "equity": 2000.0,
        "debt": 400.0,
        "cash": 200.0,
        "shares_outstanding": 100.0,
        "interest_expense": 80.0,
        "current_assets": 3000.0,
        "current_liabilities": 1000.0,
        "dividend_per_share": 5.0,
    }


def _weak_items() -> dict[str, float]:
    return {
        "revenue": 1000.0,
        "gross_profit": 100.0,
        "ebitda": 60.0,
        "ebit": 20.0,
        "net_income": 20.0,
        "eps": 0.2,
        "bvps": 2.0,
        "operating_cash_flow": 40.0,
        "free_cash_flow": 5.0,
        "total_assets": 5000.0,
        "total_liabilities": 3500.0,
        "equity": 1000.0,
        "debt": 2000.0,
        "cash": 50.0,
        "shares_outstanding": 100.0,
        "interest_expense": 20.0,
        "current_assets": 600.0,
        "current_liabilities": 1500.0,
        "dividend_per_share": 0.1,
    }


def _statement_records() -> list[dict]:
    stmt_date = _ASOF
    avail = _ASOF - timedelta(days=10)
    return [
        {
            "ticker": TICKER_A,
            "asof_date": stmt_date,
            "available_at": avail,
            "reported_at": _ASOF - timedelta(days=20),
            "period_end": _ASOF - timedelta(days=90),
            "is_annual": True,
            "items": _strong_items(),
        },
        {
            "ticker": TICKER_B,
            "asof_date": stmt_date,
            "available_at": avail,
            "reported_at": _ASOF - timedelta(days=20),
            "period_end": _ASOF - timedelta(days=90),
            "is_annual": True,
            "items": _weak_items(),
        },
    ]


async def _seed(session) -> None:
    await session.execute(
        insert(Sector).values(
            id=999,
            code="FIN",
            name="Financials",
        )
    )
    await session.execute(
        insert(Stock).values(
            [
                {
                    "ticker": TICKER_A,
                    "name": "Alpha Rising",
                    "sector_id": 999,
                    "is_active": True,
                    "shares_outstanding": 100,
                },
                {
                    "ticker": TICKER_B,
                    "name": "Beta Falling",
                    "sector_id": 999,
                    "is_active": True,
                    "shares_outstanding": 100,
                },
            ]
        )
    )
    await session.execute(
        insert(OhlcvDaily).values(
            _ohlcv_records(TICKER_A, _stock_frame(TICKER_A, 100.0, 0.005, _N_STOCKS))
        )
    )
    await session.execute(
        insert(OhlcvDaily).values(
            _ohlcv_records(TICKER_B, _stock_frame(TICKER_B, 100.0, -0.004, _N_STOCKS))
        )
    )
    await session.execute(
        insert(OhlcvDaily).values(_ohlcv_records(INDEX_TICKER, _index_frame(_N_INDEX)))
    )
    await session.execute(insert(FinancialStatement).values(_statement_records()))


def _count_stock_scores(session, asof: date) -> int:
    return session.execute(
        select(func.count())
        .select_from(StockScore)
        .where(StockScore.asof_date == asof)
        .where(StockScore.profile == "balanced")
    )  # NOTE: filled in async test below


async def test_scan_writes_ranked_idempotent_cached():
    async with get_session() as session:
        trans = await session.begin()
        try:
            await _seed(session)
            await session.flush()

            # Step 1: scan writes 2 score rows with components, ranked.
            result = await run_market_scan(
                session, BALANCED_PROFILE, tickers=[TICKER_A, TICKER_B]
            )
            assert isinstance(result, ScanResult)
            assert result.asof >= _ASOF  # test seeded up to _ASOF
            assert result.rows_written == 2
            assert len(result.ranking) == 2
            # ranking sorted descending by score; rising ticker ranks first
            scores = {t: s for t, s in result.ranking}
            assert scores[TICKER_A] > scores[TICKER_B]
            assert result.ranking[0][0] == TICKER_A

            rows = (
                (
                    await session.execute(
                        select(StockScore)
                        .where(StockScore.asof_date == result.asof)
                        .where(StockScore.profile == "balanced")
                        .order_by(StockScore.ticker)
                    )
                )
                .scalars()
                .all()
            )
            assert len(rows) == 2
            tickers = {r.ticker for r in rows}
            assert tickers == {TICKER_A, TICKER_B}
            for r in rows:
                assert r.scoring_version == SCORING_VERSION
                assert r.classification in {
                    "opportunity",
                    "watchlist",
                    "neutral",
                    "high_risk",
                    "avoid",
                }
                assert 0.0 <= r.opportunity_score <= 100.0
                comps = r.score_components
                assert isinstance(comps, dict)
                # all ten component slots present
                for key in (
                    "technical",
                    "fundamental",
                    "momentum",
                    "relative_strength",
                    "smart_money",
                    "factor",
                    "sector",
                    "macro",
                    "risk",
                    "ml",
                ):
                    assert key in comps
                assert comps["ml"] is None  # ML disabled
                assert r.feature_version == "v1"
            score_a = next(r for r in rows if r.ticker == TICKER_A).opportunity_score
            score_b = next(r for r in rows if r.ticker == TICKER_B).opportunity_score
            # Step 2: idempotent re-run -- no duplicate rows, same ranking.
            result2 = await run_market_scan(
                session, BALANCED_PROFILE, tickers=[TICKER_A, TICKER_B]
            )
            assert result2.rows_written == 2
            assert result2.ranking == result.ranking
            count = (
                await session.execute(
                    select(func.count())
                    .select_from(StockScore)
                    .where(StockScore.asof_date == result.asof)
                    .where(StockScore.profile == "balanced")
                )
            ).scalar_one()
            assert count == 2

            # Step 3: Redis cache with 24h TTL.
            from app.config.settings import get_settings

            settings = get_settings()
            rc = redis.Redis.from_url(settings.redis_url)
            await rc.ping()
            cache_key = f"scan:balanced:{_ASOF.isoformat()}"
            cached = await rc.get(cache_key)
            assert cached is not None
            payload = json.loads(cached)
            assert payload["asof"] == _ASOF.isoformat()
            assert payload["profile"] == "balanced"
            cached_ranking = [(e["ticker"], e["score"]) for e in payload["ranking"]]
            assert cached_ranking == result.ranking
            ttl = await rc.ttl(cache_key)
            assert 0 < ttl <= 86400
            await rc.delete(cache_key)
            await rc.close()
        finally:
            await trans.rollback()
