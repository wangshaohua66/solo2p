import scrapy
import re
import os
from urllib.parse import urljoin, urlparse
from datetime import datetime
from scrapy.http import Request
from bs4 import BeautifulSoup
from items.policy_item import PolicyItem, AttachmentItem
from config.settings import (
    CRAWL_SOURCES, DATE_PATTERNS, CRAWL_PAGES, STOP_ON_DUPLICATE,
    MIN_CONTENT_LENGTH, MAX_CONTENT_LENGTH, INCREMENTAL_UPDATE,
    CRAWL_DATE_START, CRAWL_DATE_END, DOWNLOAD_DIR
)
from utils.logger import logger, log_crawl_event, log_error_with_context
from utils.db import db


class PolicySpider(scrapy.Spider):
    name = 'policy_spider'
    custom_settings = {
        'DOWNLOAD_DELAY': 2,
        'RANDOMIZE_DOWNLOAD_DELAY': True,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 4,
    }

    def __init__(self, sources=None, start_date=None, end_date=None, 
                 incremental=None, max_pages=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sources = self._parse_sources(sources)
        self.start_date = start_date or CRAWL_DATE_START
        self.end_date = end_date or CRAWL_DATE_END
        self.incremental = incremental if incremental is not None else INCREMENTAL_UPDATE
        self.max_pages = max_pages or CRAWL_PAGES
        self.stats = {
            'total_requests': 0,
            'success_requests': 0,
            'failed_requests': 0,
            'policies_found': 0,
            'policies_saved': 0,
            'duplicates_skipped': 0,
            'attachments_found': 0,
        }

    def _parse_sources(self, sources_param):
        if not sources_param:
            return [code for code, cfg in CRAWL_SOURCES.items() if cfg.get('enabled', True)]
        if isinstance(sources_param, str):
            sources_param = [s.strip() for s in sources_param.split(',')]
        valid_sources = []
        for s in sources_param:
            if s in CRAWL_SOURCES:
                valid_sources.append(s)
            else:
                logger.warning(f"Unknown source: {s}, skipping")
        return valid_sources

    def start_requests(self):
        logger.info(f"Starting crawl with sources: {self.sources}")
        logger.info(f"Date range: {self.start_date} to {self.end_date}")
        logger.info(f"Incremental update: {self.incremental}")

        for source_code in self.sources:
            source_config = CRAWL_SOURCES.get(source_code)
            if not source_config:
                continue

            if not source_config.get('enabled', True):
                logger.info(f"Source {source_code} is disabled, skipping")
                continue

            list_urls = source_config.get('list_urls', [])
            for list_url in list_urls:
                self.stats['total_requests'] += 1
                yield Request(
                    list_url,
                    callback=self.parse_list,
                    meta={
                        'source_code': source_code,
                        'source_config': source_config,
                        'page': 1,
                        'base_url': list_url,
                    },
                    errback=self.errback_handler,
                    dont_filter=False
                )

    def parse_list(self, response):
        source_code = response.meta.get('source_code')
        source_config = response.meta.get('source_config')
        page = response.meta.get('page', 1)

        log_crawl_event(logger, source_config['name'], response.url, 'success', 
                       f"List page {page}")
        self.stats['success_requests'] += 1

        list_selector = source_config.get('list_selector', {})
        item_selector = list_selector.get('item', 'li')
        title_selector = list_selector.get('title', 'a::text')
        url_selector = list_selector.get('url', 'a::attr(href)')
        date_selector = list_selector.get('date', 'span::text')

        items = response.css(item_selector)
        logger.info(f"Found {len(items)} items on page {page} of {source_config['name']}")

        for item in items:
            try:
                title = item.css(title_selector).get()
                url = item.css(url_selector).get()
                date_str = item.css(date_selector).get()

                if not title or not url:
                    continue

                full_url = urljoin(response.url, url.strip())
                title = title.strip()
                date_str = date_str.strip() if date_str else ''

                publish_date = self._parse_date(date_str)
                if not self._date_in_range(publish_date):
                    logger.debug(f"Policy {title} date {publish_date} out of range, skipping")
                    continue

                if self.incremental and db.policy_exists(full_url):
                    self.stats['duplicates_skipped'] += 1
                    if STOP_ON_DUPLICATE:
                        logger.info(f"Duplicate found, stopping crawl for {source_code} page {page}")
                        return
                    continue

                if self._is_policy_related(title):
                    self.stats['policies_found'] += 1
                    self.stats['total_requests'] += 1

                    yield Request(
                        full_url,
                        callback=self.parse_detail,
                        meta={
                            'source_code': source_code,
                            'source_config': source_config,
                            'title': title,
                            'publish_date': publish_date,
                            'list_url': response.url,
                        },
                        errback=self.errback_handler,
                        priority=10
                    )

            except Exception as e:
                log_error_with_context(logger, e, f"Error parsing list item on {response.url}")
                continue

        if page < self.max_pages and len(items) > 0:
            next_page_url = self._get_next_page_url(response, page)
            if next_page_url:
                self.stats['total_requests'] += 1
                yield Request(
                    next_page_url,
                    callback=self.parse_list,
                    meta={
                        'source_code': source_code,
                        'source_config': source_config,
                        'page': page + 1,
                        'base_url': response.meta.get('base_url', response.url),
                    },
                    errback=self.errback_handler
                )

    def parse_detail(self, response):
        source_code = response.meta.get('source_code')
        source_config = response.meta.get('source_config')
        title = response.meta.get('title')
        publish_date = response.meta.get('publish_date')

        log_crawl_event(logger, source_config['name'], response.url, 'success', 
                       f"Detail: {title[:50]}...")
        self.stats['success_requests'] += 1

        try:
            detail_selector = source_config.get('detail_selector', {})

            if not title:
                title = self._extract_first(response, detail_selector.get('title', 'h1::text'))
            title = self._clean_text(title)

            content_parts = response.css(detail_selector.get('content', '.content ::text')).getall()
            content = self._clean_text('\n'.join(content_parts))

            if not publish_date:
                date_text = self._extract_first(response, detail_selector.get('publish_date', '.time::text'))
                publish_date = self._parse_date(date_text)

            source = self._extract_first(response, detail_selector.get('source', '.source::text'))
            source = source.strip() if source else source_config['name']

            attachment_links = response.css(
                detail_selector.get('attachment_links', 'a[href$=".pdf"], a[href$=".doc"], a[href$=".docx"]::attr(href)')
            ).getall()

            attachment_links = list(set([urljoin(response.url, link) for link in attachment_links if link]))

            if len(content) < MIN_CONTENT_LENGTH and not attachment_links:
                logger.debug(f"Content too short ({len(content)} chars), skipping: {response.url}")
                db.update_crawl_record(response.url, 'skipped_short_content')
                return

            if len(content) > MAX_CONTENT_LENGTH:
                logger.warning(f"Content too long ({len(content)} chars), truncating: {response.url}")
                content = content[:MAX_CONTENT_LENGTH]

            policy_item = PolicyItem()
            policy_item['url'] = response.url
            policy_item['title'] = title
            policy_item['content'] = content
            policy_item['publish_date'] = publish_date
            policy_item['source'] = source
            policy_item['site_name'] = source_config['name']
            policy_item['site_code'] = source_code
            policy_item['attachment_urls'] = attachment_links
            policy_item['raw_html'] = response.text[:100000] if len(response.text) > 100000 else response.text
            policy_item['created_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            policy_item['status'] = 'active'

            self.stats['attachments_found'] += len(attachment_links)

            for attachment_url in attachment_links:
                self.stats['total_requests'] += 1
                yield Request(
                    attachment_url,
                    callback=self.parse_attachment,
                    meta={
                        'policy_url': response.url,
                        'policy_item': policy_item,
                        'source_code': source_code,
                    },
                    errback=self.errback_handler,
                    priority=20
                )

            if not attachment_links:
                yield policy_item

            db.update_crawl_record(response.url, 'success')

        except Exception as e:
            log_error_with_context(logger, e, f"Error parsing detail page: {response.url}")
            db.update_crawl_record(response.url, 'error_parse')
            self.stats['failed_requests'] += 1

    def parse_attachment(self, response):
        policy_url = response.meta.get('policy_url')
        policy_item = response.meta.get('policy_item')

        attachment_url = response.url
        filename = os.path.basename(urlparse(attachment_url).path)
        file_type = self._get_file_type(filename)

        log_crawl_event(logger, 'Attachment', attachment_url, 'success', 
                       f"Type: {file_type}, Size: {len(response.body)} bytes")

        try:
            file_path = self._save_attachment(response, filename)

            attachment_item = AttachmentItem()
            attachment_item['policy_url'] = policy_url
            attachment_item['url'] = attachment_url
            attachment_item['filename'] = filename
            attachment_item['file_type'] = file_type
            attachment_item['file_path'] = file_path
            attachment_item['downloaded'] = True
            attachment_item['parsed'] = False

            if 'attachments' not in policy_item:
                policy_item['attachments'] = []
            policy_item['attachments'].append(dict(attachment_item))

            if 'attachment_files' not in policy_item:
                policy_item['attachment_files'] = []
            policy_item['attachment_files'].append({
                'url': attachment_url,
                'filename': filename,
                'file_path': file_path,
                'file_type': file_type
            })

            all_attachments_processed = True
            if policy_item.get('attachment_urls'):
                downloaded_urls = [a['url'] for a in policy_item.get('attachments', [])]
                all_attachments_processed = all(
                    url in downloaded_urls for url in policy_item['attachment_urls']
                )

            if all_attachments_processed:
                yield policy_item

        except Exception as e:
            log_error_with_context(logger, e, f"Error processing attachment: {attachment_url}")

    def _get_next_page_url(self, response, current_page):
        try:
            base_url = response.meta.get('base_url', response.url)
            parsed = urlparse(base_url)

            if 'index' in parsed.path:
                if current_page == 1:
                    next_path = re.sub(r'(index)(\.html?)$', r'\1_1\2', parsed.path)
                else:
                    next_path = re.sub(r'(index_)(\d+)(\.html?)$', 
                                     lambda m: f"{m.group(1)}{int(m.group(2)) + 1}{m.group(3)}", 
                                     parsed.path)
                return urljoin(base_url, next_path)

            next_links = response.css('a.next::attr(href), a.next-page::attr(href), .pagination .next a::attr(href)').getall()
            for link in next_links:
                if link and link != '#':
                    return urljoin(response.url, link)

            page_links = response.css('.pagination a::attr(href)').getall()
            for link in page_links:
                if re.search(f'[/_]{current_page + 1}[/\\.]', link or ''):
                    return urljoin(response.url, link)

        except Exception as e:
            log_error_with_context(logger, e, "Error getting next page URL")

        return None

    def _parse_date(self, date_str):
        if not date_str:
            return ''

        date_str = str(date_str).strip()

        for pattern in DATE_PATTERNS:
            match = re.search(pattern, date_str)
            if match:
                try:
                    groups = match.groups()
                    if len(groups) >= 3:
                        year, month, day = groups[:3]
                        return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
                    elif len(groups) == 2:
                        year, month = groups
                        return f"{int(year):04d}-{int(month):02d}-01"
                    else:
                        return groups[0]
                except (ValueError, TypeError):
                    continue

        return date_str

    def _date_in_range(self, date_str):
        if not date_str:
            return True

        try:
            date_obj = datetime.strptime(date_str[:10], '%Y-%m-%d')
            start_obj = datetime.strptime(self.start_date[:10], '%Y-%m-%d')
            end_obj = datetime.strptime(self.end_date[:10], '%Y-%m-%d')
            return start_obj <= date_obj <= end_obj
        except (ValueError, TypeError):
            return True

    def _is_policy_related(self, title):
        if not title:
            return False

        policy_keywords = [
            '通知', '意见', '办法', '规定', '细则', '决定', '公告', '通告',
            '批复', '函', '政策', '优抚', '抚恤', '优待', '退役', '军人',
            '安置', '补助', '救助', '医疗', '就业', '培训', '保障',
        ]

        return any(keyword in title for keyword in policy_keywords)

    def _extract_first(self, response, selectors):
        if not selectors:
            return ''

        if isinstance(selectors, str):
            selectors = [selectors]

        for selector in selectors:
            result = response.css(selector).get()
            if result and result.strip():
                return result.strip()

        return ''

    def _clean_text(self, text):
        if not text:
            return ''
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def _get_file_type(self, filename):
        ext = os.path.splitext(filename)[1].lower()
        type_map = {
            '.pdf': 'pdf',
            '.doc': 'doc',
            '.docx': 'docx',
            '.xls': 'excel',
            '.xlsx': 'excel',
            '.txt': 'text',
        }
        return type_map.get(ext, 'other')

    def _save_attachment(self, response, filename):
        safe_filename = re.sub(r'[^\w\-\.]', '_', filename)
        file_path = os.path.join(DOWNLOAD_DIR, safe_filename)

        with open(file_path, 'wb') as f:
            f.write(response.body)

        logger.info(f"Saved attachment: {file_path}")
        return file_path

    def errback_handler(self, failure):
        request = failure.request
        self.stats['failed_requests'] += 1

        url = request.url
        source_code = request.meta.get('source_code', 'unknown')
        source_config = request.meta.get('source_config', {})
        site_name = source_config.get('name', 'unknown')

        log_crawl_event(logger, site_name, url, 'error', str(failure.value))
        db.update_crawl_record(url, 'error_network')

        retry_count = request.meta.get('retry_count', 0)
        if retry_count < 3:
            new_request = request.copy()
            new_request.meta['retry_count'] = retry_count + 1
            new_request.dont_filter = True
            logger.info(f"Retrying {url} (attempt {retry_count + 2}/3)")
            return new_request

    def close(self, reason):
        logger.info("=" * 60)
        logger.info("CRAWL STATISTICS")
        logger.info("=" * 60)
        for key, value in self.stats.items():
            logger.info(f"{key:25s}: {value}")
        logger.info("=" * 60)
        logger.info(f"Crawl completed with reason: {reason}")
