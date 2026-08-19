"""BiProvider: JISDOR, BI rate, and BI calendar parsing (no network)."""

from datetime import date

import pytest

from app.infrastructure.providers.bi_provider import BiProvider
from app.infrastructure.providers.exceptions import ProviderError

_JISDOR_PAYLOAD = {
    "status": {"code": 200},
    "data": {"jisdor": [{"date": "2026-08-18", "rate": 17836.0, "jual": 17836.0}]},
}

_BI_RATE_PAYLOAD = {
    "rates": [
        {"date": "2026-08-19", "rate": 5.75, "rate_desc": "5,75%"},
        {"date": "2026-05-20", "rate": 5.75, "rate_desc": "5,75%"},
    ]
}


def _client(route, payload):
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == route, request.url
        return httpx.Response(200, json=payload)

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_jisdor_indicators_parse() -> None:
    provider = BiProvider(client=_client("/kurs/v1/jisdor/2026-08-18", _JISDOR_PAYLOAD))
    df = provider.get_indicators(["usd_idr"], date(2026, 8, 18), date(2026, 8, 18))
    assert df.columns == ["indicator", "asof_date", "value", "unit", "source"]
    row = df.to_dicts()[0]
    assert row["indicator"] == "usd_idr"
    assert row["asof_date"] == date(2026, 8, 18)
    assert row["value"] == 17836.0
    assert row["source"] == "BI"


def test_bi_rate_indicators_parse() -> None:
    provider = BiProvider(client=_client("/bi_rate/v1/rates", _BI_RATE_PAYLOAD))
    df = provider.get_indicators(["bi_rate"], date(2026, 5, 1), date(2026, 8, 31))
    rows = {r["asof_date"]: r["value"] for r in df.to_dicts()}
    assert rows[date(2026, 8, 19)] == 5.75
    assert df.to_dicts()[0]["unit"] == "%"


def test_unknown_code_raises() -> None:
    provider = BiProvider(client=_client("/kurs/v1/jisdor/2026-08-18", _JISDOR_PAYLOAD))
    with pytest.raises(ProviderError):
        provider.get_indicators(["gdp"], date(2026, 8, 18), date(2026, 8, 18))


def test_unparseable_payload_raises() -> None:
    provider = BiProvider(
        client=_client("/kurs/v1/jisdor/2026-08-18", {"unexpected": True})
    )
    with pytest.raises(ProviderError):
        provider.get_indicators(["usd_idr"], date(2026, 8, 18), date(2026, 8, 18))


def test_calendar_parse() -> None:
    html = (
        "<html><body><div class='event'>"
        "<span class='date'>18 Aug 2026</span>"
        "<span class='title'>BI Rate Decision (RDG)</span>"
        "</div></body></html>"
    )

    def handler(request):
        return httpx.Response(200, text=html)

    import httpx

    provider = BiProvider(client=httpx.Client(transport=httpx.MockTransport(handler)))
    df = provider.get_calendar(date(2026, 8, 1), date(2026, 8, 31))
    assert not df.is_empty()
    row = df.to_dicts()[0]
    assert "BI Rate" in row["event"]
    assert row["country"] == "ID"
    assert row["importance"] == 3
    assert row["status"] == "scheduled"


def test_calendar_empty_when_no_events() -> None:
    import httpx

    provider = BiProvider(
        client=httpx.Client(
            transport=httpx.MockTransport(
                lambda req: httpx.Response(200, text="<html><body></body></html>")
            )
        )
    )
    df = provider.get_calendar(date(2026, 8, 1), date(2026, 8, 31))
    assert df.is_empty()
