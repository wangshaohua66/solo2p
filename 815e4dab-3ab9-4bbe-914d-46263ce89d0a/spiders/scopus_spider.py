import urllib.parse
from typing import Iterator

import scrapy

from spiders.base_journal_spider import BaseJournalSpider


class ScopusSpider(BaseJournalSpider):
    name = 'scopus'
    allowed_domains = ['scopus.com', 'elsevier.com', 'api.elsevier.com']

    API_SEARCH = 'https://api.elsevier.com/content/serial/title'
    DETAIL_URL = 'https://www.scopus.com/sourceid/{source_id}'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.api_key = self.config.get_auth_config('scopus').get('api_key', '')

    def start_requests(self) -> Iterator[scrapy.Request]:
        yield from self.generate_retry_requests()
        headers = {}
        if self.api_key:
            headers['X-ELS-APIKey'] = self.api_key
            headers['X-ELS-Insttoken'] = self.config.get_auth_config('scopus').get('inst_token', '')
            headers['Accept'] = 'application/json'

        if self.target_issns:
            for issn in self.target_issns:
                if self.should_skip_issn(issn):
                    continue
                params = {'issn': issn.replace('-', '')}
                url = f'{self.API_SEARCH}?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_api_response,
                    meta={'issn': issn},
                    priority=10,
                    headers=headers,
                )
        else:
            for start in range(0, 20000, 200):
                params = {
                    'start': str(start),
                    'count': '200',
                    'field': 'source-id,title,issn,eissn,publisher,subject-area',
                }
                url = f'{self.API_SEARCH}?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_api_response,
                    meta={'start': start},
                    priority=5,
                    headers=headers,
                )

    def parse(self, response, **kwargs):
        return self.parse_api_response(response, **kwargs)

    def parse_api_response(self, response, **kwargs):
        import json
        try:
            data = json.loads(response.text)
        except (json.JSONDecodeError, ValueError):
            self.logger_instance.warning(f'Failed to parse Scopus API response: {response.url}')
            return

        entries = []
        if isinstance(data, dict):
            results = data.get('serial-metadata-response', data)
            entries = results.get('entry', []) or results.get('entry', data)

        if not isinstance(entries, list):
            entries = [entries]

        for entry in entries:
            if not isinstance(entry, dict):
                continue

            source_id = entry.get('source-id') or entry.get('source-id-eid', '').split(':')[-1]
            issn = entry.get('prism:issn') or entry.get('issn') or response.meta.get('issn', '')

            if issn and self.should_skip_issn(issn):
                continue

            if source_id:
                detail_url = self.DETAIL_URL.format(source_id=source_id)
                yield scrapy.Request(
                    url=detail_url,
                    callback=self.parse_journal_detail,
                    meta={'api_data': entry, 'issn': issn},
                    priority=20,
                )
            else:
                item = self._build_from_api(entry, response.url)
                if item:
                    yield item

    def parse_journal_detail(self, response, **kwargs):
        api_data = response.meta.get('api_data', {})
        journal_name = api_data.get('dc:title') or api_data.get('title') or self.safe_extract(
            response, '//h1[contains(@class,"title")]/text() | //h2[contains(@class,"journal-name")]/text()'
        ) or ''
        self._notify_progress(journal_name, response.meta.get('issn', ''), response.url)
        self.report_progress()
        issn_print = response.meta.get('issn', '') or self._extract(response, 'ISSN') or api_data.get('prism:issn')

        data = {
            'journal_name_en': api_data.get('dc:title') or self._extract(response, 'Source Title'),
            'journal_name_cn': self._extract(response, '期刊名称'),
            'issn_print': issn_print,
            'issn_online': api_data.get('prism:eIssn') or self._extract(response, 'Online ISSN'),
            'eissn': api_data.get('prism:eIssn'),
            'publisher': api_data.get('dc:publisher') or self._extract(response, 'Publisher'),
            'publication_cycle': self._extract(response, 'Frequency'),
            'founding_year': self._extract(response, 'Active since'),
            'country': self._extract(response, 'Country') or api_data.get('source-country'),
            'language': [l.strip() for l in (api_data.get('language') or self._extract(response, 'Language') or '').split(',') if l.strip()],
            'subject_category': self._extract_subject(response, api_data),
            'indexed_databases': ['Scopus'],
            'sci_status': '是' if 'SCI' in response.text else '',
            'ei_status': '是' if 'EI' in response.text or 'Compendex' in response.text else '',
            'impact_factor_current': self._extract_cite_score(response) or api_data.get('citeScoreYearInfoList', {}).get('citeScoreCurrentMetric'),
            'impact_factor_5year': self._extract(response, 'SNIP') or self._extract(response, 'SJR'),
            'cas_partition': self._parse_cas(response),
            'h_index': self._extract_int(response, 'h-index'),
            'article_count': self._extract_int(response, 'Documents'),
            'citation_count': self._extract_int(response, 'Citations'),
            'official_website': api_data.get('website') or self.safe_extract(response, '//a[contains(text(),"Homepage")]/@href'),
            'editorial_board': self._extract_list(response, 'Editorial Board'),
            'editor_in_chief': self._extract(response, 'Editor-in-Chief'),
            'open_access': self._extract(response, 'Open Access'),
            'review_cycle': self._extract(response, 'Review Time'),
            'acceptance_rate': self._extract(response, 'Acceptance Rate'),
            'submission_url': self.safe_extract(response, '//a[contains(text(),"Submit")]/@href'),
            'submission_guide_url': self.safe_extract(response, '//a[contains(text(),"Guide") or contains(text(),"Author")]/@href'),
        }

        if 'ei_status' in data and data['ei_status']:
            data['indexed_databases'].append('EI Compendex')

        item = self.build_item(data, source_url=response.url)

        if data.get('journal_name_en') or issn_print:
            self.success_count += 1
            self.record_progress(issn_print, 'completed')
            return item
        else:
            self.fail_count += 1
            self.record_progress(issn_print, 'parse_failed')
            return None

    def _build_from_api(self, entry: dict, source_url: str):
        issn = entry.get('prism:issn') or entry.get('issn', '')
        title = entry.get('dc:title')
        if not title and not issn:
            return None

        self._notify_progress(title or '', issn, source_url)
        self.report_progress()
        subject_areas = []
        sa = entry.get('subject-area')
        if isinstance(sa, list):
            subject_areas = [s.get('$', '') for s in sa if isinstance(s, dict)]
        elif isinstance(sa, dict):
            subject_areas = [sa.get('$', '')]

        data = {
            'journal_name_en': title,
            'issn_print': issn,
            'eissn': entry.get('prism:eIssn'),
            'publisher': entry.get('dc:publisher'),
            'country': entry.get('source-country'),
            'subject_category': subject_areas,
            'indexed_databases': ['Scopus'],
            'impact_factor_current': entry.get('citeScoreYearInfoList', {}).get('citeScoreCurrentMetric'),
        }
        item = self.build_item(data, source_url=source_url)
        self.success_count += 1
        self.record_progress(issn, 'completed')
        return item

    def _extract(self, response, label: str) -> str:
        xpaths = [
            f'//label[contains(text(),"{label}")]/following-sibling::span/text()',
            f'//*[contains(@class,"label")][contains(text(),"{label}")]/following-sibling::*[contains(@class,"value")]/text()',
            f'//dt[contains(text(),"{label}")]/following-sibling::dd[1]/text()',
            f'//div[contains(.,"{label}")]/span[last()]/text()',
        ]
        for xp in xpaths:
            result = self.safe_extract(response, xp)
            if result:
                return result
        return ''

    def _extract_list(self, response, label: str) -> list:
        xpaths = [
            f'//div[contains(@class,"{label.lower().replace(" ","-")}")]//li/text()',
            f'//h3[contains(text(),"{label}")]/following-sibling::ul//li/text()',
        ]
        for xp in xpaths:
            result = self.safe_extract_all(response, xp)
            if result:
                return result
        return []

    def _extract_int(self, response, label: str):
        text = self._extract(response, label)
        if text:
            import re
            match = re.search(r'\d+', text.replace(',', ''))
            if match:
                try:
                    return int(match.group())
                except ValueError:
                    pass
        return None

    def _extract_subject(self, response, api_data: dict) -> list:
        subjects = []
        if api_data:
            sa = api_data.get('subject-area')
            if isinstance(sa, list):
                subjects = [s.get('$', '') if isinstance(s, dict) else str(s) for s in sa if s]
            elif isinstance(sa, dict):
                subjects = [sa.get('$', '')]
        if not subjects:
            subjects = self.safe_extract_all(
                response, '//div[contains(@class,"subject")]//a/text() | '
                         '//span[contains(@class,"subject")]/text()'
            )
        return [s for s in subjects if s]

    def _extract_cite_score(self, response):
        import re
        xpaths = [
            '//div[contains(@class,"cite-score")]//strong/text()',
            '//*[contains(text(),"CiteScore")]/following-sibling::*[1]/text()',
        ]
        for xp in xpaths:
            text = self.safe_extract(response, xp)
            if text:
                match = re.search(r'[\d.]+', text)
                if match:
                    try:
                        return float(match.group())
                    except ValueError:
                        pass
        return None

    def _parse_cas(self, response) -> list:
        partitions = []
        import re
        for zone in ['TOP', '1区', '2区', '3区', '4区']:
            if zone in response.text:
                partitions.append(zone)
        return partitions
