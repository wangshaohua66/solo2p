import os
import sys
import time
import json
import glob
import signal
import logging
import argparse
import threading
from typing import Optional
from datetime import datetime, timedelta
from pathlib import Path

import yaml
import schedule

from .screen_capture import ScreenCapture
from .template_matcher import TemplateMatcher
from .text_extractor import TextExtractor
from .action_executor import ActionExecutor
from .notifier import Notifier
from .window_monitor import WindowMonitor
from .workflow_orchestrator import (
    WorkflowOrchestrator, WorkflowStats, WorkflowState
)

logger = logging.getLogger("container_automation")


def setup_logging(config: dict, headless: bool = False) -> None:
    log_cfg = config.get("logging", {})
    log_dir = Path(log_cfg.get("log_dir", "logs"))
    log_dir.mkdir(parents=True, exist_ok=True)

    level_str = log_cfg.get("level", "INFO").upper()
    level = getattr(logging, level_str, logging.INFO)
    retention_days = log_cfg.get("retention_days", 30)

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.handlers.clear()

    log_format = "%(asctime)s | %(levelname)-7s | %(name)-24s | %(message)s"
    formatter = logging.Formatter(log_format, datefmt="%Y-%m-%d %H:%M:%S")

    date_str = datetime.now().strftime("%Y%m%d")
    log_file = log_cfg.get("log_file_pattern", "container_automation_{date}.log")
    log_path = log_dir / log_file.format(date=date_str)

    file_handler = logging.FileHandler(str(log_path), encoding="utf-8")
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)

    if not headless:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(level)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)

    logging.getLogger("PIL").setLevel(logging.WARNING)
    logging.getLogger("schedule").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    cleanup_old_logs(log_dir, retention_days)


def cleanup_old_logs(log_dir: Path, retention_days: int) -> None:
    try:
        cutoff = datetime.now() - timedelta(days=retention_days)
        for log_file in log_dir.glob("*.log"):
            try:
                mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
                if mtime < cutoff:
                    log_file.unlink()
                    logger.debug(f"清理过期日志: {log_file.name}")
            except Exception:
                continue
    except Exception as e:
        logger.debug(f"清理旧日志异常: {e}")


def cleanup_old_screenshots(config: dict) -> None:
    try:
        log_cfg = config.get("logging", {})
        retention_days = log_cfg.get("retention_days", 30)
        screenshot_dir = Path(log_cfg.get("screenshot_dir", "screenshots"))
        if not screenshot_dir.exists():
            return
        cutoff = datetime.now() - timedelta(days=retention_days)
        for root, dirs, files in os.walk(str(screenshot_dir)):
            for fname in files:
                if fname.lower().endswith((".png", ".jpg", ".jpeg")):
                    fpath = Path(root) / fname
                    try:
                        mtime = datetime.fromtimestamp(fpath.stat().st_mtime)
                        if mtime < cutoff:
                            fpath.unlink()
                    except Exception:
                        continue
    except Exception as e:
        logger.debug(f"清理旧截图异常: {e}")


def load_config(config_path: str) -> dict:
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"配置文件不存在: {config_path}")
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def build_progress_bar(current: int, total: int, width: int = 30) -> str:
    if total <= 0:
        filled = 0
    else:
        filled = int(width * current / total)
    bar = "█" * filled + "░" * (width - filled)
    percent = (current / total * 100) if total > 0 else 0
    return f"[{bar}] {current}/{total} ({percent:5.1f}%)"


