"""Scheduler + RQ worker supervisor process.

Runs one APScheduler (BackgroundScheduler) for cron triggers and one RQ
worker in the same process. Importing this module has no side effects; call
``main()`` (or ``python -m app.interfaces.workers.supervisor``) to start.
"""

import redis
import rq
from apscheduler.schedulers.background import (  # pyright: ignore[reportMissingTypeStubs]
    BackgroundScheduler,
)
from apscheduler.triggers.cron import (  # pyright: ignore[reportMissingTypeStubs]
    CronTrigger,
)

from app.config.settings import get_settings
from app.interfaces.workers.jobs import (
    get_queue,
    ingest_calendar,
    ingest_fundamentals,
    ingest_macro,
    ingest_news,
    ingest_ohlcv_daily,
    watchdog,
)

# Re-exported so callers can `from app.interfaces.workers.supervisor import get_queue`.
__all__ = [
    "get_queue",
    "schedule_jobs",
    "build_worker",
    "run_scheduler_and_worker",
    "main",
]

_JOB_INGEST = "ingest_ohlcv_daily"
_JOB_MACRO = "ingest_macro"
_JOB_CALENDAR = "ingest_calendar"
_JOB_NEWS = "ingest_news"
_JOB_FUNDAMENTALS = "ingest_fundamentals"
_JOB_WATCHDOG = "watchdog"


def _enqueue_daily() -> None:
    get_queue().enqueue(ingest_ohlcv_daily)  # type: ignore[reportUnknownMemberType]


def _enqueue_macro() -> None:
    get_queue().enqueue(ingest_macro)  # type: ignore[reportUnknownMemberType]


def _enqueue_calendar() -> None:
    get_queue().enqueue(ingest_calendar)  # type: ignore[reportUnknownMemberType]


def _enqueue_news() -> None:
    get_queue().enqueue(ingest_news)  # type: ignore[reportUnknownMemberType]


def _enqueue_fundamentals() -> None:
    get_queue().enqueue(ingest_fundamentals)  # type: ignore[reportUnknownMemberType]


def _enqueue_watchdog() -> None:
    get_queue().enqueue(watchdog)  # type: ignore[reportUnknownMemberType]


def schedule_jobs(scheduler: BackgroundScheduler) -> None:
    settings = get_settings()
    scheduler.add_job(  # type: ignore[reportUnknownMemberType]
        _enqueue_daily,
        CronTrigger.from_crontab(settings.ingest_cron),  # type: ignore[reportUnknownMemberType]
        id=_JOB_INGEST,
    )
    scheduler.add_job(  # type: ignore[reportUnknownMemberType]
        _enqueue_macro,
        CronTrigger.from_crontab(settings.ingest_macro_cron),  # type: ignore[reportUnknownMemberType]
        id=_JOB_MACRO,
    )
    scheduler.add_job(  # type: ignore[reportUnknownMemberType]
        _enqueue_calendar,
        CronTrigger.from_crontab(settings.ingest_calendar_cron),  # type: ignore[reportUnknownMemberType]
        id=_JOB_CALENDAR,
    )
    scheduler.add_job(  # type: ignore[reportUnknownMemberType]
        _enqueue_news,
        CronTrigger.from_crontab(settings.ingest_news_cron),  # type: ignore[reportUnknownMemberType]
        id=_JOB_NEWS,
    )
    scheduler.add_job(  # type: ignore[reportUnknownMemberType]
        _enqueue_fundamentals,
        CronTrigger.from_crontab(settings.ingest_fundamentals_cron),  # type: ignore[reportUnknownMemberType]
        id=_JOB_FUNDAMENTALS,
    )
    scheduler.add_job(  # type: ignore[reportUnknownMemberType]
        _enqueue_watchdog,
        CronTrigger.from_crontab(settings.watchdog_cron),  # type: ignore[reportUnknownMemberType]
        id=_JOB_WATCHDOG,
    )


def build_worker() -> rq.Worker:
    conn = redis.from_url(get_settings().redis_url)
    return rq.Worker("default", connection=conn)


def run_scheduler_and_worker() -> None:
    scheduler = BackgroundScheduler()
    schedule_jobs(scheduler)
    scheduler.start()  # type: ignore[reportUnknownMemberType]
    build_worker().work()


def main() -> None:
    run_scheduler_and_worker()


if __name__ == "__main__":
    main()
