import urllib.parse
from typing import Iterator

import scrapy

from spiders.base_journal_spider import BaseJournalSpider


class VipSpider(BaseJournalSpider):
    name = 'vip'
    allowed_domains = ['cqvip.com', 'lib.cqvip.com', 'vpn.cqvip.com']

    SEARCH_URL = 'https://lib.cqvip.com/Jour/Search'
    DETAIL_URL = 'https://lib.cqvip.com/Jour/JournalDetail/{journal_id}'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def start_requests(self) -> Iterator[scrapy.Request]:
        if self.target_issns:
            for issn in self.target_issns:
                if self.should_skip_issn(issn):
                    continue
                params = {'key': issn, 'type': 'ISSN'}
                url = f'{self.SEARCH_URL}?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_search_result,
                    meta={'issn': issn},
                    priority=10,
                )
        else:
            categories = [
                '自然科学总论', '数理科学和化学', '天文学、地球科学',
                '生物科学', '医药、卫生', '农业科学',
                '工业技术', '自动化技术、计算机技术', '化学工业',
                '建筑科学', '水利工程', '交通运输',
                '航空、航天', '环境科学、安全科学', '综合性人文、社会科学',
            ]
            for cat in categories:
                params = {'key': cat, 'type': 'subject'}
                url = f'{self.SEARCH_URL}?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_search_result,
                    meta={'category': cat},
                    priority=5,
                )

    def parse(self, response, **kwargs):
        return self.parse_search_result(response, **kwargs)

    def parse_search_result(self, response, **kwargs):
        issn = response.meta.get('issn', '')

        journal_links = response.xpath(
            '//a[contains(@href,"JournalDetail") or contains(@class,"journal-title")]/@href | '
            '//div[contains(@class,"result")]//h3/a/@href | '
            '//td[contains(@class,"journal")]/a/@href'
        ).getall()

        self.logger_instance.debug(f'Found {len(journal_links)} journal links')

        seen_ids = set()
        for link in journal_links:
            if not link:
                continue
            journal_id = ''
            for part in link.split('/'):
                if part.isdigit() and len(part) >= 4:
                    journal_id = part
                    break
            if not journal_id:
                match = __import__('re').search(r'/(\d{4,})', link)
                if match:
                    journal_id = match.group(1)

            if journal_id and journal_id not in seen_ids:
                seen_ids.add(journal_id)
                detail_url = self.DETAIL_URL.format(journal_id=journal_id)
                yield scrapy.Request(
                    url=detail_url,
                    callback=self.parse_journal_detail,
                    meta={'issn': issn, 'journal_id': journal_id},
                    priority=20,
                )

        next_page = response.xpath(
            '//a[contains(text(),"下一页") or contains(@class,"next-page")]/@href'
        ).get()
        if next_page and 'page' not in response.meta:
            page = response.meta.get('page', 0) + 1
            if page <= 10:
                next_url = response.urljoin(next_page)
                meta = dict(response.meta)
                meta['page'] = page
                yield scrapy.Request(
                    url=next_url,
                    callback=self.parse_search_result,
                    meta=meta,
                    priority=1,
                )

    def parse_journal_detail(self, response, **kwargs):
        self.report_progress()
        issn_print = response.meta.get('issn', '') or self._extract(response, 'ISSN')

        data = {
            'journal_name_cn': self.safe_extract(
                response, '//h1[contains(@class,"title") or contains(@class,"journal-name")]/text() | '
                         '//div[@class="journal-title"]/h1/text()'
            ) or self._extract(response, '期刊名称'),
            'journal_name_en': self._extract(response, '英文名') or self._extract(response, '英文名称'),
            'issn_print': issn_print,
            'cn_number': self._extract(response, 'CN') or self._extract(response, '国内刊号'),
            'publisher': self._extract(response, '主办单位'),
            'organizer': [self._extract(response, '主办单位')] if self._extract(response, '主办单位') else [],
            'publication_cycle': self._extract(response, '出版周期') or self._extract(response, '刊期'),
            'founding_year': self._extract_int(response, '创刊'),
            'country': '中国',
            'language': ['中文'],
            'subject_category': self._extract_list(response, '中图分类号') or [response.meta.get('category', '')] if response.meta.get('category') else [],
            'indexed_databases': self._parse_indexed(response),
            'pku_core': self._check_label(response, '北大核心') or self._check_label(response, '核心期刊'),
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
            'journal_abstract': self._extract(response, '期刊简介') or self._extract(response, '期刊介绍'),
            'journal_scope': self._extract(response, '办刊宗旨'),
            'review_cycle': self._extract(response, '审稿周期'),
            'publication_fee': self._extract(response, '版面费'),
            'article_count': self._extract_int(response, '发文量'),
            'citation_count': self._extract_int(response, '被引量'),
            'h_index': self._extract_int(response, 'H指数'),
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
            f'//span[contains(text(),"{label}")]/following-sibling::*[1]/text()',
            f'//label[contains(text(),"{label}")]/following-sibling::span/text()',
            f'//div[contains(@class,"info-item")][.//*[contains(text(),"{label}")]]//*[contains(@class,"value") or contains(@class,"content")]/text()',
            f'//li[contains(.,"{label}")]/*[last()]/text()',
            f'//th[contains(text(),"{label}")]/following-sibling::td[1]/text()',
        ]
        for xp in xpaths:
            result = self.safe_extract(response, xp)
            if result:
                return result
        return ''

    def _extract_list(self, response, label: str) -> list:
        import re
        result = self._extract(response, label)
        if result:
            items = [i.strip() for i in re.split(r'[,，;；、\s]+', result) if i.strip()]
            return items[:20]
        return []

    def _extract_int(self, response, label: str):
        import re
        text = self._extract(response, label)
        if text:
            match = re.search(r'\d+', text.replace(',', ''))
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
        indexed = ['维普']
        text = response.text
        label_map = {
            '北大核心': 'PKU Core',
            'CSSCI': 'CSSCI',
            'CSCD': 'CSCD',
            'SCI': 'SCI',
            'EI': 'EI',
            'CSTPCD': 'CSTPCD',
            '统计源': 'CSTPCD',
            '中文核心': 'PKU Core',
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
