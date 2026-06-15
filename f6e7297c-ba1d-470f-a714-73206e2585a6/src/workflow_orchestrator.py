import os
import json
import time
import threading
import logging
import queue
from enum import Enum
from typing import Optional, Dict, Any, List, Callable
from dataclasses import dataclass, field, asdict
from pathlib import Path
from datetime import datetime

from .screen_capture import ScreenCapture
from .template_matcher import TemplateMatcher, MatchResult, YardGrid
from .text_extractor import TextExtractor, OcrResult
from .action_executor import ActionExecutor, ActionResult, ActionStatus

logger = logging.getLogger(__name__)


class WorkflowState(Enum):
    INIT = "init"
    CALIBRATING = "calibrating"
    LOADING_TEMPLATES = "loading_templates"
    IDLE = "idle"
    SCANNING_YARD = "scanning_yard"
    EXTRACTING_OCR = "extracting_ocr"
    DISPATCH_ENTRY = "dispatch_entry"
    CUSTOMS_ENTRY = "customs_entry"
    VERIFYING = "verifying"
    COMPLETED = "completed"
    PAUSED = "paused"
    SKIPPED = "skipped"
    ERROR = "error"


class WorkflowEvent(Enum):
    START = "start"
    CALIBRATE_DONE = "calibrate_done"
    TEMPLATES_LOADED = "templates_loaded"
    SCAN_DONE = "scan_done"
    OCR_DONE = "ocr_done"
    DISPATCH_DONE = "dispatch_done"
    CUSTOMS_DONE = "customs_done"
    VERIFY_DONE = "verify_done"
    PAUSE = "pause"
    RESUME = "resume"
    SKIP = "skip"
    RETRY = "retry"
    FAIL = "fail"


@dataclass
class ContainerJob:
    job_id: str
    container: MatchResult
    container_number: str = ""
    ocr_result: Optional[OcrResult] = None
    dispatch_result: Optional[ActionResult] = None
    customs_result: Optional[ActionResult] = None
    operation_type: str = ""
    location_from: str = ""
    location_to: str = ""
    inspection_type: str = ""
    state: WorkflowState = WorkflowState.INIT
    status: ActionStatus = ActionStatus.PENDING
    error_message: str = ""
    start_time: float = 0.0
    end_time: float = 0.0
    elapsed_seconds: float = 0.0
    screenshots: List[str] = field(default_factory=list)
    retries: int = 0

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["state"] = self.state.value
        d["status"] = self.status.value
        d["container"] = {
            "x": self.container.x, "y": self.container.y,
            "grid_row": self.container.grid_row,
            "grid_col": self.container.grid_col,
            "status": self.container.status,
            "status_label": self.container.status_label,
        }
        if self.ocr_result:
            d["ocr_result"] = {
                "raw_text": self.ocr_result.raw_text,
                "container_number": self.ocr_result.container_number,
                "is_valid": self.ocr_result.is_valid,
                "confidence": self.ocr_result.confidence,
                "check_digit_valid": self.ocr_result.check_digit_valid,
                "corrected_from": self.ocr_result.corrected_from,
                "processing_time_ms": self.ocr_result.processing_time_ms,
            }
        if self.dispatch_result:
            d["dispatch_result"] = {
                "status": self.dispatch_result.status.value,
                "message": self.dispatch_result.message,
                "screenshot_path": self.dispatch_result.screenshot_path,
                "attempts": self.dispatch_result.attempts,
            }
        if self.customs_result:
            d["customs_result"] = {
                "status": self.customs_result.status.value,
                "message": self.customs_result.message,
                "screenshot_path": self.customs_result.screenshot_path,
                "attempts": self.customs_result.attempts,
            }
        return d


