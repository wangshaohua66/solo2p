import time
import random
import json
from typing import Generator, Optional
from urllib.parse import urljoin

from loguru import logger

from spiders.base_spider import BaseSpider


class EcommerceSpider(BaseSpider):
    name = "ecommerce"

    def parse_list(self, response) -> Generator[dict, None, None]:
        selectors = self._channel.get("selectors", {})
        parser = self._parser

        if parser == "json_api":
            yield from self._parse_json(response, selectors)
        elif parser == "html_list":
            yield from self._parse_html(response, selectors)
        else:
            logger.warning(f"EcommerceSpider: unknown parser '{parser}'")

    def _parse_json(self, response, selectors: dict) -> Generator[dict, None, None]:
        try:
            data = response.json()
        except Exception:
            logger.error(f"Failed to parse JSON from {response.url}")
            return

        list_key = selectors.get("list_key", "data.list")
        items = self._resolve_key_path(data, list_key)
        if not isinstance(items, list):
            return

        for entry in items:
            title = str(entry.get(selectors.get("title_key", "title"), ""))
            content = str(entry.get(selectors.get("content_key", "content"), ""))
            date_str = str(entry.get(selectors.get("date_key", "created"), ""))
            if not title and not content:
                continue
            yield {
                "title": title,
                "content": content,
                "publish_date": date_str,
                "detail_url": response.url,
                "channel_code": self._channel_code,
                "channel_type": self._channel_type,
                "source_name": self._channel.get("name", ""),
            }

    def _parse_html(self, response, selectors: dict) -> Generator[dict, None, None]:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(response.text, "lxml")
        items = soup.select(selectors.get("item_link", "div.complaint-item a"))
        for item in items:
            href = item.get("href", "")
            title_el = item.select_one(selectors.get("title", "h3"))
            title = title_el.get_text(strip=True) if title_el else item.get_text(strip=True)
            detail_url = urljoin(self._base_url, href)
            yield {
                "title": title,
                "detail_url": detail_url,
                "channel_code": self._channel_code,
                "channel_type": self._channel_type,
                "source_name": self._channel.get("name", ""),
            }

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

    def parse_detail(self, response, item: dict) -> dict:
        selectors = self._channel.get("selectors", {})
        if self._parser == "html_list":
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(response.text, "lxml")
            content_el = soup.select_one(selectors.get("content", "div.complaint-detail"))
            date_el = soup.select_one(selectors.get("date", "span.time"))
            if content_el:
                item["content"] = content_el.get_text(strip=True)
            if date_el:
                item["publish_date"] = date_el.get_text(strip=True)
        item["collected_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        return item

    def start(self, mode: str = "incremental") -> Generator[dict, None, None]:
        selectors = self._channel.get("selectors", {})
        parser = self._parser

        if parser == "json_api":
            yield from self._crawl_json_api(mode)
        elif parser == "html_list":
            yield from self._crawl_html(mode)

    def _crawl_json_api(self, mode: str = "incremental") -> Generator[dict, None, None]:
        selectors = self._channel.get("selectors", {})
        api_url = urljoin(self._base_url, selectors.get("api_url", "/api/list"))
        page = 1
        max_pages = 3 if mode == "incremental" else 100

        while page <= max_pages:
            params = {"page": page, "page_size": 20}
            headers = {
                "X-Requested-With": "XMLHttpRequest",
                "Accept": "application/json, text/plain, */*",
            }
            response = self.request_with_retry(api_url, params=params, headers=headers)
            if not response:
                break

            items = list(self.parse_list(response))
            if not items:
                break

            yield from items
            page += 1
            time.sleep(random.uniform(0.5, 2))

    def _crawl_html(self, mode: str = "incremental") -> Generator[dict, None, None]:
        selectors = self._channel.get("selectors", {})
        list_url = urljoin(self._base_url, selectors.get("list_url", "/"))
        page = 1
        max_pages = 3 if mode == "incremental" else 30

        while page <= max_pages:
            page_url = f"{list_url}?page={page}" if page > 1 else list_url
            response = self.request_with_retry(page_url)
            if not response:
                break

            items = list(self.parse_list(response))
            if not items:
                break

            for item in items:
                if item.get("detail_url"):
                    detail_resp = self.request_with_retry(item["detail_url"])
                    if detail_resp:
                        parsed = self.parse_detail(detail_resp, item)
                        yield parsed
                    else:
                        yield item
                else:
                    yield item

            page += 1
            time.sleep(random.uniform(1, 3))

    def _handle_block(self, response):
        super()._handle_block(response)
        logger.warning(
            f"E-commerce block detected on {self._channel_code}, "
            f"status={response.status_code}, attempting cookie rotation"
        )
        self._rotate_cookie()
