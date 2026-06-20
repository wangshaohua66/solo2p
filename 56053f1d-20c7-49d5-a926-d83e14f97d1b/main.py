"""
main.py
================================================================================
车险理赔定损 RPA 自动化系统 - 程序入口

功能:
  1. 命令行交互界面
  2. 指定案件目录批量处理
  3. 单案件调试模式
  4. 处理进度实时显示
  5. 并行处理 (默认 3 个案件)
  6. 案件状态追踪
  7. 夜间无人值守模式

用法示例:
  # 批量处理某目录下所有案件
  python main.py batch --watch-dir ./data/watch

  # 单案件调试 (dry-run, 不真实操作理赔系统)
  python main.py debug --case-dir ./data/watch/CASE001 --case-no CASE001

  # 真实处理单案件
  python main.py single --case-dir ./data/watch/CASE001 --case-no CASE001

  # 追踪已提交案件状态
  python main.py track --case-no CASE001

  # 夜间无人值守模式
  python main.py night
"""

import argparse
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import asdict
from typing import List

import yaml

from logger import AppLogger, get_logger


def _init_worker(config_path: str, log_level: str):
    """子进程初始化: 重新建立日志与配置。"""
    import logging
    from logger import AppLogger
    AppLogger.setup(config_path)
    logging.getLogger("rpa").setLevel(log_level)


def _process_one_case(case_dir: str, case_no: str, config_path: str,
                      dry_run: bool) -> dict:
    """子进程任务: 处理单个案件, 返回可序列化结果。"""
    from case_processor import CaseProcessor
    processor = CaseProcessor(config_path, dry_run=dry_run)
    result = processor.process_case(case_dir, case_no)
    return asdict(result)


class ProgressTracker:
    """实时进度显示。"""

    def __init__(self, total: int):
        self.total = total
        self.done = 0
        self.success = 0
        self.failed = 0
        self.start = time.time()

    def update(self, case_no: str, status: str):
        self.done += 1
        if status == "success":
            self.success += 1
        else:
            self.failed += 1
        elapsed = time.time() - self.start
        rate = self.done / max(elapsed, 0.001) * 3600
        pct = self.done / self.total * 100
        bar_len = 30
        filled = int(bar_len * self.done / self.total)
        bar = "#" * filled + "-" * (bar_len - filled)
        sys.stdout.write(
            f"\r[{bar}] {pct:5.1f}% | 完成 {self.done}/{self.total} "
            f"(成功{self.success} 失败{self.failed}) | "
            f"速率 {rate:.0f}件/时 | 当前 {case_no}")
        sys.stdout.flush()

    def finish(self):
        elapsed = time.time() - self.start
        sys.stdout.write(
            f"\n处理结束 | 总计 {self.total} 件 | 成功 {self.success} | "
            f"失败 {self.failed} | 耗时 {elapsed:.1f}s\n")


