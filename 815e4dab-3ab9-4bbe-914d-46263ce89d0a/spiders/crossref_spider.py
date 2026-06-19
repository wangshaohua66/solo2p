import urllib.parse
from typing import Iterator

import scrapy

from spiders.base_journal_spider import BaseJournalSpider


class CrossrefSpider(BaseJournalSpider):
    name = 'crossref'
    allowed_domains = ['api.crossref.org', 'crossref.org', 'doi.org']

    API_JOURNALS = 'https://api.crossref.org/journals'
    API_SEARCH = 'https://api.crossref.org/journals?query={query}'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.api_rate_delay = 0.12

    def start_requests(self) -> Iterator[scrapy.Request]:
        headers = {
            'User-Agent': 'JournalCrawler/1.0 (mailto:contact@example.com)',
            'Accept': 'application/json',
        }

        if self.target_issns:
            for issn in self.target_issns:
                if self.should_skip_issn(issn):
                    continue
                clean_issn = issn.replace('-', '')
                formatted = f'{clean_issn[:4]}-{clean_issn[4:]}' if len(clean_issn) == 8 else clean_issn
                url = f'{self.API_JOURNALS}/{urllib.parse.quote(formatted)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_journal_detail,
                    meta={'issn': issn},
                    priority=10,
                    headers=headers,
                )
        else:
            for offset in range(0, 10000, 100):
                params = {
                    'rows': '100',
                    'offset': str(offset),
                    'sort': 'issn',
                    'order': 'asc',
                }
                url = f'{self.API_JOURNALS}?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_list,
                    meta={'offset': offset},
                    priority=5,
                    headers=headers,
                )

    def parse(self, response, **kwargs):
        return self.parse_list(response, **kwargs)

    def parse_list(self, response, **kwargs):
        import json
        try:
            data = json.loads(response.text)
        except (json.JSONDecodeError, ValueError):
            self.logger_instance.warning(f'Failed to parse Crossref list: {response.url}')
            return

        message = data.get('message', {}) if isinstance(data, dict) else {}
        items = message.get('items', [])
        total_results = message.get('total-results', 0)

        headers = {
            'User-Agent': 'JournalCrawler/1.0 (mailto:contact@example.com)',
            'Accept': 'application/json',
        }

        for item in items:
            if not isinstance(item, dict):
                continue

            issn = ''
            issn_list = item.get('ISSN', []) or []
            if issn_list:
                issn = issn_list[0]

            if issn and self.should_skip_issn(issn):
                continue

            if issn:
                url = f'{self.API_JOURNALS}/{urllib.parse.quote(issn)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_journal_detail,
                    meta={'preview': item},
                    priority=15,
                    headers=headers,
                )
            else:
                yield from self._process_single(item, response.url)

        if 'offset' in response.meta:
            offset = response.meta['offset']
            next_offset = offset + 100
            if next_offset < min(total_results, 10000):
                params = {'rows': '100', 'offset': str(next_offset)}
                url = f'{self.API_JOURNALS}?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_list,
                    meta={'offset': next_offset},
                    priority=5,
                    headers=headers,
                )

    def parse_journal_detail(self, response, **kwargs):
        import json
        try:
            data = json.loads(response.text)
        except (json.JSONDecodeError, ValueError):
            self.logger_instance.warning(f'Failed to parse Crossref detail')
            return

        message = data.get('message', {}) if isinstance(data, dict) else {}
        preview = response.meta.get('preview', {})
        item_data = message if message else preview

        yield from self._process_single(item_data, response.url)

    def _process_single(self, item: dict, source_url: str):
        issn_list = item.get('ISSN', []) or []
        issn_types = item.get('issn-type', []) or []

        issn_print = ''
        issn_online = ''
        for it in issn_types:
            if isinstance(it, dict):
                itype = it.get('type', '')
                if itype == 'print':
                    issn_print = it.get('value', '')
                elif itype == 'electronic':
                    issn_online = it.get('value', '')

        if not issn_print and issn_list:
            issn_print = issn_list[0]
        if not issn_online and len(issn_list) > 1:
            issn_online = issn_list[1]

        if issn_print and self.should_skip_issn(issn_print):
            return

        self.report_progress()

        titles = item.get('title', []) or []
        if isinstance(titles, str):
            titles = [titles]

        subjects = []
        for subj in item.get('subjects', []) or []:
            if isinstance(subj, dict):
                name = subj.get('name') or subj.get('ASJC')
                if name:
                    subjects.append(str(name))
            elif isinstance(subj, str):
                subjects.append(subj)

        publisher = item.get('publisher', '')
        if isinstance(publisher, dict):
            publisher = publisher.get('name', '')

        content = {
            'journal_name_en': titles[0] if titles else '',
            'journal_name_cn': '',
            'issn_print': issn_print,
            'issn_online': issn_online,
            'eissn': issn_online,
            'publisher': str(publisher),
            'country': '',
            'language': [],
            'subject_category': list(set(subjects)),
            'indexed_databases': ['Crossref'],
            'official_website': (item.get('URL') or ''),
            'article_count': item.get('counts', {}).get('current-dois', {}).get('total') if isinstance(item.get('counts'), dict) else None,
            'citation_count': item.get('counts', {}).get('total-citations') if isinstance(item.get('counts'), dict) else None,
            'founding_year': self._extract_founding(item),
        }

        item_obj = self.build_item(content, source_url=source_url)

        if content['journal_name_en'] or issn_print:
            self.success_count += 1
            self.record_progress(issn_print, 'completed')
            yield item_obj
        else:
            self.fail_count += 1

    def _extract_founding(self, item: dict):
        coverage = item.get('coverage', {}) or {}
        if isinstance(coverage, dict):
            for key in ('deposits', 'abstracts', 'licenses'):
                cov = coverage.get(key, {}) or {}
                if isinstance(cov, dict):
                    backfile = cov.get('backfile', {}) or {}
                    if isinstance(backfile, dict):
                        years = sorted(backfile.keys()) if backfile else []
                        if years:
                            try:
                                return int(years[0])
                            except (ValueError, TypeError):
                                pass
        return None
