import urllib.parse
import random
import time
from typing import Iterator

import scrapy

from spiders.base_journal_spider import BaseJournalSpider


class GoogleScholarSpider(BaseJournalSpider):
    name = 'google_scholar'
    allowed_domains = ['scholar.google.com', 'scholar.google.com.hk', 'scholar.googleusercontent.com']

    BASE_URL = 'https://scholar.google.com'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.request_delay_range = (3.0, 8.0)
        self._last_request_time = 0

    def start_requests(self) -> Iterator[scrapy.Request]:
        if self.target_issns:
            for issn in self.target_issns:
                if self.should_skip_issn(issn):
                    continue
                query = f'source:{issn.replace("-", "")}'
                params = {
                    'q': query,
                    'hl': 'en',
                    'as_sdt': '0,5',
                    'scisbd': '1',
                }
                url = f'{self.BASE_URL}/scholar?{urllib.parse.urlencode(params)}'
                yield self._build_request(url, self.parse_search, {'issn': issn})
        else:
            keywords = ['science', 'technology', 'medicine', 'engineering', 'computer',
                        'chemistry', 'physics', 'biology', 'economics', 'mathematics']
            for kw in keywords:
                params = {
                    'q': f'{kw} journal site:scholar.google.com',
                    'hl': 'en',
                    'as_sdt': '0,5',
                }
                url = f'{self.BASE_URL}/scholar?{urllib.parse.urlencode(params)}'
                yield self._build_request(url, self.parse_search, {'keyword': kw})

    def _build_request(self, url, callback, meta):
        self._add_jitter_delay()
        return scrapy.Request(
            url=url,
            callback=callback,
            meta=meta,
            priority=10,
            cookies={'CONSENT': 'YES+cb.20240101-01-p0.en-GB+FX+000'},
        )

    def _add_jitter_delay(self):
        delay = random.uniform(*self.request_delay_range)
        elapsed = time.time() - self._last_request_time
        if elapsed < delay:
            time.sleep(delay - elapsed)
        self._last_request_time = time.time()

    def parse(self, response, **kwargs):
        return self.parse_search(response, **kwargs)

    def parse_search(self, response, **kwargs):
        if 'captcha' in response.url.lower() or 'unusual traffic' in response.text.lower():
            self.logger_instance.warning('Google Scholar CAPTCHA detected! Switching strategy...')
            return

        journal_entries = response.xpath(
            '//div[@class="gs_ri"] | //div[contains(@class,"gs_or")]'
        )
        self.logger_instance.debug(f'Found {len(journal_entries)} entries on page')

        issn = response.meta.get('issn', '')

        for entry in journal_entries:
            title = entry.xpath('.//h3/a/text() | .//h3/span/text()').get()
            venue = entry.xpath('.//div[@class="gs_a"]//text()').getall()
            venue_text = ' '.join(venue).strip()

            source_names = self._extract_source(venue_text)
            journal_name = self._extract_journal_name(venue_text)

            data = {
                'journal_name_en': title or journal_name,
                'journal_name_cn': '',
                'issn_print': issn,
                'publisher': self._extract_publisher(venue_text),
                'subject_category': [response.meta.get('keyword', '')] if response.meta.get('keyword') else [],
                'indexed_databases': ['Google Scholar'],
                'article_count': self._extract_count(entry, 'articles'),
                'citation_count': self._extract_count(entry, 'cited'),
                'h_index': self._extract_metric(entry, 'h-index'),
                'impact_factor_current': self._extract_metric(entry, 'impact factor'),
            }

            self.report_progress()
            item = self.build_item(data, source_url=response.url)

            if data['journal_name_en']:
                self.success_count += 1
                self.record_progress(issn, 'completed')
                yield item
            else:
                self.fail_count += 1

        next_page = response.xpath('//td[@class="b nav-end"]/a/@href | //button[@name="next"]/following-sibling::a/@href').get()
        if next_page and 'page' not in response.meta:
            if random.random() < 0.3:
                next_url = response.urljoin(next_page)
                meta = dict(response.meta)
                meta['page'] = meta.get('page', 1) + 1
                if meta['page'] <= 3:
                    yield self._build_request(next_url, self.parse_search, meta)

    def parse_journal_detail(self, response, **kwargs):
        return None

    def _extract_source(self, text: str) -> list:
        sources = []
        if 'SCI' in text or 'WoS' in text:
            sources.append('SCI')
        if 'EI' in text:
            sources.append('EI')
        if 'PubMed' in text or 'MEDLINE' in text:
            sources.append('PubMed')
        sources.append('Google Scholar')
        return sources

    def _extract_journal_name(self, text: str) -> str:
        parts = text.split(' - ')
        if parts:
            name_part = parts[0].strip()
            if ',' in name_part:
                name_part = name_part.split(',')[0].strip()
            if len(name_part) > 3 and not name_part.isdigit():
                return name_part
        return ''

    def _extract_publisher(self, text: str) -> str:
        parts = text.split(' - ')
        if len(parts) >= 2:
            pub_part = parts[-1].strip()
            if pub_part and len(pub_part) < 100:
                return pub_part.split(',')[0].strip()
        return ''

    def _extract_count(self, entry, keyword: str):
        texts = entry.xpath('.//text()').getall()
        import re
        for t in texts:
            if keyword.lower() in t.lower():
                match = re.search(r'(\d[\d,]*)', t)
                if match:
                    try:
                        return int(match.group(1).replace(',', ''))
                    except ValueError:
                        pass
        return None

    def _extract_metric(self, entry, metric: str):
        import re
        texts = entry.xpath('.//text()').getall()
        for t in texts:
            if metric.lower() in t.lower():
                match = re.search(r'(\d+\.?\d*)', t)
                if match:
                    try:
                        val = float(match.group(1))
                        return int(val) if val.is_integer() else val
                    except ValueError:
                        pass
        return None
