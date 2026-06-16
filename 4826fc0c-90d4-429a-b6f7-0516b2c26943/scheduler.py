import os
import sys
import time
import threading
import queue
import heapq
from typing import Optional, Dict, List, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from datetime import datetime

from loguru import logger

from instrument_driver import InstrumentDriver, InstrumentStatus
from ocr_reader import OCRReader, OCRBatchResult, OCRResult
from lims_client import LIMSClient, LIMSResult


class TaskPriority(Enum):
    LOW = 3
    NORMAL = 2
    HIGH = 1
    URGENT = 0


@dataclass
class SampleTask:
    sample_id: str
    priority: TaskPriority = TaskPriority.NORMAL
    required_elements: Optional[List[str]] = None
    preferred_instruments: Optional[List[str]] = None
    retry_count: int = 0
    max_retries: int = 2
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    assigned_instrument: Optional[str] = None
    status: str = "pending"
    error_message: str = ""
    ocr_results: Optional[OCRBatchResult] = None
    lims_result: Optional[LIMSResult] = None

    def __lt__(self, other: "SampleTask") -> bool:
        if self.priority.value != other.priority.value:
            return self.priority.value < other.priority.value
        return self.created_at < other.created_at


@dataclass
class SchedulerStats:
    total_submitted: int = 0
    total_completed: int = 0
    total_failed: int = 0
    total_retries: int = 0
    total_review_needed: int = 0
    instrument_stats: Dict[str, Dict[str, int]] = field(default_factory=dict)
    start_time: float = field(default_factory=time.time)


