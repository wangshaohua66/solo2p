import time
import threading
import random
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Any

import scrapy
from scrapy import signals

from utils.logger import CrawlLogger
from utils.config_loader import ConfigLoader
from utils.proxy_manager import ProxyManager


class CookiePoolManager:
    def __init__(self, config: ConfigLoader):
        self.config = config
        self.logger = CrawlLogger().get_logger('CookiePoolManager')
        self._lock = threading.Lock()
        self._cookies: Dict[str, List[Dict[str, Any]]] = {}
        self._cookie_meta: Dict[str, List[Dict[str, Any]]] = {}
        self._enabled = config.get('crawl.cookie_pool_enabled', False)
        self._validation_interval = config.get('crawl.cookie_validation_interval', 1800)
        self._last_validation_time: Dict[str, float] = {}

        if self._enabled:
            self._init_sources()
            self._load_cookies()
            self._load_cookie_meta()

    def _init_sources(self):
        for source in self.config.get_enabled_sources():
            source_cfg = self.config.get_source_config(source)
            if source_cfg.get('login_required') or source_cfg.get('ip_auth_required'):
                self._cookies[source] = []
                self._cookie_meta[source] = []
                self._last_validation_time[source] = 0

    def _load_cookies(self):
        cookie_file = self.config.get('storage.cookie_file', 'config/cookies.yaml')
        try:
            import yaml
            if os.path.exists(cookie_file):
                with open(cookie_file, 'r', encoding='utf-8') as f:
                    cookies_data = yaml.safe_load(f) or {}
                for source, cookies in cookies_data.items():
                    if isinstance(cookies, list) and source in self._cookies:
                        with self._lock:
                            self._cookies[source] = cookies
                            self._cookie_meta[source] = [
                                {
                                    'added_at': time.time(),
                                    'last_used': 0,
                                    'use_count': 0,
                                    'fail_count': 0,
                                    'status': 'active'
                                } for _ in cookies
                            ]
                self.logger.info(
                    f'Loaded cookies from {cookie_file}: '
                    f'{sum(len(v) for v in self._cookies.values())} total'
                )
        except Exception as e:
            self.logger.warning(f'Failed to load cookies from file: {e}')

    def _load_cookie_meta(self):
        meta_file = self.config.get('storage.cookie_meta_file', 'output/cookie_meta.json')
        try:
            if os.path.exists(meta_file):
                with open(meta_file, 'r', encoding='utf-8') as f:
                    saved_meta = json.load(f)
                with self._lock:
                    for source, meta_list in saved_meta.items():
                        if source in self._cookie_meta:
                            for i, meta in enumerate(meta_list):
                                if i < len(self._cookie_meta[source]):
                                    self._cookie_meta[source][i].update(meta)
        except Exception as e:
            self.logger.debug(f'No cookie meta file loaded: {e}')

    def _save_cookie_meta(self):
        meta_file = self.config.get('storage.cookie_meta_file', 'output/cookie_meta.json')
        try:
            os.makedirs(os.path.dirname(meta_file), exist_ok=True)
            with open(meta_file, 'w', encoding='utf-8') as f:
                json.dump(self._cookie_meta, f, ensure_ascii=False, indent=2, default=str)
        except Exception as e:
            self.logger.warning(f'Failed to save cookie meta: {e}')

    def is_enabled(self) -> bool:
        return self._enabled

    def add_cookie(self, source: str, cookies: dict, validate: bool = True) -> bool:
        if source not in self._cookies:
            self._cookies[source] = []
            self._cookie_meta[source] = []
            self._last_validation_time[source] = 0

        with self._lock:
            if self._is_duplicate(source, cookies):
                self.logger.debug(f'Duplicate cookie skipped for {source}')
                return False

            self._cookies[source].append(cookies)
            self._cookie_meta[source].append({
                'added_at': time.time(),
                'last_used': 0,
                'use_count': 0,
                'fail_count': 0,
                'status': 'pending' if validate else 'active',
                'expires_at': self._extract_expiry(cookies),
            })
            self.logger.info(f'Cookie added for {source} (total: {len(self._cookies[source])})')

        if validate:
            threading.Thread(target=self._validate_single, args=(source, len(self._cookies[source]) - 1), daemon=True).start()

        return True

    def remove_cookie(self, source: str, index: int) -> bool:
        with self._lock:
            if source in self._cookies and 0 <= index < len(self._cookies[source]):
                removed = self._cookies[source].pop(index)
                self._cookie_meta[source].pop(index)
                self.logger.info(f'Cookie {index} removed for {source}, remaining: {len(self._cookies[source])}')
                return True
        return False

    def remove_invalid_cookies(self, source: str) -> int:
        removed_count = 0
        with self._lock:
            if source not in self._cookie_meta:
                return 0
            indices_to_remove = []
            for i, meta in enumerate(self._cookie_meta[source]):
                if meta.get('status') in ('expired', 'banned', 'invalid'):
                    indices_to_remove.append(i)
            for i in reversed(indices_to_remove):
                self._cookies[source].pop(i)
                self._cookie_meta[source].pop(i)
                removed_count += 1
        if removed_count > 0:
            self.logger.info(f'Removed {removed_count} invalid cookies for {source}')
        return removed_count

    def get_cookie(self, source: str, strategy: str = 'least_used') -> Optional[dict]:
        if source not in self._cookies:
            return None

        with self._lock:
            candidates = [
                (i, c, m) for i, (c, m) in enumerate(
                    zip(self._cookies[source], self._cookie_meta[source])
                ) if m.get('status') == 'active'
            ]

            if not candidates:
                return None

            if strategy == 'random':
                idx, cookies, meta = random.choice(candidates)
            elif strategy == 'round_robin':
                idx = (getattr(self, f'_rr_{source}', 0)) % len(candidates)
                setattr(self, f'_rr_{source}', idx + 1)
                _, cookies, meta = candidates[idx]
            elif strategy == 'least_used':
                idx, cookies, meta = min(candidates, key=lambda x: x[2].get('use_count', 0))
            elif strategy == 'fresh':
                idx, cookies, meta = min(candidates, key=lambda x: x[2].get('last_used', 0))
            else:
                idx, cookies, meta = random.choice(candidates)

            meta['last_used'] = time.time()
            meta['use_count'] = meta.get('use_count', 0) + 1

        return dict(cookies)

    def report_success(self, source: str, cookies: dict):
        self._update_cookie_status(source, cookies, success=True)

    def report_failure(self, source: str, cookies: dict, reason: str = 'auth_failed'):
        self._update_cookie_status(source, cookies, success=False, reason=reason)

    def _update_cookie_status(self, source: str, cookies: dict, success: bool, reason: str = ''):
        with self._lock:
            if source not in self._cookies:
                return
            for i, c in enumerate(self._cookies[source]):
                if self._cookies_equal(c, cookies):
                    meta = self._cookie_meta[source][i]
                    if success:
                        meta['fail_count'] = max(0, meta.get('fail_count', 0) - 1)
                        meta['status'] = 'active'
                    else:
                        meta['fail_count'] = meta.get('fail_count', 0) + 1
                        max_failures = self.config.get('crawl.cookie_max_failures', 5)
                        if meta['fail_count'] >= max_failures:
                            meta['status'] = 'banned' if reason == 'auth_failed' else 'invalid'
                            self.logger.warning(
                                f'Cookie {i} for {source} marked as {meta["status"]} '
                                f'after {meta["fail_count"]} failures (reason: {reason})'
                            )
                    break
            self._save_cookie_meta()

    def validate_all(self, source: str = None) -> Dict[str, int]:
        results = {}
        sources = [source] if source else list(self._cookies.keys())
        for src in sources:
            valid = 0
            invalid = 0
            with self._lock:
                for i, meta in enumerate(self._cookie_meta.get(src, [])):
                    if self._validate_cookie_meta(src, i, meta):
                        valid += 1
                    else:
                        invalid += 1
            results[src] = {'valid': valid, 'invalid': invalid}
            self._last_validation_time[src] = time.time()
            self.logger.info(f'Cookie validation for {src}: {valid} valid, {invalid} invalid')
            self.remove_invalid_cookies(src)
        return results

    def _validate_single(self, source: str, index: int):
        try:
            if source not in self._cookie_meta or index >= len(self._cookie_meta[source]):
                return
            meta = self._cookie_meta[source][index]
            if self._validate_cookie_meta(source, index, meta):
                meta['status'] = 'active'
            else:
                meta['status'] = 'invalid'
            self._save_cookie_meta()
        except Exception as e:
            self.logger.error(f'Cookie validation error: {e}')

    def _validate_cookie_meta(self, source: str, index: int, meta: dict) -> bool:
        if meta.get('expires_at'):
            try:
                expires = float(meta['expires_at'])
                if time.time() > expires:
                    meta['status'] = 'expired'
                    return False
            except (ValueError, TypeError):
                pass

        max_age = self.config.get('crawl.cookie_max_age_hours', 72)
        added = meta.get('added_at', 0)
        if added and (time.time() - added) > max_age * 3600:
            meta['status'] = 'expired'
            return False

        return meta.get('status') != 'banned'

    def periodic_validation(self):
        now = time.time()
        for source, last_check in self._last_validation_time.items():
            interval = self._validation_interval
            if now - last_check >= interval:
                threading.Thread(target=self.validate_all, args=(source,), daemon=True).start()

    def get_stats(self) -> dict:
        with self._lock:
            stats = {}
            for source in self._cookies:
                meta_list = self._cookie_meta.get(source, [])
                stats[source] = {
                    'total': len(self._cookies[source]),
                    'active': sum(1 for m in meta_list if m.get('status') == 'active'),
                    'banned': sum(1 for m in meta_list if m.get('status') == 'banned'),
                    'expired': sum(1 for m in meta_list if m.get('status') == 'expired'),
                    'total_uses': sum(m.get('use_count', 0) for m in meta_list),
                    'total_failures': sum(m.get('fail_count', 0) for m in meta_list),
                }
            return stats

    def _is_duplicate(self, source: str, cookies: dict) -> bool:
        for existing in self._cookies.get(source, []):
            if self._cookies_equal(existing, cookies):
                return True
        return False

    def _cookies_equal(self, c1: dict, c2: dict) -> bool:
        if not c1 or not c2:
            return c1 == c2
        return c1 == c2 or (
            set(c1.keys()) & set(c2.keys()) and
            all(c1.get(k) == c2.get(k) for k in c1.keys() & c2.keys() if k in ('sessionid', 'JSESSIONID', '_csrf'))
        )

    def _extract_expiry(self, cookies: dict) -> Optional[float]:
        if isinstance(cookies, dict):
            for key in ('expires', 'Expires', 'expiry', 'Expire'):
                if key in cookies and cookies[key]:
                    try:
                        return float(cookies[key])
                    except (ValueError, TypeError):
                        try:
                            dt = datetime.strptime(str(cookies[key]), '%a, %d %b %Y %H:%M:%S %Z')
                            return dt.timestamp()
                        except (ValueError, TypeError):
                            pass
        return None


