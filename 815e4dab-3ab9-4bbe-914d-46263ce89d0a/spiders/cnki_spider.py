import urllib.parse
from typing import Iterator

import scrapy

from spiders.base_journal_spider import BaseJournalSpider


class CnkiSpider(BaseJournalSpider):
    name = 'cnki'
    allowed_domains = ['cnki.net', 'cnki.com.cn', 'navi.cnki.net']

    BASE_SEARCH_URL = 'https://navi.cnki.net/knavi/journals/search'
    DETAIL_URL = 'https://navi.cnki.net/knavi/journals/{journal_id}'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def start_requests(self) -> Iterator[scrapy.Request]:
        if self.target_issns:
            for issn in self.target_issns:
                if self.should_skip_issn(issn):
                    continue
                params = {'SearchCondition': f'ISSN={issn}'}
                url = f'{self.BASE_SEARCH_URL}?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_search_result,
                    meta={'issn': issn, 'dont_retry': False},
                    priority=10,
                )
        else:
            for page in range(1, 101):
                params = {
                    'SearchCondition': 'Core期刊',
                    'PageIndex': page,
                    'PageSize': 20,
                }
                url = f'{self.BASE_SEARCH_URL}?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_search_result,
                    meta={'page': page},
                    priority=5,
                )

    def parse(self, response, **kwargs):
        return self.parse_search_result(response, **kwargs)

    def parse_search_result(self, response, **kwargs):
        issn = response.meta.get('issn', '')

        journal_links = response.xpath(
            '//a[contains(@class, "journal-title") or contains(@onclick, "GetJournalDetail")]/@href | '
            '//div[@class="list-item"]//h3/a/@href'
        ).getall()

        if not journal_links:
            journal_links = response.xpath(
                '//a[contains(@href, "/knavi/journals/")]/@href'
            ).getall()

        self.logger_instance.debug(f'Found {len(journal_links)} journal links on search page')

        for link in journal_links:
            if not link:
                continue
            journal_id = link.split('/')[-1].split('?')[0] if '/' in link else link
            detail_url = self.DETAIL_URL.format(journal_id=journal_id)
            yield scrapy.Request(
                url=detail_url,
                callback=self.parse_journal_detail,
                meta={'issn': issn, 'journal_id': journal_id},
                priority=20,
            )

        next_page = response.xpath(
            '//a[contains(text(), "下一页") or contains(@class, "next")]/@href'
        ).get()
        if next_page and 'page' in response.meta:
            page = response.meta['page']
            if page < 50:
                next_url = response.urljoin(next_page)
                yield scrapy.Request(
                    url=next_url,
                    callback=self.parse_search_result,
                    meta={'page': page + 1},
                    priority=1,
                )

    def parse_journal_detail(self, response, **kwargs):
        self.report_progress()
        issn_print = response.meta.get('issn', '') or self.safe_extract(
            response, '//span[contains(text(),"ISSN")]/following-sibling::text() | '
                     '//li[contains(.,"ISSN")]//span[2]/text()'
        )

        data = {
            'journal_name_cn': self.safe_extract(
                response, '//h1[contains(@class,"title")]/text() | '
                         '//div[@class="journal-title"]/h1/text() | '
                         '//div[@id="divNaviTitle"]//h1/text()'
            ),
            'journal_name_en': self.safe_extract(
                response, '//div[contains(@class,"en-name")]/text() | '
                         '//h2[contains(@class,"en-title")]/text()'
            ),
            'issn_print': issn_print,
            'cn_number': self.safe_extract(
                response, '//span[contains(text(),"CN")]/following-sibling::text() | '
                         '//li[contains(.,"CN号")]//span[2]/text()'
            ),
            'publisher': self.safe_extract(
                response, '//span[contains(text(),"主办单位")]/following-sibling::text() | '
                         '//li[contains(.,"主办")]//span[2]/text()'
            ),
            'organizer': self.safe_extract_all(
                response, '//span[contains(text(),"主办单位")]/following-sibling::*/text() | '
                         '//li[contains(.,"主办")]//a/text()'
            ),
            'publication_cycle': self.safe_extract(
                response, '//span[contains(text(),"出版周期")]/following-sibling::text() | '
                         '//li[contains(.,"周期")]//span[2]/text()'
            ),
            'founding_year': self.safe_extract(
                response, '//span[contains(text(),"创刊")]/following-sibling::text() | '
                         '//li[contains(.,"创刊")]//span[2]/text()'
            ),
            'country': '中国',
            'language': ['中文'],
            'subject_category': self.safe_extract_all(
                response, '//div[contains(@class,"subject")]//a/text() | '
                         '//span[contains(text(),"专辑")]/following-sibling::*/a/text()'
            ),
            'indexed_databases': self._parse_indexed_db(response),
            'pku_core': self._check_core_label(response, ['核心', '北大核心', 'PKU']),
            'cscd_status': self._check_core_label(response, ['CSCD']),
            'sci_status': self._check_core_label(response, ['SCI', 'SCIE']),
            'ei_status': self._check_core_label(response, ['EI']),
            'official_website': self.safe_extract(
                response, '//a[contains(@href,"http") and contains(text(),"官网")]/@href | '
                         '//a[contains(text(),"官方网站")]/@href'
            ),
            'editor_in_chief': self.safe_extract(
                response, '//span[contains(text(),"主编")]/following-sibling::text() | '
                         '//li[contains(.,"主编")]//span[2]/text()'
            ),
            'contact_email': self.safe_extract_all(
                response, '//span[contains(text(),"邮箱")]/following-sibling::text() | '
                         '//a[contains(@href,"mailto:")]/@href'
            ),
            'contact_phone': self.safe_extract_all(
                response, '//span[contains(text(),"电话")]/following-sibling::text()'
            ),
            'contact_address': self.safe_extract(
                response, '//span[contains(text(),"地址")]/following-sibling::text()'
            ),
            'postal_code': self.safe_extract(
                response, '//span[contains(text(),"邮编")]/following-sibling::text()'
            ),
            'journal_abstract': self.safe_extract(
                response, '//div[contains(@class,"intro")]/p/text() | '
                         '//div[contains(@id,"JournalIntro")]//text()'
            ),
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

    def _parse_indexed_db(self, response) -> list:
        indexed = []
        label_map = {
            'SCI': 'SCI',
            'SCIE': 'SCIE',
            'EI': 'EI',
            'CSCD': 'CSCD',
            '北大核心': 'PKU Core',
            'CSSCI': 'CSSCI',
            '统计源': 'CSTPCD',
        }
        labels = self.safe_extract_all(
            response, '//div[contains(@class,"label") or contains(@class,"tag")]/span/text() | '
                     '//span[contains(@class,"core-tag")]/text()'
        )
        for label in labels:
            for key, val in label_map.items():
                if key in label and val not in indexed:
                    indexed.append(val)
        return indexed

    def _check_core_label(self, response, keywords) -> str:
        labels = self.safe_extract_all(
            response, '//div[contains(@class,"label")]//text() | '
                     '//span[contains(@class,"tag") or contains(@class,"core")]/text()'
        )
        text = ' '.join(labels)
        for kw in keywords:
            if kw in text:
                return '是'
        return ''
