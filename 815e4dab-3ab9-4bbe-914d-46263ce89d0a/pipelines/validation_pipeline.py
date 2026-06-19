import re
import threading
from typing import Dict, List
from collections import defaultdict
from datetime import datetime

from itemadapter import ItemAdapter
from scrapy import signals

from utils.logger import CrawlLogger
from utils.config_loader import ConfigLoader


class ISSNValidator:
    ISSN_PATTERN = re.compile(r'^(\d{4})-?(\d{3})[\dXx]$')

    @classmethod
    def validate(cls, issn: str) -> bool:
        if not issn:
            return False
        match = cls.ISSN_PATTERN.match(str(issn).strip().replace(' ', ''))
        if not match:
            return False
        digits = match.group(1) + match.group(2)
        check_char = issn[-1].upper()
        total = sum(int(d) * (8 - i) for i, d in enumerate(digits))
        if check_char == 'X':
            total += 10
        else:
            total += int(check_char)
        return total % 11 == 0


class CNValidator:
    CN_PATTERN = re.compile(r'^(CN)?\d{2}-?\d{3,4}/[A-Z]{1,2}$')

    @classmethod
    def validate(cls, cn: str) -> bool:
        if not cn:
            return False
        return bool(cls.CN_PATTERN.match(str(cn).strip().upper()))


class EmailValidator:
    EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

    @classmethod
    def validate(cls, email: str) -> bool:
        if not email:
            return False
        return bool(cls.EMAIL_PATTERN.match(str(email).strip()))


