import sys
import os
import signal
import json
import time
import threading
from pathlib import Path
from datetime import datetime

import click
from loguru import logger
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config.settings import Settings
from core.scheduler import TaskScheduler
from utils.notify import Notifier
from utils.memory_monitor import MemoryMonitor


_COLOR_MAP = {
    "INFO": "<green>",
    "WARNING": "<yellow>",
    "ERROR": "<red>",
}


def _log_format(record):
    level = record["level"].name
    color = _COLOR_MAP.get(level, "")
    end = "</>" if color else ""
    return (
        f"{color}{level}{end} | "
        f"<cyan>{{name}}</cyan>:<cyan>{{function}}</cyan>:<cyan>{{line}}</cyan> | "
        f"{{message}}\n"
    )


def setup_logging(level: str = "INFO"):
    logger.remove()
    logger.add(
        sys.stderr,
        format=_log_format,
        level=level,
        colorize=True,
    )
    log_dir = Path(__file__).resolve().parent / "logs"
    log_dir.mkdir(exist_ok=True)
    logger.add(
        str(log_dir / "complaint_monitor_{time:YYYY-MM-DD}.log"),
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} | {message}",
        rotation="00:00",
        retention="30 days",
        compression="gz",
        level=level,
        encoding="utf-8",
    )


class ProgressTracker:
    def __init__(self, total: int, desc: str = "采集进度"):
        self._pbar = tqdm(
            total=total,
            desc=desc,
            bar_format="{desc}: {percentage:3.0f}%|{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]",
            colour="green",
        )
        self._start_time = time.time()

    def update(self, n: int = 1):
        self._pbar.update(n)

    def set_description(self, desc: str):
        self._pbar.set_description(desc)

    def close(self):
        self._pbar.close()

    @property
    def elapsed(self) -> float:
        return time.time() - self._start_time


scheduler_instance: TaskScheduler = None
daemon_stop_event = threading.Event()


def _signal_handler(signum, frame):
    global scheduler_instance
    logger.info("Received shutdown signal, stopping...")
    daemon_stop_event.set()
    if scheduler_instance:
        scheduler_instance.stop_scheduler()
    sys.exit(0)


signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)


@click.group()
@click.option("--log-level", default="INFO", type=click.Choice(["DEBUG", "INFO", "WARNING", "ERROR"]))
@click.pass_context
def cli(ctx, log_level):
    setup_logging(log_level)
    ctx.ensure_object(dict)
    try:
        ctx.obj["settings"] = Settings()
    except Exception as e:
        logger.error(f"Failed to load settings: {e}")
        sys.exit(1)


