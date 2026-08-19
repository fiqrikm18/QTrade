"""Tests for the worker + scheduler supervisor (Task 8)."""

from apscheduler.schedulers.background import BackgroundScheduler
from rq import Queue

import app.interfaces.workers.supervisor as s
from app.interfaces.workers.supervisor import get_queue


def test_supervisor_imports_and_main_callable() -> None:
    assert callable(s.main)
    assert callable(s.schedule_jobs)
    assert callable(s.build_worker)
    assert callable(s.run_scheduler_and_worker)


def test_get_queue_returns_queue() -> None:
    q = get_queue()
    assert isinstance(q, Queue)


def test_schedule_jobs_adds_triggers() -> None:
    scheduler = BackgroundScheduler()
    s.schedule_jobs(scheduler)
    ids = {j.id for j in scheduler.get_jobs()}
    assert ids == {
        "ingest_ohlcv_daily",
        "ingest_macro",
        "ingest_news",
        "ingest_fundamentals",
        "watchdog",
    }
