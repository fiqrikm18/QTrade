"""Seed reference data for terminal read-only endpoints.

Purpose
-------
The frontend terminal (``/macro``, ``/calendar``, ``/news``, ``/portfolio``)
expects typed payloads from the API (contracts in ``frontend/src/lib/api.ts``).
The ingestion pipelines that populate the real backing tables
(``economic_indicators``, ``economic_events``, ``news``, ``portfolios``,
``portfolio_positions`` — docs/data-model.md §7-8, §11) are roadmap items
(PRD §40: ``economic_data_ingestion``, ``news_ingestion`` jobs).

Until those jobs exist, these endpoints serve the curated reference dataset
below. It is intentionally static, documented seed data — NOT computed
indicators and NOT live market data. Every payload mirrors the field names
and shapes the frontend already consumes, so swapping in real data later is a
drop-in change behind the same API contract.

Never present this module as live data; consumers that need timestamps must
use the API response as-is.
"""

from __future__ import annotations

# --- Macro indicators -------------------------------------------------------

MACRO_INDICATORS: list[dict[str, object]] = [
    {
        "indicator": "BI Rate",
        "current": 5.75,
        "previous": 5.75,
        "change": 0.0,
        "unit": "%",
        "trend": "neutral",
        "source": "BI",
    },
    {
        "indicator": "Inflation (CPI YoY)",
        "current": 2.4,
        "previous": 2.1,
        "change": 0.3,
        "unit": "%",
        "trend": "up",
        "source": "BPS",
    },
    {
        "indicator": "USD/IDR",
        "current": 15650.0,
        "previous": 15580.0,
        "change": 70.0,
        "unit": "",
        "trend": "up",
        "source": "BI",
    },
    {
        "indicator": "10Y IDN Bond",
        "current": 6.65,
        "previous": 6.58,
        "change": 0.07,
        "unit": "%",
        "trend": "up",
        "source": "OJK",
    },
    {
        "indicator": "GDP Growth (YoY)",
        "current": 5.05,
        "previous": 5.11,
        "change": -0.06,
        "unit": "%",
        "trend": "down",
        "source": "BPS",
    },
    {
        "indicator": "Manufacturing PMI",
        "current": 52.1,
        "previous": 52.4,
        "change": -0.3,
        "unit": "",
        "trend": "down",
        "source": "S&P Global",
    },
    {
        "indicator": "Trade Balance (USD B)",
        "current": 2.8,
        "previous": 3.1,
        "change": -0.3,
        "unit": "B",
        "trend": "down",
        "source": "BPS",
    },
    {
        "indicator": "Fed Funds Rate",
        "current": 4.5,
        "previous": 4.5,
        "change": 0.0,
        "unit": "%",
        "trend": "neutral",
        "source": "Federal Reserve",
    },
    {
        "indicator": "US CPI (YoY)",
        "current": 2.9,
        "previous": 3.0,
        "change": -0.1,
        "unit": "%",
        "trend": "down",
        "source": "BLS",
    },
    {
        "indicator": "DXY",
        "current": 104.2,
        "previous": 104.6,
        "change": -0.4,
        "unit": "",
        "trend": "down",
        "source": "ICE",
    },
    {
        "indicator": "Brent Crude (USD)",
        "current": 78.4,
        "previous": 77.9,
        "change": 0.5,
        "unit": "USD",
        "trend": "up",
        "source": "ICE",
    },
    {
        "indicator": "CPO (USD/ton)",
        "current": 920.0,
        "previous": 905.0,
        "change": 15.0,
        "unit": "USD",
        "trend": "up",
        "source": "BMD",
    },
]

# --- Economic calendar events ----------------------------------------------

