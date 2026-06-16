import os
import sys
import time
import threading
from collections import deque
from typing import Deque
from datetime import datetime
from pathlib import Path

import yaml
from loguru import logger

from scheduler import TaskScheduler, TaskPriority


ANSI_COLORS = {
    "reset": "\033[0m",
    "bold": "\033[1m",
    "dim": "\033[2m",
    "red": "\033[31m",
    "green": "\033[32m",
    "yellow": "\033[33m",
    "blue": "\033[34m",
    "cyan": "\033[36m",
    "white": "\033[37m",
    "bg_black": "\033[40m",
}


def _c(text: str, color: str) -> str:
    c = ANSI_COLORS.get(color, "")
    r = ANSI_COLORS["reset"]
    return f"{c}{text}{r}"


def _bell() -> None:
    try:
        sys.stdout.write("\a")
        sys.stdout.flush()
    except Exception:
        pass


def setup_logging(log_dir: str, retention_days: int) -> None:
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)

    logger.remove()

    logger.add(
        sys.stdout,
        level="INFO",
        format="<green>{time:HH:mm:ss}</green> | "
               "<level>{level: <8}</level> | "
               "<cyan>{name}</cyan>:<cyan>{function}</cyan> | "
               "<level>{message}</level>",
        enqueue=True,
    )

    logger.add(
        log_path / "automation_{time:YYYY-MM-DD}.log",
        level="DEBUG",
        rotation="00:00",
        retention=f"{retention_days} days",
        compression="zip",
        enqueue=True,
        encoding="utf-8",
    )

    logger.add(
        log_path / "error_{time:YYYY-MM-DD}.log",
        level="ERROR",
        rotation="00:00",
        retention=f"{retention_days} days",
        compression="zip",
        enqueue=True,
        encoding="utf-8",
    )


def load_config(config_path: str = "config.yaml") -> dict:
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


