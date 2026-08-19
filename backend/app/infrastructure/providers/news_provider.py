"""RSS news provider — Google News search RSS + Antara official feeds.

Keyless. Parsed with stdlib ``xml.etree.ElementTree``. Ticker extraction is
exact word-boundary match against the universe tickers (never inferred).
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

import httpx
import polars as pl

from app.domain.news.interfaces import NewsProvider
from app.infrastructure.providers.exceptions import ProviderError

_GOOGLE_NEWS_URL = "https://news.google.com/rss/search"
_ANTARA_URLS = [
    "https://www.antaranews.com/rss/ekonomi",
    "https://www.antaranews.com/rss/terkini",
]

_NS = {"media": "http://search.yahoo.com/mrss/"}
_IGNORE_PREFIXES = ("Google News",)

_WORD = re.compile(r"\b([A-Z]{2,8})\b")


def _parse_pubdate(text: str) -> datetime | None:
    try:
        dt = parsedate_to_datetime(text)
    except (TypeError, ValueError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _match_tickers(text: str, tickers: set[str]) -> list[str]:
    found: set[str] = set()
    for token in _WORD.findall(text):
        if token in tickers:
            found.add(token)
    return sorted(found)


class RSSNewsProvider(NewsProvider):
    """Keyless RSS news crawler (Google News + Antara)."""

    def __init__(self, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=30.0)
        self._client.headers.update(
            {"User-Agent": "ihsg-quant/0.1 (+https://github.com/anomalyco/quant-trade)"}
        )

    def get_news(self, tickers: list[str] | None, since: datetime) -> pl.DataFrame:
        ticker_set = {t.upper() for t in (tickers or [])}
        urls: list[str] = []
        for tk in sorted(ticker_set):
            urls.append(f"{_GOOGLE_NEWS_URL}?q={tk}+stock&hl=en-ID&gl=ID&ceid=ID:en")
        urls.extend(_ANTARA_URLS)
        items: list[dict[str, object]] = []
        for url in urls:
            items.extend(self._fetch_and_parse(url, ticker_set, since))
        items = _dedupe_by_url(items)
        if not items:
            return pl.DataFrame(
                schema={
                    "title": pl.String,
                    "source": pl.String,
                    "published_at": pl.Datetime,
                    "url": pl.String,
                    "summary": pl.String,
                    "tickers": pl.List(pl.String),
                }
            )
        return pl.DataFrame(items)

    def _fetch_and_parse(
        self, url: str, ticker_set: set[str], since: datetime
    ) -> list[dict[str, object]]:
        try:
            resp = self._client.get(url)
            resp.raise_for_status()
        except Exception as exc:
            raise ProviderError(f"RSS fetch failed for {url}: {exc}") from exc
        try:
            root = ET.fromstring(resp.text)
        except ET.ParseError as exc:
            raise ProviderError(f"RSS parse failed for {url}: {exc}") from exc

        feed_source = url.split("//", 1)[1].split("/", 1)[0]
        out: list[dict[str, object]] = []
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub_text = item.findtext("pubDate") or item.findtext(
                "dc:date", namespaces={"dc": "http://purl.org/dc/elements/1.1/"}
            )
            description = (item.findtext("description") or "").strip()
            if not title or not link or not pub_text:
                continue
            published = _parse_pubdate(pub_text)
            if published is None or published < since:
                continue
            if any(title.startswith(p) for p in _IGNORE_PREFIXES):
                continue
            out.append(
                {
                    "title": title,
                    "source": feed_source,
                    "published_at": published,
                    "url": link,
                    "summary": _strip_html(description),
                    "tickers": _match_tickers(f"{title} {description}", ticker_set),
                }
            )
        return out


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text).strip()


def _dedupe_by_url(items: list[dict[str, object]]) -> list[dict[str, object]]:
    """Keep the first occurrence per article URL.

    The same article recurs across the per-ticker Google News queries and
    the Antara feeds; duplicates must not reach the news frame.
    """
    seen: set[str] = set()
    out: list[dict[str, object]] = []
    for item in items:
        url = item["url"]
        if not isinstance(url, str) or url in seen:
            continue
        seen.add(url)
        out.append(item)
    return out