# Dates are ISO-parseable (the calendar page renders new Date(date)).
CALENDAR_EVENTS: list[dict[str, object]] = [
    {
        "date": "2026-08-20",
        "time": "14:00 WIB",
        "country": "ID",
        "event": "BI Rate Decision",
        "impact": "HIGH",
        "category": "Monetary Policy",
        "prev": "5.75%",
        "consensus": "5.75%",
        "actual": "--",
    },
    {
        "date": "2026-08-24",
        "time": "08:30 WIB",
        "country": "ID",
        "event": "Trade Balance (Jul)",
        "impact": "MEDIUM",
        "category": "Trade",
        "prev": "2.8B",
        "consensus": "2.5B",
        "actual": "--",
    },
    {
        "date": "2026-08-26",
        "time": "19:30 WIB",
        "country": "US",
        "event": "Durable Goods Orders (Jul)",
        "impact": "MEDIUM",
        "category": "Economic Data",
        "prev": "-1.2%",
        "consensus": "0.8%",
        "actual": "--",
    },
    {
        "date": "2026-08-28",
        "time": "13:30 WIB",
        "country": "US",
        "event": "Core PCE Price Index (Jul)",
        "impact": "HIGH",
        "category": "Inflation",
        "prev": "2.6%",
        "consensus": "2.7%",
        "actual": "--",
    },
    {
        "date": "2026-09-01",
        "time": "07:00 WIB",
        "country": "CN",
        "event": "Caixin Manufacturing PMI (Aug)",
        "impact": "MEDIUM",
        "category": "PMI",
        "prev": "50.1",
        "consensus": "50.3",
        "actual": "--",
    },
    {
        "date": "2026-09-02",
        "time": "09:00 WIB",
        "country": "ID",
        "event": "Inflation (CPI YoY, Aug)",
        "impact": "HIGH",
        "category": "Inflation",
        "prev": "2.4%",
        "consensus": "2.5%",
        "actual": "--",
    },
    {
        "date": "2026-09-04",
        "time": "19:30 WIB",
        "country": "US",
        "event": "Non-Farm Payrolls (Aug)",
        "impact": "HIGH",
        "category": "Employment",
        "prev": "148K",
        "consensus": "160K",
        "actual": "--",
    },
    {
        "date": "2026-09-16",
        "time": "14:00 WIB",
        "country": "ID",
        "event": "BI Rate Decision",
        "impact": "HIGH",
        "category": "Monetary Policy",
        "prev": "5.75%",
        "consensus": "5.75%",
        "actual": "--",
    },
    {
        "date": "2026-09-18",
        "time": "01:00 WIB",
        "country": "US",
        "event": "FOMC Rate Decision",
        "impact": "HIGH",
        "category": "Monetary Policy",
        "prev": "4.50%",
        "consensus": "4.50%",
        "actual": "--",
    },
    {
        "date": "2026-09-22",
        "time": "08:30 WIB",
        "country": "ID",
        "event": "Trade Balance (Aug)",
        "impact": "MEDIUM",
        "category": "Trade",
        "prev": "2.5B",
        "consensus": "2.6B",
        "actual": "--",
    },
]

# --- News -------------------------------------------------------------------

