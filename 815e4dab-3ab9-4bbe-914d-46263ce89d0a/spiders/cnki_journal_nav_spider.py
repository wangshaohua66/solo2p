import urllib.parse
from typing import Iterator

import scrapy

from spiders.base_journal_spider import BaseJournalSpider


class CnkiJournalNavSpider(BaseJournalSpider):
    name = 'cnki_journal_nav'
    allowed_domains = ['navi.cnki.net', 'kns.cnki.net', 'cnki.net']

    NAV_URL = 'https://navi.cnki.net/knavi'
    CATEGORY_URL = 'https://navi.cnki.net/knavi/journals/category'
    DETAIL_URL = 'https://navi.cnki.net/knavi/journals/{journal_id}/detail'

    CATEGORIES = {
        '理工A': 'PKUBasic',
        '理工B': 'PKUChem',
        '理工C': 'PKUIndustry',
        '农业': 'PKUAgriculture',
        '医药卫生': 'PKUMedicine',
        '文史哲': 'PKUHumanities',
        '政治军事法律': 'PKUPolitics',
        '教育与社会科学': 'PKUEducation',
        '经济与管理': 'PKUEconomics',
        '电子技术及信息科学': 'PKUElectronic',
    }

    CORE_FILTERS = {
        'pku': 'CoreJournal',
        'cscd': 'CSCD',
        'sci': 'SCI',
        'ei': 'EI',
        'cssci': 'CSSCI',
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def start_requests(self) -> Iterator[scrapy.Request]:
        if self.target_issns:
            for issn in self.target_issns:
                if self.should_skip_issn(issn):
                    continue
                params = {
                    'SearchCondition': f'ISSN="{issn}"',
                    'PageIndex': '1',
                    'PageSize': '20',
                }
                search_url = f'https://navi.cnki.net/knavi/journals/search?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=search_url,
                    callback=self.parse_search_result,
                    meta={'issn': issn},
                    priority=10,
                )
        else:
            for cat_name, cat_code in self.CATEGORIES.items():
                params = {
                    'Category': cat_code,
                    'PageIndex': '1',
                    'PageSize': '50',
                }
                url = f'{self.CATEGORY_URL}?{urllib.parse.urlencode(params)}'
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_category,
                    meta={'category': cat_name, 'category_code': cat_code, 'page': 1},
                    priority=8,
                )

    def parse(self, response, **kwargs):
        return self.parse_category(response, **kwargs)

    def parse_category(self, response, **kwargs):
        category = response.meta.get('category', '')
        cat_code = response.meta.get('category_code', '')
        page = response.meta.get('page', 1)

        journal_links = response.xpath(
            '//a[contains(@href,"/knavi/journals/") and contains(@class,"name")]/@href | '
            '//div[contains(@class,"journal-item")]//a[1]/@href | '
            '//td[@class="journal-name"]/a/@href'
        ).getall()

        self.logger_instance.debug(f'Category {category}: found {len(journal_links)} links')

        seen = set()
        for link in journal_links:
            if not link:
                continue
            journal_id = ''
            parts = link.rstrip('/').split('/')
            for p in reversed(parts):
                if p and p not in ('detail', 'journals', 'knavi'):
                    journal_id = p.split('?')[0]
                    break
            if journal_id and journal_id not in seen and len(journal_id) > 2:
                seen.add(journal_id)
                detail_url = self.DETAIL_URL.format(journal_id=journal_id)
                yield scrapy.Request(
                    url=detail_url,
                    callback=self.parse_journal_detail,
                    meta={'category': category},
                    priority=15,
                )

        total_pages = self._extract_total_pages(response)
        if page < min(total_pages, 50):
            next_page = page + 1
            params = {
                'Category': cat_code,
                'PageIndex': str(next_page),
                'PageSize': '50',
            }
            url = f'{self.CATEGORY_URL}?{urllib.parse.urlencode(params)}'
            yield scrapy.Request(
                url=url,
                callback=self.parse_category,
                meta={'category': category, 'category_code': cat_code, 'page': next_page},
                priority=5,
            )

    def parse_search_result(self, response, **kwargs):
        issn = response.meta.get('issn', '')

        journal_links = response.xpath(
            '//a[contains(@href,"/knavi/journals/") and (contains(@class,"title") or contains(@class,"name"))]/@href | '
            '//div[@class="list-item"]//h3/a/@href'
        ).getall()

        for link in journal_links:
            if not link:
                continue
            journal_id = ''
            parts = link.rstrip('/').split('/')
            for p in reversed(parts):
                if p and p not in ('detail', 'journals', 'knavi', 'search'):
                    journal_id = p.split('?')[0]
                    break
            if journal_id:
                detail_url = self.DETAIL_URL.format(journal_id=journal_id)
                yield scrapy.Request(
                    url=detail_url,
                    callback=self.parse_journal_detail,
                    meta={'issn': issn},
                    priority=20,
                )

    def parse_journal_detail(self, response, **kwargs):
        self.report_progress()
        issn_print = response.meta.get('issn', '') or self._extract(response, 'ISSN')

        data = {
            'journal_name_cn': self.safe_extract(
                response, '//h1[contains(@class,"title")]/text() | '
                         '//div[@class="title-block"]//h1/text() | '
                         '//div[contains(@class,"journal-title")]/text()'
            ) or self._extract(response, '刊名'),
            'journal_name_en': self._extract(response, '英文刊名') or self._extract(response, '英文名'),
            'journal_alias': [self._extract(response, '曾用名')] if self._extract(response, '曾用名') else [],
            'issn_print': issn_print,
            'issn_online': self._extract(response, '国际刊号') or issn_print,
            'cn_number': self._extract(response, 'CN') or self._extract(response, '国内刊号'),
            'publisher': self._extract(response, '主办单位'),
            'organizer': [self._extract(response, '主办单位')] if self._extract(response, '主办单位') else [],
            'publication_cycle': self._extract(response, '出版周期') or self._extract(response, '刊期'),
            'founding_year': self._extract_int(response, '创刊'),
            'country': '中国',
            'language': ['中文', self._extract(response, '语种')] if self._extract(response, '语种') and self._extract(response, '语种') != '中文' else ['中文'],
            'subject_category': [response.meta.get('category', '')] if response.meta.get('category') else self._extract_list(response, '专辑名称') or self._extract_list(response, '专题'),
            'indexed_databases': self._parse_indexed(response),
            'pku_core': self._check_label(response, '核心期刊') or self._check_label(response, '北大核心'),
            'cscd_status': self._check_label(response, 'CSCD'),
            'sci_status': self._check_label(response, 'SCI'),
            'ei_status': self._check_label(response, 'EI'),
            'impact_factor_current': self._extract_float(response, '复合影响因子') or self._extract_float(response, '影响因子'),
            'impact_factor_5year': self._extract_float(response, '综合影响因子'),
            'jcr_partition': self._extract_list(response, 'JCR'),
            'cas_partition': self._extract_list(response, '中科院分区'),
            'official_website': self.safe_extract(response, '//a[contains(text(),"官网") or contains(text(),"Official")]/@href'),
            'editor_in_chief': self._extract(response, '主编') or self._extract(response, '总编'),
            'editorial_board': self._extract_list(response, '编委会') or self._extract_list(response, '编委'),
            'contact_email': self._extract_list(response, '邮箱') or self._extract_list(response, 'E-mail') or self.safe_extract_all(response, '//a[contains(@href,"mailto:")]/@href'),
            'contact_phone': self._extract_list(response, '电话') or self._extract_list(response, 'Tel'),
            'contact_address': self._extract(response, '地址'),
            'postal_code': self._extract(response, '邮编'),
            'journal_abstract': self._extract(response, '期刊简介') or self.safe_extract(
                response, '//div[contains(@class,"abstract")]//p/text() | '
                         '//div[contains(@id,"Intro")]//text()'
            ),
            'journal_scope': self._extract(response, '办刊宗旨') or self._extract(response, '主要栏目'),
            'submission_guide_url': self.safe_extract(response, '//a[contains(text(),"投稿指南") or contains(text(),"稿约")]/@href'),
            'submission_url': self.safe_extract(response, '//a[contains(text(),"在线投稿") or contains(text(),"我要投稿")]/@href'),
            'review_cycle': self._extract(response, '审稿周期'),
            'publication_fee': self._extract(response, '版面费') or self._extract(response, '收费标准'),
            'open_access': self._extract(response, '开放获取'),
            'article_count': self._extract_int(response, '发文量') or self._extract_int(response, '载文量'),
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
            f'//span[contains(text(),"{label}")]/following-sibling::span[1]/text()',
            f'//span[contains(text(),"{label}")]/../following-sibling::td[1]/text()',
            f'//li[contains(.,"{label}")]//span[last()]/text()',
            f'//th[contains(text(),"{label}")]/following-sibling::td[1]/text()',
            f'//label[contains(text(),"{label}")]/following-sibling::*[1]/text()',
        ]
        for xp in xpaths:
            result = self.safe_extract(response, xp)
            if result and result != '-':
                return result
        return ''

    def _extract_list(self, response, label: str) -> list:
        import re
        result = self._extract(response, label)
        if result:
            items = [i.strip() for i in re.split(r'[,，;；、\s/|]+', result) if i.strip() and i.strip() != '-']
            return items[:50]
        return []

    def _extract_int(self, response, label: str):
        import re
        text = self._extract(response, label)
        if text:
            match = re.search(r'\d+', text.replace(',', '').replace(' ', ''))
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

    def _extract_total_pages(self, response) -> int:
        import re
        text = response.text
        match = re.search(r'共\s*(\d+)\s*页', text)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                pass
        pages = response.xpath(
            '//div[contains(@class,"pager") or contains(@class,"page")]//a/@href'
        ).getall()
        max_p = 1
        for p in pages:
            m = re.search(r'PageIndex=(\d+)', p)
            if m:
                try:
                    max_p = max(max_p, int(m.group(1)))
                except ValueError:
                    pass
        return max_p

    def _parse_indexed(self, response) -> list:
        indexed = ['CNKI期刊导航']
        text = response.text
        label_map = {
            '北大核心': 'PKU Core',
            'CSSCI': 'CSSCI',
            'CSCD': 'CSCD',
            'SCI': 'SCI',
            'SCIE': 'SCIE',
            'EI': 'EI',
            'CSTPCD': 'CSTPCD',
            '统计源': 'CSTPCD',
            '核心期刊': 'PKU Core',
            '中文核心': 'PKU Core',
            'JST': 'JST',
            'Pж(AJ)': 'AJ',
            'CA': 'CA',
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