class TaskScheduler:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.global_cfg = config.get("global", {})
        self.instruments_cfg = config.get("instruments", {})
        self.lims_cfg = config.get("lims", {})
        self.ocr_cfg = config.get("ocr", {})

        self._max_concurrent = self.global_cfg.get("max_concurrent_instruments", 3)
        self._max_retries = self.global_cfg.get("max_retry_count", 3)
        self._audit_dir = Path(self.global_cfg.get("audit_log_dir", "audit_logs"))
        self._audit_dir.mkdir(parents=True, exist_ok=True)

        self._task_queue: "queue.PriorityQueue[SampleTask]" = queue.PriorityQueue()
        self._failed_queue: List[SampleTask] = []
        self._active_tasks: Dict[str, SampleTask] = {}
        self._completed_tasks: List[SampleTask] = []

        self._instruments: Dict[str, InstrumentDriver] = {}
        self._init_instruments()

        self._ocr_reader = OCRReader(self.ocr_cfg, self.global_cfg)
        self._lims_client = LIMSClient(self.lims_cfg, self.global_cfg)

        self._stats = SchedulerStats()
        for inst_id in self._instruments:
            self._stats.instrument_stats[inst_id] = {"success": 0, "failed": 0, "timeout": 0}

        self._running = False
        self._paused = False
        self._lock = threading.RLock()
        self._worker_thread: Optional[threading.Thread] = None
        self._threads: List[threading.Thread] = []

        self._status_callbacks: List[Callable] = []
        self._log_callbacks: List[Callable[[str, str, str], None]] = []

    def _init_instruments(self) -> None:
        for inst_id, inst_cfg in self.instruments_cfg.items():
            try:
                driver = InstrumentDriver(inst_id, inst_cfg, self.global_cfg)
                self._instruments[inst_id] = driver
                logger.info(f"初始化仪器驱动: {inst_id} ({inst_cfg.get('type', 'unknown')})")
            except Exception as e:
                logger.error(f"初始化仪器 {inst_id} 失败: {e}")

    def register_status_callback(self, callback: Callable) -> None:
        self._status_callbacks.append(callback)

    def register_log_callback(self, callback: Callable[[str, str, str], None]) -> None:
        self._log_callbacks.append(callback)

    def _emit_log(self, level: str, instrument: str, message: str) -> None:
        timestamp = datetime.now().strftime("%H:%M:%S")
        for cb in self._log_callbacks:
            try:
                cb(timestamp, level, f"[{instrument}] {message}")
            except Exception:
                pass

    def add_task(self, sample_id: str, priority: TaskPriority = TaskPriority.NORMAL,
                required_elements: Optional[List[str]] = None,
                preferred_instruments: Optional[List[str]] = None) -> bool:
        if not sample_id:
            return False
        task = SampleTask(
            sample_id=sample_id,
            priority=priority,
            required_elements=required_elements,
            preferred_instruments=preferred_instruments
        )
        self._task_queue.put(task)
        with self._lock:
            self._stats.total_submitted += 1
        logger.info(f"任务入队: {sample_id}, 优先级={priority.name}")
        self._emit_log("INFO", "Scheduler", f"任务入队: {sample_id}")
        return True

    def add_tasks_batch(self, sample_ids: List[str], priority: TaskPriority = TaskPriority.NORMAL) -> int:
        count = 0
        for sid in sample_ids:
            if self.add_task(sid, priority):
                count += 1
        return count

    def _find_available_instrument(self, task: SampleTask) -> Optional[InstrumentDriver]:
        with self._lock:
            busy_count = sum(
                1 for d in self._instruments.values()
                if d.status == InstrumentStatus.BUSY
            )
            if busy_count >= self._max_concurrent:
                return None

            candidates: List[InstrumentDriver] = []
            for inst_id, driver in self._instruments.items():
                if driver.status != InstrumentStatus.IDLE:
                    continue
                if inst_id in self._active_tasks:
                    continue

                if task.preferred_instruments and inst_id not in task.preferred_instruments:
                    inst_cfg = self.instruments_cfg.get(inst_id, {})
                    inst_elements = {e["symbol"] for e in inst_cfg.get("elements", [])}
                    if task.required_elements:
                        if not set(task.required_elements).issubset(inst_elements):
                            continue

                candidates.append(driver)

            if not candidates:
                return None

            candidates.sort(key=lambda d: (
                0 if (task.preferred_instruments and d.instrument_id in task.preferred_instruments) else 1,
                self._stats.instrument_stats.get(d.instrument_id, {}).get("success", 0)
            ), reverse=False)

            return candidates[0]

    def _get_element_mapping(self, instrument_id: str) -> Dict[str, str]:
        inst_cfg = self.instruments_cfg.get(instrument_id, {})
        elements = inst_cfg.get("elements", [])
        return {e["symbol"]: e["lims_name"] for e in elements}

    def _process_task(self, task: SampleTask, instrument: InstrumentDriver) -> None:
        task.started_at = time.time()
        task.assigned_instrument = instrument.instrument_id
        task.status = "measuring"

        with self._lock:
            self._active_tasks[instrument.instrument_id] = task

        self._emit_log("INFO", instrument.instrument_id, f"开始测量 {task.sample_id}")

        try:
            result_img = instrument.run_measurement(task.sample_id)
            if result_img is None:
                raise Exception(f"仪器测量失败")

            task.status = "ocr"
            self._emit_log("INFO", instrument.instrument_id, f"OCR识别中 {task.sample_id}")

            inst_cfg = self.instruments_cfg.get(instrument.instrument_id, {})
            ocr_batch = self._ocr_reader.recognize(
                result_img, instrument.instrument_id, task.sample_id, inst_cfg
            )
            task.ocr_results = ocr_batch

            if not ocr_batch.success:
                review_items = [r for r in ocr_batch.results if r.needs_review]
                if review_items:
                    with self._lock:
                        self._stats.total_review_needed += 1
                    self._emit_log("WARNING", instrument.instrument_id,
                                   f"{task.sample_id} 有{len(review_items)}项需人工复核")

            element_values: Dict[str, float] = {}
            for r in ocr_batch.results:
                if r.value is not None:
                    element_values[r.element] = r.value

            if not element_values:
                raise Exception(f"OCR未识别到任何有效数值")

            task.status = "lims"
            self._emit_log("INFO", instrument.instrument_id, f"LIMS回填 {task.sample_id}")

            mapping = self._get_element_mapping(instrument.instrument_id)
            lims_result = self._lims_client.submit_results(task.sample_id, element_values, mapping)
            task.lims_result = lims_result

            if not lims_result.success:
                raise Exception(f"LIMS回填失败: {lims_result.error_message}")

            task.status = "completed"
            task.completed_at = time.time()

            with self._lock:
                self._stats.total_completed += 1
                self._stats.instrument_stats[instrument.instrument_id]["success"] += 1
                self._completed_tasks.append(task)

            elapsed = task.completed_at - task.started_at
            self._emit_log("SUCCESS", instrument.instrument_id,
                           f"{task.sample_id} 完成, 耗时{elapsed:.1f}s, {len(element_values)}项")

        except Exception as e:
            task.status = "failed"
            task.error_message = str(e)
            task.completed_at = time.time()

            self._emit_log("ERROR", instrument.instrument_id, f"{task.sample_id} 失败: {e}")

            if task.retry_count < task.max_retries:
                task.retry_count += 1
                task.status = "pending"
                task.assigned_instrument = None
                with self._lock:
                    self._stats.total_retries += 1
                self._task_queue.put(task)
                self._emit_log("INFO", "Scheduler", f"{task.sample_id} 第{task.retry_count}次重试")
            else:
                with self._lock:
                    self._stats.total_failed += 1
                    self._stats.instrument_stats[instrument.instrument_id]["failed"] += 1
                    self._failed_queue.append(task)
                self._emit_log("ERROR", "Scheduler", f"{task.sample_id} 重试超限，移入异常队列")

            if instrument.status == InstrumentStatus.ERROR:
                instrument.reset()

        finally:
            with self._lock:
                if instrument.instrument_id in self._active_tasks:
                    del self._active_tasks[instrument.instrument_id]

    def _scheduler_loop(self) -> None:
        logger.info("调度引擎启动")
        self._emit_log("INFO", "Scheduler", "调度引擎启动")

        while self._running:
            if self._paused:
                time.sleep(0.5)
                continue

            try:
                if self._task_queue.empty():
                    time.sleep(0.3)
                    continue

                task = self._task_queue.queue[0]
                instrument = self._find_available_instrument(task)

                if instrument is None:
                    time.sleep(0.5)
                    continue

                self._task_queue.get()

                t = threading.Thread(
                    target=self._process_task,
                    args=(task, instrument),
                    daemon=True,
                    name=f"Worker-{instrument.instrument_id}"
                )
                t.start()
                self._threads.append(t)

            except Exception as e:
                logger.error(f"调度循环异常: {e}")
                time.sleep(1.0)

        logger.info("调度引擎停止")
        self._emit_log("INFO", "Scheduler", "调度引擎停止")

    def start(self) -> bool:
        if self._running:
            return False
        self._running = True
        self._paused = False
        self._worker_thread = threading.Thread(
            target=self._scheduler_loop,
            daemon=True,
            name="Scheduler-Main"
        )
        self._worker_thread.start()
        return True

    def stop(self) -> None:
        self._running = False
        if self._worker_thread:
            self._worker_thread.join(timeout=5.0)

    def pause(self) -> None:
        self._paused = True
        self._emit_log("WARNING", "Scheduler", "调度已暂停")

    def resume(self) -> None:
        self._paused = False
        self._emit_log("INFO", "Scheduler", "调度已恢复")

    @property
    def is_paused(self) -> bool:
        return self._paused

    @property
    def is_running(self) -> bool:
        return self._running

    def get_instrument_statuses(self) -> Dict[str, Dict[str, Any]]:
        statuses = {}
        with self._lock:
            for inst_id, driver in self._instruments.items():
                active = self._active_tasks.get(inst_id)
                statuses[inst_id] = {
                    "id": inst_id,
                    "type": self.instruments_cfg.get(inst_id, {}).get("type", ""),
                    "vendor": self.instruments_cfg.get(inst_id, {}).get("vendor", ""),
                    "status": driver.status.value,
                    "status_enum": driver.status,
                    "current_sample": active.sample_id if active else None,
                    "start_time": active.started_at if active else None,
                    "success_count": self._stats.instrument_stats.get(inst_id, {}).get("success", 0),
                    "failed_count": self._stats.instrument_stats.get(inst_id, {}).get("failed", 0),
                }
        return statuses

    def get_queue_info(self) -> Dict[str, int]:
        with self._lock:
            return {
                "pending": self._task_queue.qsize(),
                "active": len(self._active_tasks),
                "completed": self._stats.total_completed,
                "failed": self._stats.total_failed,
                "review": self._stats.total_review_needed,
                "retries": self._stats.total_retries,
                "submitted": self._stats.total_submitted,
            }

    def get_failed_tasks(self) -> List[SampleTask]:
        with self._lock:
            return list(self._failed_queue)

    def retry_failed_task(self, sample_id: str) -> bool:
        with self._lock:
            for i, task in enumerate(self._failed_queue):
                if task.sample_id == sample_id:
                    task.retry_count = 0
                    task.status = "pending"
                    task.error_message = ""
                    self._failed_queue.pop(i)
                    self._task_queue.put(task)
                    self._emit_log("INFO", "Scheduler", f"异常任务重新入队: {sample_id}")
                    return True
        return False

    def clear_completed(self) -> int:
        with self._lock:
            count = len(self._completed_tasks)
            self._completed_tasks.clear()
            return count

    def generate_audit_report(self, date_str: Optional[str] = None) -> str:
        date_str = date_str or datetime.now().strftime("%Y%m%d")
        report_lines = [
            "=" * 60,
            f"  实验室自动化桥接系统 - 审计报告",
            f"  生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"  报告日期: {date_str}",
            "=" * 60,
            "",
            "【运行统计】",
        ]

        with self._lock:
            q = self.get_queue_info()
            report_lines.extend([
                f"  提交任务数:    {q['submitted']}",
                f"  成功完成数:    {q['completed']}",
                f"  失败任务数:    {q['failed']}",
                f"  需复核任务数:  {q['review']}",
                f"  自动重试次数:  {q['retries']}",
                f"  运行时长:      {time.time() - self._stats.start_time:.1f}s",
            ])

            report_lines.append("")
            report_lines.append("【各仪器统计】")
            for inst_id, stats in self._stats.instrument_stats.items():
                inst_cfg = self.instruments_cfg.get(inst_id, {})
                report_lines.append(
                    f"  {inst_id:16s} | {inst_cfg.get('type',''):10s} | "
                    f"成功={stats.get('success',0):4d} | 失败={stats.get('failed',0):4d}"
                )

            if self._failed_queue:
                report_lines.append("")
                report_lines.append("【异常任务列表】")
                for task in self._failed_queue:
                    report_lines.append(
                        f"  {task.sample_id} | 重试{task.retry_count}次 | 仪器={task.assigned_instrument} | "
                        f"错误={task.error_message}"
                    )

        report_content = "\n".join(report_lines)

        report_path = self._audit_dir / f"audit_report_{date_str}.txt"
        try:
            with open(report_path, "w", encoding="utf-8") as f:
                f.write(report_content)
            logger.info(f"审计报告已生成: {report_path}")
        except Exception as e:
            logger.error(f"写入审计报告失败: {e}")

        return report_content
