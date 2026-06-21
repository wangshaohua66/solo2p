import re
import time
import random
from typing import Generator, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from loguru import logger

from spiders.base_spider import BaseSpider


class GovernmentSpider(BaseSpider):
    name = "government"

    def parse_list(self, response) -> Generator[dict, None, None]:
        selectors = self._channel.get("selectors", {})
        parser = self._parser

        if parser == "html_table":
            yield from self._parse_html_table(response, selectors)
        elif parser == "html_list":
            yield from self._parse_html_list(response, selectors)
        elif parser == "json_api":
            yield from self._parse_json_api(response, selectors)
        else:
            logger.warning(f"Unknown parser type: {parser}")

    def _parse_html_table(
        self, response, selectors: dict
    ) -> Generator[dict, None, None]:
        soup = BeautifulSoup(response.text, "lxml")
        item_links = soup.select(selectors.get("item_link", "table tr td a"))
        for link in item_links:
            href = link.get("href", "")
            title = link.get_text(strip=True)
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

    def _parse_html_list(
        self, response, selectors: dict
    ) -> Generator[dict, None, None]:
        soup = BeautifulSoup(response.text, "lxml")
        items = soup.select(selectors.get("item_link", "ul.list li a"))
        for item in items:
            href = item.get("href", "")
            title = item.get_text(strip=True)
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

    def _parse_json_api(
        self, response, selectors: dict
    ) -> Generator[dict, None, None]:
        try:
            data = response.json()
        except Exception:
            logger.error(f"Failed to parse JSON from {response.url}")
            return

        list_key = selectors.get("list_key", "data.list")
        items = self._extract_nested(data, list_key)
        if not isinstance(items, list):
            logger.warning(f"JSON list key '{list_key}' did not resolve to a list")
            return

        for entry in items:
            title = entry.get(selectors.get("title_key", "title"), "")
            content = entry.get(selectors.get("content_key", "content"), "")
            date_str = entry.get(selectors.get("date_key", "create_time"), "")
            if not title and not content:
                continue
            yield {
                "title": str(title),
                "content": str(content),
                "publish_date": str(date_str),
                "detail_url": response.url,
                "channel_code": self._channel_code,
                "channel_type": self._channel_type,
                "source_name": self._channel.get("name", ""),
            }

    @staticmethod
    def _extract_nested(data: dict, key_path: str):
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
        parser = self._parser

        if parser in ("html_table", "html_list"):
            soup = BeautifulSoup(response.text, "lxml")
            title_el = soup.select_one(selectors.get("title", "h1"))
            content_el = soup.select_one(selectors.get("content", "div"))
            date_el = soup.select_one(selectors.get("date", "span"))

            title = title_el.get_text(strip=True) if title_el else item.get("title", "")
            content = content_el.get_text(strip=True) if content_el else ""
            date_str = date_el.get_text(strip=True) if date_el else ""

            item["title"] = title
            item["content"] = content
            item["publish_date"] = date_str
        elif parser == "json_api":
            pass

        item["collected_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        return item

    def start(self, mode: str = "incremental") -> Generator[dict, None, None]:
        selectors = self._channel.get("selectors", {})
        parser = self._parser
        list_url = urljoin(self._base_url, selectors.get("list_url", "/"))

        if parser == "json_api":
            yield from self._crawl_json_api(mode)
        else:
            page = 1
            max_pages = 5 if mode == "incremental" else 50
            while page <= max_pages:
                page_url = f"{list_url}?page={page}" if page > 1 else list_url
                response = self.request_with_retry(page_url)
                if not response:
                    break

                items = list(self.parse_list(response))
                if not items:
                    break

                for item in items:
                    if parser in ("html_table", "html_list") and item.get("detail_url"):
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

    def _crawl_json_api(self, mode: str = "incremental") -> Generator[dict, None, None]:
        selectors = self._channel.get("selectors", {})
        api_url = urljoin(self._base_url, selectors.get("api_url", "/api/list"))
        page_size = selectors.get("page_size", 50)
        page_key = selectors.get("page_key", "page")
        max_pages = 3 if mode == "incremental" else 100

        for page in range(1, max_pages + 1):
            params = {page_key: page, "page_size": page_size}
            response = self.request_with_retry(api_url, params=params)
            if not response:
                break

            items = list(self.parse_list(response))
            if not items:
                break

            yield from items
            time.sleep(random.uniform(0.5, 2))
