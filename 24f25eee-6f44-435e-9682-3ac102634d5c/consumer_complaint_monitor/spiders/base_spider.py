import time
import random
import json
import traceback
from abc import ABC, abstractmethod
from typing import Optional, Generator, Any
from datetime import datetime

import requests
from fake_useragent import UserAgent
from loguru import logger

from config.settings import Settings


_ua = UserAgent()


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

    def __init__(self, channel_config: dict, settings: Optional[Settings] = None):
        self._channel = channel_config
        self._settings = settings or Settings()
        self._channel_code = channel_config.get("code", "unknown")
        self._channel_type = channel_config.get("channel_type", "government")
        self._base_url = channel_config.get("base_url", "")
        self._parser = channel_config.get("parser", "html_list")
        self._session = requests.Session()
        self._cookies: list = []
        self._circuit_breaker: Optional[CircuitBreaker] = None
        self._retry_policy: Optional[RetryPolicy] = None
        self._failure_recorder: Optional[FailureRecord] = None
        self._stats = {
            "collected": 0,
            "failed": 0,
            "duplicated": 0,
            "start_time": None,
            "end_time": None,
        }
        self._setup_anti_crawl()
        self._setup_retry_and_breaker()
        self._setup_failure_recorder()

    def _setup_anti_crawl(self):
        self._session.headers.update(
            {
                "User-Agent": _ua.random,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
                "Cache-Control": "max-age=0",
            }
        )
        referer = self._channel.get("base_url", "")
        if referer:
            self._session.headers["Referer"] = referer

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

    def _randomize_headers(self):
        self._session.headers["User-Agent"] = _ua.random
        if random.random() > 0.5:
            self._session.headers["DNT"] = "1"
        if random.random() > 0.7:
            self._session.headers["Upgrade-Insecure-Requests"] = "1"
        accept_versions = [
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
        ]
        self._session.headers["Accept"] = random.choice(accept_versions)

    def _set_cookie(self, cookie_str: str):
        if cookie_str:
            self._session.headers["Cookie"] = cookie_str

    def _rotate_cookie(self):
        if self._cookies:
            cookie = random.choice(self._cookies)
            self._session.headers["Cookie"] = cookie

    def _add_cookies(self, cookies: list):
        self._cookies.extend(cookies)

    def request_with_retry(
        self,
        url: str,
        method: str = "GET",
        **kwargs,
    ) -> Optional[requests.Response]:
        if not self._circuit_breaker.allow_request():
            logger.warning(f"Circuit breaker OPEN for {self._channel_code}, skipping: {url}")
            return None

        last_exception = None
        for attempt in range(self._retry_policy.max_retries + 1):
            try:
                self._randomize_headers()
                self._rotate_cookie()
                proxy_cfg = self._settings.get_proxy_config(self._channel_type)
                kwargs.setdefault("timeout", proxy_cfg.get("timeout_seconds", 30))
                kwargs.setdefault("allow_redirects", True)

                response = self._session.request(method, url, **kwargs)

                if response.status_code == 200:
                    self._circuit_breaker.record_success()
                    return response
                elif response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    logger.warning(
                        f"Rate limited (429) on {url}, retry after {retry_after}s"
                    )
                    time.sleep(retry_after + random.uniform(1, 5))
                elif response.status_code in (403, 503):
                    logger.warning(
                        f"Blocked ({response.status_code}) on {url}, rotating proxy"
                    )
                    self._handle_block(response)
                    if attempt < self._retry_policy.max_retries:
                        delay = self._retry_policy.get_delay(attempt)
                        logger.info(f"Retrying in {delay:.1f}s (attempt {attempt + 1})")
                        time.sleep(delay)
                elif response.status_code == 404:
                    logger.debug(f"Page not found: {url}")
                    return None
                else:
                    logger.warning(
                        f"HTTP {response.status_code} on {url}"
                    )
                    if attempt < self._retry_policy.max_retries:
                        delay = self._retry_policy.get_delay(attempt)
                        time.sleep(delay)

            except requests.exceptions.Timeout:
                last_exception = "timeout"
                logger.warning(f"Timeout on {url} (attempt {attempt + 1})")
            except requests.exceptions.ConnectionError as e:
                last_exception = f"connection_error: {str(e)[:200]}"
                logger.warning(f"Connection error on {url} (attempt {attempt + 1})")
            except Exception as e:
                last_exception = f"unexpected: {str(e)[:200]}"
                logger.error(f"Unexpected error on {url}: {e}")

            if attempt < self._retry_policy.max_retries:
                delay = self._retry_policy.get_delay(attempt)
                logger.info(f"Retrying in {delay:.1f}s (attempt {attempt + 1})")
                time.sleep(delay)

        self._circuit_breaker.record_failure()
        if self._failure_recorder:
            self._failure_recorder.record(
                channel_code=self._channel_code,
                url=url,
                error_type=last_exception or "max_retries_exceeded",
                error_detail=traceback.format_exc()[:2000],
                attempt=self._retry_policy.max_retries,
            )
        self._stats["failed"] += 1
        logger.error(f"All retries exhausted for {url}")
        return None

    def _handle_block(self, response: requests.Response):
        logger.warning(
            f"Block detected on {self._channel_code}, status={response.status_code}"
        )
        self._randomize_headers()

    @abstractmethod
    def parse_list(self, response: requests.Response) -> Generator[dict, None, None]:
        ...

    @abstractmethod
    def parse_detail(self, response: requests.Response, item: dict) -> dict:
        ...

    @abstractmethod
    def start(self, mode: str = "incremental") -> Generator[dict, None, None]:
        ...

    def collect(self, mode: str = "incremental") -> Generator[dict, None, None]:
        self._stats["start_time"] = datetime.now().isoformat()
        logger.info(f"Spider [{self._channel_code}] starting in {mode} mode")
        try:
            for item in self.start(mode=mode):
                self._stats["collected"] += 1
                yield item
        except Exception as e:
            logger.error(f"Spider [{self._channel_code}] crashed: {e}")
            logger.error(traceback.format_exc())
        finally:
            self._stats["end_time"] = datetime.now().isoformat()
            if self._failure_recorder:
                self._failure_recorder.flush()
            logger.info(
                f"Spider [{self._channel_code}] finished: "
                f"collected={self._stats['collected']}, "
                f"failed={self._stats['failed']}"
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