@cli.command(name="run")
@click.option("--channel", "-ch", multiple=True, help="指定渠道代码，可多次使用")
@click.option("--mode", "-m", default="incremental", type=click.Choice(["full", "incremental"]), help="采集模式")
@click.option("--daemon", "-d", is_flag=True, default=False, help="后台常驻模式")
def run_collection(channel, mode, daemon):
    global scheduler_instance

    settings = Settings()
    scheduler = TaskScheduler(settings)
    scheduler_instance = scheduler

    mem_monitor = MemoryMonitor(settings)
    mem_monitor.check_and_gc()

    channel_codes = list(channel) if channel else None
    if channel_codes:
        logger.info(f"指定渠道: {', '.join(channel_codes)}")

    enabled = settings.get_enabled_channels()
    if channel_codes:
        enabled = [ch for ch in enabled if ch.get("code") in channel_codes]

    if not enabled:
        logger.error("没有可用的渠道配置")
        return

    for ch in enabled:
        logger.info(f"  - {ch.get('code')}: type={ch.get('type')}, name={ch.get('name')}")

    logger.info(f"共 {len(enabled)} 个渠道待采集，模式: {mode}")

    if daemon:
        logger.info("启动后台常驻模式 (daemon)...")
        scheduler.start_scheduler(channel_codes)

        notifier = Notifier(settings)
        daily_report_time = settings.get("notify.email.daily_report_time", "18:00")

        def background_tasks():
            last_urgent_check = time.time()
            while not daemon_stop_event.is_set():
                now = datetime.now()
                report_time = now.strftime("%H:%M")

                if report_time == daily_report_time:
                    try:
                        stats = scheduler.get_today_stats()
                        notifier.send_daily_report(stats)
                        logger.info("日报已发送")
                    except Exception as e:
                        logger.error(f"日报发送失败: {e}")

                if time.time() - last_urgent_check >= 60:
                    try:
                        notifier.check_urgent_timeout()
                    except Exception as e:
                        logger.debug(f"Urgent timeout check failed: {e}")
                    last_urgent_check = time.time()

                daemon_stop_event.wait(60)

        report_thread = threading.Thread(target=background_tasks, daemon=True)
        report_thread.start()

        try:
            while not daemon_stop_event.is_set():
                daemon_stop_event.wait(1)
        except KeyboardInterrupt:
            pass
        finally:
            scheduler.stop_scheduler()
            logger.info("后台常驻模式已停止")
    else:
        logger.info("执行一次性采集...")
        progress = ProgressTracker(total=len(enabled), desc="渠道采集")
        scheduler.run_once(channel_codes=channel_codes, mode=mode)
        progress.update(len(enabled))
        progress.close()

        stats = scheduler.stats
        logger.info(f"采集完成 - 总量: {stats.get('total_collected', 0)}")
        risk = stats.get("risk_events", {})
        logger.info(
            f"风险统计 - 紧急: {risk.get('urgent', 0)}, "
            f"预警: {risk.get('warning', 0)}, "
            f"关注: {risk.get('attention', 0)}, "
            f"一般: {risk.get('general', 0)}"
        )
        mem_stats = mem_monitor.stats
        logger.info(
            f"内存统计 - 当前: {mem_stats.get('current_rss_mb', 0):.0f}MB, "
            f"峰值: {mem_stats.get('peak_rss_mb', 0):.0f}MB, "
            f"GC次数: {mem_stats.get('gc_count', 0)}"
        )


@cli.command(name="schedule")
@click.option("--channel", "-ch", multiple=True, help="指定渠道代码")
def start_schedule(channel):
    global scheduler_instance

    settings = Settings()
    scheduler = TaskScheduler(settings)
    scheduler_instance = scheduler

    channel_codes = list(channel) if channel else None
    scheduler.start_scheduler(channel_codes)

    notifier = Notifier(settings)

    def urgent_check_loop():
        while True:
            try:
                notifier.check_urgent_timeout()
            except Exception:
                pass
            time.sleep(60)

    check_thread = threading.Thread(target=urgent_check_loop, daemon=True)
    check_thread.start()

    logger.info("定时调度已启动，按 Ctrl+C 停止")
    try:
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        scheduler.stop_scheduler()
        logger.info("定时调度已停止")


@cli.command(name="stats")
@click.option("--channel", "-ch", default=None, help="查看指定渠道统计")
def show_stats(channel):
    settings = Settings()
    scheduler = TaskScheduler(settings)

    today_stats = scheduler.get_today_stats()
    click.echo(json.dumps(today_stats, ensure_ascii=False, indent=2))

    rates = today_stats.get("channel_success_rates", {})
    if rates:
        click.echo("\n渠道采集成功率:")
        for code, info in rates.items():
            click.echo(
                f"  {code}: {info.get('success_count', 0)}/{info.get('total_count', 0)} "
                f"({info.get('success_rate', 0):.1%})"
            )


@cli.command(name="channels")
def list_channels():
    settings = Settings()
    channels = settings.get_all_channels()
    click.echo(f"\n已配置渠道 ({len(channels)} 个):\n")
    click.echo(f"{'代码':<20} {'名称':<30} {'页面类型':<14} {'启用':<6} {'调度'}")
    click.echo("-" * 95)
    for ch in channels:
        click.echo(
            f"{ch.get('code', ''):<20} "
            f"{ch.get('name', ''):<30} "
            f"{ch.get('type', ''):<14} "
            f"{'✓' if ch.get('enabled') else '✗':<6} "
            f"{ch.get('schedule_cron', '')}"
        )


