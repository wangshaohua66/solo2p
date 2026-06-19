import time
import threading
from typing import Dict, List, Optional
from collections import defaultdict

from itemadapter import ItemAdapter
from scrapy import signals

from utils.logger import CrawlLogger
from utils.config_loader import ConfigLoader


class DeduplicationPipeline:
    def __init__(self, config: ConfigLoader):
        self.config = config
        self.logger = CrawlLogger().get_logger('DeduplicationPipeline')
        self._lock = threading.Lock()
        self._journal_store: Dict[str, dict] = {}
        self._issn_index: Dict[str, str] = {}
        self._cn_index: Dict[str, str] = {}
        self._conflict_stats: Dict[str, int] = defaultdict(int)
        self._merge_count = 0

        dedup_cfg = self.config.get('deduplication', {})
        self.primary_key = dedup_cfg.get('primary_key', 'issn_print')
        self.secondary_keys = dedup_cfg.get('secondary_keys', ['issn_online', 'cn_number', 'eissn'])
        self.merge_strategy = dedup_cfg.get('merge_strategy', 'weighted_latest')
        self.conflict_resolution = dedup_cfg.get('conflict_resolution', 'highest_weight')

        self.source_weights = {}
        for name, cfg in self.config.get('sources', {}).items():
            self.source_weights[name] = cfg.get('weight', 0.5)

    @classmethod
    def from_crawler(cls, crawler):
        pipeline = cls(crawler.settings.get('CONFIG_LOADER', ConfigLoader()))
        crawler.signals.connect(pipeline.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(pipeline.spider_closed, signal=signals.spider_closed)
        return pipeline

    def spider_opened(self, spider):
        spider.logger.info('DeduplicationPipeline initialized')
        self._load_existing_records()

    def spider_closed(self, spider):
        self.logger.info(
            f'Dedup stats: {len(self._journal_store)} unique journals, '
            f'{self._merge_count} merges performed'
        )
        if self._conflict_stats:
            self.logger.info('Field conflicts summary:')
            for field, count in sorted(self._conflict_stats.items(), key=lambda x: -x[1])[:10]:
                self.logger.info(f'  {field}: {count} conflicts')

    def _load_existing_records(self):
        db_path = self.config.get('storage.sqlite_db_path')
        if not db_path:
            return
        try:
            import sqlite3
            import os
            if not os.path.exists(db_path):
                return
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='journals'")
            if not cursor.fetchone():
                conn.close()
                return
            cursor.execute('SELECT * FROM journals')
            columns = [desc[0] for desc in cursor.description]
            for row in cursor.fetchall():
                record = dict(zip(columns, row))
                jid = record.get('journal_id') or self._generate_id(record)
                if jid:
                    self._journal_store[jid] = record
                    self._index_record(jid, record)
            conn.close()
            self.logger.info(f'Loaded {len(self._journal_store)} existing records from database')
        except Exception as e:
            self.logger.warning(f'Failed to load existing records: {e}')

    def _generate_id(self, item: dict) -> Optional[str]:
        for key in [self.primary_key] + self.secondary_keys:
            val = item.get(key)
            if val and str(val).strip():
                return str(val).strip().replace('-', '').replace(' ', '')
        return None

    def _index_record(self, jid: str, record: dict):
        for key in [self.primary_key] + self.secondary_keys:
            val = record.get(key)
            if val and str(val).strip():
                clean = str(val).strip().replace('-', '').replace(' ', '')
                if key == self.primary_key:
                    self._issn_index[clean] = jid
                elif key == 'cn_number':
                    self._cn_index[clean] = jid
                else:
                    if clean not in self._issn_index:
                        self._issn_index[clean] = jid

    def _find_match(self, item: dict) -> Optional[str]:
        for key in [self.primary_key] + self.secondary_keys:
            val = item.get(key)
            if val and str(val).strip():
                clean = str(val).strip().replace('-', '').replace(' ', '')
                if key == self.primary_key and clean in self._issn_index:
                    return self._issn_index[clean]
                if key == 'cn_number' and clean in self._cn_index:
                    return self._cn_index[clean]
                if clean in self._issn_index:
                    return self._issn_index[clean]
        return None

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        item_dict = adapter.asdict()
        source = item_dict.get('data_source', spider.name)

        with self._lock:
            match_id = self._find_match(item_dict)

            if match_id is None:
                jid = self._generate_id(item_dict) or f'new_{int(time.time()*1000)}_{id(item)}'
                item_dict['journal_id'] = jid
                item_dict['field_conflicts'] = []
                item_dict['source_quality_score'] = self.source_weights.get(source, 0.5)
                self._journal_store[jid] = item_dict
                self._index_record(jid, item_dict)
                self.logger.debug(f'New journal stored: {jid}')
            else:
                merged = self._merge_records(self._journal_store[match_id], item_dict, source)
                merged['journal_id'] = match_id
                self._journal_store[match_id] = merged
                self._merge_count += 1
                self.logger.debug(f'Merged into journal {match_id} from source {source}')
                item_dict = merged

        return item_dict

    def _merge_records(self, existing: dict, new: dict, new_source: str) -> dict:
        merged = dict(existing)
        conflicts = existing.get('field_conflicts', [])[:]

        new_weight = self.source_weights.get(new_source, 0.5)
        existing_weight = existing.get('source_quality_score', 0.5)
        new_time = new.get('crawl_timestamp', time.time())
        existing_time = existing.get('crawl_timestamp', 0)

        all_fields = set(list(existing.keys()) + list(new.keys()))
        skip_fields = {'journal_id', 'field_conflicts', 'source_quality_score',
                       'crawl_timestamp', 'data_source', 'source_url'}

        for field in all_fields:
            if field in skip_fields:
                continue

            existing_val = existing.get(field)
            new_val = new.get(field)

            if new_val is None or new_val == '' or new_val == []:
                continue

            if existing_val is None or existing_val == '' or existing_val == []:
                merged[field] = new_val
                continue

            if self._values_equal(existing_val, new_val):
                continue

            conflicts.append({
                'field': field,
                'existing_value': existing_val,
                'new_value': new_val,
                'existing_source': existing.get('data_source', 'unknown'),
                'new_source': new_source,
                'timestamp': time.time()
            })
            self._conflict_stats[field] += 1

            if self.conflict_resolution == 'highest_weight':
                if new_weight > existing_weight:
                    merged[field] = new_val
            elif self.conflict_resolution == 'latest':
                if new_time > existing_time:
                    merged[field] = new_val
            elif self.conflict_resolution == 'weighted_latest':
                new_score = new_weight * 0.7 + (1 if new_time > existing_time else 0) * 0.3
                existing_score = existing_weight * 0.7 + (1 if existing_time >= new_time else 0) * 0.3
                if new_score > existing_score:
                    merged[field] = new_val
            elif self.conflict_resolution == 'combine':
                if isinstance(existing_val, list) and isinstance(new_val, list):
                    merged[field] = list(set(existing_val + new_val))
                elif isinstance(existing_val, list):
                    merged[field] = list(set(existing_val + [new_val]))
                else:
                    merged[field] = [existing_val, new_val]

        existing_sources = existing.get('indexed_databases', [])
        if isinstance(existing_sources, str):
            existing_sources = [existing_sources]
        if new_source not in existing_sources:
            existing_sources.append(new_source)
        merged['indexed_databases'] = existing_sources

        merged['data_source'] = f"{existing.get('data_source', '')},{new_source}".strip(',')
        merged['crawl_timestamp'] = max(existing_time, new_time)
        merged['field_conflicts'] = conflicts
        merged['source_quality_score'] = max(existing_weight, new_weight)

        return merged

    def _values_equal(self, v1, v2) -> bool:
        if isinstance(v1, list) and isinstance(v2, list):
            return sorted(str(x) for x in v1) == sorted(str(x) for x in v2)
        if isinstance(v1, (int, float)) and isinstance(v2, (int, float)):
            return abs(float(v1) - float(v2)) < 0.001
        return str(v1).strip().lower() == str(v2).strip().lower()

    def get_journal_store(self) -> Dict[str, dict]:
        return self._journal_store