def render_cli_ui(orchestrator: WorkflowOrchestrator,
                  headless: bool = False,
                  ui_lock: Optional[threading.Lock] = None) -> None:
    if headless:
        return

    stats: WorkflowStats = orchestrator.stats

    state_labels = {
        WorkflowState.INIT: "初始化",
        WorkflowState.CALIBRATING: "校准窗口",
        WorkflowState.LOADING_TEMPLATES: "加载模板",
        WorkflowState.IDLE: "空闲",
        WorkflowState.SCANNING_YARD: "扫描堆场",
        WorkflowState.EXTRACTING_OCR: "OCR识别",
        WorkflowState.DISPATCH_ENTRY: "调度录入",
        WorkflowState.CUSTOMS_ENTRY: "海关录入",
        WorkflowState.VERIFYING: "校验回读",
        WorkflowState.COMPLETED: "已完成",
        WorkflowState.PAUSED: "⏸ 已暂停",
        WorkflowState.SKIPPED: "已跳过",
        WorkflowState.ERROR: "❌ 错误",
    }
    state_label = state_labels.get(stats.current_state, str(stats.current_state.value))

    status_color = "\033[32m" if orchestrator._pause_event.is_set() else "\033[33m"
    reset = "\033[0m"
    error_color = "\033[31m"
    header_color = "\033[1;36m"

    lines = []
    lines.append("")
    lines.append(f"{header_color}═" * 78 + reset)
    lines.append(
        f"{header_color}  铁路集装箱中心站 - 跨系统自动化录入平台"
        f"                          {reset}"
    )
    lines.append(f"{header_color}═" * 78 + reset)
    lines.append("")

    container_display = stats.current_container or "—"
    if len(container_display) > 15:
        container_display = container_display[:15]

    lines.append(
        f"  当前箱号: {header_color}{container_display:<15}{reset}  |  "
        f"状态: {status_color}{state_label:<10}{reset}"
    )

    progress = build_progress_bar(
        stats.current_progress,
        max(stats.total_jobs, stats.current_progress, 1),
        width=30
    )
    lines.append(f"  处理进度: {progress}")
    lines.append("")

    lines.append(
        f"  成功: \033[32m{stats.completed:<5}{reset}  "
        f"失败: \033[31m{stats.failed:<5}{reset}  "
        f"跳过: \033[33m{stats.skipped:<5}{reset}  "
        f"OCR失败: {stats.ocr_failures:<3}  "
        f"调度失败: {stats.dispatch_failures:<3}  "
        f"海关失败: {stats.customs_failures:<3}"
    )
    avg = stats.avg_elapsed_seconds or 0
    min_t = stats.min_elapsed_seconds if stats.min_elapsed_seconds != float("inf") else 0
    max_t = stats.max_elapsed_seconds
    lines.append(
        f"  平均耗时: \033[36m{avg:>5.1f}s{reset}  "
        f"最快: {min_t:>5.1f}s  最慢: {max_t:>5.1f}s"
    )

    ocr_acc = stats.ocr_accuracy or 0
    ocr_total = stats.ocr_total or 0
    ocr_hit = stats.ocr_hit or 0
    target = orchestrator.config.get("performance", {}).get("ocr_accuracy_target", 0.97)
    acc_color = "\033[32m" if ocr_acc >= target else "\033[33m" if ocr_acc >= target * 0.9 else "\033[31m"
    lines.append(
        f"  OCR准确率: {acc_color}{ocr_acc * 100:>5.2f}%{reset}  "
        f"(命中 {ocr_hit}/{ocr_total} | 目标 {target * 100:.0f}%)"
    )

    if stats.started_at:
        elapsed = (datetime.now() - stats.started_at).total_seconds()
        if elapsed > 0 and stats.completed > 0:
            rate = stats.completed / elapsed * 3600
            lines.append(f"  运行时长: {format_duration(elapsed)}  |  处理速率: {rate:.0f} 箱/小时")
        else:
            lines.append(f"  运行时长: {format_duration(elapsed)}")

    if stats.last_error:
        err_msg = stats.last_error
        if len(err_msg) > 60:
            err_msg = err_msg[:57] + "..."
        lines.append(f"  {error_color}最近错误: {err_msg}{reset}")

    lines.append("")
    lines.append(f"{header_color}─" * 78 + reset)
    lines.append(
        f"  快捷键: [P]暂停  [R]恢复  [S]跳过当前  [C]清理缓存  [H]搜索箱号  [Q]退出"
    )
    lines.append(f"{header_color}─" * 78 + reset)
    lines.append("")

    try:
        if ui_lock:
            ui_lock.acquire()
        sys.stdout.write("\033[H\033[J")
        sys.stdout.write("\n".join(lines))
        sys.stdout.flush()
    finally:
        if ui_lock:
            ui_lock.release()


