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
from utils.checkpoint import checkpoint


class PolicySpider(scrapy.Spider):
    name = 'policy_spider'
    custom_settings = {
        'DOWNLOAD_DELAY': 2,
        'RANDOMIZE_DOWNLOAD_DELAY': True,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 4,
    }

    SITE_PARSERS = {
        'government_gov_cn': {
            'list_selectors': [
                {'item': 'ul.list li', 'title': 'a::text', 'url': 'a::attr(href)', 'date': 'span.time::text'},
                {'item': '.news-list li', 'title': 'a::text', 'url': 'a::attr(href)', 'date': '.date::text'},
                {'item': '.zcwj_list li', 'title': 'a::text', 'url': 'a::attr(href)', 'date': 'em::text'},
                {'item': '.ar_list li', 'title': 'a::text', 'url': 'a::attr(href)', 'date': 'span.date::text'},
                {'item': 'ul.zcfg li', 'title': 'a::text', 'url': 'a::attr(href)', 'date': 'span::text'},
            ],
            'detail_selectors': [
                {'title': 'h1::text', 'content': '.content ::text', 'publish_date': '.time::text', 'source': '.source::text'},
                {'title': '.title::text', 'content': '#content ::text', 'publish_date': '.date::text', 'source': '.from::text'},
                {'title': '.article-title::text', 'content': '.article-content ::text', 'publish_date': '.publish-time::text', 'source': '.laiyuan::text'},
                {'title': '.con_tit::text', 'content': '.zoom ::text', 'publish_date': '.dates::text', 'source': '.source::text'},
                {'title': 'h1::text', 'content': '.pages_content ::text', 'publish_date': '.pubtime::text', 'source': '.pages-source::text'},
            ],
        },
        'provincial_gov': {
            'list_selectors': [
                {'item': '.news-list li', 'title': 'a::text', 'url': 'a::attr(href)', 'date': 'span.date::text'},
                {'item': 'ul.news li', 'title': 'a::text', 'url': 'a::attr(href)', 'date': 'em::text'},
                {'item': '.zcwj_list li', 'title': 'a::text', 'url': 'a::attr(href)', 'date': '.time::text'},
                {'item': '.file-list li', 'title': 'a::text', 'url': 'a::attr(href)', 'date': 'span.time::text'},
                {'item': '.policy-list li', 'title': 'a::text', 'url': 'a::attr(href)', 'date': '.date::text'},
            ],
            'detail_selectors': [
                {'title': 'h1::text', 'content': '.content ::text', 'publish_date': '.time::text', 'source': '.source::text'},
                {'title': '.article-title::text', 'content': '.article-content ::text', 'publish_date': '.info .time::text', 'source': '.info .source::text'},
                {'title': 'h1::text', 'content': '.TRS_Editor ::text', 'publish_date': '.times::text', 'source': '.laiyuan::text'},
                {'title': '.title::text', 'content': '.view TRS_UEDITOR ::text', 'publish_date': '.date::text', 'source': '.from::text'},
            ],
        },
        'city_gov': {
            'list_selectors': [
                {'item': '.list-box li', 'title': 'a::text', 'url': 'a::attr(href)', 'date': 'span.date::text'},
                {'item': '.news-list li', 'title': 'a::text', 'url': 'a::attr(href)', 'date': '.time::text'},
                {'item': 'ul.news li', 'title': 'a::text', 'url': 'a::attr(href)', 'date': 'em::text'},
            ],
            'detail_selectors': [
                {'title': 'h1::text', 'content': '.content ::text', 'publish_date': '.time::text', 'source': '.source::text'},
                {'title': '.article-title::text', 'content': '.article-content ::text', 'publish_date': '.info .time::text', 'source': '.info .source::text'},
            ],
        },
        'government': {
            'list_selectors': [
                {'item': 'ul.list li', 'title': 'a::text', 'url': 'a::attr(href)', 'date': 'span.time::text'},
                {'item': 'li', 'title': 'a::text', 'url': 'a::attr(href)', 'date': 'span::text'},
            ],
            'detail_selectors': [
                {'title': 'h1::text', 'content': '.content ::text', 'publish_date': '.time::text', 'source': '.source::text'},
                {'title': 'h1::text', 'content': 'body ::text', 'publish_date': '.date::text', 'source': '.source::text'},
            ],
        },
    }

    DEFAULT_ATTACHMENT_SELECTOR = (
        'a[href$=".pdf"]::attr(href), a[href$=".PDF"]::attr(href), '
        'a[href$=".doc"]::attr(href), a[href$=".DOC"]::attr(href), '
        'a[href$=".docx"]::attr(href), a[href$=".DOCX"]::attr(href), '
        'a[href$=".xls"]::attr(href), a[href$=".xlsx"]::attr(href)'
    )

    def __init__(self, sources=None, start_date=None, end_date=None, 
                 incremental=None, max_pages=None, use_checkpoint=True,
                 resume=False, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sources = self._parse_sources(sources)
        self.start_date = start_date or CRAWL_DATE_START
        self.end_date = end_date or CRAWL_DATE_END
        self.incremental = incremental if incremental is not None else INCREMENTAL_UPDATE
        self.max_pages = max_pages or CRAWL_PAGES
        self.use_checkpoint = use_checkpoint
        self.resume = resume
        self.session_id = None

        if self.use_checkpoint:
            self.session_id = checkpoint.start_session(
                session_name='policy_crawl',
                sources=self.sources
            )
            logger.info(f"Checkpoint session: {self.session_id}")
            if self.resume:
                logger.info("Resuming from previous checkpoint")

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

    def _dispatch_list_parser(self, source_config: dict) -> list:
        site_type = source_config.get('site_type', 'government')
        parsers = self.SITE_PARSERS.get(site_type, self.SITE_PARSERS['government'])

        selectors = []
        config_selector = source_config.get('list_selector', {})
        if config_selector:
            selectors.append(config_selector)
        selectors.extend(parsers['list_selectors'])
        return selectors

    def _dispatch_detail_parser(self, source_config: dict) -> list:
        site_type = source_config.get('site_type', 'government')
        parsers = self.SITE_PARSERS.get(site_type, self.SITE_PARSERS['government'])

        selectors = []
        config_selector = source_config.get('detail_selector', {})
        if config_selector:
            selectors.append(config_selector)
        selectors.extend(parsers['detail_selectors'])
        return selectors

    def _try_extract_list_items(self, response, selectors: list) -> list:
        for selector_set in selectors:
            item_selector = selector_set.get('item', 'li')
            title_selector = selector_set.get('title', 'a::text')
            url_selector = selector_set.get('url', 'a::attr(href)')
            date_selector = selector_set.get('date', 'span::text')

            items = response.css(item_selector)
            extracted = []

            for item in items:
                title = item.css(title_selector).get()
                url = item.css(url_selector).get()
                date_str = item.css(date_selector).get()

                if title and url:
                    extracted.append({
                        'title': title.strip(),
                        'url': url.strip(),
                        'date_str': date_str.strip() if date_str else '',
                    })

            if extracted:
                logger.debug(f"Using selector: {selector_set}, found {len(extracted)} items")
                return extracted

        logger.warning("No valid list selector matched, falling back to generic extraction")
        return self._generic_list_extract(response)

    def _generic_list_extract(self, response) -> list:
        items = response.css('li, tr')
        extracted = []
        for item in items:
            links = item.css('a')
            for link in links:
                title = link.css('::text').get()
                url = link.css('::attr(href)').get()
                if title and url and len(title.strip()) > 4:
                    date_candidates = item.css('span::text, td::text, em::text').getall()
                    date_str = ''
                    for dc in date_candidates:
                        if self._looks_like_date(dc.strip()):
                            date_str = dc.strip()
                            break
                    extracted.append({
                        'title': title.strip(),
                        'url': url.strip(),
                        'date_str': date_str,
                    })
        return extracted

    def _looks_like_date(self, text: str) -> bool:
        if not text:
            return False
        patterns = [
            r'\d{4}[-./年]\d{1,2}[-./月]\d{1,2}',
            r'\d{4}[-./]\d{1,2}[-./]\d{1,2}',
            r'\d{1,2}[-./月]\d{1,2}[日]',
        ]
        for p in patterns:
            if re.search(p, text):
                return True
        return False

    def _try_extract_detail(self, response, selectors: list) -> dict:
        for selector_set in selectors:
            title_selector = selector_set.get('title', 'h1::text')
            content_selector = selector_set.get('content', 'body ::text')
            date_selector = selector_set.get('publish_date', '.date::text')
            source_selector = selector_set.get('source', '.source::text')

            title_parts = response.css(title_selector).getall()
            title = ''.join(title_parts).strip()

            if title and len(title) > 2:
                content_parts = response.css(content_selector).getall()
                content = '\n'.join([p.strip() for p in content_parts if p.strip()])

                date_parts = response.css(date_selector).getall()
                publish_date = ''
                for dp in date_parts:
                    parsed = self._parse_date(dp.strip())
                    if parsed:
                        publish_date = parsed
                        break

                source_parts = response.css(source_selector).getall()
                source_org = ''.join([p.strip() for p in source_parts if p.strip()])

                logger.debug(f"Using detail selector: {selector_set}")
                return {
                    'title': title,
                    'content': content,
                    'publish_date': publish_date,
                    'source_org': source_org,
                }

        logger.warning("No valid detail selector matched, using generic extraction")
        return self._generic_detail_extract(response)

    def _generic_detail_extract(self, response) -> dict:
        titles = response.css('h1::text, h2::text, .title::text').getall()
        title = ''
        for t in titles:
            if t.strip() and len(t.strip()) > 4:
                title = t.strip()
                break

        contents = response.css('article ::text, .content ::text, #content ::text, body ::text').getall()
        content = '\n'.join([c.strip() for c in contents if c.strip() and len(c.strip()) > 1])

        date_candidates = response.css(
            '.date::text, .time::text, .publish::text, '
            '.publish-time::text, [class*="time"]::text, [class*="date"]::text'
        ).getall()
        publish_date = ''
        for dc in date_candidates:
            parsed = self._parse_date(dc.strip())
            if parsed:
                publish_date = parsed
                break

        return {
            'title': title,
            'content': content,
            'publish_date': publish_date,
            'source_org': '',
        }

    def _should_skip_url(self, url: str, source: str) -> bool:
        if not self.use_checkpoint:
            return False
        if self.incremental and checkpoint.is_url_visited(url, incremental=True):
            logger.debug(f"Skipping visited URL via checkpoint: {url[:80]}")
            return True
        if checkpoint.is_url_failed(url, max_retries=3):
            logger.warning(f"Skipping repeatedly failed URL: {url[:80]}")
            return True
        return False

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

        if self.use_checkpoint:
            checkpoint.update_source_progress(source_code, page)
            checkpoint.mark_url_visited(response.url, source=source_code)

        site_type = source_config.get('site_type', 'government')
        logger.debug(f"Parsing list for site_type={site_type}, source={source_code}")

        list_selectors = self._dispatch_list_parser(source_config)
        extracted_items = self._try_extract_list_items(response, list_selectors)
        logger.info(f"Found {len(extracted_items)} items on page {page} of {source_config['name']} (type={site_type})")

        extracted_count = 0
        for item in extracted_items:
            try:
                title = item['title']
                url = item['url']
                date_str = item['date_str']

                if not title or not url:
                    continue

                full_url = urljoin(response.url, url)

                if self._should_skip_url(full_url, source_code):
                    self.stats['duplicates_skipped'] += 1
                    continue

                publish_date = self._parse_date(date_str)
                if not self._date_in_range(publish_date):
                    logger.debug(f"Policy {title} date {publish_date} out of range, skipping")
                    continue

                if self.incremental and db.policy_exists(full_url):
                    self.stats['duplicates_skipped'] += 1
                    if STOP_ON_DUPLICATE:
                        logger.info(f"Duplicate found, stopping crawl for {source_code} page {page}")
                        if self.use_checkpoint:
                            checkpoint.mark_url_processed(response.url, source=source_code, saved=False)
                        return
                    continue

                if self._is_policy_related(title):
                    self.stats['policies_found'] += 1
                    self.stats['total_requests'] += 1
                    extracted_count += 1

                    if self.use_checkpoint:
                        checkpoint.mark_url_visited(full_url, source=source_code)

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

        if extracted_count == 0 and page == 1:
            logger.warning(f"No policy items extracted from {source_code}, site_type={site_type}")
            logger.warning("  Check list_selector or verify page content structure")

        if page < self.max_pages and len(extracted_items) > 0:
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

        if self.use_checkpoint and page == self.max_pages:
            checkpoint.mark_url_processed(response.url, source=source_code, saved=False)

    def parse_detail(self, response):
        source_code = response.meta.get('source_code')
        source_config = response.meta.get('source_config')
        title = response.meta.get('title')
        publish_date = response.meta.get('publish_date')

        log_crawl_event(logger, source_config['name'], response.url, 'success', 
                       f"Detail: {title[:50]}...")
        self.stats['success_requests'] += 1

        site_type = source_config.get('site_type', 'government')

        try:
            detail_selectors = self._dispatch_detail_parser(source_config)
            extracted = self._try_extract_detail(response, detail_selectors)

            if extracted['title'] and not title:
                title = self._clean_text(extracted['title'])
            elif title:
                title = self._clean_text(title)
            else:
                title = ''

            content = self._clean_text(extracted['content'])

            if not publish_date and extracted['publish_date']:
                publish_date = extracted['publish_date']

            source_org = self._clean_text(extracted['source_org']) or source_config.get('name', '')

            if not self._date_in_range(publish_date):
                logger.debug(f"Policy {title} date {publish_date} out of range, skipping")
                if self.use_checkpoint:
                    checkpoint.mark_url_processed(response.url, source=source_code, saved=False)
                return

            if not publish_date:
                publish_date = datetime.now().strftime('%Y-%m-%d')

            doc_number = self._extract_doc_number(response)
            content_length = len(content)

            if content_length < MIN_CONTENT_LENGTH:
                logger.warning(f"Content too short ({content_length} chars): {title[:50]}")
                if content_length < 50:
                    if self.use_checkpoint:
                        checkpoint.mark_url_processed(response.url, source=source_code, saved=False)
                    return

            content = content[:MAX_CONTENT_LENGTH]

            attachments = []
            attachment_urls = response.css(self.DEFAULT_ATTACHMENT_SELECTOR).getall()
            attachment_urls += response.css(source_config.get('attachment_selector', '')).getall()
            attachment_urls = list(set(attachment_urls))[:20]

            for att_url in attachment_urls:
                full_att_url = urljoin(response.url, att_url)
                att_name = self._extract_attachment_name(response, att_url)
                attachments.append(AttachmentItem(
                    name=att_name or os.path.basename(urlparse(full_att_url).path),
                    url=full_att_url,
                    type=self._detect_attachment_type(full_att_url),
                ))

            self.stats['attachments_found'] += len(attachments)

            policy_item = PolicyItem(
                title=title,
                url=response.url,
                source_code=source_code,
                source_name=source_config.get('name', ''),
                source_level=source_config.get('level', 'provincial'),
                category='待分类',
                publish_date=publish_date,
                doc_number=doc_number,
                content=content,
                content_length=content_length,
                source_org=source_org,
                attachments=attachments,
                list_page=response.meta.get('list_url', ''),
            )

            self.stats['policies_saved'] += 1

            if self.use_checkpoint:
                checkpoint.mark_url_processed(response.url, source=source_code, saved=True)

            yield policy_item

        except Exception as e:
            log_error_with_context(logger, e, f"Error parsing detail page {response.url}")
            if self.use_checkpoint:
                checkpoint.mark_url_failed(response.url, e, source=source_code)
            self.stats['failed_requests'] += 1
            return

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

        if self.use_checkpoint:
            checkpoint.mark_url_failed(url, failure.value, source=source_code)

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

        if self.use_checkpoint:
            if reason == 'finished':
                checkpoint.end_session(status='completed')
            elif reason == 'shutdown':
                checkpoint.end_session(status='interrupted')
            else:
                checkpoint.end_session(status=reason)
            checkpoint_stats = checkpoint.get_statistics()
            logger.info("=" * 60)
            logger.info("CHECKPOINT STATISTICS")
            logger.info("=" * 60)
            for k, v in checkpoint_stats.items():
                logger.info(f"  {k:25s}: {v}")
            checkpoint.save(force=True)