class ConsoleUI:
    def __init__(self, scheduler: TaskScheduler, ui_cfg: dict):
        self.scheduler = scheduler
        self.ui_cfg = ui_cfg
        self._log_buffer: Deque = deque(maxlen=200)
        self._display_logs: Deque = deque(maxlen=50)
        self._running = False
        self._ui_thread: threading.Thread = None
        self._input_thread: threading.Thread = None
        self._lock = threading.Lock()
        self._last_error_flag = False

        scheduler.register_log_callback(self._on_log)

    def _on_log(self, timestamp: str, level: str, message: str) -> None:
        with self._lock:
            self._log_buffer.append((timestamp, level, message))
            self._display_logs.append((timestamp, level, message))
            if level in ("ERROR", "WARNING") and not self._last_error_flag:
                self._last_error_flag = True
                _bell()
                self._last_error_flag = False

    def _clear_screen(self) -> None:
        if sys.platform == "win32":
            os.system("cls")
        else:
            sys.stdout.write("\033[2J\033[H")
            sys.stdout.flush()

    def _render_header(self) -> list:
        lines = []
        w = 100
        sep = "=" * w
        lines.append(_c(sep, "cyan"))
        title = "  特钢集团化验室自动化桥接系统  "
        padding = (w - len(title)) // 2
        lines.append(_c(" " * padding + title + " " * padding, "cyan"))
        status = "运行中" if self.scheduler.is_running else "已停止"
        status_color = "green" if self.scheduler.is_running else "red"
        if self.scheduler.is_paused:
            status = "已暂停"
            status_color = "yellow"
        time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        info = f"  状态: [{status}]  |  时间: {time_str}"
        lines.append(_c(" " * 20 + info, "white"))
        lines.append(_c(sep, "cyan"))
        return lines

    def _render_instruments(self) -> list:
        lines = []
        lines.append("")
        lines.append(_c("  ┌─ 仪器状态 " + "─" * 82, "cyan"))
        statuses = self.scheduler.get_instrument_statuses()
        sorted_ids = sorted(statuses.keys())

        for inst_id in sorted_ids:
            s = statuses[inst_id]
            status = s["status"]
            status_color = {
                "空闲": "green",
                "测量中": "yellow",
                "异常": "red",
                "离线": "dim",
            }.get(status, "white")

            sample_str = s["current_sample"] or "-"
            if s["start_time"]:
                elapsed = time.time() - s["start_time"]
                elapsed_str = f" ({elapsed:.0f}s)"
            else:
                elapsed_str = ""

            stat_str = f"成功={s['success_count']} 失败={s['failed_count']}"
            inst_type = s["type"]
            row = (
                "  │ " + _c(f"{inst_type:8s}", "white")
                + "  " + _c(f"{inst_id:20s}", "white")
                + "  [" + _c(f"{status:8s}", status_color)
                + "  样品: " + _c(f"{sample_str:14s}", "white")
                + f"{elapsed_str:10s}"
                + "  " + _c(stat_str, "dim")
            )
            lines.append(row)

        lines.append(_c("  └" + "─" * 96, "cyan"))
        return lines

    def _render_logs(self) -> list:
        lines = []
        lines.append("")
        lines.append(_c("  ┌─ 操作日志 " + "─" * 82, "cyan"))

        with self._lock:
            logs = list(self._display_logs)

        if logs:
            recent = logs[-15:]
            for ts, level, msg in recent:
                level_color = {
                    "INFO": "white",
                    "WARNING": "yellow",
                    "ERROR": "red",
                    "SUCCESS": "green",
                }.get(level, "white")
                lines.append(
                    f"  │ {_c(ts, 'dim')}"
                    f" [{_c(f'{level:6s}', level_color)}]"
                    f" {msg}"
                )
        else:
            lines.append(f"  │ {_c('等待操作日志...', 'dim')}")

        lines.append(_c("  └" + "─" * 96, "cyan"))
        return lines

    def _render_progress(self) -> list:
        lines = []
        q = self.scheduler.get_queue_info()
        lines.append("")
        submitted = max(q["submitted"], 1)
        done = q["completed"] + q["failed"]
        progress = done / submitted if submitted > 0 else 0

        bar_width = 60
        filled = int(bar_width * progress)
        bar = "█" * filled + "░" * (bar_width - filled)
        pct = f"{progress * 100:.1f}%"

        completed_str = str(q["completed"])
        failed_str = str(q["failed"])
        pending_str = str(q["pending"])
        active_str = str(q["active"])
        review_str = str(q["review"])
        retries_str = str(q["retries"])

        lines.append(
            "  进度: [" + _c(bar, "blue") + "] " + _c(pct, "bold")
            + "  完成:" + _c(completed_str, "green")
            + "  失败:" + _c(failed_str, "red")
            + "  待处理:" + _c(pending_str, "yellow")
            + "  运行中:" + _c(active_str, "cyan")
            + "  需复核:" + _c(review_str, "yellow")
            + "  重试:" + _c(retries_str, "dim")
        )
        lines.append("")

        lines.append(
            f"  快捷键: {_c('[P]暂停', 'yellow')}"
            f"  {_c('[R]恢复', 'green')}"
            f"  {_c('[A]添加样品', 'cyan')}"
            f"  {_c('[L]异常队列', 'yellow')}"
            f"  {_c('[V]复核任务', 'magenta')}"
            f"  {_c('[G]审计报告', 'white')}"
            f"  {_c('[Q]退出', 'red')}"
        )
        return lines

    def _render(self) -> None:
        self._clear_screen()
        output = []
        output.extend(self._render_header())
        output.extend(self._render_instruments())
        output.extend(self._render_logs())
        output.extend(self._render_progress())
        output.append("")
        sys.stdout.write("\n".join(output))
        sys.stdout.flush()

    def _display_loop(self) -> None:
        interval = float(self.ui_cfg.get("refresh_interval", 0.5))
        while self._running:
            try:
                self._render()
            except Exception as e:
                logger.error(f"UI渲染异常: {e}")
            time.sleep(interval)

    def _input_loop(self) -> None:
        while self._running:
            try:
                try:
                    if sys.platform == "win32":
                        import msvcrt
                        if msvcrt.kbhit():
                            ch = msvcrt.getch().decode("utf-8", errors="ignore").lower()
                        else:
                            time.sleep(0.2)
                            continue
                    else:
                        import select
                        if select.select([sys.stdin], [], [], 0.3)[0]:
                            ch = sys.stdin.readline().strip().lower()
                        else:
                            continue
                except Exception:
                    time.sleep(0.3)
                    continue

                if not ch:
                    continue

                ch = ch[0] if len(ch) > 0 else ""

                if ch == "p":
                    self.scheduler.pause()
                elif ch == "r":
                    self.scheduler.resume()
                elif ch == "q":
                    self._running = False
                    self.scheduler.stop()
                    logger.info("用户请求退出")
                    break
                elif ch == "a":
                    self._add_sample_interactive()
                elif ch == "l":
                    self._show_failed_tasks()
                elif ch == "v":
                    self._show_review_tasks()
                elif ch == "g":
                    report = self.scheduler.generate_audit_report()
                    self._show_report(report)
                else:
                    pass

            except Exception as e:
                logger.warning(f"输入处理异常: {e}")

    def _add_sample_interactive(self) -> None:
        print("\n" + _c("  添加样品模式", "cyan"))
        try:
            print(_c("  输入样品编号（逗号分隔多个，回车取消）: ", "yellow"), end="", flush=True)
            raw = input()
            if not raw.strip():
                return
            ids = [s.strip() for s in raw.split(",") if s.strip()]
            if not ids:
                return
            added = self.scheduler.add_tasks_batch(ids)
            print(_c(f"  已添加 {added} 个样品任务", "green"))
            time.sleep(1.5)
        except Exception as e:
            logger.error(f"添加样品异常: {e}")
            time.sleep(1)

    def _show_failed_tasks(self) -> None:
        print("\n" + _c("  异常任务列表", "red"))
        failed = self.scheduler.get_failed_tasks()
        if not failed:
            print(_c("  无异常任务", "green"))
            time.sleep(1.5)
            return
        for t in failed:
            print(
                f"  {t.sample_id} | 重试{t.retry_count}次 | "
                f"仪器={t.assigned_instrument} | 错误={t.error_message}"
            )
        print(_c("\n  输入样品编号进行重试（回车返回）: ", "yellow"), end="", flush=True)
        try:
            sid = input().strip()
            if sid:
                if self.scheduler.retry_failed_task(sid):
                    print(_c(f"  已重新入队: {sid}", "green"))
                else:
                    print(_c("  未找到该任务", "red"))
                time.sleep(1.5)
        except Exception:
            pass

    def _show_review_tasks(self) -> None:
        print("\n" + _c("  待复核任务列表", "magenta"))
        review_tasks = self.scheduler.get_review_tasks()
        if not review_tasks:
            print(_c("  无待复核任务", "green"))
            time.sleep(1.5)
            return
        for t in review_tasks:
            review_count = 0
            if t.ocr_results:
                review_count = sum(1 for r in t.ocr_results.results if r.needs_review)
            print(
                f"  {t.sample_id} | 待复核项={review_count} | "
                f"仪器={t.assigned_instrument} | 状态={t.status}"
            )
        print(_c("\n  操作: c <样品编号> 确认通过 | r <样品编号> 驳回 | 回车返回", "yellow"))
        try:
            raw = input().strip()
            if not raw:
                return
            parts = raw.split(maxsplit=1)
            if len(parts) == 2 and parts[0] in ("c", "r"):
                action, sid = parts[0], parts[1].strip()
                accept = (action == "c")
                if self.scheduler.confirm_review_sample(sid, accept=accept):
                    label = "确认通过" if accept else "驳回"
                    print(_c(f"  {sid} 已{label}", "green"))
                else:
                    print(_c(f"  未找到任务: {sid}", "red"))
                time.sleep(1.5)
        except Exception:
            pass

    def _show_report(self, report: str) -> None:
        print("\n" + _c("  审计报告", "cyan"))
        print(report)
        print(_c("\n  按回车返回...", "yellow"), end="", flush=True)
        try:
            input()
        except Exception:
            pass

    def start(self) -> None:
        self._running = True
        self._ui_thread = threading.Thread(target=self._display_loop, daemon=True, name="ConsoleUI-Display")
        self._input_thread = threading.Thread(target=self._input_loop, daemon=True, name="ConsoleUI-Input")
        self._ui_thread.start()
        self._input_thread.start()

    def stop(self) -> None:
        self._running = False
        if self._ui_thread:
            self._ui_thread.join(timeout=2.0)
        if self._input_thread:
            self._input_thread.join(timeout=2.0)


