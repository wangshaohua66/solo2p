import re
import time
from datetime import datetime
from loguru import logger
from core.database import DatabaseManager
from items import CrawledPageItem


class StoragePipeline:
    def __init__(self):
        self.db = None
        self.processed_count = 0
        self.duplicate_count = 0

    def open_spider(self, spider):
        self.db = DatabaseManager()

    def close_spider(self, spider):
        logger.info(
            f"StoragePipeline: processed={self.processed_count}, "
            f"duplicates={self.duplicate_count}"
        )

    def process_item(self, item, spider):
        if not isinstance(item, CrawledPageItem):
            return item

        content_text = self._clean_text(item.get("content_text", ""))
        result_title = self._clean_text(item.get("result_title", ""))

        try:
            existing = self.db.fetchone(
                "SELECT id FROM crawled_pages WHERE work_id=? AND platform_key=? AND result_url=?",
                (item["work_id"], item["platform_key"], item["result_url"]),
            )
            if existing:
                self.duplicate_count += 1
                self.db.execute(
                    """UPDATE crawled_pages
                       SET result_title=?, result_author=?, content_text=?,
                           search_keyword=?, crawl_time=?
                       WHERE work_id=? AND platform_key=? AND result_url=?""",
                    (
                        result_title,
                        item.get("result_author", ""),
                        content_text[:50000],
                        item.get("search_keyword", ""),
                        datetime.now().isoformat(),
                        item["work_id"],
                        item["platform_key"],
                        item["result_url"],
                    ),
                )
                return item

            self.db.execute(
                """INSERT INTO crawled_pages
                   (work_id, platform_key, platform_name, result_title, result_author,
                    result_url, result_summary, content_text, search_keyword, entry_type, crawl_time)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    item["work_id"],
                    item["platform_key"],
                    item.get("platform_name", ""),
                    result_title,
                    item.get("result_author", ""),
                    item["result_url"],
                    item.get("result_summary", "")[:2000],
                    content_text[:50000],
                    item.get("search_keyword", ""),
                    item.get("entry_type", "search"),
                    datetime.now().isoformat(),
                ),
            )
            self.processed_count += 1

        except Exception as e:
            logger.error(f"StoragePipeline error for {item.get('result_url')}: {e}")

        return item

    @staticmethod
    def _clean_text(text):
        if not text:
            return ""
        text = re.sub(r"<[^>]+>", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        text = re.sub(r"[^\u4e00-\u9fff\u3000-\u303f\uff00-\uffefa-zA-Z0-9\s.,!?;:，。！？；：、\u201c\u201d\u2018\u2019\uff08\uff09()\[\]\u3010\u3011\u2014\u2026\-]", "", text)
        return text
