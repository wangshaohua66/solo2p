import time
import random
import re
from typing import Generator, Optional
from datetime import datetime

from bs4 import BeautifulSoup
from loguru import logger

from spiders.base_spider import BaseSpider


class WeixinSpider(BaseSpider):
    name = "weixin"

    def __init__(self, channel_config: dict, settings=None):
        super().__init__(channel_config, settings)
        self._account_id = channel_config.get("account_id", "")
        self._keywords = channel_config.get("keywords", [])

    def parse_list(self, response) -> Generator[dict, None, None]:
        soup = BeautifulSoup(response.text, "lxml")
        articles = soup.select("div.article_list div.article_item")
        if not articles:
            articles = soup.select("ul.news-list li")
        if not articles:
            articles = soup.select("div.weui_msg_card")

        for article in articles:
            link = article.select_one("a")
            if not link:
                continue
            href = link.get("href", "")
            title_el = article.select_one("h3") or article.select_one("h2") or link
            title = title_el.get_text(strip=True) if title_el else ""
            date_el = article.select_one("span.pub_time") or article.select_one(
                "span.date"
            )
            date_str = date_el.get_text(strip=True) if date_el else ""

            if self._keywords:
                matched = any(kw in title for kw in self._keywords)
                if not matched:
                    continue

            yield {
                "title": title,
                "detail_url": href,
                "publish_date": date_str,
                "channel_code": self._channel_code,
                "channel_type": self._channel_type,
                "source_name": self._channel.get("name", ""),
                "account_id": self._account_id,
            }

    def parse_detail(self, response, item: dict) -> dict:
        soup = BeautifulSoup(response.text, "lxml")
        content_el = soup.select_one("div.rich_media_content") or soup.select_one(
            "div.article-content"
        )
        if content_el:
            for tag in content_el.find_all(["script", "style"]):
                tag.decompose()
            content = content_el.get_text(strip=True, separator="\n")
        else:
            content = ""

        date_el = soup.select_one("em#publish_time") or soup.select_one(
            "span.rich_media_meta_text"
        )
        if date_el:
            item["publish_date"] = date_el.get_text(strip=True)

        author_el = soup.select_one("a.rich_media_meta_link") or soup.select_one(
            "span.rich_media_meta_nickname"
        )
        if author_el:
            item["author"] = author_el.get_text(strip=True)

        item["content"] = content
        item["collected_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        return item

    def start(self, mode: str = "incremental") -> Generator[dict, None, None]:
        yield from self._crawl_via_sogou(mode)

    def _crawl_via_sogou(self, mode: str = "incremental") -> Generator[dict, None, None]:
        search_url = "https://weixin.sogou.com/weixin"
        page = 1
        max_pages = 2 if mode == "incremental" else 10

        while page <= max_pages:
            params = {
                "type": "1",
                "query": self._account_id,
                "page": page,
            }
            if self._keywords:
                params["query"] = f"{self._account_id} {' '.join(self._keywords[:3])}"

            response = self.request_with_retry(search_url, params=params)
            if not response:
                break

            if "验证" in response.text or "antispider" in response.url:
                logger.warning(f"Sogou anti-spider triggered for {self._account_id}")
                time.sleep(random.uniform(10, 30))
                continue

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
            time.sleep(random.uniform(3, 8))

    def _crawl_via_api(self, mode: str = "incremental") -> Generator[dict, None, None]:
        api_url = "https://weixin.sogou.com/api/search"
        params = {
            "type": "1",
            "query": self._account_id,
            "page": 1,
        }
        response = self.request_with_retry(api_url, params=params)
        if not response:
            return
        try:
            data = response.json()
            articles = data.get("items", [])
            for article in articles:
                yield {
                    "title": article.get("title", ""),
                    "content": article.get("digest", ""),
                    "detail_url": article.get("url", ""),
                    "publish_date": article.get("time", ""),
                    "channel_code": self._channel_code,
                    "channel_type": self._channel_type,
                    "source_name": self._channel.get("name", ""),
                    "account_id": self._account_id,
                    "collected_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                }
        except Exception:
            logger.error(f"Failed to parse Weixin API response")

    def _handle_block(self, response):
        super()._handle_block(response)
        logger.warning(
            f"Weixin block detected on {self._channel_code}, "
            f"account={self._account_id}"
        )
        time.sleep(random.uniform(5, 15))
