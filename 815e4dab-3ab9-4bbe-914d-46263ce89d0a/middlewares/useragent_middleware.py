import random
import threading
from typing import List

from scrapy import signals

from utils.logger import CrawlLogger
from utils.config_loader import ConfigLoader


class UserAgentMiddleware:
    DESKTOP_UAS = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 OPR/104.0.0.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ]

    SCHOLAR_UAS = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
    ]

    API_UAS = [
        'JournalCrawler/1.0 (Research Institute Bot; +https://example.com)',
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    ]

    def __init__(self, config: ConfigLoader):
        self.config = config
        self.logger = CrawlLogger().get_logger('UserAgentMiddleware')
        self._lock = threading.Lock()
        self._ua_count = {}
        self._custom_uas = self._load_custom_uas()
        self.enabled = self.config.get('crawl.user_agent_rotation', True)

    def _load_custom_uas(self) -> List[str]:
        uas = self.config.get('crawl.custom_user_agents', [])
        if isinstance(uas, list):
            return uas
        filepath = self.config.get('crawl.user_agent_file', '')
        if filepath:
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    return [line.strip() for line in f if line.strip() and not line.startswith('#')]
            except Exception as e:
                self.logger.warning(f'Failed to load user agents from {filepath}: {e}')
        return []

    @classmethod
    def from_crawler(cls, crawler):
        middleware = cls(crawler.settings.get('CONFIG_LOADER', ConfigLoader()))
        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        return middleware

    def spider_opened(self, spider):
        spider.logger.info('UserAgentMiddleware initialized')

    def process_request(self, request, spider):
        if not self.enabled:
            return None

        spider_name = getattr(spider, 'name', '')
        ua_type = request.meta.get('ua_type', self._detect_ua_type(spider_name, request.url))
        user_agent = self._get_user_agent(ua_type)

        request.headers['User-Agent'] = user_agent
        request.headers['Accept-Language'] = random.choice([
            'zh-CN,zh;q=0.9,en;q=0.8',
            'en-US,en;q=0.9,zh-CN;q=0.8',
            'zh-CN,zh;q=0.9',
            'en;q=0.9',
        ])
        request.headers['Accept'] = random.choice([
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'application/json, text/plain, */*',
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ])

        with self._lock:
            self._ua_count[user_agent] = self._ua_count.get(user_agent, 0) + 1

        return None

    def _detect_ua_type(self, spider_name: str, url: str) -> str:
        if any(kw in spider_name.lower() for kw in ['scholar', 'google', 'baidu', 'microsoft']):
            return 'scholar'
        if any(kw in url.lower() for kw in ['api', 'pubmed', 'crossref', 'doaj']):
            return 'api'
        return 'desktop'

    def _get_user_agent(self, ua_type: str) -> str:
        if self._custom_uas and random.random() < 0.3:
            return random.choice(self._custom_uas)

        if ua_type == 'scholar':
            pool = self.SCHOLAR_UAS + self.DESKTOP_UAS[:5]
        elif ua_type == 'api':
            pool = self.API_UAS + self.DESKTOP_UAS[:3]
        else:
            pool = self.DESKTOP_UAS

        return random.choice(pool)

    def get_stats(self) -> dict:
        with self._lock:
            total = sum(self._ua_count.values())
            return {
                'total_requests': total,
                'unique_uas': len(self._ua_count),
                'ua_distribution': self._ua_count.copy()
            }
