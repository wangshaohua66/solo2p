import random
import threading
import time
from typing import List, Optional, Dict
from urllib.parse import urlparse

import requests

from utils.logger import CrawlLogger


class ProxyManager:
    def __init__(self, proxy_list: List[str] = None, check_url: str = 'https://httpbin.org/ip',
                 check_interval: int = 300, max_failures: int = 5):
        self.proxy_list = proxy_list or []
        self.check_url = check_url
        self.check_interval = check_interval
        self.max_failures = max_failures
        self.failure_counts: Dict[str, int] = {}
        self.last_used: Dict[str, float] = {}
        self.disabled_proxies: set = set()
        self._lock = threading.Lock()
        self._current_index = 0
        self.logger = CrawlLogger().get_logger('ProxyManager')
        self._last_check_time = 0

        if self.proxy_list:
            for p in self.proxy_list:
                self.failure_counts[p] = 0
                self.last_used[p] = 0

    def add_proxy(self, proxy: str):
        with self._lock:
            if proxy not in self.proxy_list:
                self.proxy_list.append(proxy)
                self.failure_counts[proxy] = 0
                self.last_used[proxy] = 0
                self.disabled_proxies.discard(proxy)
                self.logger.debug(f'Added proxy: {proxy}')

    def remove_proxy(self, proxy: str):
        with self._lock:
            if proxy in self.proxy_list:
                self.proxy_list.remove(proxy)
                self.disabled_proxies.add(proxy)
                self.logger.debug(f'Removed proxy: {proxy}')

    def get_proxy(self, strategy: str = 'round_robin') -> Optional[Dict[str, str]]:
        with self._lock:
            active_proxies = [p for p in self.proxy_list if p not in self.disabled_proxies]
            if not active_proxies:
                return None

            if strategy == 'random':
                proxy = random.choice(active_proxies)
            elif strategy == 'least_used':
                proxy = min(active_proxies, key=lambda p: self.last_used.get(p, 0))
            else:
                proxy = active_proxies[self._current_index % len(active_proxies)]
                self._current_index += 1

            self.last_used[proxy] = time.time()
            return self._format_proxy(proxy)

    def _format_proxy(self, proxy: str) -> Dict[str, str]:
        parsed = urlparse(proxy)
        if parsed.scheme:
            return {
                'http': proxy,
                'https': proxy
            }
        return {
            'http': f'http://{proxy}',
            'https': f'http://{proxy}'
        }

    def report_failure(self, proxy_url: str):
        with self._lock:
            proxy = self._extract_proxy_key(proxy_url)
            if proxy in self.failure_counts:
                self.failure_counts[proxy] += 1
                if self.failure_counts[proxy] >= self.max_failures:
                    self.disabled_proxies.add(proxy)
                    self.logger.warning(
                        f'Proxy disabled due to {self.max_failures} failures: {proxy}'
                    )

    def report_success(self, proxy_url: str):
        with self._lock:
            proxy = self._extract_proxy_key(proxy_url)
            if proxy in self.failure_counts:
                self.failure_counts[proxy] = max(0, self.failure_counts[proxy] - 1)

    def _extract_proxy_key(self, proxy_url: str) -> str:
        if proxy_url.startswith('http://') or proxy_url.startswith('https://'):
            return proxy_url
        for p in self.proxy_list:
            if proxy_url in p or p in proxy_url:
                return p
        return proxy_url

    def check_proxies(self) -> Dict[str, bool]:
        self.logger.info('Checking proxy availability...')
        results = {}
        proxies_copy = list(self.proxy_list)

        for proxy in proxies_copy:
            results[proxy] = self._check_single_proxy(proxy)
            if results[proxy]:
                with self._lock:
                    self.disabled_proxies.discard(proxy)
                    self.failure_counts[proxy] = 0
                    self.logger.debug(f'Proxy OK: {proxy}')
            else:
                with self._lock:
                    self.disabled_proxies.add(proxy)
                    self.logger.warning(f'Proxy FAILED: {proxy}')

        self._last_check_time = time.time()
        self.logger.info(
            f'Proxy check complete: {sum(results.values())}/{len(results)} available'
        )
        return results

    def _check_single_proxy(self, proxy: str, timeout: int = 10) -> bool:
        try:
            proxies = self._format_proxy(proxy)
            response = requests.get(self.check_url, proxies=proxies, timeout=timeout)
            return response.status_code == 200
        except Exception:
            return False

    def periodic_check(self):
        now = time.time()
        if now - self._last_check_time >= self.check_interval:
            self.check_proxies()

    def get_stats(self) -> Dict:
        with self._lock:
            active = [p for p in self.proxy_list if p not in self.disabled_proxies]
            return {
                'total': len(self.proxy_list),
                'active': len(active),
                'disabled': len(self.disabled_proxies),
                'failure_counts': dict(self.failure_counts)
            }

    def load_from_file(self, filepath: str):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    proxy = line.strip()
                    if proxy and not proxy.startswith('#'):
                        self.add_proxy(proxy)
            self.logger.info(f'Loaded {len(self.proxy_list)} proxies from {filepath}')
        except Exception as e:
            self.logger.error(f'Failed to load proxies from {filepath}: {e}')
