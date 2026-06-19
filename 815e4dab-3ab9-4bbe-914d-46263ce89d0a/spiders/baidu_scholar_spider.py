import urllib.parse
import random
import time
from typing import Iterator

import scrapy

from spiders.base_journal_spider import BaseJournalSpider


class BaiduScholarSpider(BaseJournalSpider):
    name = 'baidu_scholar'
    allowed_domains = ['xueshu.baidu.com', 'baike.baidu.com']

    BASE_URL = 'https://xueshu.baidu.com'
    SEARCH_URL = 'https://xueshu.baidu.com/s'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.request_delay_range = (2.0, 5.0)
        self._last_request_time = 0

    def start_requests(self) -> Iterator[scrapy.Request]:
        yield from self.generate_retry_requests()
        if self.target_issns:
            for issn in self.target_issns:
                if self.should_skip_issn(issn):
                    continue
                params = {
                    'wd': issn,
                    'rsv_bp': '1',
                    'tn': 'SE_xueshu',
                }
                url = f'{self.SEARCH_URL}?{urllib.parse.urlencode(params)}'
                yield self._build_request(url, self.parse_search, {'issn': issn})
        else:
            keywords = ['核心期刊', 'SCI期刊', 'EI期刊', 'CSSCI', 'CSCD', '北大核心']
            for kw in keywords:
                params = {
                    'wd': kw,
                    'rsv_bp': '1',
                    'tn': 'SE_xueshu',
                }
                url = f'{self.SEARCH_URL}?{urllib.parse.urlencode(params)}'
                yield self._build_request(url, self.parse_search, {'keyword': kw})

    def _build_request(self, url, callback, meta):
        self._add_delay()
        return scrapy.Request(url=url, callback=callback, meta=meta, priority=10)

    def _add_delay(self):
        delay = random.uniform(*self.request_delay_range)
        elapsed = time.time() - self._last_request_time
        if elapsed < delay:
            time.sleep(delay - elapsed)
        self._last_request_time = time.time()

    def parse(self, response, **kwargs):
        return self.parse_search(response, **kwargs)

    def parse_search(self, response, **kwargs):
        issn = response.meta.get('issn', '')

        journal_links = response.xpath(
            '//a[contains(@href,"/journal") or contains(@class,"journal_name")]/@href | '
            '//div[contains(@class,"result")]//h3/a/@href'
        ).getall()

        self.logger_instance.debug(f'Found {len(journal_links)} journal links')

        for link in journal_links:
            if not link:
                continue
            detail_url = response.urljoin(link)
            meta = {'issn': issn}
            yield self._build_request(detail_url, self.parse_journal_detail, meta)

        next_page = response.xpath(
            '//a[contains(text(),"下一页") or contains(@class,"n")]/@href'
        ).get()
        if next_page and 'page' not in response.meta:
            page = response.meta.get('page', 0) + 1
            if page <= 5:
                next_url = response.urljoin(next_page)
                meta = dict(response.meta)
                meta['page'] = page
                yield self._build_request(next_url, self.parse_search, meta)

    def parse_journal_detail(self, response, **kwargs):
        journal_name = self.safe_extract(
            response, '//h1[contains(@class,"title") or contains(@class,"name")]/text() | '
                     '//div[contains(@class,"journal_title")]//text()'
        ) or self._extract(response, '期刊名称') or ''
        self._notify_progress(journal_name, response.meta.get('issn', ''), response.url)
        self.report_progress()
        issn_print = response.meta.get('issn', '') or self._extract(response, 'ISSN')

        data = {
            'journal_name_cn': journal_name,
            'journal_name_en': self._extract(response, '英文名称'),
            'issn_print': issn_print,
            'cn_number': self._extract(response, 'CN') or self._extract(response, 'CN号'),
            'publisher': self._extract(response, '主办单位') or self._extract(response, '出版者'),
            'organizer': [self._extract(response, '主办单位')] if self._extract(response, '主办单位') else [],
            'publication_cycle': self._extract(response, '周期') or self._extract(response, '出版周期'),
            'founding_year': self._extract_int(response, '创刊'),
            'country': '中国',
            'language': ['中文'],
            'subject_category': self._extract_list(response, '学科'),
            'indexed_databases': self._parse_indexed(response),
            'pku_core': self._check_label(response, '北大核心'),
            'cscd_status': self._check_label(response, 'CSCD'),
            'sci_status': self._check_label(response, 'SCI'),
            'ei_status': self._check_label(response, 'EI'),
            'impact_factor_current': self._extract_float(response, '影响因子'),
            'official_website': self.safe_extract(response, '//a[contains(text(),"官网")]/@href'),
            'editor_in_chief': self._extract(response, '主编'),
            'contact_email': self._extract_list(response, '邮箱') or self.safe_extract_all(response, '//a[contains(@href,"mailto:")]/@href'),
            'contact_phone': self._extract_list(response, '电话'),
            'contact_address': self._extract(response, '地址'),
            'postal_code': self._extract(response, '邮编'),
            'journal_abstract': self.safe_extract(
                response, '//div[contains(@class,"abstract") or contains(@class,"intro")]/p/text() | '
                         '//div[@class="journal_content"]/text()'
            ),
            'review_cycle': self._extract(response, '审稿周期'),
            'publication_fee': self._extract(response, '版面费'),
        }

        item = self.build_item(data, source_url=response.url)

        if data.get('journal_name_cn') or issn_print:
            self.success_count += 1
            self.record_progress(issn_print, 'completed')
            return item
        else:
            self.fail_count += 1
            self.record_progress(issn_print, 'parse_failed')
            return None

    def _extract(self, response, label: str) -> str:
        xpaths = [
            f'//div[contains(.,"{label}")]//span[last()]/text()',
            f'//li[contains(.,"{label}")]/*[last()]/text()',
            f'//dt[contains(text(),"{label}")]/following-sibling::dd[1]/text()',
            f'//span[contains(text(),"{label}")]/following-sibling::span[1]/text()',
        ]
        for xp in xpaths:
            result = self.safe_extract(response, xp)
            if result:
                return result
        return ''

    def _extract_list(self, response, label: str) -> list:
        import re
        text = response.text
        pattern = rf'{label}[：:\s]*([^<\n\r，,；;]+)'
        match = re.search(pattern, text)
        if match:
            items = [i.strip() for i in re.split(r'[,，;；、]', match.group(1)) if i.strip()]
            return items[:10]
        return []

    def _extract_int(self, response, label: str):
        import re
        text = self._extract(response, label)
        if text:
            match = re.search(r'\d{4}', text)
            if match:
                try:
                    return int(match.group())
                except ValueError:
                    pass
        return None

    def _extract_float(self, response, label: str):
        import re
        text = self._extract(response, label)
        if text:
            match = re.search(r'[\d.]+', text)
            if match:
                try:
                    return float(match.group())
                except ValueError:
                    pass
        return None

    def _parse_indexed(self, response) -> list:
        indexed = ['百度学术']
        text = response.text
        label_map = {
            '北大核心': 'PKU Core',
            'CSSCI': 'CSSCI',
            'CSCD': 'CSCD',
            'SCI': 'SCI',
            'EI': 'EI',
            'CSTPCD': 'CSTPCD',
            '统计源': 'CSTPCD',
        }
        for key, val in label_map.items():
            if key in text and val not in indexed:
                indexed.append(val)
        return indexed

    def _check_label(self, response, keyword: str) -> str:
        text = response.text
        if keyword in text:
            return '是'
        return ''
