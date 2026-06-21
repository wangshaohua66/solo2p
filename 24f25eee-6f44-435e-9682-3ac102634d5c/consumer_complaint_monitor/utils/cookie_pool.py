import json
import time
import random
import threading
from pathlib import Path
from typing import Optional

import redis
from loguru import logger

from config.settings import Settings


class CookiePool:
    _instances = {}
    _lock = threading.Lock()

    @classmethod
    def get_instance(cls, channel_code: str, settings):
        with cls._lock:
            key = f"{channel_code}"
            if key not in cls._instances:
                cls._instances[key] = CookiePool(channel_code, settings)
            return cls._instances[key]

    def __init__(self, channel_code: str, settings: Optional[Settings] = None):
        self._channel_code = channel_code
        self._settings = settings or Settings()
        self._cookies: list = []
        self._selenium_cookies: list = []
        self._cookie_stats: dict = {}
        self._redis: Optional[redis.Redis] = None
        self._file_path = Path(__file__).resolve().parent.parent / "config" / ".cookies" / f"{channel_code}.json"
        self._init_storage()
        self._load_cookies()

    def _init_storage(self):
        redis_cfg = self._settings.get_redis_config()
        try:
            self._redis = redis.Redis(
                host=redis_cfg.get("host", "127.0.0.1"),
                port=redis_cfg.get("port", 6379),
                password=redis_cfg.get("password") or None,
                db=redis_cfg.get("queue_db", 2),
                decode_responses=True,
                socket_timeout=5,
            )
            self._redis.ping()
        except Exception:
            self._redis = None

    def _load_cookies(self):
        loaded = False

        if self._redis:
            try:
                redis_key = f"cookies:{self._channel_code}"
                raw = self._redis.get(redis_key)
                if raw:
                    data = json.loads(raw)
                    self._cookies = data.get("string_cookies", [])
                    self._selenium_cookies = data.get("selenium_cookies", [])
                    for c in self._cookies:
                        self._cookie_stats[c] = {"success": 0, "fail": 0}
                    loaded = True
                    logger.info(f"Loaded {len(self._cookies)} string cookies from Redis for {self._channel_code}")
            except Exception as e:
                logger.debug(f"Failed to load cookies from Redis: {e}")

        if not loaded and self._file_path.exists():
            try:
                with open(self._file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._cookies = data.get("string_cookies", [])
                self._selenium_cookies = data.get("selenium_cookies", [])
                for c in self._cookies:
                    self._cookie_stats[c] = {"success": 0, "fail": 0}
                loaded = True
                logger.info(f"Loaded {len(self._cookies)} cookies from file for {self._channel_code}")
            except Exception as e:
                logger.debug(f"Failed to load cookies from file: {e}")

        if not self._cookies and not self._selenium_cookies:
            logger.info(f"No pre-existing cookies for {self._channel_code}, pool will be populated during crawl")

    def _save_cookies(self):
        data = {
            "string_cookies": self._cookies,
            "selenium_cookies": self._selenium_cookies,
            "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }

        if self._redis:
            try:
                redis_key = f"cookies:{self._channel_code}"
                self._redis.setex(redis_key, 86400 * 7, json.dumps(data, ensure_ascii=False))
            except Exception as e:
                logger.debug(f"Failed to save cookies to Redis: {e}")

        try:
            self._file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self._file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.debug(f"Failed to save cookies to file: {e}")

    def get_cookie(self) -> Optional[str]:
        if not self._cookies:
            return None
        healthy = [c for c in self._cookies
                   if self._cookie_stats.get(c, {}).get("fail", 0) < 5]
        if not healthy:
            logger.warning(f"All cookies unhealthy for {self._channel_code}, resetting stats")
            for c in self._cookies:
                self._cookie_stats[c] = {"success": 0, "fail": 0}
            healthy = self._cookies
        return random.choice(healthy)

    def get_selenium_cookies(self) -> list:
        return list(self._selenium_cookies)

    def save_selenium_cookies(self, cookies: list):
        self._selenium_cookies = list(cookies)
        self._save_cookies()
        logger.info(f"Saved {len(cookies)} selenium cookies for {self._channel_code}")

    def add_cookie(self, cookie_str: str):
        if cookie_str and cookie_str not in self._cookies:
            self._cookies.append(cookie_str)
            self._cookie_stats[cookie_str] = {"success": 0, "fail": 0}
            self._save_cookies()
            logger.info(f"Added cookie to pool for {self._channel_code}, pool size={len(self._cookies)}")

    def add_cookies(self, cookies: list):
        for c in cookies:
            if c and c not in self._cookies:
                self._cookies.append(c)
                self._cookie_stats[c] = {"success": 0, "fail": 0}
        self._save_cookies()

    def report_success(self, cookie_str: Optional[str]):
        if not cookie_str or cookie_str not in self._cookie_stats:
            return
        self._cookie_stats[cookie_str]["success"] += 1

    def report_failure(self, cookie_str: Optional[str]):
        if not cookie_str:
            return
        if cookie_str not in self._cookie_stats:
            return
        self._cookie_stats[cookie_str]["fail"] += 1
        if self._cookie_stats[cookie_str]["fail"] >= 10:
            logger.warning(f"Removing dead cookie from pool for {self._channel_code}")
            if cookie_str in self._cookies:
                self._cookies.remove(cookie_str)
                del self._cookie_stats[cookie_str]
            self._save_cookies()

    @property
    def pool_size(self) -> int:
        return len(self._cookies)

    @property
    def is_empty(self) -> bool:
        return len(self._cookies) == 0 and len(self._selenium_cookies) == 0

    @property
    def stats(self) -> dict:
        return {
            "channel_code": self._channel_code,
            "string_cookies": len(self._cookies),
            "selenium_cookies": len(self._selenium_cookies),
            "pool_healthy": sum(1 for c in self._cookies if self._cookie_stats.get(c, {}).get("fail", 0) < 5),
        }
