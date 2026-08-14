import pytest
from sqlalchemy import text

from app.infrastructure.database.session import get_session


@pytest.mark.asyncio
async def test_db_roundtrip():
    async for session in get_session():
        result = await session.execute(text("SELECT 1"))
        assert result.scalar_one() == 1
