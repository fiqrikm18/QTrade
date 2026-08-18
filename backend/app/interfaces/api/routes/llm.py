"""LLM API routes."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.llm_service import LLMService
from app.infrastructure.database.session import get_session

router = APIRouter()


class ExplainRequest(BaseModel):
    ticker: str
    asof: date


class NLScreenerRequest(BaseModel):
    query: str


class ReportRequest(BaseModel):
    tickers: list[str]
    template: str = "daily"


@router.post("/explain", response_model=dict[str, str])
async def explain_stock(
    req: ExplainRequest = Body(...),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    service = LLMService()
    text = await service.explain_stock_score(req.ticker, req.asof, session)
    return {"explanation": text}


@router.post("/nl-screener", response_model=dict[str, object])
async def nl_screener(
    req: NLScreenerRequest = Body(...),
) -> dict[str, object]:
    service = LLMService()
    filter_tree = await service.translate_nl_to_filter(req.query)
    return {"filter": filter_tree.model_dump(by_alias=True)}


@router.post("/report", response_model=dict[str, str])
async def generate_report(
    req: ReportRequest = Body(...),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    service = LLMService()
    explanations: list[str] = []
    for t in req.tickers:
        exp = await service.explain_stock_score(t, date.today(), session)
        explanations.append(f"## {t}\n{exp}")
    return {"report": "\n\n".join(explanations)}
