from app.infrastructure.database.base import AuditMixin  # noqa: F401
from app.infrastructure.database.models import OhlcvDaily, Stock


def test_audit_mixin_present():
    assert "created_at" in OhlcvDaily.__table__.columns
    assert "updated_at" in OhlcvDaily.__table__.columns


def test_ohlcv_unique_constraint():
    uq = {c.name for c in OhlcvDaily.__table__.constraints
          if getattr(c, "columns", None) and
          {col.name for col in c.columns} >= {"ticker", "trade_date"}}
    assert uq, "expected (ticker, trade_date) unique"


def test_stock_sector_fk():
    assert any(getattr(fk, "column", None) is not None and
               fk.parent.name == "sector_id"
               for fk in Stock.__table__.foreign_keys)
