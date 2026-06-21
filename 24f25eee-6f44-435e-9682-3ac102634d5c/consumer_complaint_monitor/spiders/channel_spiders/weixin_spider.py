import time
import random
from typing import Generator, Optional
from datetime import datetime

from loguru import logger

from spiders.base_spider import BaseSpider
from utils.cookie_pool import CookiePool
from utils.memory_monitor import MemoryMonitor


class WeixinArticleSpider(BaseSpider):
    name = "weixin_article"
    strategy = "weixin_article"

    def __init__(self, channel_config: dict, settings=None):
        super().__init__(channel_config, settings)
        self._account_id = channel_config.get("account_id", "")
        self._keywords = channel_config.get("keywords", [])
        self._cookie_pool = CookiePool(channel_config.get("code", "unknown"), settings)
        self._mem_monitor = MemoryMonitor(settings)
        self._ws_api = None

    def _init_wechatsogou(self):
        try:
            from wechatsogou import WechatSogouAPI

            cookie_str = self._cookie_pool.get_cookie()
            self._ws_api = WechatSogouAPI(cookie=cookie_str if cookie_str else None)
            logger.info(f"WechatSogouAPI initialized for account={self._account_id}")
        except ImportError:
            logger.warning("wechatsogou SDK not installed, falling back to manual crawl")
            self._ws_api = None
        except Exception as e:
            logger.error(f"Failed to init WechatSogouAPI: {e}")
            self._ws_api = None

    def start(self, mode: str = "incremental") -> Generator[dict, None, None]:
        self._mem_monitor.check_and_gc()
        self._init_wechatsogou()

        if self._ws_api:
            yield from self._crawl_via_sdk(mode)
        else:
            yield from self._crawl_via_sogou(mode)

    def _crawl_via_sdk(self, mode: str = "incremental") -> Generator[dict, None, None]:
        max_pages = 2 if mode == "incremental" else 10

        try:
            articles = self._ws_api.get_gzh_article_by_history(self._account_id)
            if not articles:
                logger.warning(f"No articles found for account={self._account_id}")
                return

            count = 0
            for article in articles:
                if count >= max_pages * 10:
                    break

                title = article.get("title", "")
                url = article.get("url", "")
                digest = article.get("digest", "")
                publish_time = article.get("publish_time", "")

                if self._keywords:
                    matched = any(kw in title or kw in digest for kw in self._keywords)
                    if not matched:
                        continue

                content = digest
                if url:
                    detail_content = self._fetch_article_content(url)
                    if detail_content:
                        content = detail_content

                yield {
                    "title": title,
                    "content": content,
                    "detail_url": url,
                    "publish_date": str(publish_time),
                    "channel_code": self._channel_code,
                    "channel_type": self._channel_type,
                    "source_name": self._channel.get("name", ""),
                    "account_id": self._account_id,
                    "collected_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                }
                count += 1
                time.sleep(random.uniform(1, 3))

        except Exception as e:
            logger.error(f"WechatSogouAPI error for {self._account_id}: {e}")
            yield from self._crawl_via_sogou(mode)

    def _fetch_article_content(self, url: str) -> Optional[str]:
        try:
            import requests as req
            from fake_useragent import UserAgent
            from bs4 import BeautifulSoup

            ua = UserAgent()
            headers = {
                "User-Agent": ua.random,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }
            cookie_str = self._cookie_pool.get_cookie()
            if cookie_str:
                headers["Cookie"] = cookie_str

            resp = req.get(url, headers=headers, timeout=15)
            if resp.status_code != 200:
                return None

            soup = BeautifulSoup(resp.text, "lxml")
            content_el = soup.select_one("div.rich_media_content")
            if content_el:
                for tag in content_el.find_all(["script", "style"]):
                    tag.decompose()
                return content_el.get_text(strip=True, separator="\n")
            return None
        except Exception as e:
            logger.debug(f"Failed to fetch article content from {url}: {e}")
            return None

    def _crawl_via_sogou(self, mode: str = "incremental") -> Generator[dict, None, None]:
        import requests as req
        from fake_useragent import UserAgent
        from bs4 import BeautifulSoup

        search_url = "https://weixin.sogou.com/weixin"
        page = 1
        max_pages = 2 if mode == "incremental" else 10
        ua = UserAgent()

        while page <= max_pages:
            self._mem_monitor.check_and_gc()
            params = {
                "type": "1",
                "query": self._account_id,
                "page": page,
            }
            if self._keywords:
                params["query"] = f"{self._account_id} {' '.join(self._keywords[:3])}"

            headers = {
                "User-Agent": ua.random,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": "https://weixin.sogou.com/",
            }
            cookie_str = self._cookie_pool.get_cookie()
            if cookie_str:
                headers["Cookie"] = cookie_str

            try:
                resp = req.get(search_url, params=params, headers=headers, timeout=15)
                if not resp or resp.status_code != 200:
                    break

                if "验证" in resp.text or "antispider" in resp.url:
                    logger.warning(f"Sogou anti-spider triggered for {self._account_id}")
                    self._cookie_pool.report_failure(cookie_str)
                    time.sleep(random.uniform(10, 30))
                    continue

                self._cookie_pool.report_success(cookie_str)

                soup = BeautifulSoup(resp.text, "lxml")
                articles = soup.select("div.txt-box h3 a")
                if not articles:
                    articles = soup.select("ul.news-list li h3 a")

                if not articles:
                    break

                for article_link in articles:
                    title = article_link.get_text(strip=True)
                    href = article_link.get("href", "")

                    if self._keywords:
                        matched = any(kw in title for kw in self._keywords)
                        if not matched:
                            continue

                    content = ""
                    if href:
                        detail_content = self._fetch_article_content(href)
                        if detail_content:
                            content = detail_content

                    yield {
                        "title": title,
                        "content": content,
                        "detail_url": href,
                        "publish_date": "",
                        "channel_code": self._channel_code,
                        "channel_type": self._channel_type,
                        "source_name": self._channel.get("name", ""),
                        "account_id": self._account_id,
                        "collected_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                    }

            except Exception as e:
                logger.error(f"Sogou crawl error for {self._account_id}: {e}")
                self._stats["failed"] += 1
                self._stats["total_count"] += 1

            page += 1
            time.sleep(random.uniform(3, 8))
