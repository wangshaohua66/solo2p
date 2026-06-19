import urllib.parse
import time
from typing import Iterator

import scrapy

from spiders.base_journal_spider import BaseJournalSpider


class PubMedSpider(BaseJournalSpider):
    name = 'pubmed'
    allowed_domains = ['ncbi.nlm.nih.gov', 'pubmed.ncbi.nlm.nih.gov', 'eutils.ncbi.nlm.nih.gov']

    ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi'
    ESUMMARY_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi'
    EFETCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi'
    JOURNAL_DETAIL = 'https://www.ncbi.nlm.nih.gov/nlmcatalog/?term={issn}'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.api_key = self.config.get_auth_config('pubmed').get('api_key', '')
        self.rate_limit_delay = 0.35 if self.api_key else 0.5
        self._last_request_time = 0

    def start_requests(self) -> Iterator[scrapy.Request]:
        yield from self.generate_retry_requests()
        base_params = {'db': 'nlmcatalog', 'retmode': 'json'}
        if self.api_key:
            base_params['api_key'] = self.api_key

        if self.target_issns:
            for issn in self.target_issns:
                if self.should_skip_issn(issn):
                    continue
                params = base_params.copy()
                params['term'] = f'{issn.replace("-", "")}[ISSN]'
                params['retmax'] = '5'
                url = f'{self.ESEARCH_URL}?{urllib.parse.urlencode(params)}'
                yield self._build_request(url, self.parse_esearch, {'issn': issn})
        else:
            terms = [
                'journal[pt] AND eng[la]',
                'journal[pt] AND chi[la]',
            ]
            for term in terms:
                params = base_params.copy()
                params['term'] = term
                params['retmax'] = '100'
                url = f'{self.ESEARCH_URL}?{urllib.parse.urlencode(params)}'
                yield self._build_request(url, self.parse_esearch, {'term': term})

    def _build_request(self, url, callback, meta):
        self._rate_limit()
        return scrapy.Request(url=url, callback=callback, meta=meta, priority=10)

    def _rate_limit(self):
        elapsed = time.time() - self._last_request_time
        if elapsed < self.rate_limit_delay:
            time.sleep(self.rate_limit_delay - elapsed)
        self._last_request_time = time.time()

    def parse(self, response, **kwargs):
        return self.parse_esearch(response, **kwargs)

    def parse_esearch(self, response, **kwargs):
        import json
        try:
            data = json.loads(response.text)
        except (json.JSONDecodeError, ValueError):
            self.logger_instance.warning(f'Failed to parse PubMed esearch response')
            return

        id_list = []
        if isinstance(data, dict):
            id_list = data.get('esearchresult', {}).get('idlist', [])

        base_params = {'db': 'nlmcatalog', 'retmode': 'json', 'rettype': 'xml'}
        if self.api_key:
            base_params['api_key'] = self.api_key

        batch_size = 100
        for i in range(0, len(id_list), batch_size):
            batch = id_list[i:i + batch_size]
            if not batch:
                continue
            params = base_params.copy()
            params['id'] = ','.join(batch)
            url = f'{self.ESUMMARY_URL}?{urllib.parse.urlencode(params)}'
            yield self._build_request(url, self.parse_esummary, {'issn': response.meta.get('issn', '')})

        count = int(data.get('esearchresult', {}).get('count', '0'))
        retmax = int(data.get('esearchresult', {}).get('retmax', '0'))
        retstart = int(data.get('esearchresult', {}).get('retstart', '0'))
        if retstart + retmax < count and 'term' in response.meta:
            new_start = retstart + retmax
            if new_start < 5000:
                params = {'db': 'nlmcatalog', 'retmode': 'json'}
                if self.api_key:
                    params['api_key'] = self.api_key
                params['term'] = response.meta['term']
                params['retmax'] = str(retmax)
                params['retstart'] = str(new_start)
                url = f'{self.ESEARCH_URL}?{urllib.parse.urlencode(params)}'
                yield self._build_request(url, self.parse_esearch, {'term': response.meta['term']})

    def parse_esummary(self, response, **kwargs):
        import json
        import xml.etree.ElementTree as ET
        issn_base = response.meta.get('issn', '')
        content_type = response.headers.get('Content-Type', b'').decode()

        result_list = []
        if 'json' in content_type:
            try:
                data = json.loads(response.text)
                result_list = self._parse_json_summary(data)
            except (json.JSONDecodeError, ValueError):
                pass
        else:
            try:
                result_list = self._parse_xml_summary(response.text)
            except ET.ParseError:
                pass

        for record in result_list:
            issn = record.get('issn') or issn_base
            if issn and self.should_skip_issn(issn):
                continue
            journal_name = record.get('title', '')
            self._notify_progress(journal_name, issn, response.url)
            self.report_progress()

            data = {
                'journal_name_en': record.get('title', ''),
                'journal_name_cn': record.get('title_cn', ''),
                'issn_print': record.get('issn_print') or issn,
                'issn_online': record.get('issn_online'),
                'eissn': record.get('eissn'),
                'publisher': record.get('publisher', ''),
                'publication_cycle': record.get('frequency', ''),
                'founding_year': record.get('year'),
                'country': record.get('country', ''),
                'language': record.get('language', []),
                'subject_category': record.get('subjects', []),
                'indexed_databases': ['PubMed', 'MEDLINE'],
                'official_website': record.get('url', ''),
                'editor_in_chief': record.get('editor', ''),
                'contact_address': record.get('address', ''),
                'contact_email': [record.get('email')] if record.get('email') else [],
                'journal_scope': record.get('scope', ''),
                'article_count': record.get('article_count'),
            }

            if 'PubMed Central' in str(record) or 'PMC' in str(record):
                data['indexed_databases'].append('PMC')

            item = self.build_item(data, source_url=response.url)

            if data.get('journal_name_en') or data.get('issn_print'):
                self.success_count += 1
                self.record_progress(issn, 'completed')
                yield item
            else:
                self.fail_count += 1
                self.record_progress(issn, 'parse_failed')

    def parse_journal_detail(self, response, **kwargs):
        return None

    def _parse_json_summary(self, data: dict) -> list:
        results = []
        result_set = data.get('result', {})
        uids = data.get('header', {}).get('uids', []) or result_set.get('uids', [])
        for uid in uids:
            item = result_set.get(str(uid), {})
            if not item:
                continue
            record = {}
            record['title'] = item.get('title', item.get('fulljournalname', ''))
            record['issn_print'] = item.get('issn', '')
            record['issn_online'] = item.get('essn', '')
            record['eissn'] = item.get('essn', '')
            record['publisher'] = item.get('publishername', '')
            record['frequency'] = item.get('pubfreq', '')
            record['country'] = item.get('country', '')
            record['language'] = [l.strip() for l in item.get('language', []) if l.strip()]
            if isinstance(item.get('language'), str):
                record['language'] = [item['language']]
            record['subjects'] = item.get('publicationtype', [])
            record['article_count'] = item.get('pmcrefcount')
            results.append(record)
        return results

    def _parse_xml_summary(self, xml_text: str) -> list:
        import xml.etree.ElementTree as ET
        results = []
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError:
            return results

        for docsum in root.findall('.//DocumentSummary'):
            record = {}
            title_elem = docsum.find('.//Title')
            if title_elem is not None:
                record['title'] = title_elem.text or ''

            for tag, field in [('ISSN', 'issn_print'), ('ESSN', 'eissn'),
                                 ('Publisher', 'publisher'),
                                 ('PublicationFrequency', 'frequency'),
                                 ('Country', 'country'),
                                 ('Url', 'url')]:
                elem = docsum.find(f'.//{tag}')
                if elem is not None and elem.text:
                    record[field] = elem.text

            langs = docsum.findall('.//Language')
            if langs:
                record['language'] = [l.text for l in langs if l.text]

            subjects = docsum.findall('.//Subject')
            if subjects:
                record['subjects'] = [s.text for s in subjects if s.text]

            results.append(record)
        return results