@cli.command(name="encrypt")
@click.argument("value")
def encrypt_value(value):
    from config.settings import encrypt_value as _encrypt

    encrypted = _encrypt(value)
    click.echo(f"加密值: {encrypted}")
    click.echo("请将此值填入 channels.yaml 中对应的敏感字段")


@cli.command(name="test")
@click.option("--channel", "-ch", required=True, help="测试指定渠道的连通性")
def test_channel(channel):
    settings = Settings()
    ch = settings.get_channel_by_code(channel)
    if not ch:
        click.echo(f"未找到渠道: {channel}")
        return

    click.echo(f"测试渠道: {ch.get('name')} ({channel})")
    click.echo(f"  页面类型: {ch.get('type')}")
    click.echo(f"  渠道类型: {ch.get('channel_type')}")
    click.echo(f"  URL: {ch.get('base_url')}")
    click.echo(f"  解析器: {ch.get('parser')}")

    strategy_map = {"static": "Scrapy", "dynamic": "Selenium-Wire", "weixin_article": "WechatSogou"}
    click.echo(f"  采集策略: {strategy_map.get(ch.get('type'), '未知')}")

    try:
        import requests

        resp = requests.get(ch.get("base_url", ""), timeout=10)
        click.echo(f"  连通性: HTTP {resp.status_code}")
        if resp.status_code == 200:
            click.echo("  ✓ 渠道连通正常")
        else:
            click.echo(f"  ✗ 渠道返回非200状态码: {resp.status_code}")
    except Exception as e:
        click.echo(f"  ✗ 渠道连通失败: {e}")


@cli.command(name="api")
@click.option("--host", default="0.0.0.0", help="API服务监听地址")
@click.option("--port", default=8080, type=int, help="API服务端口")
def start_api(host, port):
    try:
        from http.server import HTTPServer, BaseHTTPRequestHandler
    except ImportError:
        click.echo("API服务依赖不可用")
        return

    settings = Settings()
    mem_monitor = MemoryMonitor(settings)

    class MonitorAPIHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            scheduler = TaskScheduler(settings)

            if self.path == "/api/stats/today":
                data = scheduler.get_today_stats()
                self._json_response(data)
            elif self.path == "/api/stats/memory":
                data = mem_monitor.stats
                self._json_response(data)
            elif self.path == "/api/channels":
                channels = settings.get_enabled_channels()
                result = []
                for ch in channels:
                    ch_info = dict(ch)
                    strategy_map = {
                        "static": "Scrapy",
                        "dynamic": "Selenium-Wire",
                        "weixin_article": "WechatSogou",
                    }
                    ch_info["strategy"] = strategy_map.get(ch.get("type"), "未知")
                    result.append(ch_info)
                self._json_response({"channels": result, "count": len(result)})
            elif self.path.startswith("/api/channel/"):
                code = self.path.split("/")[-1]
                ch = settings.get_channel_by_code(code)
                if ch:
                    self._json_response(ch)
                else:
                    self._json_response({"error": "Channel not found"}, 404)
            elif self.path == "/api/health":
                mem_stats = mem_monitor.stats
                self._json_response({
                    "status": "ok",
                    "timestamp": datetime.now().isoformat(),
                    "memory_rss_mb": mem_stats.get("current_rss_mb", 0),
                    "memory_peak_mb": mem_stats.get("peak_rss_mb", 0),
                    "gc_count": mem_stats.get("gc_count", 0),
                })
            else:
                self._json_response({"error": "Not found"}, 404)

        def _json_response(self, data, status=200):
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

        def log_message(self, format, *args):
            logger.debug(f"API: {format % args}")

    server = HTTPServer((host, port), MonitorAPIHandler)
    logger.info(f"监控API服务启动: http://{host}:{port}")
    click.echo(f"监控API服务已启动: http://{host}:{port}")
    click.echo("  - GET /api/stats/today       今日采集统计(含成功率)")
    click.echo("  - GET /api/stats/memory       内存使用统计")
    click.echo("  - GET /api/channels           渠道列表(含采集策略)")
    click.echo("  - GET /api/channel/<code>     渠道详情")
    click.echo("  - GET /api/health             健康检查(含内存)")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
        logger.info("API服务已停止")


if __name__ == "__main__":
    cli()