class AuthMiddleware:
    def __init__(self, config: ConfigLoader):
        self.config = config
        self.logger = CrawlLogger().get_logger('AuthMiddleware')
        self._lock = threading.Lock()
        self.cookie_manager = CookiePoolManager(config)
        self._cookies_pool: Dict[str, list] = self.cookie_manager._cookies if self.cookie_manager.is_enabled() else {}
        self._init_auth()

    def _init_auth(self):
        for source in self.config.get_enabled_sources():
            source_cfg = self.config.get_source_config(source)
            if source_cfg.get('login_required') or source_cfg.get('ip_auth_required'):
                if source not in self._cookies_pool:
                    self._cookies_pool[source] = []
        if not self.cookie_manager.is_enabled():
            self._load_cookies_from_config()

    def _load_cookies_from_config(self):
        cookie_file = self.config.get('storage.cookie_file', 'config/cookies.yaml')
        try:
            import yaml
            if os.path.exists(cookie_file):
                with open(cookie_file, 'r', encoding='utf-8') as f:
                    cookies_data = yaml.safe_load(f) or {}
                for source, cookies in cookies_data.items():
                    if isinstance(cookies, list):
                        with self._lock:
                            self._cookies_pool[source] = cookies
        except Exception as e:
            self.logger.warning(f'Failed to load cookies from file: {e}')

    @classmethod
    def from_crawler(cls, crawler):
        middleware = cls(crawler.settings.get('CONFIG_LOADER', ConfigLoader()))
        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(middleware.spider_closed, signal=signals.spider_closed)
        return middleware

    def spider_opened(self, spider):
        spider.logger.info('AuthMiddleware initialized')
        if self.cookie_manager.is_enabled():
            spider.logger.info(
                f'CookiePoolManager enabled, sources: {list(self._cookies_pool.keys())}'
            )
            stats = self.cookie_manager.get_stats()
            for src, s in stats.items():
                if s['total'] > 0:
                    spider.logger.info(f'  {src}: {s}')

    def spider_closed(self, spider, reason):
        if self.cookie_manager.is_enabled():
            if not self.config.get('crawl.cookie_pool_enabled', False):
                return
            self.cookie_manager._save_cookie_meta()

    def process_request(self, request, spider):
        source = getattr(spider, 'name', '')
        used_cookies = None

        if self.cookie_manager.is_enabled() and source in self._cookies_pool:
            cookies = self.cookie_manager.get_cookie(source)
            if cookies:
                used_cookies = cookies
                request.cookies.update(cookies)
                request.meta['_cookie_manager_cookies'] = cookies
                request.meta['_cookie_manager_source'] = source
        elif source in self._cookies_pool:
            with self._lock:
                cookies_list = self._cookies_pool.get(source, [])
                if cookies_list:
                    cookies = random.choice(cookies_list)
                    if cookies:
                        used_cookies = cookies
                        request.cookies.update(cookies)

        auth_config = self.config.get_auth_config(source)
        if auth_config.get('username') and auth_config.get('password'):
            request.meta['auth'] = (
                auth_config['username'],
                auth_config['password']
            )

        if source == 'webofscience' and auth_config.get('api_key'):
            request.headers['X-API-Key'] = auth_config['api_key']
        if source == 'scopus' and auth_config.get('api_key'):
            request.headers['X-ELS-APIKey'] = auth_config['api_key']
            request.headers['X-ELS-Insttoken'] = auth_config.get('inst_token', '')

        return None

    def process_response(self, request, response, spider):
        source = request.meta.get('_cookie_manager_source', getattr(spider, 'name', ''))
        used_cookies = request.meta.get('_cookie_manager_cookies')

        if response.status in (401, 403):
            self.logger.warning(
                f'Auth failed for {spider.name}: {request.url}, status={response.status}'
            )
            if self.cookie_manager.is_enabled() and used_cookies:
                self.cookie_manager.report_failure(source, used_cookies, f'http_{response.status}')

            request.meta['auth_retry'] = request.meta.get('auth_retry', 0) + 1
            if request.meta['auth_retry'] < 3:
                new_req = request.copy()
                if self.cookie_manager.is_enabled() and source in self._cookies_pool:
                    new_cookies = self.cookie_manager.get_cookie(source, 'fresh')
                    if new_cookies:
                        new_req.cookies = new_cookies
                        new_req.meta['_cookie_manager_cookies'] = new_cookies
                return new_req
        else:
            if self.cookie_manager.is_enabled() and used_cookies and response.status < 400:
                self.cookie_manager.report_success(source, used_cookies)

        return response

    def process_exception(self, request, exception, spider):
        if self.cookie_manager.is_enabled():
            source = request.meta.get('_cookie_manager_source', getattr(spider, 'name', ''))
            used_cookies = request.meta.get('_cookie_manager_cookies')
            if used_cookies:
                self.cookie_manager.report_failure(source, used_cookies, f'exception_{type(exception).__name__}')
        return None

    def add_cookies(self, source: str, cookies: dict, validate: bool = True):
        if self.cookie_manager.is_enabled():
            return self.cookie_manager.add_cookie(source, cookies, validate)
        else:
            with self._lock:
                if source not in self._cookies_pool:
                    self._cookies_pool[source] = []
                self._cookies_pool[source].append(cookies)
                self.logger.info(f'Added cookies for source: {source} (legacy)')
                return True
