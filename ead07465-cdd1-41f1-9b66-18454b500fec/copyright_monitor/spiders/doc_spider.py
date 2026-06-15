import scrapy
import json
from urllib.parse import quote, urljoin
from datetime import datetime
from loguru import logger
from core.platforms import DOC_PLATFORMS
from core.database import DatabaseManager
from items import CrawledPageItem


class DocSpider(scrapy.Spider):
    name = "doc_spider"
    custom_settings = {
        "CONCURRENT_REQUESTS_PER_DOMAIN": 3,
        "DOWNLOAD_DELAY": 2.5,
        "RANDOMIZE_DOWNLOAD_DELAY": True,
    }

    def __init__(self, work_ids=None, platform_keys=None, scan_type="incremental", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.scan_type = scan_type
        self.db = DatabaseManager()
        self.platforms = DOC_PLATFORMS
        if platform_keys:
            pkeys = platform_keys.split(",") if isinstance(platform_keys, str) else platform_keys
            self.platforms = {k: v for k, v in DOC_PLATFORMS.items() if k in pkeys}
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
                   WHERE (ss.next_scan_time <= datetime('now') OR ss.next_scan_time IS NULL)
                     AND ss.platform_key IN ({})
                   ORDER BY ss.scan_priority DESC""".format(
                    ",".join(f"'{k}'" for k in DOC_PLATFORMS.keys())
                )
            )
        return [dict(r) for r in rows] if rows else []

    def start_requests(self):
        total = len(self.works) * len(self.platforms)
        logger.info(f"DocSpider: {len(self.works)} works x {len(self.platforms)} platforms = {total} scan tasks")

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
            for kw in custom_kw.split(",")[:2]:
                stripped = kw.strip()
                if stripped and stripped not in keywords:
                    keywords.append(stripped)
        return keywords[:3]

    def parse_search_results(self, response):
        meta = response.meta
        rules = meta["parse_rules"]
        pkey = meta["platform_key"]

        items = response.css(rules.get("list_selector", ""))
        if not items:
            items = response.xpath(rules.get("list_xpath", "//div[contains(@class,'result') or contains(@class,'item')]"))

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

        next_page = response.css("a.next::attr(href)").get()
        if next_page and self.stats["pages_crawled"] < 300:
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
        if not paragraphs:
            paragraphs = response.css("::text").getall()
        content_text = "\n".join(p.strip() for p in paragraphs if p.strip())

        item["content_text"] = content_text[:50000]
        item["raw_html"] = response.text[:200000] if len(response.text) > 200000 else response.text
        item["response_headers"] = json.dumps(dict(response.headers), ensure_ascii=False)

        self.stats["items_scraped"] += 1
        yield item

    def errback_handler(self, failure):
        self.stats["errors"] += 1
        url = failure.request.url if failure.request else "unknown"
        logger.warning(f"DocSpider request failed: {url} - {failure.value}")

    def closed(self, reason):
        logger.info(f"DocSpider closed: {json.dumps(self.stats, ensure_ascii=False)}")