def format_duration(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h > 0:
        return f"{h}h{m:02d}m{s:02d}s"
    elif m > 0:
        return f"{m}m{s:02d}s"
    return f"{s}s"


def ui_render_loop(orchestrator: WorkflowOrchestrator,
                   stop_event: threading.Event,
                   headless: bool = False,
                   interval: float = 0.3) -> None:
    ui_lock = threading.Lock()
    while not stop_event.is_set():
        try:
            render_cli_ui(orchestrator, headless=headless, ui_lock=ui_lock)
        except Exception:
            pass
        stop_event.wait(interval)


def keyboard_listener(orchestrator: WorkflowOrchestrator,
                      stop_event: threading.Event,
                      headless: bool = False) -> None:
    if headless:
        return

    try:
        import tty
        import termios
    except ImportError:
        logger.warning("当前环境不支持键盘监听，快捷键功能已禁用")
        return

    old_settings = None
    try:
        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        tty.setcbreak(fd)
    except Exception:
        logger.warning("设置终端模式失败，快捷键功能不可用")
        return

    try:
        while not stop_event.is_set():
            try:
                import select
                dr, _, _ = select.select([sys.stdin], [], [], 0.3)
                if not dr:
                    continue
                ch = sys.stdin.read(1)
                if not ch:
                    continue
                ch_upper = ch.upper()
                if ch_upper == "P":
                    orchestrator.pause()
                    logger.info("用户操作: 暂停 (P)")
                elif ch_upper == "R":
                    orchestrator.resume()
                    logger.info("用户操作: 恢复 (R)")
                elif ch_upper == "S":
                    orchestrator.skip()
                    logger.info("用户操作: 跳过 (S)")
                elif ch_upper == "C":
                    orchestrator.clear_processed_cache()
                    logger.info("用户操作: 清理处理缓存 (C)")
                elif ch_upper == "H":
                    stop_event.set()
                    _interactive_search(orchestrator)
                    stop_event.clear()
                elif ch_upper == "Q" or ord(ch) == 3:
                    logger.info("用户操作: 退出 (Q)")
                    orchestrator.stop()
                    stop_event.set()
                    break
            except KeyboardInterrupt:
                logger.info("收到中断信号")
                orchestrator.stop()
                stop_event.set()
                break
            except Exception as e:
                logger.debug(f"键盘监听异常: {e}")
    finally:
        if old_settings is not None:
            try:
                termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
            except Exception:
                pass


def _interactive_search(orchestrator: WorkflowOrchestrator) -> None:
    try:
        sys.stdout.write("\n")
        sys.stdout.write("=" * 70 + "\n")
        sys.stdout.write("  按箱号查询历史作业记录\n")
        sys.stdout.write("=" * 70 + "\n")
        sys.stdout.write("  请输入箱号 (按 Enter 取消): ")
        sys.stdout.flush()

        val = input().strip()
        if not val:
            return

        results = orchestrator.search_history_by_container(val)
        sys.stdout.write(f"\n  找到 {len(results)} 条记录:\n\n")
        for i, rec in enumerate(results[:20], 1):
            cno = rec.get("container_number", "?")
            status = rec.get("status", "?")
            elapsed = rec.get("elapsed_seconds", 0)
            cnt = rec.get("container", {})
            pos = f"R{cnt.get('grid_row','?')}C{cnt.get('grid_col','?')}"
            cstatus = cnt.get("status_label", "?")
            err = rec.get("error_message", "")
            err_str = f" | {err[:40]}" if err else ""

            sys.stdout.write(
                f"  {i:>2}. {cno:<12} [{status:<7}] "
                f"位置={pos:<8} 箱态={cstatus:<4} "
                f"耗时={elapsed:>5.1f}s{err_str}\n"
            )
        if len(results) > 20:
            sys.stdout.write(f"  ... 还有 {len(results) - 20} 条记录未显示\n")
        sys.stdout.write("\n  按任意键返回... ")
        sys.stdout.flush()
        try:
            import select
            select.select([sys.stdin], [], [], 30)
        except Exception:
            time.sleep(1)
    except Exception as e:
        logger.error(f"搜索历史异常: {e}")


def memory_monitor(config: dict,
                   stop_event: threading.Event,
                   check_interval: int = 60) -> None:
    perf_cfg = config.get("performance", {})
    growth_limit_mb = perf_cfg.get("memory_growth_limit_mb", 150)
    abs_limit_mb = perf_cfg.get("memory_limit_mb", 1024)

    try:
        import psutil
        proc = psutil.Process()
    except ImportError:
        logger.warning("未安装 psutil，内存监控禁用")
        return

    baseline_rss_mb: Optional[float] = None
    baseline_vms_mb: Optional[float] = None
    sample_count = 0
    samples_required = 3
    sample_interval = 5.0

    logger.info(
        f"内存监控启动: 基线将在{sample_interval * samples_required:.0f}s内建立, "
        f"增量阈值={growth_limit_mb}MB, 绝对阈值={abs_limit_mb}MB"
    )

    while not stop_event.is_set():
        try:
            info = proc.memory_info()
            rss_mb = info.rss / (1024 * 1024)
            vms_mb = info.vms / (1024 * 1024)

            if baseline_rss_mb is None:
                if sample_count < samples_required:
                    stop_event.wait(sample_interval)
                    if stop_event.is_set():
                        break
                    if baseline_rss_mb is None:
                        baseline_rss_mb = rss_mb
                        baseline_vms_mb = vms_mb
                    else:
                        n = sample_count + 1
                        baseline_rss_mb = (baseline_rss_mb * sample_count + rss_mb) / n
                        baseline_vms_mb = (baseline_vms_mb * sample_count + vms_mb) / n
                    sample_count += 1
                    if sample_count >= samples_required:
                        logger.info(
                            f"内存基线建立完成: RSS={baseline_rss_mb:.1f}MB "
                            f"VMS={baseline_vms_mb:.1f}MB (采样{sample_count}次)"
                        )
                continue

            growth_rss = rss_mb - baseline_rss_mb
            growth_vms = vms_mb - (baseline_vms_mb or 0)

            level = logging.DEBUG
            msgs = []
            if growth_rss > growth_limit_mb:
                level = logging.WARNING
                msgs.append(
                    f"RSS增量 {growth_rss:+.1f}MB 超过阈值 {growth_limit_mb}MB "
                    f"(基线 {baseline_rss_mb:.1f}MB, 当前 {rss_mb:.1f}MB)"
                )
            if abs_limit_mb and rss_mb > abs_limit_mb:
                level = logging.WARNING
                msgs.append(
                    f"RSS绝对占用 {rss_mb:.1f}MB 超过上限 {abs_limit_mb}MB"
                )
            if msgs:
                logger.log(level, " | ".join(msgs))
            else:
                logger.debug(
                    f"内存监控: RSS {rss_mb:.1f}MB (Δ{growth_rss:+.1f}MB) | "
                    f"VMS {vms_mb:.1f}MB (Δ{growth_vms:+.1f}MB) | "
                    f"基线RSS {baseline_rss_mb:.1f}MB"
                )
        except Exception as e:
            logger.debug(f"内存监控异常: {e}")
        stop_event.wait(check_interval)


def scheduled_jobs(config: dict,
                   orchestrator: WorkflowOrchestrator,
                   stop_event: threading.Event) -> None:
    sched_cfg = config.get("schedule", {})
    morning = sched_cfg.get("morning_shift", "08:00")
    evening = sched_cfg.get("evening_shift", "20:00")
    interval = sched_cfg.get("scan_interval_seconds", 30)
    batch_size = sched_cfg.get("batch_size", 50)

    def start_morning_shift():
        logger.info(f"=== 早班自动启动 @ {datetime.now()} ===")
        orchestrator.resume()
        orchestrator.stats.reset()
        orchestrator.clear_processed_cache()

    def start_evening_shift():
        logger.info(f"=== 晚班自动启动 @ {datetime.now()} ===")
        orchestrator.resume()
        orchestrator.stats.reset()
        orchestrator.clear_processed_cache()

    schedule.every().day.at(morning).do(start_morning_shift)
    schedule.every().day.at(evening).do(start_evening_shift)

    logger.info(
        f"定时任务已配置: 早班 {morning}, 晚班 {evening}, "
        f"每 {interval}s 扫描一次, 批次 {batch_size} 箱"
    )

    last_run = 0.0
    while not stop_event.is_set():
        try:
            schedule.run_pending()
            now = time.time()
            if (now - last_run) >= interval and not orchestrator.is_paused:
                last_run = now
                if orchestrator.job_queue.empty():
                    logger.debug(f"定时扫描触发 ({interval}s 间隔)")
                    orchestrator.run_batch(count=batch_size)
                    cleanup_old_screenshots(config)
        except Exception as e:
            logger.error(f"定时任务异常: {e}", exc_info=True)
        stop_event.wait(1.0)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="铁路集装箱中心站 - 跨系统自动化录入平台",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python -m src.main --config config.yaml                # 交互式启动
  python -m src.main --config config.yaml --headless     # 静默模式
  python -m src.main --config config.yaml --once --count 20  # 单次处理20箱
  python -m src.main --config config.yaml --no-schedule  # 不启动定时任务
  python -m src.main --config config.yaml --search ABCU1234567  # 查询历史
        """
    )
    parser.add_argument("--config", "-c", default="config.yaml", help="配置文件路径 (默认: config.yaml)")
    parser.add_argument("--headless", action="store_true", help="静默模式，仅写日志不输出UI")
    parser.add_argument("--once", action="store_true", help="仅运行一次批次处理，不进入循环")
    parser.add_argument("--count", "-n", type=int, default=0, help="单批次处理上限 (0=不限制)")
    parser.add_argument("--no-schedule", action="store_true", help="禁用定时任务")
    parser.add_argument("--calibrate-only", action="store_true", help="仅执行校准后退出")
    parser.add_argument("--search", type=str, default="", help="按箱号查询历史，查询后退出")
    parser.add_argument("--log-level", type=str, default="", help="覆盖日志级别 DEBUG/INFO/WARN/ERROR")

    args = parser.parse_args()

    try:
        config = load_config(args.config)
    except Exception as e:
        print(f"加载配置失败: {e}", file=sys.stderr)
        return 1

    if args.log_level:
        config.setdefault("logging", {})["level"] = args.log_level

    setup_logging(config, headless=args.headless)
    logger.info("=" * 60)
    logger.info("  铁路集装箱跨系统自动化录入平台 启动")
    logger.info(f"  配置文件: {args.config} | 模式: {'静默' if args.headless else '交互'}")
    logger.info("=" * 60)

    screen_capture = ScreenCapture(config)
    template_matcher = TemplateMatcher(config, screen_capture)
    text_extractor = TextExtractor(config, screen_capture)
    action_executor = ActionExecutor(config, screen_capture, template_matcher, text_extractor)
    orchestrator = WorkflowOrchestrator(config, screen_capture, template_matcher, text_extractor, action_executor)

    notifier = Notifier.instance(config)
    window_monitor = WindowMonitor(config, screen_capture, notifier)

    if args.search:
        results = orchestrator.search_history_by_container(args.search)
        print(json.dumps(results, ensure_ascii=False, indent=2))
        return 0

    if args.calibrate_only:
        ok = screen_capture.auto_calibrate()
        logger.info(f"校准结果: {'成功' if ok else '失败'}")
        logger.info(f"校准数据: {json.dumps(screen_capture.calibration, ensure_ascii=False, indent=2)}")
        return 0 if ok else 1

    stop_event = threading.Event()
    threads = []

    def _handle_signal(signum, frame):
        logger.info(f"收到信号 {signum}，开始优雅退出...")
        orchestrator.stop()
        stop_event.set()

    try:
        signal.signal(signal.SIGINT, _handle_signal)
        signal.signal(signal.SIGTERM, _handle_signal)
    except Exception:
        pass

    ui_thread = threading.Thread(
        target=ui_render_loop, args=(orchestrator, stop_event, args.headless),
        name="ui_renderer", daemon=True
    )
    threads.append(ui_thread)
    ui_thread.start()

    kb_thread = threading.Thread(
        target=keyboard_listener, args=(orchestrator, stop_event, args.headless),
        name="keyboard_listener", daemon=True
    )
    threads.append(kb_thread)
    kb_thread.start()

    mem_thread = threading.Thread(
        target=memory_monitor, args=(config, stop_event),
        name="memory_monitor", daemon=True
    )
    threads.append(mem_thread)
    mem_thread.start()

    win_mon_thread = window_monitor.start()
    threads.append(win_mon_thread)

    try:
        if args.once:
            orchestrator.run_batch(count=args.count)
            stats = orchestrator.stats
            logger.info(
                f"单次执行完成: 成功={stats.completed} 失败={stats.failed} "
                f"跳过={stats.skipped} 平均耗时={stats.avg_elapsed_seconds:.1f}s"
            )
        elif args.no_schedule:
            orchestrator.initialize()
            while not stop_event.is_set():
                orchestrator.run_batch(count=args.count or None)
                stop_event.wait(5.0)
        else:
            scheduled_jobs(config, orchestrator, stop_event)
    except KeyboardInterrupt:
        logger.info("用户中断")
    finally:
        orchestrator.stop()
        window_monitor.stop()
        stop_event.set()
        for t in threads:
            if t.is_alive():
                t.join(timeout=2.0)

    final_stats = orchestrator.stats
    final_ocr = orchestrator.text_extractor.get_ocr_stats()
    logger.info("=" * 60)
    logger.info("  最终统计")
    logger.info("=" * 60)
    logger.info(f"  总作业: {final_stats.completed + final_stats.failed + final_stats.skipped}")
    logger.info(f"  成功: {final_stats.completed}")
    logger.info(f"  失败: {final_stats.failed}")
    logger.info(f"  跳过: {final_stats.skipped}")
    logger.info(f"  平均耗时: {final_stats.avg_elapsed_seconds:.1f}s")
    logger.info(
        f"  OCR统计: 总数={final_ocr.get('total', 0)} "
        f"命中={final_ocr.get('hit', 0)} "
        f"自动纠错={final_ocr.get('corrected', 0)} "
        f"准确率={final_ocr.get('accuracy', 0) * 100:.2f}%"
    )
    if final_stats.started_at:
        elapsed = (datetime.now() - final_stats.started_at).total_seconds()
        logger.info(f"  总运行: {format_duration(elapsed)}")
        if elapsed > 0 and final_stats.completed > 0:
            rate = final_stats.completed / elapsed * 3600
            logger.info(f"  吞吐率: {rate:.0f} 箱/小时")
    logger.info("程序已退出")
    return 0 if final_stats.failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