def load_demo_tasks(scheduler: TaskScheduler) -> None:
    demo_samples = [
        f"TS{datetime.now().strftime('%Y%m%d')}{i:04d}"
        for i in range(1, 11)
    ]
    scheduler.add_tasks_batch(demo_samples[:5], TaskPriority.NORMAL)
    scheduler.add_tasks_batch(demo_samples[5:8], TaskPriority.HIGH)
    logger.info(f"已加载 {len(demo_samples)} 个演示样品")


def main() -> int:
    try:
        config_path = os.environ.get("CONFIG_PATH", "config.yaml")
        if not os.path.exists(config_path):
            print(f"配置文件不存在: {config_path}")
            return 1

        config = load_config(config_path)
        global_cfg = config.get("global", {})
        ui_cfg = config.get("console_ui", {})

        setup_logging(
            global_cfg.get("log_dir", "logs"),
            global_cfg.get("log_retention_days", 30),
        )

        logger.info("=" * 60)
        logger.info("特钢集团化验室自动化桥接系统启动")
        logger.info("=" * 60)

        scheduler = TaskScheduler(config)

        ui = ConsoleUI(scheduler, ui_cfg)

        scheduler.start()
        ui.start()

        logger.info("系统初始化完成，控制台UI已启动")

        try:
            while scheduler.is_running:
                time.sleep(1.0)
        except KeyboardInterrupt:
            logger.info("收到键盘中断信号")
        finally:
            logger.info("正在停止系统...")
            ui.stop()
            scheduler.stop()
            report = scheduler.generate_audit_report()
            logger.info("系统已安全关闭")
            return 0

    except Exception as e:
        logger.exception(f"系统致命错误: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
