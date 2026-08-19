"""FredProvider: FRED CSV parsing (no network)."""

from datetime import date

import httpx
import pytest

from app.infrastructure.providers.exceptions import ProviderError
from app.infrastructure.providers.fred_provider import _SERIES_MAP, FredProvider

_CSV = """date,value
2026-08-18,6.65
2026-08-17,6.62
"""


def _client(csv_body: str) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith(".csv")
        return httpx.Response(200, text=csv_body)

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_series_map_known_codes() -> None:
    assert set(_SERIES_MAP) == {
        "idn_10y",
        "us_10y",
        "us_2y",
        "fed_funds",
        "dxy",
        "sp500",
    }


def test_parse_csv_frame() -> None:
    provider = FredProvider(client=_client(_CSV))
    df = provider.get_indicators(["idn_10y"], date(2026, 8, 1), date(2026, 8, 31))
    assert df.columns == ["indicator", "asof_date", "value", "unit", "source"]
    assert df.height == 2
    row = df.to_dicts()[0]
    assert row["indicator"] == "idn_10y"
    assert row["asof_date"] == date(2026, 8, 18)
    assert row["value"] == 6.65
    assert row["source"] == "FRED"


def test_unknown_code_raises() -> None:
    provider = FredProvider(client=_client(_CSV))
    with pytest.raises(ProviderError):
        provider.get_indicators(["nope"], date(2026, 8, 1), date(2026, 8, 31))


def test_http_failure_raises() -> None:
    provider = FredProvider(
        client=httpx.Client(
            transport=httpx.MockTransport(lambda req: httpx.Response(500, text="boom"))
        )
    )
    with pytest.raises(ProviderError):
        provider.get_indicators(["sp500"], date(2026, 8, 1), date(2026, 8, 31))


def test_bad_csv_raises() -> None:
    provider = FredProvider(client=_client("not,a,csv\n"))
    with pytest.raises(ProviderError):
        provider.get_indicators(["dxy"], date(2026, 8, 1), date(2026, 8, 31))
