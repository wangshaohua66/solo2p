import time
import threading
import random
from typing import Dict, Optional

import scrapy
from scrapy import signals
from scrapy.downloadermiddlewares.retry import RetryMiddleware
from scrapy.utils.response import response_status_message

from utils.logger import CrawlLogger
from utils.config_loader import ConfigLoader
from utils.proxy_manager import ProxyManager


class AuthMiddleware:
    def __init__(self, config: ConfigLoader):
        self.config = config
        self.logger = CrawlLogger().get_logger('AuthMiddleware')
        self._cookies_pool: Dict[str, list] = {}
        self._lock = threading.Lock()
        self._init_auth()

    def _init_auth(self):
        for source in self.config.get_enabled_sources():
            source_cfg = self.config.get_source_config(source)
            if source_cfg.get('login_required') or source_cfg.get('ip_auth_required'):
                self._cookies_pool[source] = []
        self._load_cookies_from_config()

    def _load_cookies_from_config(self):
        cookie_file = self.config.get('storage.cookie_file', 'config/cookies.yaml')
        try:
            import yaml
            import os
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
        return middleware

    def spider_opened(self, spider):
        spider.logger.info('AuthMiddleware initialized')

    def process_request(self, request, spider):
        source = getattr(spider, 'name', '')

        if source in self._cookies_pool:
            with self._lock:
                cookies_list = self._cookies_pool.get(source, [])
                if cookies_list:
                    cookies = random.choice(cookies_list)
                    if cookies:
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
        if response.status in (401, 403):
            self.logger.warning(
                f'Auth failed for {spider.name}: {request.url}, status={response.status}'
            )
            request.meta['auth_retry'] = request.meta.get('auth_retry', 0) + 1
            if request.meta['auth_retry'] < 3:
                return request.copy()
        return response

    def add_cookies(self, source: str, cookies: dict):
        with self._lock:
            if source not in self._cookies_pool:
                self._cookies_pool[source] = []
            self._cookies_pool[source].append(cookies)
            self.logger.info(f'Added cookies for source: {source}')