@dataclass
class WorkflowStats:
    total_jobs: int = 0
    completed: int = 0
    failed: int = 0
    skipped: int = 0
    timeout_count: int = 0
    ocr_failures: int = 0
    dispatch_failures: int = 0
    customs_failures: int = 0
    avg_elapsed_seconds: float = 0.0
    min_elapsed_seconds: float = float("inf")
    max_elapsed_seconds: float = 0.0
    ocr_accuracy: float = 0.0
    ocr_total: int = 0
    ocr_hit: int = 0
    current_container: str = ""
    current_state: WorkflowState = WorkflowState.IDLE
    current_progress: int = 0
    is_paused: bool = False
    started_at: Optional[datetime] = None
    last_error: str = ""
    def update_from_job(self, job: ContainerJob) -> None:
        self.current_container = job.container_number or "-"
        self.current_state = job.state
        if job.status == ActionStatus.SUCCESS:
            self.completed += 1
        elif job.status == ActionStatus.FAILED:
            self.failed += 1
        elif job.status == ActionStatus.SKIPPED:
            self.skipped += 1
        if job.elapsed_seconds > 0:
            if self.avg_elapsed_seconds == 0:
                self.avg_elapsed_seconds = job.elapsed_seconds
            else:
                total = self.avg_elapsed_seconds * (self.completed + self.failed - 1)
                self.avg_elapsed_seconds = (total + job.elapsed_seconds) / max(self.completed + self.failed, 1)
            self.min_elapsed_seconds = min(self.min_elapsed_seconds, job.elapsed_seconds)
            self.max_elapsed_seconds = max(self.max_elapsed_seconds, job.elapsed_seconds)

    def reset(self) -> None:
        self.total_jobs = 0
        self.completed = 0
        self.failed = 0
        self.skipped = 0
        self.ocr_failures = 0
        self.dispatch_failures = 0
        self.customs_failures = 0
        self.avg_elapsed_seconds = 0.0
        self.min_elapsed_seconds = float("inf")
        self.max_elapsed_seconds = 0.0
        self.ocr_accuracy = 0.0
        self.ocr_total = 0
        self.ocr_hit = 0
        self.current_container = ""
        self.current_state = WorkflowState.IDLE
        self.current_progress = 0
        self.is_paused = False
        self.started_at = datetime.now()
        self.last_error = ""


