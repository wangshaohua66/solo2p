import time
import random
import threading
from typing import Optional
from datetime import datetime

import requests
from loguru import logger

from config.settings import Settings


class ProxyPool:
    def __init__(self, settings: Optional[Settings] = None):
        self._settings = settings or Settings()
        proxy_cfg = self._settings.get("proxy", {})
        self._pool_api = proxy_cfg.get("pool_api", "")
        self._min_alive = proxy_cfg.get("min_alive_count", 20)
        self._check_interval = proxy_cfg.get("check_interval_seconds", 60)
        self._max_fail = proxy_cfg.get("max_fail_count", 3)
        self._enabled = proxy_cfg.get("enabled", True)

        self._proxies: list = []
        self._proxy_stats: dict = {}
        self._lock = threading.RLock()
        self._last_fetch: float = 0
        self._fetch_interval: float = 30.0

        if self._enabled:
            self._fetch_proxies()

    def _fetch_proxies(self):
        if not self._pool_api:
            logger.debug("No proxy pool API configured, skipping proxy fetch")
            return

        now = time.time()
        if now - self._last_fetch < self._fetch_interval:
            return

        try:
            resp = requests.get(self._pool_api, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                raw_proxies = data if isinstance(data, list) else data.get("proxies", [])
                with self._lock:
                    for p in raw_proxies:
                        proxy_url = p if isinstance(p, str) else p.get("proxy", "")
                        if proxy_url and proxy_url not in self._proxy_stats:
                            self._proxies.append(proxy_url)
                            self._proxy_stats[proxy_url] = {
                                "fail_count": 0,
                                "success_count": 0,
                                "last_check": now,
                                "alive": True,
                            }
                self._last_fetch = now
                logger.info(f"Fetched {len(raw_proxies)} proxies, pool size={len(self._proxies)}")
        except Exception as e:
            logger.error(f"Failed to fetch proxies: {e}")

    def get_proxy(self) -> Optional[str]:
        if not self._enabled:
            return None

        with self._lock:
            alive = [p for p in self._proxies if self._proxy_stats.get(p, {}).get("alive", True)]
            if len(alive) < self._min_alive:
                pass

        self._fetch_proxies()

        with self._lock:
            alive = [p for p in self._proxies if self._proxy_stats.get(p, {}).get("alive", True)]
            if not alive:
                logger.warning("No alive proxies available")
                return None
            proxy = random.choice(alive)
            return proxy

    def report_success(self, proxy: str):
        with self._lock:
            if proxy in self._proxy_stats:
                self._proxy_stats[proxy]["success_count"] += 1
                self._proxy_stats[proxy]["fail_count"] = 0

    def report_failure(self, proxy: str):
        with self._lock:
            if proxy in self._proxy_stats:
                self._proxy_stats[proxy]["fail_count"] += 1
                if self._proxy_stats[proxy]["fail_count"] >= self._max_fail:
                    self._proxy_stats[proxy]["alive"] = False
                    logger.warning(f"Proxy marked dead: {proxy}")

    def check_health(self):
        with self._lock:
            for proxy, stats in self._proxy_stats.items():
                if not stats["alive"]:
                    continue
                try:
                    test_resp = requests.get(
                        "https://www.baidu.com",
                        proxies={"http": proxy, "https": proxy},
                        timeout=5,
                    )
                    if test_resp.status_code == 200:
                        stats["alive"] = True
                        stats["fail_count"] = 0
                    else:
                        stats["fail_count"] += 1
                        if stats["fail_count"] >= self._max_fail:
                            stats["alive"] = False
                except Exception:
                    stats["fail_count"] += 1
                    if stats["fail_count"] >= self._max_fail:
                        stats["alive"] = False
                stats["last_check"] = time.time()

        alive_count = sum(1 for s in self._proxy_stats.values() if s["alive"])
        total = len(self._proxy_stats)
        rate = alive_count / total if total > 0 else 0
        logger.info(f"Proxy pool health: {alive_count}/{total} alive ({rate:.1%})")

    @property
    def alive_count(self) -> int:
        with self._lock:
            return sum(1 for s in self._proxy_stats.values() if s["alive"])

    @property
    def survival_rate(self) -> float:
        total = len(self._proxy_stats)
        if total == 0:
            return 0.0
        return self.alive_count / total


class RateLimiter:
    def __init__(self, max_rpm: int = 20):
        self._max_rpm = max_rpm
        self._min_interval = 60.0 / max_rpm if max_rpm > 0 else 0
        self._lock = threading.Lock()
        self._last_request: float = 0
        self._request_count: int = 0
        self._window_start: float = time.time()

    def acquire(self):
        with self._lock:
            now = time.time()
            elapsed = now - self._last_request
            if elapsed < self._min_interval:
                sleep_time = self._min_interval - elapsed + random.uniform(0, 0.1)
                time.sleep(sleep_time)
            self._last_request = time.time()
            self._request_count += 1

            if now - self._window_start >= 60:
                self._request_count = 1
                self._window_start = now

    def adaptive_wait(self, response_status: int):
        if response_status == 429:
            wait = random.uniform(10, 30)
            logger.warning(f"Rate limited, adaptive wait: {wait:.1f}s")
            time.sleep(wait)
        elif response_status == 503:
            wait = random.uniform(5, 15)
            logger.warning(f"Service unavailable, adaptive wait: {wait:.1f}s")
            time.sleep(wait)

    @property
    def current_rpm(self) -> int:
        now = time.time()
        if now - self._window_start >= 60:
            return 0
        return self._request_count


class ProxyMiddleware:
    def __init__(self, settings: Optional[Settings] = None):
        self._settings = settings or Settings()
        self._pool = ProxyPool(settings)
        self._rate_limiters: dict = {}
        self._current_proxy: Optional[str] = None
        self._init_rate_limiters()

    def _init_rate_limiters(self):
        categories = self._settings.get("proxy.categories", {})
        for channel_type, cfg in categories.items():
            max_rpm = cfg.get("max_rpm", 20)
            self._rate_limiters[channel_type] = RateLimiter(max_rpm=max_rpm)

    def get_rate_limiter(self, channel_type: str) -> RateLimiter:
        if channel_type not in self._rate_limiters:
            self._rate_limiters[channel_type] = RateLimiter(max_rpm=20)
        return self._rate_limiters[channel_type]

    def before_request(self, channel_type: str) -> dict:
        limiter = self.get_rate_limiter(channel_type)
        limiter.acquire()

        proxy = self._pool.get_proxy()
        self._current_proxy = proxy

        result = {}
        if proxy:
            result["proxies"] = {"http": proxy, "https": proxy}

        return result

    def after_response(self, response_status: int, channel_type: str):
        if self._current_proxy:
            if response_status == 200:
                self._pool.report_success(self._current_proxy)
            else:
                self._pool.report_failure(self._current_proxy)

        limiter = self.get_rate_limiter(channel_type)
        limiter.adaptive_wait(response_status)

    def rotate_proxy(self) -> Optional[str]:
        old = self._current_proxy
        if old:
            self._pool.report_failure(old)
        new = self._pool.get_proxy()
        self._current_proxy = new
        if new:
            logger.info(f"Proxy rotated: {old} -> {new}")
        return new

    @property
    def pool_stats(self) -> dict:
        return {
            "alive_count": self._pool.alive_count,
            "survival_rate": f"{self._pool.survival_rate:.1%}",
            "current_proxy": self._current_proxy,
        }
