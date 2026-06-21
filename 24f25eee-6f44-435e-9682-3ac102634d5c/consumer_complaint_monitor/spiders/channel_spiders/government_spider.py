import time
import random
from typing import Generator, Optional
from urllib.parse import urljoin

import scrapy
from scrapy.http import HtmlResponse, Request, Response
from scrapy.spiders import Spider
from bs4 import BeautifulSoup
from loguru import logger

from spiders.base_spider import BaseSpider, CircuitBreaker
from utils.cookie_pool import CookiePool
from utils.captcha import CaptchaSolver


class StaticScrapySpider(BaseSpider):
    name = "static_scrapy"
    strategy = "static"

    def __init__(self, channel_config: dict, settings=None):
        super().__init__(channel_config, settings)
        self._cookie_pool = CookiePool(channel_config.get("code", "unknown"), settings)
        self._captcha_solver = CaptchaSolver(settings)

    def start(self, mode: str = "incremental") -> Generator[dict, None, None]:
        yield from self._crawl_with_scrapy(mode)

    def _crawl_with_scrapy(self, mode: str = "incremental") -> Generator[dict, None, None]:
        selectors = self._channel.get("selectors", {})
        parser = self._parser

        if parser == "json_api":
            yield from self._crawl_json_api(mode)
            return

        list_url = urljoin(self._base_url, selectors.get("list_url", "/"))
        max_pages = 5 if mode == "incremental" else 50

        for page in range(1, max_pages + 1):
            page_url = f"{list_url}?page={page}" if page > 1 else list_url

            try:
                response = self._scrapy_get(page_url)
                if not response:
                    break

                if self._is_captcha_page(response):
                    response = self._handle_captcha(response, page_url)
                    if not response:
                        logger.warning(f"Captcha unsolvable for {page_url}")
                        break

                items = list(self._parse_html(response, selectors))
                if not items:
                    break

                for item in items:
                    if item.get("detail_url"):
                        detail_resp = self._scrapy_get(item["detail_url"])
                        if detail_resp:
                            parsed = self._parse_detail(detail_resp, item, selectors)
                            yield parsed
                        else:
                            yield item
                    else:
                        yield item

            except Exception as e:
                logger.error(f"Scrapy crawl error on {page_url}: {e}")
                if self._failure_recorder:
                    self._failure_recorder.record(
                        self._channel_code, page_url, "scrapy_error",
                        str(e)[:2000], 0
                    )
                self._stats["failed"] += 1
                self._stats["total_count"] += 1

            time.sleep(random.uniform(1, 3))

    def _scrapy_get(self, url: str) -> Optional[HtmlResponse]:
        if not self._circuit_breaker.allow_request():
            logger.warning(f"Circuit breaker OPEN for {self._channel_code}")
            return None

        from fake_useragent import UserAgent
        import requests as req

        ua = UserAgent()
        cookie_str = self._cookie_pool.get_cookie()

        headers = {
            "User-Agent": ua.random,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": self._base_url,
        }
        if cookie_str:
            headers["Cookie"] = cookie_str

        last_error = None
        for attempt in range(self._retry_policy.max_retries + 1):
            try:
                resp = req.get(url, headers=headers, timeout=30, allow_redirects=True)
                if resp.status_code == 200:
                    self._circuit_breaker.record_success()
                    self._cookie_pool.report_success(cookie_str)
                    html_response = HtmlResponse(url=url, body=resp.content, encoding="utf-8")
                    return html_response
                elif resp.status_code == 429:
                    retry_after = int(resp.headers.get("Retry-After", 60))
                    logger.warning(f"Rate limited (429) on {url}, wait {retry_after}s")
                    time.sleep(retry_after + random.uniform(1, 5))
                elif resp.status_code in (403, 503):
                    logger.warning(f"Blocked ({resp.status_code}) on {url}")
                    self._cookie_pool.report_failure(cookie_str)
                    if attempt < self._retry_policy.max_retries:
                        delay = self._retry_policy.get_delay(attempt)
                        time.sleep(delay)
                else:
                    logger.warning(f"HTTP {resp.status_code} on {url}")
                    if attempt < self._retry_policy.max_retries:
                        delay = self._retry_policy.get_delay(attempt)
                        time.sleep(delay)
            except Exception as e:
                last_error = str(e)[:200]
                logger.warning(f"Request error on {url} (attempt {attempt + 1}): {e}")
                if attempt < self._retry_policy.max_retries:
                    delay = self._retry_policy.get_delay(attempt)
                    time.sleep(delay)

        self._circuit_breaker.record_failure()
        if self._failure_recorder:
            self._failure_recorder.record(
                self._channel_code, url, "max_retries", last_error or "exhausted",
                self._retry_policy.max_retries,
            )
        return None

    def _is_captcha_page(self, response: HtmlResponse) -> bool:
        captcha_selectors = [
            "input[name*='captcha']", "input[name*='verify']",
            "img[src*='captcha']", "img[src*='verify']",
            "#captcha", ".captcha-img",
        ]
        for sel in captcha_selectors:
            if response.css(sel):
                return True
        captcha_texts = ["验证码", "请输入验证码", "captcha"]
        text = response.text.lower()
        for t in captcha_texts:
            if t in text:
                return True
        return False

    def _handle_captcha(self, response: HtmlResponse, url: str) -> Optional[HtmlResponse]:
        captcha_img = response.css("img[src*='captcha']::attr(src)").get()
        if not captcha_img:
            captcha_img = response.css("img[src*='verify']::attr(src)").get()
        if not captcha_img:
            logger.warning(f"Captcha image not found on {url}")
            return None

        captcha_url = urljoin(self._base_url, captcha_img)
        import requests as req
        img_resp = req.get(captcha_url, timeout=15)
        if img_resp.status_code != 200:
            return None

        code = self._captcha_solver.solve(img_resp.content)
        if not code:
            logger.warning(f"Captcha solve failed for {url}")
            return None

        logger.info(f"Captcha solved: {code} for {url}")
        return self._scrapy_get(url)

    def _parse_html(self, response: HtmlResponse, selectors: dict) -> Generator[dict, None, None]:
        if self._parser == "html_table":
            item_sel = selectors.get("item_link", "table tr td a")
        else:
            item_sel = selectors.get("item_link", "ul.list li a")

        for link in response.css(item_sel):
            href = link.css("::attr(href)").get("")
            title = link.css("::text").get("").strip()
            if not title:
                title = "".join(link.css("::text").getall()).strip()
            if not title:
                continue
            detail_url = urljoin(self._base_url, href)
            yield {
                "title": title,
                "detail_url": detail_url,
                "channel_code": self._channel_code,
                "channel_type": self._channel_type,
                "source_name": self._channel.get("name", ""),
            }

    def _parse_detail(self, response: HtmlResponse, item: dict, selectors: dict) -> dict:
        title_sel = selectors.get("title", "h1")
        content_sel = selectors.get("content", "div")
        date_sel = selectors.get("date", "span")

        title = response.css(f"{title_sel}::text").get("").strip() or item.get("title", "")
        content_parts = response.css(f"{content_sel}::text").getall()
        content = " ".join(p.strip() for p in content_parts if p.strip())
        date_str = response.css(f"{date_sel}::text").get("").strip()

        item["title"] = title
        item["content"] = content
        item["publish_date"] = date_str
        item["collected_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        return item

    def _crawl_json_api(self, mode: str = "incremental") -> Generator[dict, None, None]:
        selectors = self._channel.get("selectors", {})
        api_url = urljoin(self._base_url, selectors.get("api_url", "/api/list"))
        page_size = selectors.get("page_size", 50)
        max_pages = 3 if mode == "incremental" else 100

        import requests as req
        from fake_useragent import UserAgent
        ua = UserAgent()

        for page in range(1, max_pages + 1):
            params = {"page": page, "page_size": page_size}
            headers = {
                "User-Agent": ua.random,
                "Accept": "application/json",
                "Referer": self._base_url,
            }
            cookie_str = self._cookie_pool.get_cookie()
            if cookie_str:
                headers["Cookie"] = cookie_str

            try:
                resp = req.get(api_url, params=params, headers=headers, timeout=30)
                if resp.status_code != 200:
                    break

                data = resp.json()
                list_key = selectors.get("list_key", "data.list")
                items = self._resolve_key_path(data, list_key)
                if not isinstance(items, list) or not items:
                    break

                for entry in items:
                    title = str(entry.get(selectors.get("title_key", "title"), ""))
                    content = str(entry.get(selectors.get("content_key", "content"), ""))
                    date_str = str(entry.get(selectors.get("date_key", "create_time"), ""))
                    if not title and not content:
                        continue
                    yield {
                        "title": title,
                        "content": content,
                        "publish_date": date_str,
                        "detail_url": api_url,
                        "channel_code": self._channel_code,
                        "channel_type": self._channel_type,
                        "source_name": self._channel.get("name", ""),
                        "collected_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                    }

                time.sleep(random.uniform(0.5, 2))
            except Exception as e:
                logger.error(f"JSON API crawl error: {e}")
                break

    @staticmethod
    def _resolve_key_path(data, key_path: str):
        keys = key_path.split(".")
        current = data
        for k in keys:
            if isinstance(current, dict) and k in current:
                current = current[k]
            elif isinstance(current, list) and k.isdigit():
                idx = int(k)
                if idx < len(current):
                    current = current[idx]
                else:
                    return None
            else:
                return None
        return current
