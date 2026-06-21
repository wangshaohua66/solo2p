import heapq
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Tuple

from config import PERFORMANCE, TASK_PRIORITY
from logger import logger


@dataclass(order=True)
class TaskItem:
    priority_score: float
    task_id: str = field(compare=False)
    config: Dict[str, Any] = field(compare=False)
    priority: str = field(compare=False, default="NORMAL")
    size_mb: float = field(compare=False, default=0.0)
    submitted_at: float = field(compare=False, default_factory=time.time)


class BatchProgressDisplay:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._tasks: Dict[str, Dict[str, Any]] = {}
        self._lines_printed = 0

    def register_task(self, task_id: str, project_name: str) -> None:
        with self._lock:
            self._tasks[task_id] = {
                "name": project_name,
                "status": "QUEUED",
                "progress": 0.0,
                "issues": 0,
                "started_at": None,
                "eta": None,
            }

    def update_task(self, task_id: str, status: str, progress: float = 0.0,
                    issues: int = 0, eta: Optional[float] = None) -> None:
        with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id]["status"] = status
                self._tasks[task_id]["progress"] = progress
                self._tasks[task_id]["issues"] = issues
                if eta is not None:
                    self._tasks[task_id]["eta"] = eta
                if status == "RUNNING" and self._tasks[task_id]["started_at"] is None:
                    self._tasks[task_id]["started_at"] = time.time()

    def refresh(self) -> None:
        with self._lock:
            if self._lines_printed > 0:
                import sys
                sys.stdout.write("\033[1A" * self._lines_printed)

            lines: List[str] = []
            lines.append(f"\033[1m=== 批量审查任务调度 ===\033[0m")
            lines.append(f"时间: {datetime.now().strftime('%H:%M:%S')} | "
                         f"运行中/总计: {sum(1 for t in self._tasks.values() if t['status'] == 'RUNNING')}/{len(self._tasks)}")
            lines.append("")
            lines.append(f"{'项目':<25} {'状态':<10} {'进度':>7} {'问题':>5} {'ETA':>8}")
            lines.append("-" * 60)

            status_icons = {
                "QUEUED": "\033[90m○\033[0m",
                "RUNNING": "\033[94m◐\033[0m",
                "COMPLETED": "\033[92m✓\033[0m",
                "FAILED": "\033[91m✗\033[0m",
            }
            status_labels = {
                "QUEUED": "排队中",
                "RUNNING": "审查中",
                "COMPLETED": "已完成",
                "FAILED": "失败",
            }

            for tid, info in self._tasks.items():
                icon = status_icons.get(info["status"], "○")
                label = status_labels.get(info["status"], info["status"])
                bar_filled = int(info["progress"] / 100 * 15)
                bar = "█" * bar_filled + "░" * (15 - bar_filled)
                eta_str = ""
                if info["eta"] is not None and info["status"] == "RUNNING":
                    eta_str = f"{int(info['eta'])}秒"
                elif info["status"] == "COMPLETED":
                    eta_str = "—"
                lines.append(
                    f"{info['name'][:25]:<25} {icon} {label:<6} "
                    f"[{bar}]{info['progress']:5.1f}% {info['issues']:>5} {eta_str:>8}"
                )

            import sys
            output = "\n".join(lines) + "\n"
            sys.stdout.write("\033[2K\r" + output)
            sys.stdout.flush()
            self._lines_printed = len(lines)

    def finalize(self) -> None:
        import sys
        sys.stdout.write("\n")


