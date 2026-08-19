"""YFinanceProvider.get_latest_fundamentals mapping (mocked yfinance)."""

from datetime import date

from app.infrastructure.providers.yfinance_provider import YFinanceProvider


class _FakeInfo(dict):
    def get(self, key, default=None):
        return super().get(key, default)


class _FakeFrame:
    def __init__(self, columns, data):
        self._columns = columns
        self._data = data

    @property
    def columns(self):
        return self._columns

    def __getitem__(self, key):
        return self._data[key]

    @property
    def loc(self):
        return self._data

    @property
    def empty(self):
        return False

    def get(self, key, default=None):
        return self._data.get(key, default)


def _fake_ticker(items, info):
    class _Ticker:
        def __init__(self):
            self.info = info
            self.income_stmt = _FakeFrame(["Total Revenue"], {})
            self.balance_sheet = _FakeFrame(["Total Assets"], {})
            self.cashflow = _FakeFrame(["Operating Cash Flow"], {})

        @property
        def financials(self):
            return _FakeFrame([date(2026, 6, 30)], {})

    return _Ticker()


def test_maps_info_into_items(monkeypatch):
    import yfinance as yf

    info = {
        "sharesOutstanding": 1000,
        "dividendRate": 0.5,
        "totalRevenue": 5000.0,
        "netIncomeToCommon": 800.0,
        "returnOnEquity": 0.15,
        "currentRatio": 1.5,
        "debtToEquity": 0.4,
        "priceToBook": 2.1,
        "trailingPE": 18.5,
    }

    def fake_ticker(symbol):
        return _fake_ticker({}, info)

    monkeypatch.setattr(yf, "Ticker", fake_ticker)
    provider = YFinanceProvider()
    out = provider.get_latest_fundamentals("BBCA")
    assert out["period_end"] is not None
    assert "items" in out
    items = out["items"]
    assert items["shares_outstanding"] == 1000
    assert items["dividend_per_share"] == 0.5
    assert items["revenue"] == 5000.0
    assert items["net_income"] == 800.0
    assert isinstance(out["reported_at"], str)