class WorkflowOrchestrator:
    def __init__(self, config: Dict[str, Any],
                 screen_capture: ScreenCapture,
                 template_matcher: TemplateMatcher,
                 text_extractor: TextExtractor,
                 action_executor: ActionExecutor):
        self.config = config
        self.screen_capture = screen_capture
        self.template_matcher = template_matcher
        self.text_extractor = text_extractor
        self.action_executor = action_executor

        self.current_state = WorkflowState.INIT
        self.stats = WorkflowStats()
        self.job_history: List[ContainerJob] = []
        self.job_queue: "queue.Queue[ContainerJob]" = queue.Queue()
        self._processed_numbers = set()
        self._pause_event = threading.Event()
        self._pause_event.set()
        self._stop_event = threading.Event()
        self._skip_next = threading.Event()
        self._timeout_seconds = config.get("performance", {}).get("single_box_timeout_seconds", 25)
        self._ocr_accuracy_target = config.get("performance", {}).get("ocr_accuracy_target", 0.97)
        self._ocr_accuracy_min_samples = config.get("performance", {}).get("ocr_accuracy_min_samples", 20)
        self._ocr_accuracy_alert_sent = False

        parallel_cfg = config.get("parallel", {})
        self._parallel_enabled = parallel_cfg.get("enabled", True)
        self._parallel_workers = max(1, int(parallel_cfg.get("workers", 3)))
        self._gui_lock = threading.RLock()
        self._stats_lock = threading.RLock()
        self._history_lock = threading.RLock()

        self._history_file = os.path.join(
            config.get("logging", {}).get("log_dir", "logs"),
            "job_history.jsonl"
        )
        Path(os.path.dirname(self._history_file)).mkdir(parents=True, exist_ok=True)

    @property
    def is_paused(self) -> bool:
        return not self._pause_event.is_set()

    @property
    def is_stopped(self) -> bool:
        return self._stop_event.is_set()

    def pause(self) -> None:
        self._pause_event.clear()
        self.stats.is_paused = True
        logger.info("任务已暂停")

    def resume(self) -> None:
        self._pause_event.set()
        self.stats.is_paused = False
        logger.info("任务已恢复")

    def skip(self) -> None:
        self._skip_next.set()
        logger.info("已标记跳过当前集装箱")

    def stop(self) -> None:
        self._stop_event.set()
        self._pause_event.set()
        logger.info("任务已停止")

    def _check_interrupts(self) -> bool:
        if self._stop_event.is_set():
            return True
        if not self._pause_event.is_set():
            self.current_state = WorkflowState.PAUSED
            self.stats.current_state = WorkflowState.PAUSED
            logger.info("等待恢复中...")
            self._pause_event.wait()
            if self._stop_event.is_set():
                return True
            self.current_state = WorkflowState.IDLE
            self.stats.current_state = WorkflowState.IDLE
            logger.info("任务已恢复执行")
        return False

    def _transition(self, event: WorkflowEvent, job: Optional[ContainerJob] = None) -> None:
        transitions = {
            WorkflowState.INIT: {
                WorkflowEvent.START: WorkflowState.CALIBRATING,
            },
            WorkflowState.CALIBRATING: {
                WorkflowEvent.CALIBRATE_DONE: WorkflowState.LOADING_TEMPLATES,
                WorkflowEvent.FAIL: WorkflowState.ERROR,
            },
            WorkflowState.LOADING_TEMPLATES: {
                WorkflowEvent.TEMPLATES_LOADED: WorkflowState.IDLE,
                WorkflowEvent.FAIL: WorkflowState.ERROR,
            },
            WorkflowState.IDLE: {
                WorkflowEvent.START: WorkflowState.SCANNING_YARD,
            },
            WorkflowState.SCANNING_YARD: {
                WorkflowEvent.SCAN_DONE: WorkflowState.EXTRACTING_OCR,
                WorkflowEvent.FAIL: WorkflowState.ERROR,
            },
            WorkflowState.EXTRACTING_OCR: {
                WorkflowEvent.OCR_DONE: WorkflowState.DISPATCH_ENTRY,
                WorkflowEvent.SKIP: WorkflowState.SKIPPED,
                WorkflowEvent.FAIL: WorkflowState.ERROR,
            },
            WorkflowState.DISPATCH_ENTRY: {
                WorkflowEvent.DISPATCH_DONE: WorkflowState.CUSTOMS_ENTRY,
                WorkflowEvent.SKIP: WorkflowState.SKIPPED,
                WorkflowEvent.FAIL: WorkflowState.ERROR,
            },
            WorkflowState.CUSTOMS_ENTRY: {
                WorkflowEvent.CUSTOMS_DONE: WorkflowState.VERIFYING,
                WorkflowEvent.SKIP: WorkflowState.SKIPPED,
                WorkflowEvent.FAIL: WorkflowState.ERROR,
            },
            WorkflowState.VERIFYING: {
                WorkflowEvent.VERIFY_DONE: WorkflowState.COMPLETED,
                WorkflowEvent.RETRY: WorkflowState.DISPATCH_ENTRY,
                WorkflowEvent.FAIL: WorkflowState.ERROR,
            },
            WorkflowState.PAUSED: {
                WorkflowEvent.RESUME: WorkflowState.IDLE,
            },
        }

        current = job.state if job else self.current_state
        state_map = transitions.get(current, {})
        next_state = state_map.get(event)

        if next_state:
            if job:
                job.state = next_state
            else:
                self.current_state = next_state
                self.stats.current_state = next_state
            logger.debug(f"状态转换: {current.value} --[{event.value}]--> {next_state.value}")
        else:
            logger.warning(f"无效的状态转换: {current.value} --[{event.value}]--> (无定义)")

    def initialize(self) -> bool:
        self._transition(WorkflowEvent.START)

        self.current_state = WorkflowState.CALIBRATING
        self.stats.current_state = WorkflowState.CALIBRATING
        logger.info("步骤1: 校准屏幕窗口坐标")
        calib_ok = self.screen_capture.auto_calibrate()
        if not calib_ok:
            logger.error("校准失败")
            self._transition(WorkflowEvent.FAIL)
            return False
        self._transition(WorkflowEvent.CALIBRATE_DONE)

        self.current_state = WorkflowState.LOADING_TEMPLATES
        self.stats.current_state = WorkflowState.LOADING_TEMPLATES
        logger.info("步骤2: 加载匹配模板")
        tpl_ok = self.template_matcher.load_templates()
        if not tpl_ok:
            logger.warning("未加载到任何模板文件，将使用坐标模式（请在templates目录放置模板图片）")
        self._transition(WorkflowEvent.TEMPLATES_LOADED)

        self.current_state = WorkflowState.IDLE
        self.stats.current_state = WorkflowState.IDLE
        self.stats.started_at = datetime.now()
        logger.info("初始化完成，等待任务调度")
        return True

    def scan_yard_and_enqueue(self, max_count: int = 0) -> int:
        if self._check_interrupts():
            return 0

        self.current_state = WorkflowState.SCANNING_YARD
        self.stats.current_state = WorkflowState.SCANNING_YARD

        logger.info("开始扫描堆场画面...")
        yard_grid: YardGrid = self.template_matcher.analyze_yard_grid()

        enqueued = 0
        for container in yard_grid.containers:
            if self._stop_event.is_set():
                break
            if self._skip_next.is_set():
                self._skip_next.clear()
                continue

            status_filter = ["pending", "loaded"]
            if container.status not in status_filter and container.status != "unknown":
                continue

            key = f"{container.grid_row}_{container.grid_col}"
            if key in self._processed_numbers:
                continue

            job = ContainerJob(
                job_id=f"JOB_{int(time.time()*1000)}_{enqueued}",
                container=container,
                state=WorkflowState.SCANNING_YARD,
                start_time=time.time(),
            )
            self.job_queue.put(job)
            enqueued += 1

            if max_count and enqueued >= max_count:
                break

        self.stats.total_jobs = enqueued
        logger.info(f"堆场扫描完成，入队 {enqueued} 个待处理集装箱")
        self._transition(WorkflowEvent.SCAN_DONE)
        return enqueued

    def _check_deadline(self, deadline: float, stage: str, job: ContainerJob) -> bool:
        if time.time() > deadline:
            elapsed = time.time() - job.start_time
            logger.warning(
                f"作业超时 [{job.job_id}] 在阶段 [{stage}]，"
                f"已耗时 {elapsed:.1f}s / 阈值 {self._timeout_seconds}s"
            )
            job.error_message = f"流程超时(阶段:{stage})，{elapsed:.1f}s > {self._timeout_seconds}s"
            job.status = ActionStatus.FAILED
            self.stats.timeout_count += 1
            self._finalize_job(job)
            return True
        return False

    def process_single_job(self, job: ContainerJob) -> bool:
        job.start_time = time.time()
        timeout_deadline = job.start_time + self._timeout_seconds

        try:
            job.state = WorkflowState.EXTRACTING_OCR
            self.stats.current_container = "识别中..."
            self.stats.current_state = WorkflowState.EXTRACTING_OCR

            if self._check_interrupts():
                job.status = ActionStatus.SKIPPED
                return False

            ocr_result = self._execute_with_timeout(
                lambda: self.text_extractor.extract_container_number(job.container, system_name="yard"),
                deadline=timeout_deadline
            )
            if ocr_result is None:
                job.error_message = "OCR识别超时"
                job.status = ActionStatus.FAILED
                self.stats.ocr_failures += 1
                self.stats.timeout_count += 1
                self._finalize_job(job)
                return False

            job.ocr_result = ocr_result
            job.container_number = ocr_result.container_number

            if not ocr_result.is_valid:
                logger.warning(f"OCR结果无效: raw='{ocr_result.raw_text}'")
                if self._skip_next.is_set():
                    self._skip_next.clear()
                    job.status = ActionStatus.SKIPPED
                    self._transition(WorkflowEvent.SKIP, job)
                    self._finalize_job(job)
                    return False
                job.error_message = f"OCR校验失败: {ocr_result.raw_text}"
                job.status = ActionStatus.FAILED
                self.stats.ocr_failures += 1
                self._finalize_job(job)
                return False

            logger.info(f"箱号识别成功: {job.container_number} ({job.container.status_label})")
            self.stats.current_container = job.container_number
            self._transition(WorkflowEvent.OCR_DONE, job)

            if self._check_deadline(timeout_deadline, "OCR识别", job):
                return False
            if self._check_interrupts():
                job.status = ActionStatus.SKIPPED
                return False

            op_info = self.action_executor.determine_operation_type(job.container.status)
            job.operation_type = op_info.get("operation", "移箱")
            job.location_from = op_info.get("from", "A区")
            job.location_to = op_info.get("to", "B区")
            job.inspection_type = op_info.get("inspection", "机检")

            job.state = WorkflowState.DISPATCH_ENTRY
            self.stats.current_state = WorkflowState.DISPATCH_ENTRY
            dispatch_result = self.action_executor.execute_with_retry(
                self.action_executor.fill_dispatch_form,
                job.container_number, job.location_from, job.location_to, job.operation_type,
                task_name=f"dispatch_{job.container_number}",
                deadline=timeout_deadline
            )
            job.dispatch_result = dispatch_result

            if not dispatch_result.is_success:
                if dispatch_result.data.get("timeout"):
                    job.error_message = "调度录入超时"
                    self.stats.timeout_count += 1
                else:
                    job.error_message = f"调度录入失败: {dispatch_result.message}"
                job.status = ActionStatus.FAILED
                self.stats.dispatch_failures += 1
                if dispatch_result.data.get("should_pause"):
                    self.pause()
                    self.stats.last_error = job.error_message
                self._finalize_job(job)
                return False
            self._transition(WorkflowEvent.DISPATCH_DONE, job)

            if self._check_deadline(timeout_deadline, "调度录入", job):
                return False
            if self._check_interrupts():
                job.status = ActionStatus.SKIPPED
                return False

            job.state = WorkflowState.CUSTOMS_ENTRY
            self.stats.current_state = WorkflowState.CUSTOMS_ENTRY
            customs_result = self.action_executor.execute_with_retry(
                self.action_executor.fill_customs_form,
                job.container_number, "", job.inspection_type,
                task_name=f"customs_{job.container_number}",
                deadline=timeout_deadline
            )
            job.customs_result = customs_result

            if not customs_result.is_success:
                if customs_result.data.get("timeout"):
                    job.error_message = "海关录入超时"
                    self.stats.timeout_count += 1
                else:
                    job.error_message = f"海关录入失败: {customs_result.message}"
                job.status = ActionStatus.FAILED
                self.stats.customs_failures += 1
                if customs_result.data.get("should_pause"):
                    self.pause()
                    self.stats.last_error = job.error_message
                self._finalize_job(job)
                return False
            self._transition(WorkflowEvent.CUSTOMS_DONE, job)

            if self._check_deadline(timeout_deadline, "海关录入", job):
                return False

            job.state = WorkflowState.VERIFYING
            self.stats.current_state = WorkflowState.VERIFYING
            if not self._verify_results(job, deadline=timeout_deadline):
                logger.warning(f"回读校验未通过，尝试修正: {job.container_number}")
                job.retries += 1
                if job.retries < 2 and not self._check_deadline(timeout_deadline, "回读校验", job):
                    self._transition(WorkflowEvent.RETRY, job)
                    job.state = WorkflowState.DISPATCH_ENTRY
                    dispatch_result2 = self.action_executor.fill_dispatch_form(
                        job.container_number, job.location_from, job.location_to, job.operation_type
                    )
                    if not dispatch_result2.is_success:
                        job.error_message = "回退修正失败"
                        job.status = ActionStatus.FAILED
                        self._finalize_job(job)
                        return False

            if self._check_deadline(timeout_deadline, "回读校验", job):
                return False

            job.status = ActionStatus.SUCCESS
            job.state = WorkflowState.COMPLETED
            self._transition(WorkflowEvent.VERIFY_DONE, job)
            self._finalize_job(job)
            return True

        except Exception as e:
            logger.error(f"处理作业异常 [{job.job_id}]: {e}", exc_info=True)
            job.error_message = f"系统异常: {str(e)}"
            job.status = ActionStatus.FAILED
            self.stats.last_error = job.error_message
            self._finalize_job(job)
            return False

    def _execute_with_timeout(self, fn: Callable, deadline: float) -> Any:
        result_holder = []
        exception_holder = []

        def _worker():
            try:
                result_holder.append(fn())
            except Exception as e:
                exception_holder.append(e)

        t = threading.Thread(target=_worker, daemon=True)
        t.start()
        while t.is_alive():
            if time.time() > deadline:
                logger.warning("OCR执行超时，强制返回")
                return None
            if self._stop_event.is_set():
                return None
            t.join(timeout=0.5)

        if exception_holder:
            raise exception_holder[0]
        return result_holder[0] if result_holder else None

    def _verify_results(self, job: ContainerJob, deadline: Optional[float] = None) -> bool:
        logger.info(f"执行回读校验: {job.container_number}")
        verification_details: Dict[str, Dict[str, Any]] = {}
        all_passed = True

        systems_cfg = self.config.get("systems", {})

        dispatch_fields = systems_cfg.get("dispatch", {}).get("input_fields", {})
        dispatch_expected = {
            "container_number": job.container_number,
            "location_from": job.location_from,
            "location_to": job.location_to,
            "operation_type": job.operation_type,
        }
        try:
            if deadline is not None and time.time() > deadline:
                logger.warning("回读校验(调度段)超时，跳过")
                all_passed = False
                verification_details["dispatch_timeout"] = {"timeout": True, "passed": False}
            else:
                if self.screen_capture.activate_window("dispatch"):
                    time.sleep(0.3)
                    for fname, expected in dispatch_expected.items():
                        if deadline is not None and time.time() > deadline:
                            all_passed = False
                            verification_details[f"dispatch_{fname}_timeout"] = {"timeout": True, "passed": False}
                            break
                        fcfg = dispatch_fields.get(fname)
                        if not fcfg or not isinstance(fcfg, dict) or "x" not in fcfg:
                            continue
                        actual = self.text_extractor.read_field_value(
                            fcfg, "dispatch", fcfg.get("type", "text")
                        )
                        passed = (expected and expected in actual) or (not expected and not actual)
                        if not passed:
                            all_passed = False
                            logger.warning(
                                f"[校验失败-调度] {fname}: 预期='{expected}' 回读='{actual}'"
                            )
                        verification_details[f"dispatch_{fname}"] = {
                            "expected": expected,
                            "actual": actual,
                            "passed": passed,
                        }
        except Exception as e:
            logger.error(f"调度系统回读校验异常: {e}")
            all_passed = False
            verification_details["dispatch_error"] = {"error": str(e), "passed": False}

        customs_fields = systems_cfg.get("customs", {}).get("input_fields", {})
        customs_expected = {
            "container_number": job.container_number,
            "customs_code": "",
            "inspection_type": job.inspection_type,
        }
        try:
            if deadline is not None and time.time() > deadline:
                logger.warning("回读校验(海关段)超时，跳过")
                all_passed = False
                verification_details["customs_timeout"] = {"timeout": True, "passed": False}
            else:
                if self.screen_capture.activate_window("customs"):
                    time.sleep(0.3)
                    for fname, expected in customs_expected.items():
                        if deadline is not None and time.time() > deadline:
                            all_passed = False
                            verification_details[f"customs_{fname}_timeout"] = {"timeout": True, "passed": False}
                            break
                        fcfg = customs_fields.get(fname)
                        if not fcfg or not isinstance(fcfg, dict) or "x" not in fcfg:
                            continue
                        actual = self.text_extractor.read_field_value(
                            fcfg, "customs", fcfg.get("type", "text")
                        )
                        passed = (expected and expected in actual) or (not expected)
                        if expected and not passed:
                            all_passed = False
                            logger.warning(
                                f"[校验失败-海关] {fname}: 预期='{expected}' 回读='{actual}'"
                            )
                        verification_details[f"customs_{fname}"] = {
                            "expected": expected,
                            "actual": actual,
                            "passed": passed,
                        }
        except Exception as e:
            logger.error(f"海关系统回读校验异常: {e}")
            all_passed = False
            verification_details["customs_error"] = {"error": str(e), "passed": False}

        job.dispatch_result = job.dispatch_result or ActionResult(
            status=ActionStatus.SUCCESS, message=""
        )
        if job.dispatch_result.data is None:
            job.dispatch_result.data = {}
        job.dispatch_result.data["verification"] = verification_details

        frame = self.screen_capture.capture_full_screen()
        if frame is not None:
            shot = self.screen_capture.save_screenshot(
                frame, prefix=f"verify_{job.container_number}", subdir="verify"
            )
            if shot and job.screenshots is not None:
                job.screenshots.append(shot)

        if all_passed:
            logger.info(f"回读校验通过: {job.container_number} ({len(verification_details)}项)")
        else:
            failed_count = sum(1 for v in verification_details.values() if not v.get("passed", True))
            logger.warning(
                f"回读校验失败: {job.container_number} "
                f"{failed_count}/{len(verification_details)} 项不一致"
            )
        return all_passed

    def _finalize_job(self, job: ContainerJob) -> None:
        job.end_time = time.time()
        job.elapsed_seconds = round(job.end_time - job.start_time, 2)
        if job.elapsed_seconds > self._timeout_seconds:
            logger.warning(f"作业耗时 {job.elapsed_seconds:.1f}s 超过阈值 {self._timeout_seconds}s")

        container_key = f"{job.container.grid_row}_{job.container.grid_col}"
        with self._stats_lock:
            self._processed_numbers.add(container_key)
            self.job_history.append(job)
            self.stats.update_from_job(job)
            self.stats.current_progress = len(self.job_history)

            ocr_stats = self.text_extractor.get_ocr_stats()
            self.stats.ocr_total = ocr_stats["total"]
            self.stats.ocr_hit = ocr_stats["hit"]
            self.stats.ocr_accuracy = ocr_stats["accuracy"]

        self._check_ocr_accuracy(ocr_stats)

        with self._history_lock:
            try:
                with open(self._history_file, "a", encoding="utf-8") as f:
                    f.write(json.dumps(job.to_dict(), ensure_ascii=False) + "\n")
            except Exception as e:
                logger.debug(f"写入作业历史失败: {e}")

        with self._gui_lock:
            frame = self.screen_capture.capture_full_screen()
            if frame is not None:
                shot = self.screen_capture.save_screenshot(
                    frame, prefix=f"end_{job.status.value}_{job.container_number or job.job_id}",
                    subdir="completed" if job.status == ActionStatus.SUCCESS else "failed"
                )
                if shot:
                    job.screenshots.append(shot)

        logger.info(
            f"作业完成: {job.container_number or job.job_id} "
            f"[{job.status.value}] 耗时={job.elapsed_seconds:.1f}s "
            f"重试={job.retries} 错误={job.error_message or '-'}"
        )

    def _check_ocr_accuracy(self, ocr_stats: Dict[str, Any]) -> None:
        total = ocr_stats.get("total", 0)
        accuracy = ocr_stats.get("accuracy", 0.0)

        if total < self._ocr_accuracy_min_samples:
            return

        target = self._ocr_accuracy_target
        if accuracy >= target:
            if self._ocr_accuracy_alert_sent:
                self._ocr_accuracy_alert_sent = False
                logger.info(f"OCR准确率已恢复至 {accuracy:.2%}，高于阈值 {target:.0%}")
            return

        if self._ocr_accuracy_alert_sent:
            return

        self._ocr_accuracy_alert_sent = True
        msg = (
            f"OCR准确率低于阈值告警\n"
            f"当前准确率: {accuracy:.2%} / 目标: {target:.0%}\n"
            f"统计样本: {total} 个 (命中 {ocr_stats.get('hit', 0)} 个)\n"
            f"建议: 检查图像质量、调整OCR参数或启用人工复核"
        )
        logger.warning(msg.replace("\n", " "))

        try:
            from .notifier import Notifier
            Notifier.instance().send_warning(
                title="OCR准确率告警",
                content=msg
            )
        except Exception as e:
            logger.error(f"发送OCR准确率告警失败: {e}")

    def run_batch(self, count: int = 0) -> WorkflowStats:
        from concurrent.futures import ThreadPoolExecutor, as_completed

        if self.current_state == WorkflowState.INIT:
            if not self.initialize():
                logger.error("初始化失败，退出")
                return self.stats

        if self.job_queue.empty():
            enqueued = self.scan_yard_and_enqueue(max_count=count)
            if enqueued == 0:
                logger.info("没有检测到待处理的集装箱")
                return self.stats

        jobs_to_process: List[ContainerJob] = []
        while not self.job_queue.empty():
            if count and len(jobs_to_process) >= count:
                break
            try:
                jobs_to_process.append(self.job_queue.get_nowait())
            except queue.Empty:
                break

        total = len(jobs_to_process)
        logger.info(
            f"开始批次处理: {total} 个集装箱, "
            f"并行模式={'ON (workers=' + str(self._parallel_workers) + ')' if self._parallel_enabled else 'OFF'}"
        )

        def _worker(job: ContainerJob) -> bool:
            if self._stop_event.is_set():
                return False
            self._check_interrupts()
            if self._stop_event.is_set():
                return False
            with self._gui_lock:
                return self.process_single_job(job)

        processed = 0
        if self._parallel_enabled and total > 1:
            workers = min(self._parallel_workers, total)
            with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="container_worker") as executor:
                future_map = {executor.submit(_worker, job): job for job in jobs_to_process}
                for future in as_completed(future_map):
                    if self._stop_event.is_set():
                        for f in future_map:
                            f.cancel()
                        break
                    try:
                        future.result()
                    except Exception as e:
                        job = future_map.get(future)
                        logger.error(f"作业异常 [{getattr(job, 'job_id', '?')}]: {e}", exc_info=True)
                    finally:
                        processed += 1
                        with self._stats_lock:
                            self.stats.current_progress = len(self.job_history)
                        try:
                            self.job_queue.task_done()
                        except Exception:
                            pass
        else:
            for job in jobs_to_process:
                if self._stop_event.is_set():
                    break
                self._check_interrupts()
                if self._stop_event.is_set():
                    break
                try:
                    _worker(job)
                except Exception as e:
                    logger.error(f"作业异常 [{job.job_id}]: {e}", exc_info=True)
                finally:
                    processed += 1
                    try:
                        self.job_queue.task_done()
                    except Exception:
                        pass

        with self._stats_lock:
            ocr_stats = self.text_extractor.get_ocr_stats()
            self.stats.ocr_total = ocr_stats["total"]
            self.stats.ocr_hit = ocr_stats["hit"]
            self.stats.ocr_accuracy = ocr_stats["accuracy"]

        self.current_state = WorkflowState.IDLE
        self.stats.current_state = WorkflowState.IDLE
        logger.info(
            f"批次处理完成: 成功={self.stats.completed} "
            f"失败={self.stats.failed} 跳过={self.stats.skipped} "
            f"平均耗时={self.stats.avg_elapsed_seconds:.1f}s "
            f"OCR准确率={self.stats.ocr_accuracy:.2%} ({self.stats.ocr_hit}/{self.stats.ocr_total})"
        )
        return self.stats

    def search_history_by_container(self, container_number: str) -> List[Dict[str, Any]]:
        results = []
        for job in self.job_history:
            if container_number.upper() in job.container_number.upper():
                results.append(job.to_dict())
        if not results and os.path.exists(self._history_file):
            try:
                with open(self._history_file, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                            if container_number.upper() in data.get("container_number", "").upper():
                                results.append(data)
                        except json.JSONDecodeError:
                            continue
            except Exception as e:
                logger.error(f"读取历史文件失败: {e}")
        return results

    def clear_processed_cache(self) -> None:
        self._processed_numbers.clear()
        logger.info("已清理已处理记录缓存，下轮将重新扫描")
