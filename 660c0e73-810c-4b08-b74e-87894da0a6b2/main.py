import argparse
import os
import signal
import sys
import threading
import time
from datetime import datetime

import yaml
from loguru import logger

from patrol_engine import PatrolEngine


def setup_logging(log_dir: str, retention_days: int):
    os.makedirs(log_dir, exist_ok=True)
    logger.remove()
    logger.add(
        sys.stderr,
        level="INFO",
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
            "<level>{message}</level>"
        ),
    )
    logger.add(
        os.path.join(log_dir, "patrol_{time:YYYY-MM-DD}.log"),
        rotation="00:00",
        retention=f"{retention_days} days",
        compression="gz",
        level="DEBUG",
        format=(
            "{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | "
            "{name}:{function}:{line} | {message}"
        ),
    )
    anomaly_log = os.path.join(log_dir, "anomaly_{time:YYYY-MM-DD}.log")
    logger.add(
        anomaly_log,
        rotation="00:00",
        retention=f"{retention_days} days",
        compression="gz",
        level="WARNING",
        format=(
            "{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | "
            "{name}:{function}:{line} | {message}"
        ),
        filter=lambda record: record["level"].no >= 30,
    )


def load_config(config_path: str) -> dict:
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    return config


def print_dashboard(engine: PatrolEngine):
    os.system("cls" if os.name == "nt" else "clear")

    stats = engine.get_stats()
    point_states = engine.get_point_states()
    db_stats = engine.data_store.get_stats()

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    print("=" * 80)
    print(f"  化工厂屏幕巡检系统 | {now}")
    print("=" * 80)
    print()

    status = "运行中" if stats["running"] else "已停止"
    status_color = "\033[92m" if stats["running"] else "\033[91m"
    print(f"  状态: {status_color}{status}\033[0m")
    print(f"  巡检点位: {stats['total_points']} 个")
    print(f"  当前点位: {stats.get('current_point', '-')}")
    print(f"  上一轮耗时: {stats.get('round_duration_ms', 0):.0f} ms")
    print()

    print("-" * 80)
    print(f"  {'点位ID':<25} {'上次巡检':<20} {'次数':>6} {'异常':>6} {'耗时(ms)':>10}")
    print("-" * 80)

    for pid, state in sorted(point_states.items()):
        last_time = (
            datetime.fromtimestamp(state.last_patrol_time).strftime("%H:%M:%S")
            if state.last_patrol_time > 0 else "-"
        )
        value_str = "-"
        if state.last_result:
            from image_analyzer import GaugeType
            r = state.last_result
            if r.gauge_type == GaugeType.DIGITAL and r.digital_result:
                v = r.digital_result.value
                value_str = f"{v}" if v is not None else "N/A"
            elif r.gauge_type == GaugeType.POINTER and r.pointer_result:
                v = r.pointer_result.value
                value_str = f"{v}" if v is not None else "N/A"
            elif r.gauge_type == GaugeType.ALARM_LIGHTS and r.alarm_results:
                from image_analyzer import AlarmLightState
                red_count = sum(
                    1 for a in r.alarm_results
                    if a.state == AlarmLightState.RED
                )
                value_str = f"RED:{red_count}" if red_count else "正常"

        anomaly_marker = "\033[91m" if state.total_anomalies > 0 else ""
        anomaly_reset = "\033[0m" if state.total_anomalies > 0 else ""

        print(
            f"  {pid:<25} {last_time:<20} "
            f"{state.total_patrols:>6} "
            f"{anomaly_marker}{state.total_anomalies:>6}{anomaly_reset} "
            f"{state.last_duration_ms:>10.0f}"
        )

    print()
    print("-" * 80)
    print(f"  数据库记录: {db_stats.get('total_records', 0)}")
    print(f"  异常记录: {db_stats.get('anomaly_count', 0)}")
    print(f"  未确认告警: {db_stats.get('unacknowledged_alerts', 0)}")
    print(f"  最近巡检: {db_stats.get('last_patrol_time', '-')}")
    print("=" * 80)
    print()
    print("  命令: [q]退出  [r]立即巡检  [e]导出报表  [s]状态刷新")


