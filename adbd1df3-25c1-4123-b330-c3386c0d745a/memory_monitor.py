import os
import gc
import time
import logging
import threading
from typing import Optional, Dict, Tuple, Callable, List
from dataclasses import dataclass, field
from enum import Enum

try:
    import psutil
except ImportError:
    psutil = None


logger = logging.getLogger(__name__)


class MemoryLevel(Enum):
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class MemorySnapshot:
    timestamp: float
    rss_mb: float
    vms_mb: float
    percent: float
    limit_mb: float
    usage_ratio: float
    level: MemoryLevel

    def to_dict(self) -> Dict:
        return {
            "timestamp": self.timestamp,
            "rss_mb": round(self.rss_mb, 2),
            "vms_mb": round(self.vms_mb, 2),
            "percent": round(self.percent, 2),
            "limit_mb": self.limit_mb,
            "usage_ratio": round(self.usage_ratio, 4),
            "level": self.level.value,
        }


class MemoryExceededError(Exception):
    def __init__(self, message: str, current_mb: float, limit_mb: float):
        super().__init__(message)
        self.current_mb = current_mb
        self.limit_mb = limit_mb


class MemoryMonitor:
    def __init__(
        self,
        limit_mb: float = 500.0,
        warning_threshold: float = 0.8,
        critical_threshold: float = 0.95,
        check_interval: float = 30.0,
        auto_gc: bool = True,
        gc_threshold: float = 0.7,
    ):
        if psutil is None:
            raise ImportError(
                "psutil is required for MemoryMonitor. Install with: pip install psutil"
            )

        self.limit_mb = limit_mb
        self.warning_threshold = warning_threshold
        self.critical_threshold = critical_threshold
        self.check_interval = check_interval
        self.auto_gc = auto_gc
        self.gc_threshold = gc_threshold

        self._process = psutil.Process(os.getpid())
        self._history: List[MemorySnapshot] = []
        self._max_history = 100
        self._peak_rss_mb = 0.0
        self._warning_count = 0
        self._critical_count = 0
        self._gc_count = 0
        self._lock = threading.Lock()

        self._monitor_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._on_warning: Optional[Callable[[MemorySnapshot], None]] = None
        self._on_critical: Optional[Callable[[MemorySnapshot], None]] = None

    def get_current_usage(self) -> MemorySnapshot:
        mem_info = self._process.memory_info()
        rss_mb = mem_info.rss / (1024 * 1024)
        vms_mb = mem_info.vms / (1024 * 1024)

        try:
            system_mem = psutil.virtual_memory()
            percent = system_mem.percent
        except Exception:
            percent = 0.0

        usage_ratio = rss_mb / self.limit_mb if self.limit_mb > 0 else 0.0

        if usage_ratio >= self.critical_threshold:
            level = MemoryLevel.CRITICAL
        elif usage_ratio >= self.warning_threshold:
            level = MemoryLevel.WARNING
        else:
            level = MemoryLevel.NORMAL

        snapshot = MemorySnapshot(
            timestamp=time.time(),
            rss_mb=rss_mb,
            vms_mb=vms_mb,
            percent=percent,
            limit_mb=self.limit_mb,
            usage_ratio=usage_ratio,
            level=level,
        )

        with self._lock:
            self._history.append(snapshot)
            if len(self._history) > self._max_history:
                self._history.pop(0)

            if rss_mb > self._peak_rss_mb:
                self._peak_rss_mb = rss_mb

        return snapshot

    def check_memory(self) -> Tuple[bool, MemorySnapshot]:
        snapshot = self.get_current_usage()

        if snapshot.level == MemoryLevel.CRITICAL:
            self._critical_count += 1
            logger.error(
                f"Critical memory usage: {snapshot.rss_mb:.1f}MB / {self.limit_mb:.1f}MB "
                f"({snapshot.usage_ratio:.1%})",
                extra={
                    "operation": "memory_check",
                    "status": "critical",
                    "duration": 0.0,
                    "rss_mb": snapshot.rss_mb,
                    "limit_mb": self.limit_mb,
                    "usage_ratio": snapshot.usage_ratio,
                },
            )
            if self._on_critical:
                try:
                    self._on_critical(snapshot)
                except Exception as e:
                    logger.error(f"Memory critical callback failed: {str(e)}")
            return False, snapshot

        if snapshot.level == MemoryLevel.WARNING:
            self._warning_count += 1
            logger.warning(
                f"High memory usage: {snapshot.rss_mb:.1f}MB / {self.limit_mb:.1f}MB "
                f"({snapshot.usage_ratio:.1%})",
                extra={
                    "operation": "memory_check",
                    "status": "warning",
                    "duration": 0.0,
                    "rss_mb": snapshot.rss_mb,
                    "limit_mb": self.limit_mb,
                    "usage_ratio": snapshot.usage_ratio,
                },
            )
            if self._on_warning:
                try:
                    self._on_warning(snapshot)
                except Exception as e:
                    logger.error(f"Memory warning callback failed: {str(e)}")

        return True, snapshot

    def ensure_capacity(self, required_mb: float = 0.0) -> bool:
        snapshot = self.get_current_usage()

        projected_usage = snapshot.rss_mb + required_mb
        projected_ratio = projected_usage / self.limit_mb if self.limit_mb > 0 else 0.0

        if projected_ratio >= 1.0:
            logger.error(
                f"Memory limit would be exceeded: current {snapshot.rss_mb:.1f}MB + "
                f"required {required_mb:.1f}MB = {projected_usage:.1f}MB > limit {self.limit_mb:.1f}MB",
                extra={
                    "operation": "memory_ensure_capacity",
                    "status": "rejected",
                    "duration": 0.0,
                    "current_mb": snapshot.rss_mb,
                    "required_mb": required_mb,
                    "projected_mb": projected_usage,
                    "limit_mb": self.limit_mb,
                },
            )
            return False

        if projected_ratio >= self.warning_threshold:
            logger.warning(
                f"Memory approaching limit after operation: {projected_usage:.1f}MB / "
                f"{self.limit_mb:.1f}MB ({projected_ratio:.1%})",
                extra={
                    "operation": "memory_ensure_capacity",
                    "status": "warning",
                    "duration": 0.0,
                    "projected_mb": projected_usage,
                    "limit_mb": self.limit_mb,
                    "projected_ratio": projected_ratio,
                },
            )

        return True

    def force_gc(self) -> Tuple[int, float]:
        before = self.get_current_usage().rss_mb
        collected = gc.collect()
        after = self.get_current_usage().rss_mb
        freed_mb = before - after

        self._gc_count += 1

        logger.info(
            f"Garbage collection completed: freed {freed_mb:.1f}MB, collected {collected} objects",
            extra={
                "operation": "memory_gc",
                "status": "success",
                "duration": 0.0,
                "freed_mb": freed_mb,
                "collected_objects": collected,
                "before_mb": before,
                "after_mb": after,
            },
        )

        return collected, freed_mb

    def try_cleanup(self) -> bool:
        snapshot = self.get_current_usage()

        if snapshot.usage_ratio >= self.gc_threshold:
            logger.info(
                f"Memory usage {snapshot.usage_ratio:.1%} exceeds GC threshold "
                f"{self.gc_threshold:.1%}, triggering cleanup",
                extra={
                    "operation": "memory_cleanup",
                    "status": "triggered",
                    "duration": 0.0,
                    "usage_ratio": snapshot.usage_ratio,
                    "gc_threshold": self.gc_threshold,
                },
            )
            self.force_gc()
            return True

        return False

    def start_monitoring(
        self,
        on_warning: Optional[Callable[[MemorySnapshot], None]] = None,
        on_critical: Optional[Callable[[MemorySnapshot], None]] = None,
    ) -> None:
        if self._monitor_thread is not None and self._monitor_thread.is_alive():
            logger.warning("Memory monitoring is already running")
            return

        self._on_warning = on_warning
        self._on_critical = on_critical
        self._stop_event.clear()

        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            daemon=True,
            name="MemoryMonitor",
        )
        self._monitor_thread.start()

        logger.info(
            f"Memory monitoring started (interval={self.check_interval}s, limit={self.limit_mb}MB)",
            extra={
                "operation": "memory_monitor_start",
                "status": "success",
                "duration": 0.0,
                "interval": self.check_interval,
                "limit_mb": self.limit_mb,
            },
        )

    def stop_monitoring(self) -> None:
        if self._monitor_thread is None:
            return

        self._stop_event.set()
        self._monitor_thread.join(timeout=5.0)
        self._monitor_thread = None

        logger.info(
            "Memory monitoring stopped",
            extra={
                "operation": "memory_monitor_stop",
                "status": "success",
                "duration": 0.0,
            },
        )

    def _monitor_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                ok, snapshot = self.check_memory()

                if not ok and self.auto_gc:
                    self.force_gc()

            except Exception as e:
                logger.error(
                    f"Memory monitoring error: {str(e)}",
                    extra={
                        "operation": "memory_monitor",
                        "status": "error",
                        "duration": 0.0,
                        "error": str(e),
                    },
                )

            self._stop_event.wait(self.check_interval)

    def get_stats(self) -> Dict:
        snapshot = self.get_current_usage()
        return {
            "current": snapshot.to_dict(),
            "peak_rss_mb": round(self._peak_rss_mb, 2),
            "warning_count": self._warning_count,
            "critical_count": self._critical_count,
            "gc_count": self._gc_count,
            "history_size": len(self._history),
            "limit_mb": self.limit_mb,
            "warning_threshold": self.warning_threshold,
            "critical_threshold": self.critical_threshold,
        }

    def get_history(self, last_n: int = 10) -> List[Dict]:
        with self._lock:
            return [s.to_dict() for s in self._history[-last_n:]]

    def reset_stats(self) -> None:
        with self._lock:
            self._history.clear()
            self._peak_rss_mb = 0.0
            self._warning_count = 0
            self._critical_count = 0
            self._gc_count = 0

    @classmethod
    def from_yaml_config(cls, config: Dict) -> "MemoryMonitor":
        system_config = config.get("system", {})
        memory_config = config.get("memory_monitoring", {})

        limit_mb = system_config.get("memory_limit_mb", 500)

        return cls(
            limit_mb=limit_mb,
            warning_threshold=memory_config.get("warning_threshold", 0.8),
            critical_threshold=memory_config.get("critical_threshold", 0.95),
            check_interval=memory_config.get("check_interval", 30.0),
            auto_gc=memory_config.get("auto_gc", True),
            gc_threshold=memory_config.get("gc_threshold", 0.7),
        )


