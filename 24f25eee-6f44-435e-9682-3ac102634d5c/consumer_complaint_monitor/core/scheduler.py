import time
import json
import threading
from typing import Optional, Callable
from datetime import datetime

import redis
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from loguru import logger

from config.settings import Settings
from spiders.channel_spiders.government_spider import StaticScrapySpider
from spiders.channel_spiders.ecommerce_spider import DynamicSeleniumSpider
from spiders.channel_spiders.weixin_spider import WeixinArticleSpider
from pipelines.dedup_pipeline import DedupPipeline
from pipelines.classify_pipeline import ClassifyPipeline
from middlewares.proxy_middleware import ProxyMiddleware
from utils.memory_monitor import MemoryMonitor


_STRATEGY_MAP = {
    "static": StaticScrapySpider,
    "dynamic": DynamicSeleniumSpider,
    "weixin_article": WeixinArticleSpider,
}


class DistributedLock:
    def __init__(self, redis_client: redis.Redis, lock_key: str, timeout: int = 3600):
        self._redis = redis_client
        self._lock_key = f"lock:{lock_key}"
        self._timeout = timeout
        self._identifier = None

    def acquire(self, blocking: bool = True, polling_interval: float = 1.0) -> bool:
        identifier = f"{threading.current_thread().ident}:{time.time()}"
        start = time.time()
        while True:
            acquired = self._redis.set(self._lock_key, identifier, nx=True, ex=self._timeout)
            if acquired:
                self._identifier = identifier
                logger.debug(f"Lock acquired: {self._lock_key}")
                return True
            if not blocking:
                return False
            if time.time() - start > self._timeout:
                logger.warning(f"Lock acquire timeout: {self._lock_key}")
                return False
            time.sleep(polling_interval)

    def release(self):
        if self._identifier:
            current = self._redis.get(self._lock_key)
            if current and current.decode() == self._identifier:
                self._redis.delete(self._lock_key)
                logger.debug(f"Lock released: {self._lock_key}")
            self._identifier = None

    def __enter__(self):
        self.acquire()
        return self

    def __exit__(self, *args):
        self.release()


