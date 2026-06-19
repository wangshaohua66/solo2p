import urllib.parse
from typing import Iterator

import scrapy

from spiders.base_journal_spider import BaseJournalSpider


class WebOfScienceSpider(BaseJournalSpider):
    name = 'webofscience'
    allowed_domains = ['webofscience.com', 'clarivate.com', 'mjl.clarivate.com']

    MASTER_JOURNAL_URL = 'https://mjl.clarivate.com/home'
    SEARCH_URL = 'https://mjl.clarivate.com/search-results'
    API_URL = 'https://mjl.clarivate.com/api/journals/search'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def start_requests(self) -> Iterator[scrapy.Request]:
        yield from self.generate_retry_requests()
        yield scrapy.Request(
            url=self.MASTER_JOURNAL_URL,
            callback=self.parse_home_page,
            priority=30,
            meta={'requires_login': True},
        )

    def parse_home_page(self, response):
        if self.target_issns:
            for issn in self.target_issns:
                if self.should_skip_issn(issn):
                    continue
                clean_issn = issn.replace('-', '')
                params = {'issn': clean_issn}
                url = f'{self.API_URL}?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_api_result,
                    meta={'issn': issn},
                    priority=20,
                    headers={'Accept': 'application/json'},
                )
        else:
            for page in range(0, 200):
                params = {
                    'from': str(page * 50),
                    'size': '50',
                    'sort': 'journalName:asc',
                }
                url = f'{self.API_URL}?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_api_result,
                    meta={'page': page},
                    priority=10,
                    headers={'Accept': 'application/json'},
                )

    def parse(self, response, **kwargs):
        return self.parse_api_result(response, **kwargs)

    def parse_api_result(self, response, **kwargs):
        import json
        try:
            data = json.loads(response.text)
        except (json.JSONDecodeError, ValueError):
            self.logger_instance.warning(f'Failed to parse WoS API response: {response.url}')
            return

        journals = []
        if isinstance(data, dict):
            journals = data.get('journals', []) or data.get('content', []) or [data]
        elif isinstance(data, list):
            journals = data

        if not isinstance(journals, list):
            journals = [journals]

        for journal in journals:
            if not isinstance(journal, dict):
                continue
            issn = journal.get('issn') or journal.get('printIssn') or response.meta.get('issn', '')
            if issn and self.should_skip_issn(issn):
                continue

            jid = journal.get('id') or journal.get('journalId') or ''
            if jid:
                detail_url = f'https://mjl.clarivate.com/journal-profile/{jid}'
                yield scrapy.Request(
                    url=detail_url,
                    callback=self.parse_journal_detail,
                    meta={'api_data': journal, 'issn': issn},
                    priority=25,
                )
            else:
                item = self._build_from_api(journal, response.url)
                if item:
                    yield item

    def parse_journal_detail(self, response, **kwargs):
        api_data = response.meta.get('api_data', {})
        journal_name = api_data.get('journalName') or self._extract_detail(response, 'Journal Name') or self._extract_detail(response, '期刊名称') or ''
        self._notify_progress(journal_name, response.meta.get('issn', ''), response.url)
        self.report_progress()
        issn_print = response.meta.get('issn', '') or self._extract_detail(response, 'ISSN')

        data = {
            'journal_name_cn': self._extract_detail(response, '期刊名称') or journal_name,
            'journal_name_en': journal_name or self._extract_detail(response, 'Journal Name'),
            'issn_print': issn_print,
            'issn_online': self._extract_detail(response, 'Online ISSN') or api_data.get('onlineIssn'),
            'eissn': api_data.get('eissn'),
            'publisher': api_data.get('publisher') or self._extract_detail(response, 'Publisher'),
            'publication_cycle': self._extract_detail(response, 'Frequency') or api_data.get('frequency'),
            'founding_year': api_data.get('foundingYear'),
            'country': self._extract_detail(response, 'Country') or api_data.get('country'),
            'language': [l.strip() for l in (api_data.get('language') or '').split(',') if l.strip()] or self._extract_list(response, 'Language'),
            'subject_category': api_data.get('categories', []) or self._extract_list(response, 'Category'),
            'indexed_databases': self._parse_indexed(api_data, response),
            'impact_factor_current': self._extract_impact(api_data, response, 'JIF'),
            'impact_factor_5year': self._extract_impact(api_data, response, '5Year'),
            'jcr_partition': self._parse_jcr(api_data, response),
            'sci_status': '是' if 'SCI' in str(api_data) or 'SCI' in response.text else '',
            'official_website': api_data.get('homepage') or self.safe_extract(response, '//a[contains(text(),"Visit Journal")]/@href'),
            'editor_in_chief': api_data.get('editorInChief'),
            'acceptance_rate': self._extract_detail(response, 'Acceptance Rate'),
            'review_cycle': self._extract_detail(response, 'Review Time') or self._extract_detail(response, 'Submission to Decision'),
            'submission_url': self.safe_extract(response, '//a[contains(text(),"Submit")]/@href') or api_data.get('submissionUrl'),
            'submission_guide_url': api_data.get('guideUrl'),
            'h_index': api_data.get('hIndex'),
            'article_count': api_data.get('articleCount'),
            'citation_count': api_data.get('citationCount'),
            'journal_scope': self._extract_detail(response, 'Scope') or self._extract_detail(response, 'Aims & Scope'),
        }

        item = self.build_item(data, source_url=response.url)

        if data.get('journal_name_en') or issn_print:
            self.success_count += 1
            self.record_progress(issn_print, 'completed')
            return item
        else:
            self.fail_count += 1
            self.record_progress(issn_print, 'parse_failed')
            return None

    def _build_from_api(self, journal: dict, source_url: str):
        issn = journal.get('issn') or journal.get('printIssn', '')
        journal_name = journal.get('journalName', '')
        if not journal_name and not issn:
            return None

        self._notify_progress(journal_name, issn, source_url)
        self.report_progress()
        data = {
            'journal_name_en': journal_name,
            'issn_print': issn,
            'issn_online': journal.get('onlineIssn'),
            'publisher': journal.get('publisher'),
            'country': journal.get('country'),
            'publication_cycle': journal.get('frequency'),
            'language': [journal.get('language')] if journal.get('language') else [],
            'subject_category': journal.get('categories', []),
            'impact_factor_current': journal.get('jif', journal.get('impactFactor')),
            'impact_factor_5year': journal.get('fiveYearImpactFactor'),
            'jcr_partition': journal.get('jcrQuartiles', {}),
            'indexed_databases': ['SCIE', 'JCR'],
            'founding_year': journal.get('foundingYear'),
            'official_website': journal.get('homepage'),
            'article_count': journal.get('articleCount'),
            'citation_count': journal.get('citationCount'),
            'h_index': journal.get('hIndex'),
        }
        item = self.build_item(data, source_url=source_url)
        self.success_count += 1
        self.record_progress(issn, 'completed')
        return item

    def _extract_detail(self, response, label: str) -> str:
        xpaths = [
            f'//label[contains(text(),"{label}")]/following-sibling::span/text()',
            f'//dt[contains(text(),"{label}")]/following-sibling::dd[1]/text()',
            f'//div[contains(@class,"detail-item")][.//*[contains(text(),"{label}")]]//*[contains(@class,"value")]/text()',
        ]
        for xp in xpaths:
            result = self.safe_extract(response, xp)
            if result:
                return result
        return ''

    def _extract_list(self, response, label: str) -> list:
        xpaths = [
            f'//label[contains(text(),"{label}")]/following-sibling::*/a/text()',
            f'//div[contains(@class,"{label.lower()}")]//span/text()',
        ]
        for xp in xpaths:
            result = self.safe_extract_all(response, xp)
            if result:
                return result
        return []

    def _extract_impact(self, api_data: dict, response, keyword: str):
        if api_data:
            if keyword == 'JIF':
                return api_data.get('jif') or api_data.get('impactFactor')
            if keyword == '5Year':
                return api_data.get('fiveYearImpactFactor')
        import re
        xpaths = [
            f'//div[contains(text(),"{keyword}")]/following-sibling::*//strong/text()',
            f'//*[contains(text(),"{keyword}")]/following-sibling::span/text()',
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

    def _parse_jcr(self, api_data: dict, response) -> list:
        partitions = []
        if api_data:
            quartiles = api_data.get('jcrQuartiles') or api_data.get('quartiles')
            if isinstance(quartiles, dict):
                for cat, q in quartiles.items():
                    partitions.append(f'{cat}: {q}')
            elif isinstance(quartiles, list):
                partitions = [str(q) for q in quartiles]
        import re
        for q in ['Q1', 'Q2', 'Q3', 'Q4']:
            if q in response.text and q not in str(partitions):
                partitions.append(q)
        return partitions

    def _parse_indexed(self, api_data: dict, response) -> list:
        indexed = ['Web of Science']
        text = response.text + str(api_data)
        if 'SCIE' in text or 'Science Citation Index Expanded' in text:
            indexed.append('SCIE')
        if 'SSCI' in text or 'Social Sciences Citation Index' in text:
            indexed.append('SSCI')
        if 'AHCI' in text or 'Arts & Humanities' in text:
            indexed.append('AHCI')
        if 'ESCI' in text:
            indexed.append('ESCI')
        indexed.append('JCR')
        return indexed
