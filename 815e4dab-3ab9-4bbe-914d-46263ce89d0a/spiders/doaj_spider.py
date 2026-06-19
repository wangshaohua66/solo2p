import urllib.parse
from typing import Iterator

import scrapy

from spiders.base_journal_spider import BaseJournalSpider


class DoajSpider(BaseJournalSpider):
    name = 'doaj'
    allowed_domains = ['doaj.org', 'doaj.azurewebsites.net']

    API_URL = 'https://doaj.org/api/search/journals'
    DETAIL_URL = 'https://doaj.org/toc/{issn}'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def start_requests(self) -> Iterator[scrapy.Request]:
        if self.target_issns:
            for issn in self.target_issns:
                if self.should_skip_issn(issn):
                    continue
                query = f'issn:{issn.replace("-", "")}'
                url = f'{self.API_URL}/{urllib.parse.quote(query)}?page=1&pageSize=10'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_api,
                    meta={'issn': issn},
                    priority=10,
                    headers={'Accept': 'application/json'},
                )
        else:
            for page in range(1, 101):
                params = {
                    'query': 'index:lcc AND publisher:*',
                    'page': str(page),
                    'pageSize': '100',
                }
                url = f'{self.API_URL}?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_api,
                    meta={'page': page},
                    priority=5,
                    headers={'Accept': 'application/json'},
                )

    def parse(self, response, **kwargs):
        return self.parse_api(response, **kwargs)

    def parse_api(self, response, **kwargs):
        import json
        try:
            data = json.loads(response.text)
        except (json.JSONDecodeError, ValueError):
            self.logger_instance.warning(f'Failed to parse DOAJ API: {response.url}')
            return

        results = data.get('results', []) if isinstance(data, dict) else []
        total = data.get('total', 0)

        for result in results:
            bibjson = result.get('bibjson', {}) if isinstance(result, dict) else {}
            if not bibjson:
                continue

            issn = ''
            for ident in bibjson.get('identifier', []):
                if ident.get('type') in ('pissn', 'print'):
                    issn = ident.get('id', '')
                    break
            if not issn:
                for ident in bibjson.get('identifier', []):
                    if ident.get('type') in ('eissn', 'issn'):
                        issn = ident.get('id', '')
                        break

            if issn and self.should_skip_issn(issn):
                continue

            self.report_progress()

            subjects = []
            for subj in bibjson.get('subject', []):
                if isinstance(subj, dict):
                    term = subj.get('term') or subj.get('code')
                    if term:
                        subjects.append(term)

            languages = []
            for lang in bibjson.get('language', []):
                if lang:
                    languages.append(str(lang))

            issns = {'print': '', 'online': ''}
            for ident in bibjson.get('identifier', []):
                id_type = ident.get('type', '')
                if id_type in ('pissn', 'print'):
                    issns['print'] = ident.get('id', '')
                elif id_type in ('eissn', 'online'):
                    issns['online'] = ident.get('id', '')

            data = {
                'journal_name_en': bibjson.get('title', ''),
                'journal_name_cn': '',
                'issn_print': issns['print'],
                'issn_online': issns['online'],
                'eissn': issns['online'],
                'publisher': bibjson.get('publisher', ''),
                'country': bibjson.get('country', {}).get('code', '') if isinstance(bibjson.get('country'), dict) else str(bibjson.get('country', '')),
                'publication_cycle': self._get_frequency(bibjson),
                'language': languages,
                'subject_category': subjects,
                'indexed_databases': ['DOAJ'],
                'open_access': '是',
                'official_website': bibjson.get('link', [{}])[0].get('url', '') if bibjson.get('link') else '',
                'submission_url': self._find_link(bibjson, 'submission'),
                'submission_guide_url': self._find_link(bibjson, 'guide'),
                'editorial_board': [bibjson.get('editor', {}).get('name', '')] if isinstance(bibjson.get('editor'), dict) and bibjson.get('editor', {}).get('name') else [],
                'founding_year': bibjson.get('provider', {}).get('inception_date', '').split('-')[0] if isinstance(bibjson.get('provider'), dict) else None,
                'article_count': bibjson.get('article_count'),
                'journal_abstract': bibjson.get('description', ''),
            }

            url = self.DETAIL_URL.format(issn=issn or issns['print'] or issns['online'])
            item = self.build_item(data, source_url=url)

            if data.get('journal_name_en') or issn:
                self.success_count += 1
                self.record_progress(issn or issns['print'], 'completed')
                yield item
            else:
                self.fail_count += 1

        if not self.target_issns and 'page' in response.meta:
            page = response.meta['page']
            if page * 100 < total and page < 100:
                params = {
                    'query': 'index:lcc AND publisher:*',
                    'page': str(page + 1),
                    'pageSize': '100',
                }
                url = f'{self.API_URL}?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_api,
                    meta={'page': page + 1},
                    priority=5,
                )

    def parse_journal_detail(self, response, **kwargs):
        return None

    def _find_link(self, bibjson: dict, link_type: str) -> str:
        for link in bibjson.get('link', []):
            if isinstance(link, dict):
                lt = (link.get('type') or '').lower()
                if link_type in lt:
                    return link.get('url', '')
        return ''

    def _get_frequency(self, bibjson: dict) -> str:
        provider = bibjson.get('provider', {})
        if isinstance(provider, dict):
            return provider.get('publication_time', '') or ''
        return ''
