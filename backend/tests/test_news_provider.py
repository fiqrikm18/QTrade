"""RSSNewsProvider: RSS XML parsing (no network)."""

from datetime import UTC, datetime

import httpx

from app.infrastructure.providers.news_provider import RSSNewsProvider

_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Test Feed</title>
<item>
<title>BBCA posts strong quarterly profit</title>
<link>https://example.com/bbc.html</link>
<pubDate>Mon, 17 Aug 2026 08:30:00 GMT</pubDate>
<description>Bank Central Asia (BBCA) reported results.</description>
</item>
<item>
<title>Market closes higher</title>
<link>https://example.com/mkt.html</link>
<pubDate>Tue, 18 Aug 2026 10:00:00 GMT</pubDate>
<description>IDX composite gained today.</description>
</item>
</channel></rss>"""


def _client(body: str) -> httpx.Client:
    return httpx.Client(
        transport=httpx.MockTransport(lambda req: httpx.Response(200, text=body))
    )


def test_parses_items_and_matches_tickers() -> None:
    provider = RSSNewsProvider(client=_client(_RSS))
    since = datetime(2026, 8, 1, tzinfo=UTC)
    df = provider.get_news(["BBCA", "BBRI"], since)
    assert df.columns == [
        "title",
        "source",
        "published_at",
        "url",
        "summary",
        "tickers",
    ]
    assert df.height == 2
    rows = {r["title"]: r for r in df.to_dicts()}
    bbc = rows["BBCA posts strong quarterly profit"]
    assert bbc["tickers"] == ["BBCA"]
    assert bbc["published_at"] == datetime(2026, 8, 17, 8, 30, tzinfo=UTC)
    mkt = rows["Market closes higher"]
    assert mkt["tickers"] == []
    assert mkt["url"] == "https://example.com/mkt.html"


def test_http_failure_raises_provider_error() -> None:
    from app.infrastructure.providers.exceptions import ProviderError

    provider = RSSNewsProvider(
        client=httpx.Client(
            transport=httpx.MockTransport(lambda req: httpx.Response(500, text="boom"))
        )
    )
    try:
        provider.get_news(["BBCA"], datetime(2026, 8, 1, tzinfo=UTC))
    except ProviderError:
        return
    raise AssertionError("expected ProviderError")
