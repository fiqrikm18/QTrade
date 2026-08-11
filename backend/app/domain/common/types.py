from dataclasses import dataclass
from datetime import date, datetime


@dataclass(frozen=True, slots=True)
class Timestamped:
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class UniverseItem:
    ticker: str
    name: str
    listing_date: date | None
    board: str
    shares_outstanding: int | None


@dataclass(frozen=True, slots=True)
class Quote:
    ticker: str
    price: float
    change: float
    volume: int
    turnover: float
    market_cap: float
    asof: date
