"""LLM API routes."""



async def test_llm_explain_endpoint_returns_200(client):
    """POST /api/v1/llm/explain returns explanation or fallback."""
    # LLM may be disabled; endpoint should still respond
    resp = await client.post(
        "/api/v1/llm/explain", json={"ticker": "BBCA", "asof": "2024-03-01"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "explanation" in body


async def test_llm_nl_screener_endpoint_returns_filter(client):
    """POST /api/v1/llm/nl-screener returns FilterTree."""
    resp = await client.post(
        "/api/v1/llm/nl-screener", json={"query": "banking stocks above 70"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "filter" in body
    assert "and" in body["filter"] or "or" in body["filter"]


async def test_llm_report_endpoint_returns_200(client):
    """POST /api/v1/llm/report returns report text."""
    resp = await client.post(
        "/api/v1/llm/report",
        json={"tickers": ["BBCA", "BBRI"], "template": "daily"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "report" in body
