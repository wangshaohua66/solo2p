import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Optional, Callable

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from .utils import (
    load_config,
    logger,
    today_str,
    check_config_changed,
    Color,
    color_text,
    chunk_list,
)
from .pipeline import DataPipeline
from .spiders import (
    HtmlSpider,
    ApiSpider,
    ExcelSpider,
    WechatSpider,
    LoginSpider,
)


SPIDER_TYPE_MAP = {
    "html": HtmlSpider,
    "api": ApiSpider,
    "excel": ExcelSpider,
    "wechat": WechatSpider,
    "login": LoginSpider,
}


class SpiderManager:
    """Spider注册、调度、熔断、断点续采的管理器"""

    def __init__(self):
        self.config = load_config()
        self.pipeline = DataPipeline()

        self._spider_instances: Dict[str, object] = {}
        for stype, cls in SPIDER_TYPE_MAP.items():
            self._spider_instances[stype] = cls()

        self._market_registry: Dict[str, Dict] = {}
        self._build_market_registry()

        self._scheduler: Optional[BackgroundScheduler] = None
        self._max_workers = self.config["system"]["max_concurrent_requests"]
        self._shutdown = threading.Event()

        logger.info(
            color_text(
                f"[Manager] Spider管理器初始化完成，共注册{len(self._market_registry)}个市场，"
                f"最大并发{self._max_workers}",
                Color.CYAN,
            )
        )

    def _build_market_registry(self):
        self._market_registry.clear()
        for group_key, markets in self.config.get("markets", {}).items():
            for m in markets or []:
                if m.get("enabled", True):
                    self._market_registry[m["id"]] = m

    def reload_config_if_needed(self):
        if check_config_changed():
            try:
                self.config = load_config(reload=True)
                self._build_market_registry()
                self.pipeline.reload_config()
                logger.info(color_text("[Manager] 配置热更新完成", Color.BG_GREEN))
            except Exception as e:
                logger.error(color_text(f"[Manager] 配置热更新失败: {e}", Color.RED))

    def list_markets(self, spider_type: str = None) -> List[Dict]:
        result = []
        for mid, info in self._market_registry.items():
            if spider_type and info.get("type") != spider_type:
                continue
            result.append(info)
        return result

    def get_market(self, market_id: str) -> Optional[Dict]:
        return self._market_registry.get(market_id)

    def get_spider(self, spider_type: str):
        return self._spider_instances.get(spider_type)

    def crawl_one(self, market_id: str, force: bool = False) -> Dict:
        """采集单个市场"""
        start = time.time()
        self.reload_config_if_needed()

        market = self.get_market(market_id)
        result = {
            "market_id": market_id,
            "market_name": market.get("name", market_id) if market else market_id,
            "status": "unknown",
            "total": 0,
            "success": 0,
            "duplicate": 0,
            "unmapped": 0,
            "alerts": 0,
            "errors": 0,
            "duration_seconds": 0.0,
            "message": "",
        }

        if not market:
            result["status"] = "error"
            result["message"] = f"未找到市场ID: {market_id}"
            logger.error(color_text(f"[Manager] {result['message']}", Color.RED))
            return result

        spider_type = market.get("type", "html")
        circuit = self.pipeline.circuit
        if not force and circuit.is_open(market_id):
            remaining = circuit.get_open_until(market_id)
            hours = round((remaining - time.time()) / 3600, 1) if remaining else 0
            result["status"] = "skipped"
            result["message"] = f"熔断中，剩余{hours}小时"
            logger.warning(
                color_text(
                    f"[Manager] 跳过 {market['name']}：{result['message']}",
                    Color.BG_YELLOW,
                )
            )
            return result

        spider = self.get_spider(spider_type)
        if spider is None:
            result["status"] = "error"
            result["message"] = f"未知Spider类型: {spider_type}"
            logger.error(color_text(f"[Manager] {result['message']}", Color.RED))
            circuit.record_failure(market_id)
            return result

        try:
            logger.info(
                color_text(
                    f"[Manager] === 执行采集 [{spider_type}] {market['name']} ({market_id}) ===",
                    Color.BOLD + Color.CYAN,
                )
            )
            raw_records = spider.crawl(market)
            proc_result = self.pipeline.process_records(
                market,
                raw_records,
                source_url=market.get("url", ""),
            )

            result.update({
                "total": proc_result["total"],
                "success": proc_result["success"],
                "duplicate": proc_result["duplicate"],
                "unmapped": proc_result["unmapped"],
                "alerts": proc_result["alerts"],
                "errors": proc_result["errors"],
                "status": "success",
                "message": f"成功{proc_result['success']}/原始{proc_result['total']}",
            })
            circuit.record_success(market_id)
            logger.info(
                color_text(
                    f"[Manager] === {market['name']} 完成："
                    f"成功{proc_result['success']} 重复{proc_result['duplicate']} "
                    f"未映射{proc_result['unmapped']} 预警{proc_result['alerts']} 错误{proc_result['errors']} ===",
                    Color.GREEN,
                )
            )
        except Exception as e:
            result["status"] = "failed"
            result["message"] = str(e)
            result["errors"] += 1
            circuit.record_failure(market_id)
            logger.error(
                color_text(
                    f"[Manager] === {market['name']} 采集异常: {e} ===",
                    Color.BG_RED,
                )
            )
        finally:
            result["duration_seconds"] = round(time.time() - start, 2)

        return result

    def crawl_all(self, market_ids: List[str] = None, force: bool = False, resume: bool = True) -> Dict:
        """批量采集，支持断点续采"""
        task_date = today_str()
        start_time = time.time()

        if market_ids is None:
            market_ids = list(self._market_registry.keys())

        progress = {"completed": [], "failed": [], "in_progress": None}
        if resume:
            progress = self.pipeline.db.load_progress(task_date)
            completed_set = set(progress["completed"])
            skipped = [mid for mid in market_ids if mid in completed_set]
            if skipped:
                logger.info(
                    color_text(
                        f"[Manager] 断点续采：跳过已完成的{len(skipped)}个市场",
                        Color.YELLOW,
                    )
                )
            market_ids = [mid for mid in market_ids if mid not in completed_set]

        total_markets = len(market_ids)
        summary = {
            "task_date": task_date,
            "total_markets": total_markets,
            "completed": list(progress["completed"]),
            "failed": list(progress["failed"]),
            "per_market": [],
            "total_records": 0,
            "total_success": 0,
            "total_duplicate": 0,
            "total_unmapped": 0,
            "total_alerts": 0,
            "total_errors": 0,
            "start_time": start_time,
            "end_time": None,
            "duration_minutes": 0,
        }

        if not market_ids:
            logger.info(color_text("[Manager] 没有需要采集的市场，任务结束", Color.YELLOW))
            summary["end_time"] = time.time()
            return summary

        logger.info(
            color_text(
                f"[Manager] 启动批量采集，共{total_markets}个市场，并发{self._max_workers}",
                Color.BOLD + Color.CYAN,
            )
        )

        completed = list(progress["completed"])
        failed = list(progress["failed"])

        try:
            with ThreadPoolExecutor(max_workers=self._max_workers) as executor:
                future_map = {}
                for mid in market_ids:
                    f = executor.submit(self.crawl_one, mid, force)
                    future_map[f] = mid

                for f in as_completed(future_map):
                    mid = future_map[f]
                    try:
                        mr = f.result()
                        summary["per_market"].append(mr)
                        summary["total_records"] += mr["total"]
                        summary["total_success"] += mr["success"]
                        summary["total_duplicate"] += mr["duplicate"]
                        summary["total_unmapped"] += mr["unmapped"]
                        summary["total_alerts"] += mr["alerts"]
                        summary["total_errors"] += mr["errors"]

                        if mr["status"] in ("success", "skipped"):
                            if mid not in completed:
                                completed.append(mid)
                        else:
                            if mid not in failed:
                                failed.append(mid)

                        self.pipeline.db.save_progress(task_date, completed, failed, None)
                    except Exception as e:
                        logger.error(color_text(f"[Manager] 市场{mid}任务异常: {e}", Color.RED))
                        if mid not in failed:
                            failed.append(mid)
                        summary["total_errors"] += 1
        except KeyboardInterrupt:
            logger.warning(color_text("[Manager] 收到中断信号，正在保存进度...", Color.BG_YELLOW))
            self.pipeline.db.save_progress(task_date, completed, failed, None)
            raise

        summary["completed"] = completed
        summary["failed"] = failed
        summary["end_time"] = time.time()
        summary["duration_minutes"] = round((summary["end_time"] - start_time) / 60, 2)

        self.pipeline.flush_pending_alerts()
        self.pipeline.db.save_progress(task_date, completed, failed, None)

        success_count = len(completed)
        fail_count = len(failed)
        logger.info(
            color_text(
                f"\n{'='*60}\n"
                f"[Manager] 批量采集完成 | 日期: {task_date}\n"
                f"  市场总数: {total_markets} | 成功: {success_count} | 失败: {fail_count}\n"
                f"  记录: 成功{summary['total_success']} / 原始{summary['total_records']} | "
                f"重复{summary['total_duplicate']} | 未映射{summary['total_unmapped']} | 预警{summary['total_alerts']}\n"
                f"  耗时: {summary['duration_minutes']} 分钟\n"
                f"{'='*60}",
                Color.BOLD + (Color.BG_GREEN if fail_count == 0 else Color.BG_YELLOW),
            )
        )

        return summary

    def start_scheduler(self):
        """启动APScheduler后台调度"""
        if self._scheduler and self._scheduler.running:
            logger.warning("[Manager] 调度器已在运行")
            return

        from pytz import timezone
        tz = timezone(self.config["system"].get("timezone", "Asia/Shanghai"))

        self._scheduler = BackgroundScheduler(timezone=tz)

        daily_time = self.config["system"].get("daily_crawl_time", "07:00")
        hour, minute = map(int, daily_time.split(":"))
        self._scheduler.add_job(
            func=self._daily_crawl_job,
            trigger=CronTrigger(hour=hour, minute=minute, timezone=tz),
            id="daily_crawl",
            name="每日全量采集任务",
            replace_existing=True,
            misfire_grace_time=self.config["scheduler"]["misfire_grace_time"],
            coalesce=self.config["scheduler"]["coalesce"],
            max_instances=self.config["scheduler"]["max_instances"],
        )

        reload_minutes = self.config["system"].get("config_reload_interval_minutes", 5)
        self._scheduler.add_job(
            func=self.reload_config_if_needed,
            trigger=CronTrigger(minute=f"*/{reload_minutes}", timezone=tz),
            id="config_reload",
            name="配置热更新检测",
            replace_existing=True,
        )

        self._scheduler.start()
        logger.info(
            color_text(
                f"[Manager] 调度器已启动，每日{daily_time}执行全量采集，"
                f"每{reload_minutes}分钟检测配置更新",
                Color.BG_GREEN,
            )
        )

    def shutdown_scheduler(self):
        if self._scheduler and self._scheduler.running:
            self._scheduler.shutdown(wait=True)
            logger.info(color_text("[Manager] 调度器已关闭", Color.YELLOW))

    def _daily_crawl_job(self):
        logger.info(color_text("[Manager] === 定时任务触发：开始每日全量采集 ===", Color.BOLD))
        try:
            self.crawl_all(resume=True)
        except Exception as e:
            logger.error(color_text(f"[Manager] 每日全量采集异常: {e}", Color.BG_RED))

    def wait_forever(self):
        try:
            while not self._shutdown.is_set():
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info(color_text("[Manager] 收到退出信号", Color.YELLOW))
        finally:
            self.shutdown_scheduler()
            self._shutdown.set()
