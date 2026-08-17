"""Pytest isolation: run tests against the dedicated test database.

``ihsg_quant_test`` is migrated via alembic (see README/dev docs). Setting the
DSN before any app import keeps the dev database untouched by destructive
test fixtures (e.g. ``delete(StockScore)`` in scanner/api tests).
"""

import os

os.environ["POSTGRES_DSN"] = (
    "postgresql+asyncpg://ihsg:ihsg@localhost:5432/ihsg_quant_test"
)
