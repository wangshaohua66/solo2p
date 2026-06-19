import urllib.parse
from typing import Iterator

import scrapy

from spiders.base_journal_spider import BaseJournalSpider


class MicrosoftAcademicSpider(BaseJournalSpider):
    name = 'microsoft_academic'
    allowed_domains = ['academic.microsoft.com', 'api.labs.cognitive.microsoft.com', 'msra.cn']

    API_URL = 'https://api.labs.cognitive.microsoft.com/academic/v1.0/evaluate'
    WEB_URL = 'https://academic.microsoft.com/search'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.api_key = self.config.get_auth_config('microsoft_academic').get('api_key', '')

    def start_requests(self) -> Iterator[scrapy.Request]:
        headers = {}
        if self.api_key:
            headers['Ocp-Apim-Subscription-Key'] = self.api_key

        if self.target_issns:
            for issn in self.target_issns:
                if self.should_skip_issn(issn):
                    continue
                expr = f"Ti='{issn.replace('-','')}' OR ISSN='{issn}'"
                params = {
                    'expr': expr,
                    'attributes': 'Id,Ti,JJ,JN,DN,ISSN,Pt,Y,CitCon,CC,AA.AuN,AW,F.FId,F.FN',
                    'count': '10',
                }
                url = f'{self.API_URL}?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_api,
                    meta={'issn': issn},
                    priority=10,
                    headers=headers,
                )
        else:
            for offset in range(0, 5000, 100):
                params = {
                    'expr': "Pt='3'",
                    'attributes': 'Id,Ti,JJ,JN,DN,ISSN,Pt,Y,CitCon,CC,F.FId,F.FN',
                    'count': '100',
                    'offset': str(offset),
                    'orderby': 'CC:desc',
                }
                url = f'{self.API_URL}?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_api,
                    meta={'offset': offset},
                    priority=5,
                    headers=headers,
                )

            keywords = ['computer science', 'medicine', 'biology', 'chemistry', 'physics']
            for kw in keywords:
                web_params = {
                    'q': kw,
                    'filter': 'Pt==3',
                }
                web_url = f'{self.WEB_URL}?{urllib.parse.urlencode(web_params)}'
                yield scrapy.Request(
                    url=web_url,
                    callback=self.parse_web_search,
                    meta={'keyword': kw},
                    priority=8,
                )

    def parse(self, response, **kwargs):
        return self.parse_api(response, **kwargs)

    def parse_api(self, response, **kwargs):
        import json
        try:
            data = json.loads(response.text)
        except (json.JSONDecodeError, ValueError):
            self.logger_instance.warning(f'Failed to parse MS Academic API response')
            yield from self._fallback_web_parse(response, **kwargs)
            return

        entities = data.get('entities', []) if isinstance(data, dict) else []
        if not isinstance(entities, list):
            entities = [entities]

        for entity in entities:
            if not isinstance(entity, dict):
                continue

            issn = ''
            if entity.get('ISSN'):
                issn = str(entity['ISSN']).replace('-', '')
                if len(issn) == 8:
                    issn = f'{issn[:4]}-{issn[4:]}'

            if not issn:
                issn = response.meta.get('issn', '')

            if issn and self.should_skip_issn(issn):
                continue

            self.report_progress()

            fields = []
            for f in entity.get('F', []) or []:
                if isinstance(f, dict):
                    fn = f.get('FN', '')
                    if fn:
                        fields.append(fn)

            editors = []
            for a in entity.get('AA', []) or []:
                if isinstance(a, dict):
                    name = a.get('AuN', '') or a.get('DAuN', '')
                    if name:
                        editors.append(name)

            journal_name = ''
            names = [entity.get('DN'), entity.get('JN'), entity.get('JJ'), entity.get('Ti')]
            for n in names:
                if n:
                    journal_name = str(n)
                    break

            content = {
                'journal_name_en': journal_name,
                'journal_name_cn': entity.get('CW', ''),
                'issn_print': issn,
                'publisher': entity.get('PB', ''),
                'publication_cycle': 'Continuous' if entity.get('Pt') == '3' else '',
                'founding_year': entity.get('Y'),
                'country': '',
                'language': [],
                'subject_category': list(set(fields))[:20],
                'indexed_databases': ['Microsoft Academic'],
                'article_count': entity.get('CitCon'),
                'citation_count': entity.get('CC'),
                'editorial_board': list(set(editors))[:50],
                'h_index': entity.get('HIndex'),
            }

            eid = entity.get('Id', '')
            source = f'https://academic.microsoft.com/venue/{eid}' if eid else response.url

            item = self.build_item(content, source_url=source)

            if journal_name or issn:
                self.success_count += 1
                self.record_progress(issn, 'completed')
                yield item
            else:
                self.fail_count += 1

    def parse_web_search(self, response, **kwargs):
        import json
        import re

        data_match = re.search(r'__INITIAL_STATE__\s*=\s*({.*?});', response.text, re.DOTALL)
        if not data_match:
            return

        try:
            state = json.loads(data_match.group(1))
        except (json.JSONDecodeError, ValueError):
            return

        entities = []
        if isinstance(state, dict):
            for key in ['entities', 'results', 'papers']:
                if key in state and isinstance(state[key], list):
                    entities.extend(state[key])

        for entity in entities:
            if not isinstance(entity, dict):
                continue
            pt = entity.get('Pt', entity.get('type'))
            if str(pt) not in ('3', 'venue', 'journal'):
                continue

            issn = response.meta.get('issn', '') or str(entity.get('ISSN', ''))
            if issn and self.should_skip_issn(issn):
                continue

            self.report_progress()
            content = {
                'journal_name_en': entity.get('Ti') or entity.get('title', ''),
                'issn_print': issn,
                'citation_count': entity.get('CC') or entity.get('citationCount'),
                'indexed_databases': ['Microsoft Academic'],
                'subject_category': [f.get('FN') for f in (entity.get('F', []) or []) if isinstance(f, dict)],
            }
            item = self.build_item(content, source_url=response.url)
            if content['journal_name_en']:
                self.success_count += 1
                self.record_progress(issn, 'completed')
                yield item

    def _fallback_web_parse(self, response, **kwargs):
        return

    def parse_journal_detail(self, response, **kwargs):
        return None