class App:
    def __init__(self, config_path: str = "config.yaml"):
        self.config_path = config_path
        with open(config_path, "r", encoding="utf-8") as f:
            self.cfg = yaml.safe_load(f)
        self.max_parallel = int(self.cfg.get("system", {}).get(
            "max_parallel_cases", 3))

    # --------------------------------------------------------------------------
    # 命令: batch 批量处理
    # --------------------------------------------------------------------------
    def cmd_batch(self, args):
        log = get_logger("main")
        watch_dir = args.watch_dir or self.cfg.get("system", {}).get(
            "watch_dir", "./data/watch")
        log.info("批量处理启动 | watch_dir=%s 并行数=%d dry_run=%s",
                 watch_dir, self.max_parallel, args.dry_run)

        cases = self._discover_cases(watch_dir)
        if not cases:
            log.warning("未发现待处理案件 | dir=%s", watch_dir)
            return

        log.info("发现 %d 个待处理案件", len(cases))
        tracker = ProgressTracker(len(cases))

        # 并行处理 (ProcessPoolExecutor, 满足 "并行处理 3 个案件")
        workers = min(self.max_parallel, len(cases))
        with ProcessPoolExecutor(max_workers=workers,
                                  initializer=_init_worker,
                                  initargs=(self.config_path,
                                            self.cfg.get("logging", {}).get(
                                                "level", "INFO"))) as pool:
            futures = {
                pool.submit(_process_one_case, cdir, cno,
                           self.config_path, args.dry_run): cno
                for cno, cdir, _ in cases
            }
            for fut in as_completed(futures):
                case_no = futures[fut]
                try:
                    res = fut.result()
                    tracker.update(case_no, res["status"])
                except Exception as exc:
                    log.error("案件处理异常 | case=%s err=%s", case_no, exc)
                    tracker.update(case_no, "failed")
        tracker.finish()

    # --------------------------------------------------------------------------
    # 命令: single 真实处理单案件
    # --------------------------------------------------------------------------
    def cmd_single(self, args):
        self._process_single(args, dry_run=False)

    # --------------------------------------------------------------------------
    # 命令: debug 单案件调试 (dry-run)
    # --------------------------------------------------------------------------
    def cmd_debug(self, args):
        self._process_single(args, dry_run=True)

    def _process_single(self, args, dry_run: bool):
        log = get_logger("main")
        log.info("单案件处理 | case=%s dir=%s dry_run=%s",
                 args.case_no, args.case_dir, dry_run)
        result = _process_one_case(args.case_dir, args.case_no,
                                    self.config_path, dry_run)
        log.info("案件处理结果 | case=%s status=%s 损伤=%d 费用=%.2f "
                 "耗时=%ss",
                 result["case_no"], result["status"],
                 result["damage_count"], result["total_cost"],
                 result["durations"].get("total", 0))
        print("\n=== 案件处理结果 ===")
        for k, v in result.items():
            if k in ("durations",):
                print(f"  各阶段耗时: {v}")
            elif k == "error" and not v:
                continue
            else:
                print(f"  {k}: {v}")

    # --------------------------------------------------------------------------
    # 命令: track 状态追踪
    # --------------------------------------------------------------------------
    def cmd_track(self, args):
        from case_processor import CaseProcessor
        log = get_logger("main")
        processor = CaseProcessor(self.config_path, dry_run=args.dry_run)
        status = processor.track_case_status(args.case_no)
        log.info("案件最终状态 | case=%s status=%s", args.case_no, status)
        print(f"案件 {args.case_no} 状态: {status}")

    # --------------------------------------------------------------------------
    # 命令: night 夜间无人值守
    # --------------------------------------------------------------------------
    def cmd_night(self, args):
        from case_processor import CaseProcessor
        log = get_logger("main")
        log.info("启动夜间无人值守模式")
        processor = CaseProcessor(self.config_path, dry_run=args.dry_run)
        try:
            processor.run_night_mode()
        except KeyboardInterrupt:
            log.info("夜间模式被手动中断")

    # --------------------------------------------------------------------------
    # 辅助: 发现案件
    # --------------------------------------------------------------------------
    def _discover_cases(self, watch_dir: str) -> List[tuple]:
        cases = []
        if not os.path.isdir(watch_dir):
            return cases
        for name in sorted(os.listdir(watch_dir)):
            case_dir = os.path.join(watch_dir, name)
            if os.path.isdir(case_dir):
                cases.append((name, case_dir, {}))
        return cases


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="车险理赔定损 RPA 自动化系统",
        formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("--config", default="config.yaml",
                        help="配置文件路径 (默认 config.yaml)")
    sub = parser.add_subparsers(dest="command", required=True)

    p_batch = sub.add_parser("batch", help="批量处理指定目录下所有案件")
    p_batch.add_argument("--watch-dir", default=None,
                          help="案件监控目录 (默认取 config.yaml 配置)")
    p_batch.add_argument("--dry-run", action="store_true",
                          help="模拟模式, 不真实操作理赔系统")

    p_single = sub.add_parser("single", help="真实处理单个案件")
    p_single.add_argument("--case-dir", required=True, help="案件目录")
    p_single.add_argument("--case-no", required=True, help="案件号")

    p_debug = sub.add_parser("debug", help="单案件调试模式 (dry-run)")
    p_debug.add_argument("--case-dir", required=True, help="案件目录")
    p_debug.add_argument("--case-no", required=True, help="案件号")

    p_track = sub.add_parser("track", help="追踪已提交案件审核状态")
    p_track.add_argument("--case-no", required=True, help="案件号")
    p_track.add_argument("--dry-run", action="store_true",
                          help="模拟模式")

    sub.add_parser("night", help="启动夜间无人值守模式")
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    # 初始化日志
    log_level = "DEBUG" if args.command in ("debug", "single") else "INFO"
    AppLogger.setup(args.config)
    log = get_logger("main")
    log.info("车险理赔 RPA 启动 | 命令=%s", args.command)

    app = App(args.config)
    cmd_map = {
        "batch": app.cmd_batch,
        "single": app.cmd_single,
        "debug": app.cmd_debug,
        "track": app.cmd_track,
        "night": app.cmd_night,
    }
    try:
        cmd_map[args.command](args)
    except KeyboardInterrupt:
        log.warning("用户中断, 程序退出")
        sys.exit(130)
    except Exception as exc:
        log.error("程序异常退出 | err=%s", exc, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
