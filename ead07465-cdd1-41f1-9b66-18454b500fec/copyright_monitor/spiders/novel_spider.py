import scrapy
import json
from urllib.parse import quote, urljoin
from datetime import datetime
from loguru import logger
from core.platforms import NOVEL_PLATFORMS
from core.database import DatabaseManager
from items import CrawledPageItem


class NovelSpider(scrapy.Spider):
    name = "novel_spider"
    custom_settings = {
        "CONCURRENT_REQUESTS_PER_DOMAIN": 4,
        "DOWNLOAD_DELAY": 2.0,
        "RANDOMIZE_DOWNLOAD_DELAY": True,
    }

    def __init__(self, work_ids=None, platform_keys=None, scan_type="incremental", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.scan_type = scan_type
        self.db = DatabaseManager()
        self.platforms = NOVEL_PLATFORMS
        if platform_keys:
            pkeys = platform_keys.split(",") if isinstance(platform_keys, str) else platform_keys
            self.platforms = {k: v for k, v in NOVEL_PLATFORMS.items() if k in pkeys}
        self.works = []
        if work_ids:
            wids = work_ids.split(",") if isinstance(work_ids, str) else work_ids
            for wid in wids:
                work = self._get_work(wid)
                if work:
                    self.works.append(work)
        else:
            self.works = self._get_pending_works()
        self.stats = {"pages_crawled": 0, "items_scraped": 0, "errors": 0}

    def _get_work(self, work_id):
        row = self.db.fetchone("SELECT * FROM copyrighted_works WHERE id=?", (work_id,))
        return dict(row) if row else None

    def _get_pending_works(self):
        if self.scan_type == "full":
            rows = self.db.fetchall("SELECT * FROM copyrighted_works")
        else:
            rows = self.db.fetchall(
                """SELECT cw.* FROM copyrighted_works cw
                   LEFT JOIN scan_schedule ss ON cw.id = ss.work_id
                   WHERE ss.next_scan_time <= datetime('now')
                      OR ss.next_scan_time IS NULL
                   ORDER BY ss.scan_priority DESC, cw.created_at DESC"""
            )
        return [dict(r) for r in rows] if rows else []

    def start_requests(self):
        total = len(self.works) * len(self.platforms)
        logger.info(f"NovelSpider: {len(self.works)} works x {len(self.platforms)} platforms = {total} scan tasks")

        for work in self.works:
            keywords = self._generate_keywords(work)
            for pkey, pconf in self.platforms.items():
                for keyword in keywords:
                    url = pconf["search_url"].format(keyword=quote(keyword))
                    meta = {
                        "work_id": work["id"],
                        "work_title": work["title"],
                        "platform_key": pkey,
                        "platform_name": pconf["name"],
                        "search_keyword": keyword,
                        "entry_type": pconf["entry_strategy"],
                        "parse_rules": pconf["parse_rules"],
                    }
                    yield scrapy.Request(
                        url, callback=self.parse_search_results, meta=meta, errback=self.errback_handler, dont_filter=False
                    )

    def _generate_keywords(self, work):
        keywords = [work["title"]]
        if work.get("author"):
            keywords.append(f"{work['title']} {work['author']}")
        custom_kw = work.get("keywords", "")
        if custom_kw:
            for kw in custom_kw.split(",")[:3]:
                stripped = kw.strip()
                if stripped and stripped not in keywords:
                    keywords.append(stripped)
        return keywords[:5]

    def parse_search_results(self, response):
        meta = response.meta
        rules = meta["parse_rules"]
        pkey = meta["platform_key"]

        items = response.css(rules.get("list_selector", ""))
        if not items:
            items = response.xpath(rules.get("list_xpath", "//div[contains(@class,'result')]"))

        self.stats["pages_crawled"] += 1

        for item_elem in items:
            title_elem = item_elem.css(rules.get("title_selector", ""))
            title = title_elem.css("::text").get("").strip()
            link = title_elem.css("::attr(href)").get("")
            author = item_elem.css(rules.get("author_selector", "")).css("::text").get("").strip()
            summary = item_elem.css(rules.get("summary_selector", "")).css("::text").get("").strip()

            if not title or not link:
                continue

            if link and not link.startswith("http"):
                base_url = self.platforms[pkey]["base_url"]
                link = urljoin(base_url, link)

            if self._is_same_source(title, author, meta["work_title"]):
                continue

            item = CrawledPageItem()
            item["work_id"] = meta["work_id"]
            item["work_title"] = meta["work_title"]
            item["platform_key"] = pkey
            item["platform_name"] = meta["platform_name"]
            item["result_title"] = title
            item["result_author"] = author
            item["result_url"] = link
            item["result_summary"] = summary[:2000] if summary else ""
            item["content_text"] = ""
            item["raw_html"] = ""
            item["response_headers"] = ""
            item["crawl_time"] = datetime.now().isoformat()
            item["entry_type"] = meta["entry_type"]
            item["search_keyword"] = meta["search_keyword"]

            content_selector = rules.get("content_selector", "")
            if content_selector:
                yield scrapy.Request(
                    link,
                    callback=self.parse_content,
                    meta={**meta, "item": item, "parse_rules": rules},
                    errback=self.errback_handler,
                    priority=1,
                )
            else:
                yield item

        next_page = response.css(rules.get("next_page_selector", "a.next::attr(href)")).get()
        if next_page and self.stats["pages_crawled"] < 500:
            if not next_page.startswith("http"):
                next_page = urljoin(response.url, next_page)
            yield scrapy.Request(
                next_page,
                callback=self.parse_search_results,
                meta=response.meta,
                errback=self.errback_handler,
                priority=0,
            )

    def parse_content(self, response):
        meta = response.meta
        item = meta["item"]
        rules = meta["parse_rules"]
        content_selector = rules.get("content_selector", "")

        paragraphs = response.css(f"{content_selector} ::text").getall()
        content_text = "\n".join(p.strip() for p in paragraphs if p.strip())

        item["content_text"] = content_text[:50000]
        item["raw_html"] = response.text[:200000] if len(response.text) > 200000 else response.text
        item["response_headers"] = json.dumps(dict(response.headers), ensure_ascii=False)

        self.stats["items_scraped"] += 1
        yield item

        chapter_links = response.css(rules.get("chapter_list_selector", "")).css("::attr(href)").getall()
        for idx, ch_link in enumerate(chapter_links[:10]):
            if ch_link and not ch_link.startswith("http"):
                base_url = self.platforms[meta["platform_key"]]["base_url"]
                ch_link = urljoin(base_url, ch_link)
            yield scrapy.Request(
                ch_link,
                callback=self.parse_chapter,
                meta={**meta, "item": None, "chapter_index": idx + 1},
                errback=self.errback_handler,
                priority=2,
            )

    def parse_chapter(self, response):
        meta = response.meta
        rules = meta["parse_rules"]
        content_selector = rules.get("content_selector", "")

        paragraphs = response.css(f"{content_selector} ::text").getall()
        content_text = "\n".join(p.strip() for p in paragraphs if p.strip())

        if not content_text or len(content_text) < 50:
            return

        item = CrawledPageItem()
        item["work_id"] = meta["work_id"]
        item["work_title"] = meta["work_title"]
        item["platform_key"] = meta["platform_key"]
        item["platform_name"] = meta["platform_name"]
        item["result_title"] = f"第{meta['chapter_index']}章"
        item["result_author"] = ""
        item["result_url"] = response.url
        item["result_summary"] = content_text[:200]
        item["content_text"] = content_text[:50000]
        item["raw_html"] = ""
        item["response_headers"] = ""
        item["crawl_time"] = datetime.now().isoformat()
        item["entry_type"] = "chapter"
        item["search_keyword"] = meta.get("search_keyword", "")

        self.stats["items_scraped"] += 1
        yield item

    def _is_same_source(self, title, author, work_title):
        if not title:
            return False
        if title.strip() == work_title.strip():
            return True
        return False

    def errback_handler(self, failure):
        self.stats["errors"] += 1
        url = failure.request.url if failure.request else "unknown"
        logger.warning(f"Request failed: {url} - {failure.value}")

    def closed(self, reason):
        logger.info(f"NovelSpider closed: {json.dumps(self.stats, ensure_ascii=False)}")
