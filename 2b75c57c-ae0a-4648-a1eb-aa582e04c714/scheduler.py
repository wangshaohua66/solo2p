from datetime import datetime
from typing import Any, Callable, Dict, Optional

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.interval import IntervalTrigger
    from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_MISSED
    _HAS_APSCHEDULER = True
except ImportError:
    _HAS_APSCHEDULER = False

from logger import get_logger
from config import load_config, AppConfig


logger = get_logger("scheduler")


class TaskScheduler:
    def __init__(self, config: Optional[AppConfig] = None):
        self.config = config or load_config()
        self.scheduler: Optional[BackgroundScheduler] = None
        if _HAS_APSCHEDULER:
            self.scheduler = BackgroundScheduler(
                timezone=self.config.scheduler.timezone,
                job_defaults={"coalesce": True, "max_instances": 1, "misfire_grace_time": 60},
            )
            self.scheduler.add_listener(self._on_job_error, EVENT_JOB_ERROR | EVENT_JOB_MISSED)

    def _on_job_error(self, event) -> None:
        logger.error(
            f"调度任务异常: job={event.job_id}, "
            f"exception={getattr(event, 'exception', None)}"
        )
        try:
            from notifier import Notifier
            Notifier().send_alert(
                f"调度任务失败: {event.job_id}",
                str(getattr(event, "exception", "unknown"))
            )
        except Exception:
            pass

    def add_job(self, func: Callable, job_id: str, minutes: int,
                kwargs: Optional[Dict[str, Any]] = None) -> None:
        if self.scheduler is None:
            logger.warning("APScheduler未安装，无法添加定时任务")
            return
        trigger = IntervalTrigger(minutes=minutes, timezone=self.config.scheduler.timezone)
        self.scheduler.add_job(
            func,
            trigger=trigger,
            id=job_id,
            kwargs=kwargs or {},
            next_run_time=datetime.now(),
        )
        logger.info(f"已添加定时任务: {job_id} (每{minutes}分钟)")

    def add_crawl_job(self, crawl_func: Callable) -> None:
        self.add_job(
            crawl_func,
            job_id="crawl_all_sites",
            minutes=self.config.scheduler.crawl_interval_minutes,
        )

    def add_track_job(self, track_func: Callable) -> None:
        self.add_job(
            track_func,
            job_id="track_submissions",
            minutes=self.config.scheduler.track_interval_minutes,
        )

    def add_monitor_job(self, monitor_func: Callable, minutes: int = 30) -> None:
        self.add_job(monitor_func, job_id="system_monitor", minutes=minutes)

    def start(self) -> None:
        if self.scheduler is None:
            logger.warning("APScheduler未安装，调度器无法启动")
            return
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("调度器已启动")

    def shutdown(self, wait: bool = True) -> None:
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown(wait=wait)
            logger.info("调度器已停止")

    def list_jobs(self) -> list:
        if self.scheduler is None:
            return []
        return self.scheduler.get_jobs()

    def run_forever(self) -> None:
        self.start()
        logger.info("调度器运行中，按 Ctrl+C 停止...")
        try:
            import signal
            signal.signal(signal.SIGINT, lambda *_: self.shutdown())
            signal.signal(signal.SIGTERM, lambda *_: self.shutdown())
            import time
            while self.scheduler and self.scheduler.running:
                time.sleep(1)
        except (KeyboardInterrupt, SystemExit):
            self.shutdown()
