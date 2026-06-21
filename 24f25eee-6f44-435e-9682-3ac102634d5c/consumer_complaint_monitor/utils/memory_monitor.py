import gc
import os
import time
import threading
from typing import Optional

from loguru import logger

from config.settings import Settings


class MemoryMonitor:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self, settings: Optional[Settings] = None):
        if self._initialized:
            return
        self._settings = settings or Settings()
        self._memory_limit_mb = self._settings.get("global.memory_limit_mb", 2048)
        self._warning_threshold = 0.75
        self._critical_threshold = 0.90
        self._gc_interval = 300
        self._last_gc = time.time()
        self._oom_alert_sent = False
        self._stats = {
            "current_rss_mb": 0,
            "peak_rss_mb": 0,
            "gc_count": 0,
            "oom_warnings": 0,
        }
        self._initialized = True

    def get_rss_mb(self) -> float:
        try:
            import psutil
            process = psutil.Process(os.getpid())
            return process.memory_info().rss / 1024 / 1024
        except ImportError:
            pass

        try:
            with open(f"/proc/{os.getpid()}/status", "r") as f:
                for line in f:
                    if line.startswith("VmRSS:"):
                        return int(line.split()[1]) / 1024
        except Exception:
            pass

        import resource
        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024

    def check_and_gc(self) -> float:
        rss_mb = self.get_rss_mb()
        self._stats["current_rss_mb"] = round(rss_mb, 2)
        if rss_mb > self._stats["peak_rss_mb"]:
            self._stats["peak_rss_mb"] = round(rss_mb, 2)

        usage_ratio = rss_mb / self._memory_limit_mb

        if usage_ratio >= self._critical_threshold:
            logger.error(
                f"CRITICAL memory: {rss_mb:.0f}MB / {self._memory_limit_mb}MB "
                f"({usage_ratio:.1%})"
            )
            self._stats["oom_warnings"] += 1
            if not self._oom_alert_sent:
                self._send_oom_alert(rss_mb)
                self._oom_alert_sent = True
            self._force_gc()

        elif usage_ratio >= self._warning_threshold:
            logger.warning(
                f"High memory: {rss_mb:.0f}MB / {self._memory_limit_mb}MB "
                f"({usage_ratio:.1%})"
            )
            self._oom_alert_sent = False
            if time.time() - self._last_gc > self._gc_interval:
                self._force_gc()

        else:
            self._oom_alert_sent = False
            if time.time() - self._last_gc > self._gc_interval:
                gc.collect(generation=0)
                self._last_gc = time.time()

        return rss_mb

    def _force_gc(self):
        before = self.get_rss_mb()
        gc.collect(generation=2)
        self._last_gc = time.time()
        self._stats["gc_count"] += 1
        after = self.get_rss_mb()
        freed = before - after
        logger.info(f"GC completed: {before:.0f}MB -> {after:.0f}MB (freed {freed:.0f}MB)")

    def _send_oom_alert(self, rss_mb: float):
        try:
            from utils.notify import Notifier
            notifier = Notifier(self._settings)
            notifier.send_dingtalk(
                title="⚠️ 内存告警",
                text=(
                    f"### ⚠️ 内存使用告警\n\n"
                    f"**当前内存：** {rss_mb:.0f}MB\n\n"
                    f"**内存上限：** {self._memory_limit_mb}MB\n\n"
                    f"**使用率：** {rss_mb / self._memory_limit_mb:.1%}\n\n"
                    f"> 系统即将触发强制GC，请关注运行状态"
                ),
            )
        except Exception as e:
            logger.error(f"Failed to send OOM alert: {e}")

    @property
    def stats(self) -> dict:
        self._stats["current_rss_mb"] = round(self.get_rss_mb(), 2)
        return dict(self._stats)

    @property
    def memory_usage_ratio(self) -> float:
        return self.get_rss_mb() / self._memory_limit_mb