class TaskScheduler:
    def __init__(self, max_workers: int = 0) -> None:
        self.max_workers = max_workers or PERFORMANCE["max_parallel_tasks"]
        self._queue: List[TaskItem] = []
        self._lock = threading.Lock()
        self._results: Dict[str, Any] = {}
        self._display = BatchProgressDisplay()
        self._task_counter = 0
        self._running = False

    def _compute_priority_score(self, priority: str, size_mb: float) -> float:
        base = TASK_PRIORITY.get(priority, 2)
        size_factor = min(size_mb / 1000.0, 1.0)
        return base - size_factor * 0.5

    def submit(self, config: Dict[str, Any], priority: str = "NORMAL",
               size_mb: float = 0.0) -> str:
        self._task_counter += 1
        task_id = f"task_{self._task_counter:04d}"
        score = self._compute_priority_score(priority, size_mb)

        item = TaskItem(
            priority_score=score,
            task_id=task_id,
            config=config,
            priority=priority,
            size_mb=size_mb,
        )

        with self._lock:
            heapq.heappush(self._queue, item)

        project_name = config.get("project_name", task_id)
        self._display.register_task(task_id, project_name)
        logger.info(f"任务已提交: {task_id} - {project_name} (优先级={priority}, 大小={size_mb:.1f}MB)")
        return task_id

    def _execute_task(self, item: TaskItem, review_fn: Callable) -> Dict[str, Any]:
        task_id = item.task_id
        self._display.update_task(task_id, "RUNNING", progress=0.0)
        logger.info(f"开始执行任务: {task_id} - {item.config.get('project_name', '')}")

        try:
            result = review_fn(item.config)
            self._display.update_task(
                task_id, "COMPLETED", progress=100.0,
                issues=result.get("issues_count", 0),
            )
            self._results[task_id] = result
            logger.info(f"任务完成: {task_id}")
            return result
        except Exception as e:
            logger.error(f"任务失败: {task_id}: {e}", exception=e)
            self._display.update_task(task_id, "FAILED", progress=0.0)
            self._results[task_id] = {"success": False, "error": str(e)}
            return {"success": False, "error": str(e)}

    def run_all(self, review_fn: Callable, progress_interval: float = 2.0) -> Dict[str, Any]:
        if not self._queue:
            logger.warning("没有待执行的任务")
            return {}

        self._running = True
        sorted_items: List[TaskItem] = []
        with self._lock:
            while self._queue:
                sorted_items.append(heapq.heappop(self._queue))

        logger.info(f"开始批量审查，共 {len(sorted_items)} 个任务，最大并行 {self.max_workers}")

        completed: Dict[str, Any] = {}
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_map: Dict[Future, str] = {}
            for item in sorted_items:
                future = executor.submit(self._execute_task, item, review_fn)
                future_map[future] = item.task_id

            while future_map:
                still_running = {}
                for future in list(future_map.keys()):
                    task_id = future_map[future]
                    if future.done():
                        result = future.result()
                        completed[task_id] = result
                    else:
                        still_running[future] = task_id

                future_map = still_running
                self._display.refresh()
                if future_map:
                    time.sleep(progress_interval)

        self._running = False
        self._display.finalize()

        summary = self._compute_batch_summary(completed)
        self._print_batch_summary(summary)
        return summary

    def _compute_batch_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        total = len(results)
        success = sum(1 for r in results.values() if r.get("success"))
        failed = total - success
        total_issues = sum(r.get("issues_count", 0) for r in results.values())
        total_duration = sum(r.get("total_duration", 0) for r in results.values())

        severity_counts: Dict[str, int] = {}
        for r in results.values():
            stats = r.get("stats", {})
            for sev, cnt in stats.get("by_severity", {}).items():
                severity_counts[sev] = severity_counts.get(sev, 0) + int(cnt)

        return {
            "total_tasks": total,
            "success_count": success,
            "failed_count": failed,
            "total_issues": total_issues,
            "total_duration": total_duration,
            "severity_counts": severity_counts,
            "results": results,
        }

    def _print_batch_summary(self, summary: Dict[str, Any]) -> None:
        print(f"\n\033[1m=== 批量审查完成 ===\033[0m")
        print(f"  总任务数: {summary['total_tasks']}")
        print(f"  成功: {summary['success_count']} | 失败: {summary['failed_count']}")
        print(f"  问题总数: {summary['total_issues']}")
        print(f"  总耗时: {summary['total_duration']:.1f} 秒")
        if summary["severity_counts"]:
            sev_labels = {"FATAL": "致命错误", "DEFECT": "一般缺陷", "SUGGESTION": "建议优化"}
            print("  问题分布:")
            for sev, cnt in sorted(summary["severity_counts"].items()):
                print(f"    {sev_labels.get(sev, sev)}: {cnt}")

    def get_results(self) -> Dict[str, Any]:
        return dict(self._results)

    @property
    def pending_count(self) -> int:
        with self._lock:
            return len(self._queue)

    @property
    def is_running(self) -> bool:
        return self._running
