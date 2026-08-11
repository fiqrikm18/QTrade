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
_JOB_WATCHDOG = "watchdog"


def _enqueue_daily() -> None:
    get_queue().enqueue(ingest_ohlcv_daily)  # type: ignore[reportUnknownMemberType]


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
