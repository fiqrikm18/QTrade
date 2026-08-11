from datetime import date
from decimal import Decimal
from pathlib import Path

from openpyxl import Workbook
from sqlalchemy import delete, func, select

from app.application.services.universe import parse_universe, seed_universe
from app.infrastructure.database.models import Stock, UniverseHistory
from app.infrastructure.database.session import get_session

FIXTURE_TICKERS = ("AALI", "ABBA")

HEADER = [
    "No", "Kode", "Nama Perusahaan", "Tanggal Pencatatan", "Saham", "Papan Pencatatan"
]


def _write_fixture(path: Path) -> Path:
    wb = Workbook()
    ws = wb.active
    ws.append(HEADER)
    ws.append([1, "AALI", "Astra Agro Lestari Tbk.", "09 Des 1997",
               "1.924.688.333", "Utama"])
    ws.append([2, "ABBA", "Mahaka Media Tbk.", "03 Apr 2002",
               "3.935.892.857", "Pemantauan Khusus"])
    ws.append([3, "", "", "01 Jan 2020", "1.000", "Pengembangan"])
    wb.save(path)
    return path


async def _cleanup(session) -> None:
    await session.execute(
        delete(UniverseHistory).where(UniverseHistory.ticker.in_(FIXTURE_TICKERS))
    )
    await session.execute(delete(Stock).where(Stock.ticker.in_(FIXTURE_TICKERS)))
    await session.commit()


def test_parse_universe(tmp_path):
    path = _write_fixture(tmp_path / "universe.xlsx")
    items = parse_universe(path)
    assert [item.ticker for item in items] == ["AALI", "ABBA"]
    assert items[0].listing_date == date(1997, 12, 9)
    assert items[0].shares_outstanding == 1_924_688_333
    assert items[0].board == "Utama"
    assert items[1].board == "Pemantauan Khusus"


async def test_seed_universe_idempotent(tmp_path):
    path = _write_fixture(tmp_path / "universe.xlsx")
    async with get_session() as session:
        try:
            assert await seed_universe(session, path=path) == 2
            first = await _counts(session)
            assert first == (2, 2)

            assert await seed_universe(session, path=path) == 2
            assert await _counts(session) == (2, 2)

            row = (
                await session.execute(select(Stock).where(Stock.ticker == "AALI"))
            ).scalar_one()
            assert row.shares_outstanding == Decimal("1924688333")
            assert row.listing_date == date(1997, 12, 9)
        finally:
            await _cleanup(session)


async def _counts(session) -> tuple[int, int]:
    stocks = (
        await session.execute(
            select(func.count()).select_from(Stock).where(Stock.ticker.in_(FIXTURE_TICKERS))
        )
    ).scalar_one()
    history = (
        await session.execute(
            select(func.count())
            .select_from(UniverseHistory)
            .where(UniverseHistory.ticker.in_(FIXTURE_TICKERS))
        )
    ).scalar_one()
    return stocks, history