class MemoryGuard:
    def __init__(self, monitor: MemoryMonitor, operation_name: str = "operation"):
        self.monitor = monitor
        self.operation_name = operation_name
        self._snapshot_before: Optional[MemorySnapshot] = None

    def __enter__(self) -> "MemoryGuard":
        self._snapshot_before = self.monitor.get_current_usage()

        ok = self.monitor.ensure_capacity()
        if not ok:
            raise MemoryExceededError(
                f"Memory limit exceeded before {self.operation_name}: "
                f"{self._snapshot_before.rss_mb:.1f}MB / {self.monitor.limit_mb:.1f}MB",
                current_mb=self._snapshot_before.rss_mb,
                limit_mb=self.monitor.limit_mb,
            )

        logger.debug(
            f"Memory guard entered for {self.operation_name} "
            f"(current: {self._snapshot_before.rss_mb:.1f}MB)",
            extra={
                "operation": f"memory_guard_{self.operation_name}",
                "status": "entered",
                "duration": 0.0,
                "rss_mb": self._snapshot_before.rss_mb,
            },
        )

        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        snapshot_after = self.monitor.get_current_usage()

        if self._snapshot_before:
            delta = snapshot_after.rss_mb - self._snapshot_before.rss_mb
            logger.debug(
                f"Memory guard exited for {self.operation_name} "
                f"(delta: {delta:+.1f}MB, current: {snapshot_after.rss_mb:.1f}MB)",
                extra={
                    "operation": f"memory_guard_{self.operation_name}",
                    "status": "exited",
                    "duration": 0.0,
                    "delta_mb": delta,
                    "rss_mb": snapshot_after.rss_mb,
                },
            )

        if snapshot_after.level != MemoryLevel.NORMAL:
            self.monitor.try_cleanup()
