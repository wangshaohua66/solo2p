import urllib.parse
from typing import Iterator

import scrapy

from spiders.base_journal_spider import BaseJournalSpider


class WanfangSpider(BaseJournalSpider):
    name = 'wanfang'
    allowed_domains = ['wanfangdata.com.cn', 'wanfangdata.com']

    SEARCH_URL = 'https://sns.wanfangdata.com.cn/perio/toIndex'
    DETAIL_URL = 'https://sns.wanfangdata.com.cn/perio/detail/{journal_id}'
    API_SEARCH = 'https://sns.wanfangdata.com.cn/perio/searchList'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def start_requests(self) -> Iterator[scrapy.Request]:
        yield from self.generate_retry_requests()
        if self.target_issns:
            for issn in self.target_issns:
                if self.should_skip_issn(issn):
                    continue
                formdata = {
                    'searchType': 'perio',
                    'searchWord': issn,
                    'isMatch': 'true',
                    'pageNum': '1',
                    'pageSize': '10',
                }
                yield scrapy.FormRequest(
                    url=self.API_SEARCH,
                    formdata=formdata,
                    callback=self.parse_api_response,
                    meta={'issn': issn},
                    priority=10,
                    headers={'X-Requested-With': 'XMLHttpRequest'},
                )
        else:
            for page in range(1, 201):
                formdata = {
                    'searchType': 'perio',
                    'searchWord': '',
                    'pageNum': str(page),
                    'pageSize': '20',
                    'coreClass': '核心期刊',
                }
                yield scrapy.FormRequest(
                    url=self.API_SEARCH,
                    formdata=formdata,
                    callback=self.parse_api_response,
                    meta={'page': page},
                    priority=5,
                )

    def parse(self, response, **kwargs):
        return self.parse_api_response(response, **kwargs)

    def parse_api_response(self, response, **kwargs):
        import json
        try:
            data = json.loads(response.text)
        except (json.JSONDecodeError, ValueError):
            self.logger_instance.warning(f'Failed to parse API response: {response.url}')
            return

        results = []
        if isinstance(data, dict):
            results = data.get('list', []) or data.get('data', {}).get('list', []) or []
        elif isinstance(data, list):
            results = data

        if not results:
            self.logger_instance.debug(f'No results in API response for {response.url}')
            return

        for item in results:
            journal_id = item.get('id') or item.get('perioId') or item.get('ID')
            if journal_id:
                detail_url = self.DETAIL_URL.format(journal_id=journal_id)
                meta = {
                    'issn': response.meta.get('issn', item.get('issn')),
                    'preview_data': item,
                }
                yield scrapy.Request(
                    url=detail_url,
                    callback=self.parse_journal_detail,
                    meta=meta,
                    priority=20,
                )

    def parse_journal_detail(self, response, **kwargs):
        preview = response.meta.get('preview_data', {})
        journal_name = self._extract_from_detail(response, '刊名') or preview.get('title') or preview.get('name') or ''
        self._notify_progress(journal_name, response.meta.get('issn', ''), response.url)
        self.report_progress()
        issn_print = response.meta.get('issn', '') or self._extract_from_detail(response, 'ISSN')

        data = {
            'journal_name_cn': journal_name,
            'journal_name_en': self._extract_from_detail(response, '英文名'),
            'issn_print': issn_print,
            'cn_number': self._extract_from_detail(response, 'CN'),
            'publisher': self._extract_from_detail(response, '主办单位'),
            'organizer': [self._extract_from_detail(response, '主办单位')],
            'publication_cycle': self._extract_from_detail(response, '刊期') or self._extract_from_detail(response, '出版周期'),
            'founding_year': self._extract_from_detail(response, '创刊时间'),
            'country': '中国',
            'language': ['中文'],
            'subject_category': self._extract_list(response, '学科分类'),
            'indexed_databases': self._parse_indexed(response),
            'pku_core': self._check_core(response, '北大核心'),
            'cscd_status': self._check_core(response, 'CSCD'),
            'sci_status': self._check_core(response, 'SCI'),
            'ei_status': self._check_core(response, 'EI'),
            'impact_factor_current': self._extract_float(response, '影响因子'),
            'official_website': self.safe_extract(response, '//a[contains(text(),"官网") or contains(text(),"官方网站")]/@href'),
            'editor_in_chief': self._extract_from_detail(response, '主编'),
            'contact_email': self._extract_list(response, 'Email') or self.safe_extract_all(response, '//a[contains(@href,"mailto:")]/@href'),
            'contact_phone': self._extract_list(response, '电话'),
            'contact_address': self._extract_from_detail(response, '地址'),
            'postal_code': self._extract_from_detail(response, '邮编'),
            'journal_abstract': self._extract_from_detail(response, '期刊简介') or self.safe_extract(response, '//div[contains(@class,"abstract") or contains(@class,"intro")]//text()'),
            'article_count': preview.get('articleCount'),
            'citation_count': preview.get('citationCount'),
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

    def _extract_from_detail(self, response, label: str) -> str:
        xpaths = [
            f'//label[contains(text(),"{label}")]/following-sibling::span/text()',
            f'//span[contains(text(),"{label}")]/following-sibling::*/text()',
            f'//li[contains(.,"{label}")]//span[last()]/text()',
            f'//div[contains(@class,"info-item")][.//*[contains(text(),"{label}")]]//span[last()]/text()',
            f'//dt[contains(text(),"{label}")]/following-sibling::dd[1]/text()',
        ]
        for xp in xpaths:
            result = self.safe_extract(response, xp)
            if result:
                return result
        return ''

    def _extract_list(self, response, label: str) -> list:
        xpaths = [
            f'//label[contains(text(),"{label}")]/following-sibling::*/a/text()',
            f'//span[contains(text(),"{label}")]/following-sibling::*/a/text()',
            f'//li[contains(.,"{label}")]//a/text()',
        ]
        for xp in xpaths:
            result = self.safe_extract_all(response, xp)
            if result:
                return result
        return []

    def _extract_float(self, response, label: str):
        text = self._extract_from_detail(response, label)
        if text:
            import re
            match = re.search(r'[\d.]+', text)
            if match:
                try:
                    return float(match.group())
                except ValueError:
                    return None
        return None

    def _parse_indexed(self, response) -> list:
        indexed = []
        text = response.text
        label_map = {
            '北大核心': 'PKU Core',
            'CSCD': 'CSCD',
            'CSSCI': 'CSSCI',
            'SCI': 'SCI',
            'SCIE': 'SCIE',
            'EI': 'EI',
            'CSTPCD': 'CSTPCD',
            '统计源': 'CSTPCD',
            '知网收录': 'CNKI',
            '万方收录': 'Wanfang',
            '维普收录': 'VIP',
        }
        for key, val in label_map.items():
            if key in text and val not in indexed:
                indexed.append(val)
        return indexed

    def _check_core(self, response, keyword: str) -> str:
        indexed = self._parse_indexed(response)
        mapping = {
            '北大核心': 'PKU Core',
            'CSCD': 'CSCD',
            'SCI': 'SCI',
            'EI': 'EI',
        }
        if mapping.get(keyword, keyword) in indexed:
            return '是'
        return ''