def run_interactive(engine: PatrolEngine):
    engine_thread = threading.Thread(target=engine.run, daemon=True)
    engine_thread.start()

    auto_refresh = True
    last_refresh = 0

    while True:
        try:
            if auto_refresh and time.time() - last_refresh > 5:
                print_dashboard(engine)
                last_refresh = time.time()

            import select
            if sys.platform != "win32":
                ready, _, _ = select.select([sys.stdin], [], [], 1.0)
                if ready:
                    cmd = sys.stdin.readline().strip().lower()
                else:
                    continue
            else:
                import msvcrt
                if msvcrt.kbhit():
                    cmd = msvcrt.getch().decode().lower()
                else:
                    time.sleep(0.5)
                    continue

            if cmd in ("q", "quit", "exit"):
                logger.info("Shutting down...")
                engine.stop()
                break
            elif cmd in ("r", "run", "patrol"):
                logger.info("Triggering immediate patrol round...")
                engine.patrol_round()
                print_dashboard(engine)
                last_refresh = time.time()
            elif cmd in ("e", "export"):
                filepath = engine.data_store.export_excel()
                if filepath:
                    print(f"\n  报表已导出: {filepath}\n")
                else:
                    print("\n  导出失败或无数据\n")
            elif cmd in ("s", "status"):
                print_dashboard(engine)
                last_refresh = time.time()
        except KeyboardInterrupt:
            engine.stop()
            break
        except Exception as e:
            logger.error(f"Interactive error: {e}")
            time.sleep(1)

    engine.stop()
    logger.info("System shutdown complete")


def run_once(engine: PatrolEngine):
    logger.info("Running single patrol round...")
    results = engine.patrol_round()
    logger.info(f"Patrol round completed: {len(results)} points checked")
    for r in results:
        if r.error:
            logger.warning(f"  {r.point_id}: ERROR - {r.error}")
        else:
            from image_analyzer import GaugeType
            if r.gauge_type == GaugeType.DIGITAL and r.digital_result:
                v = r.digital_result.value
                logger.info(f"  {r.point_id}: {v}")
            elif r.gauge_type == GaugeType.POINTER and r.pointer_result:
                v = r.pointer_result.value
                logger.info(f"  {r.point_id}: {v}")
            elif r.gauge_type == GaugeType.ALARM_LIGHTS and r.alarm_results:
                from image_analyzer import AlarmLightState
                states = [
                    f"{ar.label}={ar.state.value}" for ar in r.alarm_results
                ]
                logger.info(f"  {r.point_id}: {' | '.join(states)}")


def export_report(engine: PatrolEngine, args):
    logger.info("Exporting patrol report...")
    filepath = engine.data_store.export_excel(
        start_time=args.start_time,
        end_time=args.end_time,
    )
    if filepath:
        logger.info(f"Report exported: {filepath}")
    else:
        logger.warning("Export failed or no data available")


def main():
    parser = argparse.ArgumentParser(
        description="化工厂屏幕巡检与异常自动识别代理",
    )
    parser.add_argument(
        "-c", "--config",
        default="config.yaml",
        help="配置文件路径 (default: config.yaml)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="执行单轮巡检后退出",
    )
    parser.add_argument(
        "--export",
        action="store_true",
        help="导出巡检报表",
    )
    parser.add_argument(
        "--start-time",
        default=None,
        help="报表起始时间 (ISO格式)",
    )
    parser.add_argument(
        "--end-time",
        default=None,
        help="报表结束时间 (ISO格式)",
    )

    args = parser.parse_args()

    if not os.path.exists(args.config):
        print(f"Configuration file not found: {args.config}")
        sys.exit(1)

    config = load_config(args.config)
    global_config = config.get("global", {})

    setup_logging(
        log_dir=global_config.get("log_dir", "./logs"),
        retention_days=global_config.get("log_retention_days", 90),
    )

    logger.info(f"Configuration loaded from {args.config}")
    logger.info(f"Patrol points: {len(config.get('screens', []))}")

    engine = PatrolEngine(config)

    def signal_handler(sig, frame):
        logger.info("Received shutdown signal")
        engine.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    if args.export:
        export_report(engine, args)
    elif args.once:
        run_once(engine)
    else:
        run_interactive(engine)


if __name__ == "__main__":
    main()