NEWS_ITEMS: list[dict[str, object]] = [
    {
        "id": 1,
        "date": "2026-08-15",
        "time": "09:30 WIB",
        "title": "Bank Indonesia holds BI Rate at 5.75% amid stable inflation",
        "source": "Bisnis Indonesia",
        "category": "Monetary Policy",
        "impact": "HIGH",
        "sentiment": "NEUTRAL",
        "tickers": ["BBRI", "BBCA"],
        "summary": "BI kept the policy rate unchanged for a sixth consecutive meeting, "
        "citing contained inflation and a stable rupiah.",
    },
    {
        "id": 2,
        "date": "2026-08-15",
        "time": "08:45 WIB",
        "title": "Rupiah firms to 15,650 as foreign inflows return to IDX",
        "source": "Kontan",
        "category": "Macro",
        "impact": "MEDIUM",
        "sentiment": "POSITIVE",
        "tickers": ["BBCA", "BMRI"],
        "summary": "Foreign investors turned net buyers this week, supporting the "
        "rupiah and banking large-caps.",
    },
    {
        "id": 3,
        "date": "2026-08-14",
        "time": "16:10 WIB",
        "title": "IDX Composite closes higher on banking sector strength",
        "source": "CNBC Indonesia",
        "category": "Market",
        "impact": "MEDIUM",
        "sentiment": "POSITIVE",
        "tickers": ["BBCA", "BBRI", "BMRI"],
        "summary": "The benchmark index rose led by banks on strong loan-growth "
        "expectations and steady margins.",
    },
    {
        "id": 4,
        "date": "2026-08-14",
        "time": "11:00 WIB",
        "title": "Telkom Indonesia announces 2026 capex guidance of Rp 28T",
        "source": "Investor Daily",
        "category": "Corporate Action",
        "impact": "MEDIUM",
        "sentiment": "NEUTRAL",
        "tickers": ["TLKM"],
        "summary": "Capex guidance remains focused on fixed-broadband expansion and "
        "data-center growth.",
    },
    {
        "id": 5,
        "date": "2026-08-13",
        "time": "09:15 WIB",
        "title": "Astra International Q2 net profit rises 8% on auto recovery",
        "source": "Bisnis Indonesia",
        "category": "Earnings",
        "impact": "HIGH",
        "sentiment": "POSITIVE",
        "tickers": ["ASII"],
        "summary": "Auto sales recovered while mining services remained supportive; "
        "management kept full-year guidance.",
    },
    {
        "id": 6,
        "date": "2026-08-12",
        "time": "15:00 WIB",
        "title": "BPS: July inflation at 2.4% YoY, within BI target band",
        "source": "Kontan",
        "category": "Inflation",
        "impact": "HIGH",
        "sentiment": "POSITIVE",
        "tickers": [],
        "summary": "Headline inflation stayed inside the 2.5%±1% target band, keeping "
        "the door open for eventual rate cuts.",
    },
    {
        "id": 7,
        "date": "2026-08-11",
        "time": "10:30 WIB",
        "title": "Coal price extends rally on China restocking demand",
        "source": "Reuters",
        "category": "Commodities",
        "impact": "MEDIUM",
        "sentiment": "POSITIVE",
        "tickers": ["ADRO", "PTBA", "ITMG"],
        "summary": "Thermal coal prices rose for a third straight week on restocking "
        "demand from China and tighter supply.",
    },
    {
        "id": 8,
        "date": "2026-08-08",
        "time": "13:45 WIB",
        "title": "US CPI cools to 2.9% YoY, markets price September Fed cut",
        "source": "Bloomberg",
        "category": "Macro",
        "impact": "HIGH",
        "sentiment": "POSITIVE",
        "tickers": [],
        "summary": "Softer US inflation reinforced expectations for a Fed easing in "
        "September, supportive for EM equities.",
    },
]

# --- Portfolio seed ---------------------------------------------------------

# Demo portfolio (quantities, prices in IDR). market_value / pnl are derived
# in the endpoint so the payload always stays internally consistent.
PORTFOLIO_POSITIONS: list[dict[str, object]] = [
    {
        "ticker": "BBCA",
        "name": "Bank Central Asia",
        "quantity": 5000,
        "avgPrice": 9200.0,
        "currentPrice": 10400.0,
        "sector": "BANKING",
        "beta": 0.82,
        "sharpe": 1.34,
        "var95": 2.1,
    },
    {
        "ticker": "BMRI",
        "name": "Bank Mandiri",
        "quantity": 8000,
        "avgPrice": 5400.0,
        "currentPrice": 5650.0,
        "sector": "BANKING",
        "beta": 1.05,
        "sharpe": 1.12,
        "var95": 2.6,
    },
    {
        "ticker": "TLKM",
        "name": "Telkom Indonesia",
        "quantity": 12000,
        "avgPrice": 3800.0,
        "currentPrice": 3450.0,
        "sector": "TELECOM",
        "beta": 0.71,
        "sharpe": 0.62,
        "var95": 1.9,
    },
    {
        "ticker": "ASII",
        "name": "Astra International",
        "quantity": 4000,
        "avgPrice": 5100.0,
        "currentPrice": 5350.0,
        "sector": "CONSUMER",
        "beta": 0.95,
        "sharpe": 0.98,
        "var95": 2.4,
    },
    {
        "ticker": "ADRO",
        "name": "Adaro Energy",
        "quantity": 6000,
        "avgPrice": 2750.0,
        "currentPrice": 2980.0,
        "sector": "ENERGY",
        "beta": 1.21,
        "sharpe": 1.05,
        "var95": 3.2,
    },
]
