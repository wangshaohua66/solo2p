import time
import random
import traceback
from abc import ABC, abstractmethod
from typing import Optional, Generator, Any
from datetime import datetime

from loguru import logger

from config.settings import Settings


class CircuitBreaker:
    def __init__(self, threshold: int = 5, reset_seconds: int = 600):
        self._threshold = threshold
        self._reset_seconds = reset_seconds
        self._failure_count = 0
        self._state = "closed"
        self._last_failure_time: Optional[float] = None

    @property
    def state(self) -> str:
        if self._state == "open":
            if self._last_failure_time and (
                time.time() - self._last_failure_time >= self._reset_seconds
            ):
                self._state = "half_open"
                logger.info("Circuit breaker: open -> half_open")
        return self._state

    def record_failure(self):
        self._failure_count += 1
        self._last_failure_time = time.time()
        if self._failure_count >= self._threshold:
            self._state = "open"
            logger.warning(
                f"Circuit breaker tripped: failures={self._failure_count}, threshold={self._threshold}"
            )

    def record_success(self):
        self._failure_count = 0
        self._state = "closed"

    def allow_request(self) -> bool:
        state = self.state
        if state == "closed":
            return True
        if state == "half_open":
            return True
        return False


class RetryPolicy:
    def __init__(
        self,
        max_retries: int = 3,
        backoff_base: float = 2.0,
        backoff_max: float = 300.0,
    ):
        self._max_retries = max_retries
        self._backoff_base = backoff_base
        self._backoff_max = backoff_max

    def get_delay(self, attempt: int) -> float:
        delay = min(
            self._backoff_base ** attempt + random.uniform(0, 1),
            self._backoff_max,
        )
        return delay

    @property
    def max_retries(self) -> int:
        return self._max_retries


class FailureRecord:
    def __init__(self, mysql_config: dict):
        self._mysql_config = mysql_config
        self._buffer: list = []
        self._flush_size = 50

    def record(
        self,
        channel_code: str,
        url: str,
        error_type: str,
        error_detail: str,
        attempt: int,
    ):
        entry = {
            "channel_code": channel_code,
            "url": url,
            "error_type": error_type,
            "error_detail": error_detail[:2000],
            "attempt": attempt,
            "created_at": datetime.now().isoformat(),
        }
        self._buffer.append(entry)
        if len(self._buffer) >= self._flush_size:
            self.flush()

    def flush(self):
        if not self._buffer:
            return
        try:
            import pymysql

            conn = pymysql.connect(
                host=self._mysql_config["host"],
                port=self._mysql_config["port"],
                user=self._mysql_config["user"],
                password=self._mysql_config.get("password", ""),
                database=self._mysql_config["database"],
                charset=self._mysql_config.get("charset", "utf8mb4"),
            )
            with conn.cursor() as cursor:
                sql = """INSERT INTO crawl_failures
                         (channel_code, url, error_type, error_detail, attempt, created_at)
                         VALUES (%(channel_code)s, %(url)s, %(error_type)s,
                                 %(error_detail)s, %(attempt)s, %(created_at)s)"""
                cursor.executemany(sql, self._buffer)
            conn.commit()
            conn.close()
            self._buffer.clear()
        except Exception as e:
            logger.error(f"Failed to persist failure records: {e}")
            for entry in self._buffer:
                logger.error(
                    f"Failure record: channel={entry['channel_code']}, "
                    f"url={entry['url']}, error={entry['error_type']}"
                )


class BaseSpider(ABC):
    name: str = "base"
    strategy: str = "base"

    def __init__(self, channel_config: dict, settings: Optional[Settings] = None):
        self._channel = channel_config
        self._settings = settings or Settings()
        self._channel_code = channel_config.get("code", "unknown")
        self._channel_type = channel_config.get("channel_type", "government")
        self._page_type = channel_config.get("type", "static")
        self._base_url = channel_config.get("base_url", "")
        self._parser = channel_config.get("parser", "html_list")
        self._circuit_breaker: Optional[CircuitBreaker] = None
        self._retry_policy: Optional[RetryPolicy] = None
        self._failure_recorder: Optional[FailureRecord] = None
        self._stats = {
            "collected": 0,
            "failed": 0,
            "duplicated": 0,
            "success_count": 0,
            "total_count": 0,
            "start_time": None,
            "end_time": None,
        }
        self._setup_retry_and_breaker()
        self._setup_failure_recorder()

    def _setup_retry_and_breaker(self):
        proxy_cfg = self._settings.get_proxy_config(self._channel_type)
        self._retry_policy = RetryPolicy(
            max_retries=proxy_cfg.get("retry_times", 3),
            backoff_base=proxy_cfg.get("backoff_base", 2.0),
            backoff_max=proxy_cfg.get("backoff_max", 300.0),
        )
        self._circuit_breaker = CircuitBreaker(
            threshold=proxy_cfg.get("circuit_breaker_threshold", 5),
            reset_seconds=proxy_cfg.get("circuit_breaker_reset_seconds", 600),
        )

    def _setup_failure_recorder(self):
        mysql_cfg = self._settings.get_mysql_config()
        if mysql_cfg:
            self._failure_recorder = FailureRecord(mysql_cfg)

    @abstractmethod
    def start(self, mode: str = "incremental") -> Generator[dict, None, None]:
        ...

    def collect(self, mode: str = "incremental") -> Generator[dict, None, None]:
        self._stats["start_time"] = datetime.now().isoformat()
        logger.info(f"Spider [{self._channel_code}] starting in {mode} mode, strategy={self.strategy}")
        try:
            for item in self.start(mode=mode):
                self._stats["collected"] += 1
                self._stats["total_count"] += 1
                self._stats["success_count"] += 1
                yield item
        except Exception as e:
            self._stats["failed"] += 1
            self._stats["total_count"] += 1
            logger.error(f"Spider [{self._channel_code}] crashed: {e}")
            logger.error(traceback.format_exc())
        finally:
            self._stats["end_time"] = datetime.now().isoformat()
            if self._failure_recorder:
                self._failure_recorder.flush()
            logger.info(
                f"Spider [{self._channel_code}] finished: "
                f"collected={self._stats['collected']}, "
                f"failed={self._stats['failed']}, "
                f"success_rate={self._stats['success_count']}/{self._stats['total_count']}"
            )

    @property
    def stats(self) -> dict:
        return dict(self._stats)

    @property
    def channel_code(self) -> str:
        return self._channel_code

    @property
    def channel_type(self) -> str:
        return self._channel_type

    @property
    def page_type(self) -> str:
        return self._page_type
