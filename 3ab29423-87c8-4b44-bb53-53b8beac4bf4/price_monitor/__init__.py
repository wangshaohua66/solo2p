"""农产品批发市场价格监测预警系统

基于 Python 3.11 + Scrapy + Requests + SQLite + Redis + APScheduler

功能:
- 多源适配采集 (HTML/JSON API/Excel/微信图片/登录态)
- 品类模糊映射对齐
- 异常波动预警检测 + 企业微信推送
- Redis增量去重 + 断点续采
- 指数退避重试 + 连续失败熔断
- SQLite审计日志 + APScheduler每日定时采集
"""

__version__ = "1.0.0"
__all__ = [
    "SpiderManager",
    "DataPipeline",
]

from .spider_manager import SpiderManager
from .pipeline import DataPipeline
from .cli import main as cli_main


def run():
    """命令行入口"""
    cli_main()