class TaskScheduler:
    def __init__(self, settings: Optional[Settings] = None):
        self._settings = settings or Settings()
        self._scheduler = BackgroundScheduler(
            job_defaults={
                "coalesce": True,
                "max_instances": 1,
                "misfire_grace_time": 300,
            }
        )
        self._redis: Optional[redis.Redis] = None
        self._dedup: Optional[DedupPipeline] = None
        self._classify: Optional[ClassifyPipeline] = None
        self._proxy_middleware: Optional[ProxyMiddleware] = None
        self._mem_monitor: Optional[MemoryMonitor] = None
        self._running = False
        self._stats = {
            "total_collected": 0,
            "total_deduplicated": 0,
            "total_classified": 0,
            "risk_events": {"urgent": 0, "warning": 0, "attention": 0, "general": 0},
            "channel_stats": {},
            "last_run": None,
        }
        self._stats_lock = threading.Lock()
        self._init_components()

    def _init_components(self):
        redis_cfg = self._settings.get_redis_config()
        try:
            self._redis = redis.Redis(
                host=redis_cfg.get("host", "127.0.0.1"),
                port=redis_cfg.get("port", 6379),
                password=redis_cfg.get("password") or None,
                db=redis_cfg.get("db", 0),
                decode_responses=True,
            )
            self._redis.ping()
            logger.info("Scheduler: Redis connected")
        except Exception as e:
            logger.error(f"Scheduler: Redis connection failed: {e}")
            self._redis = None

        try:
            self._dedup = DedupPipeline(self._settings)
        except Exception as e:
            logger.error(f"DedupPipeline init failed: {e}")
            self._dedup = None

        try:
            self._classify = ClassifyPipeline(self._settings)
        except Exception as e:
            logger.error(f"ClassifyPipeline init failed: {e}")
            self._classify = None

        try:
            self._proxy_middleware = ProxyMiddleware(self._settings)
        except Exception as e:
            logger.error(f"ProxyMiddleware init failed: {e}")
            self._proxy_middleware = None

        try:
            self._mem_monitor = MemoryMonitor(self._settings)
        except Exception as e:
            logger.error(f"MemoryMonitor init failed: {e}")
            self._mem_monitor = None

    def _get_spider(self, channel_config: dict):
        page_type = channel_config.get("type", "static")
        spider_cls = _STRATEGY_MAP.get(page_type)
        if not spider_cls:
            logger.error(f"No spider strategy for page type: {page_type}")
            return None
        logger.info(f"Selected strategy '{page_type}' -> {spider_cls.__name__} for channel {channel_config.get('code')}")
        return spider_cls(channel_config, self._settings)

    def _run_channel(self, channel_config: dict, mode: str = "incremental"):
        channel_code = channel_config.get("code", "unknown")
        lock = None
        if self._redis:
            lock = DistributedLock(self._redis, f"channel:{channel_code}", timeout=3600)
            if not lock.acquire(blocking=False):
                logger.info(f"Channel {channel_code} is already being processed by another instance")
                return

        try:
            spider = self._get_spider(channel_config)
            if not spider:
                return

            logger.info(f"Starting channel: {channel_code} (mode={mode}, type={channel_config.get('type')})")
            collected = 0
            deduped = 0
            classified = 0

            for item in spider.collect(mode=mode):
                if self._dedup:
                    dedup_result = self._dedup.process(item)
                    if dedup_result is None:
                        deduped += 1
                        continue
                    item = dedup_result

                if self._classify:
                    item = self._classify.process(item)

                self._enqueue_complaint(item)
                self._persist_item(item)
                classified += 1
                collected += 1

                self._update_stats(item, channel_code)

                if item.get("risk_level") in ("urgent", "warning"):
                    self._handle_risk_event(item)

                if self._mem_monitor:
                    self._mem_monitor.check_and_gc()

            spider_stats = spider.stats
            with self._stats_lock:
                self._stats["channel_stats"][channel_code] = {
                    "collected": collected,
                    "deduped": deduped,
                    "classified": classified,
                    "success_count": spider_stats.get("success_count", collected),
                    "total_count": spider_stats.get("total_count", collected),
                    "success_rate": round(
                        spider_stats.get("success_count", collected) / max(spider_stats.get("total_count", collected), 1), 4
                    ),
                    "last_run": datetime.now().isoformat(),
                }

            logger.info(
                f"Channel {channel_code} finished: collected={collected}, deduped={deduped}"
            )

        except Exception as e:
            logger.error(f"Error running channel {channel_code}: {e}")
        finally:
            if lock:
                lock.release()

    def _enqueue_complaint(self, item: dict):
        if not self._redis:
            return
        queue_key = "queue:complaints:new"
        try:
            self._redis.rpush(queue_key, json.dumps(item, ensure_ascii=False))
        except Exception as e:
            logger.error(f"Failed to enqueue complaint: {e}")

    def _persist_item(self, item: dict):
        try:
            import pymysql

            mysql_cfg = self._settings.get_mysql_config()
            conn = pymysql.connect(
                host=mysql_cfg["host"],
                port=mysql_cfg["port"],
                user=mysql_cfg["user"],
                password=mysql_cfg.get("password", ""),
                database=mysql_cfg["database"],
                charset=mysql_cfg.get("charset", "utf8mb4"),
            )
            with conn.cursor() as cursor:
                sql = """INSERT INTO complaints
                         (title, content, publish_date, detail_url, channel_code,
                          channel_type, source_name, category, risk_level, keywords,
                          companies, products, account_id, collected_at)
                         VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                         ON DUPLICATE KEY UPDATE updated_at=NOW()"""
                cursor.execute(
                    sql,
                    (
                        item.get("title", ""),
                        item.get("content", ""),
                        item.get("publish_date", ""),
                        item.get("detail_url", ""),
                        item.get("channel_code", ""),
                        item.get("channel_type", ""),
                        item.get("source_name", ""),
                        item.get("category", "其他"),
                        item.get("risk_level", "general"),
                        ",".join(item.get("keywords", [])),
                        ",".join(item.get("companies", [])),
                        ",".join(item.get("products", [])),
                        item.get("account_id", ""),
                        item.get("collected_at", ""),
                    ),
                )
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Failed to persist item: {e}")
            self._enqueue_for_retry(item)

    def _enqueue_for_retry(self, item: dict):
        if not self._redis:
            return
        queue_key = "queue:persist_retry"
        try:
            self._redis.rpush(queue_key, json.dumps(item, ensure_ascii=False))
        except Exception as e:
            logger.error(f"Failed to enqueue retry item: {e}")

    def _update_stats(self, item: dict, channel_code: str):
        with self._stats_lock:
            self._stats["total_collected"] += 1
            risk = item.get("risk_level", "general")
            if risk in self._stats["risk_events"]:
                self._stats["risk_events"][risk] += 1
            self._stats["last_run"] = datetime.now().isoformat()

            if self._redis:
                try:
                    today = datetime.now().strftime("%Y-%m-%d")
                    self._redis.hincrby(f"stats:daily:{today}", "total", 1)
                    self._redis.hincrby(f"stats:daily:{today}", f"channel:{channel_code}", 1)
                    self._redis.hincrby(f"stats:daily:{today}", f"risk:{risk}", 1)
                    self._redis.hincrby(f"stats:daily:{today}", f"success:{channel_code}", 1)
                    self._redis.hincrby(f"stats:daily:{today}", f"total_req:{channel_code}", 1)
                    self._redis.expire(f"stats:daily:{today}", 86400 * 7)
                except Exception:
                    pass

    def _handle_risk_event(self, item: dict):
        try:
            from utils.notify import Notifier

            notifier = Notifier(self._settings)
            risk_level = item.get("risk_level", "general")
            if risk_level == "urgent":
                notifier.send_urgent_alert(item)
            elif risk_level == "warning":
                notifier.send_warning_alert(item)
        except Exception as e:
            logger.error(f"Failed to handle risk event: {e}")

    def add_channel_job(self, channel_config: dict, mode: str = "incremental"):
        channel_code = channel_config.get("code", "unknown")
        cron = channel_config.get("schedule_cron", "*/30 * * * *")
        job_id = f"channel_{channel_code}"

        parts = cron.split()
        trigger = CronTrigger(
            minute=parts[0] if len(parts) > 0 else "*",
            hour=parts[1] if len(parts) > 1 else "*",
            day=parts[2] if len(parts) > 2 else "*",
            month=parts[3] if len(parts) > 3 else "*",
            day_of_week=parts[4] if len(parts) > 4 else "*",
        )

        self._scheduler.add_job(
            self._run_channel,
            trigger=trigger,
            id=job_id,
            args=[channel_config, mode],
            replace_existing=True,
        )
        logger.info(f"Added scheduled job: {job_id} with cron={cron}")

    def run_once(self, channel_codes: Optional[list] = None, mode: str = "incremental"):
        channels = self._settings.get_enabled_channels()
        if channel_codes:
            channels = [ch for ch in channels if ch.get("code") in channel_codes]

        logger.info(f"Running {len(channels)} channels in {mode} mode")
        threads = []
        for ch in channels:
            t = threading.Thread(
                target=self._run_channel,
                args=(ch, mode),
                name=f"spider-{ch.get('code', 'unknown')}",
            )
            t.daemon = True
            t.start()
            threads.append(t)

        for t in threads:
            t.join(timeout=600)

        logger.info(f"Run completed. Stats: {self._stats}")

    def start_scheduler(self, channel_codes: Optional[list] = None):
        channels = self._settings.get_enabled_channels()
        if channel_codes:
            channels = [ch for ch in channels if ch.get("code") in channel_codes]

        for ch in channels:
            self.add_channel_job(ch)

        if self._proxy_middleware:
            self._scheduler.add_job(
                self._proxy_middleware._pool.check_health,
                IntervalTrigger(minutes=5),
                id="proxy_health_check",
                replace_existing=True,
            )

        self._scheduler.add_job(
            self._process_retry_queue,
            IntervalTrigger(minutes=10),
            id="retry_queue_processor",
            replace_existing=True,
        )

        self._scheduler.add_job(
            self._process_complaint_queue,
            IntervalTrigger(seconds=30),
            id="complaint_queue_processor",
            replace_existing=True,
        )

        if self._mem_monitor:
            self._scheduler.add_job(
                self._mem_monitor.check_and_gc,
                IntervalTrigger(minutes=5),
                id="memory_monitor",
                replace_existing=True,
            )

        self._scheduler.start()
        self._running = True
        logger.info("Scheduler started")

    def _process_retry_queue(self):
        if not self._redis:
            return
        queue_key = "queue:persist_retry"
        batch_size = 100
        for _ in range(batch_size):
            raw = self._redis.lpop(queue_key)
            if not raw:
                break
            try:
                item = json.loads(raw)
                self._persist_item(item)
            except Exception as e:
                logger.error(f"Retry persist failed: {e}")
                self._redis.rpush(queue_key, raw)

    def _process_complaint_queue(self):
        if not self._redis:
            return
        queue_key = "queue:complaints:new"
        batch_size = 200
        processed = 0
        for _ in range(batch_size):
            raw = self._redis.lpop(queue_key)
            if not raw:
                break
            processed += 1
        if processed > 0:
            logger.debug(f"Processed {processed} items from complaint queue")

    def stop_scheduler(self):
        if self._running:
            self._scheduler.shutdown(wait=True)
            self._running = False
            logger.info("Scheduler stopped")

    @property
    def stats(self) -> dict:
        with self._stats_lock:
            return dict(self._stats)

    def get_today_stats(self) -> dict:
        if not self._redis:
            return self.stats
        today = datetime.now().strftime("%Y-%m-%d")
        try:
            data = self._redis.hgetall(f"stats:daily:{today}")
            by_channel = {}
            by_channel_success = {}
            by_channel_total = {}

            for k, v in data.items():
                if k.startswith("channel:"):
                    code = k.replace("channel:", "")
                    by_channel[code] = int(v)
                elif k.startswith("success:"):
                    code = k.replace("success:", "")
                    by_channel_success[code] = int(v)
                elif k.startswith("total_req:"):
                    code = k.replace("total_req:", "")
                    by_channel_total[code] = int(v)

            channel_success_rates = {}
            all_codes = set(list(by_channel.keys()) + list(by_channel_success.keys()))
            for code in all_codes:
                success = by_channel_success.get(code, 0)
                total = by_channel_total.get(code, max(by_channel.get(code, 1), 1))
                channel_success_rates[code] = {
                    "success_count": success,
                    "total_count": total,
                    "success_rate": round(success / max(total, 1), 4),
                }

            return {
                "date": today,
                "total": int(data.get("total", 0)),
                "by_channel": by_channel,
                "by_risk": {
                    k.replace("risk:", ""): int(v)
                    for k, v in data.items()
                    if k.startswith("risk:")
                },
                "channel_success_rates": channel_success_rates,
                "memory": self._mem_monitor.stats if self._mem_monitor else {},
            }
        except Exception:
            return self.stats

    @property
    def is_running(self) -> bool:
        return self._running