class ValidationPipeline:
    def __init__(self, config: ConfigLoader):
        self.config = config
        self.logger = CrawlLogger().get_logger('ValidationPipeline')
        self._lock = threading.Lock()
        self._stats = defaultdict(lambda: {'total': 0, 'passed': 0, 'failed': 0})
        self._field_stats = defaultdict(lambda: {'present': 0, 'valid': 0, 'missing': 0, 'invalid': 0})
        self._warning_count = 0
        self._error_count = 0

        val_cfg = self.config.get('validation', {})
        self.issn_check = val_cfg.get('issn_check', True)
        self.impact_factor_range = val_cfg.get('impact_factor_range', [0, 200])
        self.required_fields = val_cfg.get('required_fields', ['journal_name_cn', 'issn_print', 'data_source'])

    @classmethod
    def from_crawler(cls, crawler):
        pipeline = cls(crawler.settings.get('CONFIG_LOADER', ConfigLoader()))
        crawler.signals.connect(pipeline.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(pipeline.spider_closed, signal=signals.spider_closed)
        return pipeline

    def spider_opened(self, spider):
        spider.logger.info('ValidationPipeline initialized')

    def spider_closed(self, spider):
        total_items = sum(s['total'] for s in self._stats.values())
        passed_items = sum(s['passed'] for s in self._stats.values())
        rate = (passed_items / total_items * 100) if total_items > 0 else 0

        self.logger.info('========== Validation Report ==========')
        self.logger.info(f'Total items validated: {total_items}')
        self.logger.info(f'Validation pass rate: {rate:.2f}%')
        self.logger.info(f'Warnings: {self._warning_count}, Errors: {self._error_count}')

        for source, stats in sorted(self._stats.items()):
            s_rate = (stats['passed'] / stats['total'] * 100) if stats['total'] > 0 else 0
            self.logger.info(f'  {source}: {stats["passed"]}/{stats["total"]} ({s_rate:.1f}%)')

        self.logger.info('Field completeness:')
        for field, stats in sorted(self._field_stats.items()):
            total = stats['present'] + stats['missing']
            complete_rate = (stats['present'] / total * 100) if total > 0 else 0
            valid_rate = (stats['valid'] / stats['present'] * 100) if stats['present'] > 0 else 0
            self.logger.info(
                f'  {field}: present {stats["present"]}/{total} ({complete_rate:.1f}%), '
                f'valid {valid_rate:.1f}%'
            )

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        item_dict = adapter.asdict()
        source = item_dict.get('data_source', spider.name)
        errors = []
        warnings = []

        with self._lock:
            self._stats[source]['total'] += 1

        self._check_required_fields(item_dict, errors, warnings)
        self._validate_identifiers(item_dict, errors, warnings)
        self._validate_numeric_fields(item_dict, errors, warnings)
        self._validate_emails(item_dict, warnings)
        self._validate_urls(item_dict, warnings)
        self._track_field_presence(item_dict)

        item_dict['_validation_errors'] = errors
        item_dict['_validation_warnings'] = warnings

        with self._lock:
            if errors:
                self._stats[source]['failed'] += 1
                self._error_count += len(errors)
                self.logger.error(
                    f'Validation failed for {item_dict.get("journal_name_cn", "Unknown")} '
                    f'(source: {source}): {"; ".join(errors)}'
                )
            else:
                self._stats[source]['passed'] += 1

            if warnings:
                self._warning_count += len(warnings)
                self.logger.warning(
                    f'Validation warnings for {item_dict.get("journal_name_cn", "Unknown")} '
                    f'(source: {source}): {"; ".join(warnings)}'
                )

        for key in list(item_dict.keys()):
            if key.startswith('_validation_'):
                del item_dict[key]

        return item_dict

    def _check_required_fields(self, item: dict, errors: list, warnings: list):
        for field in self.required_fields:
            value = item.get(field)
            if value is None or value == '' or value == []:
                if field == 'journal_name_cn':
                    errors.append(f'Required field missing: {field}')
                else:
                    warnings.append(f'Required field missing: {field}')

    def _validate_identifiers(self, item: dict, errors: list, warnings: list):
        if self.issn_check:
            for field in ['issn_print', 'issn_online', 'eissn']:
                value = item.get(field)
                if value:
                    if not ISSNValidator.validate(value):
                        warnings.append(f'Invalid ISSN format in {field}: {value}')
                else:
                    if field == 'issn_print':
                        warnings.append(f'{field} is missing')

        cn = item.get('cn_number')
        if cn:
            if not CNValidator.validate(cn):
                warnings.append(f'Invalid CN format: {cn}')

    def _validate_numeric_fields(self, item: dict, errors: list, warnings: list):
        for field in ['impact_factor_current', 'impact_factor_5year', 'source_quality_score']:
            value = item.get(field)
            if value is not None:
                try:
                    v = float(value)
                    lo, hi = self.impact_factor_range
                    if not (lo <= v <= hi):
                        warnings.append(f'{field} value {v} out of expected range [{lo}, {hi}]')
                except (ValueError, TypeError):
                    warnings.append(f'{field} has non-numeric value: {value}')

        for field in ['founding_year', 'article_count', 'citation_count', 'h_index']:
            value = item.get(field)
            if value is not None:
                try:
                    v = int(value)
                    current_year = datetime.now().year
                    if field == 'founding_year' and (v < 1600 or v > current_year):
                        warnings.append(f'{field} value {v} out of valid range [1600, {current_year}]')
                    elif v < 0:
                        warnings.append(f'{field} has negative value: {v}')
                except (ValueError, TypeError):
                    warnings.append(f'{field} has non-integer value: {value}')

    def _validate_emails(self, item: dict, warnings: list):
        emails = item.get('contact_email', [])
        if isinstance(emails, str):
            emails = [emails]
        for email in emails:
            if email and not EmailValidator.validate(email):
                warnings.append(f'Invalid email format: {email}')

    def _validate_urls(self, item: dict, warnings: list):
        from urllib.parse import urlparse
        for field in ['submission_guide_url', 'submission_url', 'official_website', 'source_url']:
            value = item.get(field)
            if value:
                try:
                    parsed = urlparse(value)
                    if not parsed.scheme or not parsed.netloc:
                        warnings.append(f'Invalid URL in {field}: {value}')
                except Exception:
                    warnings.append(f'Invalid URL in {field}: {value}')

    def _track_field_presence(self, item: dict):
        with self._lock:
            tracked_fields = [
                'journal_name_cn', 'journal_name_en', 'issn_print', 'issn_online',
                'cn_number', 'publisher', 'organizer', 'publication_cycle',
                'impact_factor_current', 'jcr_partition', 'cas_partition',
                'editorial_board', 'contact_email', 'submission_guide_url',
                'review_cycle', 'publication_fee'
            ]
            for field in tracked_fields:
                value = item.get(field)
                if value is not None and value != '' and value != []:
                    self._field_stats[field]['present'] += 1
                    if field == 'issn_print' and ISSNValidator.validate(value):
                        self._field_stats[field]['valid'] += 1
                    elif field != 'issn_print':
                        self._field_stats[field]['valid'] += 1
                else:
                    self._field_stats[field]['missing'] += 1
