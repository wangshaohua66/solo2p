import os
import csv
import json
import sqlite3
import threading
from datetime import datetime
from typing import Dict, List
from collections import defaultdict

from itemadapter import ItemAdapter
from scrapy import signals

from utils.logger import CrawlLogger
from utils.config_loader import ConfigLoader


class StoragePipeline:
    SQLITE_SCHEMA = '''
    CREATE TABLE IF NOT EXISTS journals (
        journal_id TEXT PRIMARY KEY,
        journal_name_cn TEXT,
        journal_name_en TEXT,
        journal_alias TEXT,
        issn_print TEXT,
        issn_online TEXT,
        cn_number TEXT,
        eissn TEXT,
        publisher TEXT,
        organizer TEXT,
        publication_cycle TEXT,
        founding_year INTEGER,
        country TEXT,
        language TEXT,
        subject_category TEXT,
        indexed_databases TEXT,
        impact_factor_current REAL,
        impact_factor_5year REAL,
        impact_factor_trend TEXT,
        jcr_partition TEXT,
        cas_partition TEXT,
        cscd_status TEXT,
        pku_core TEXT,
        sci_status TEXT,
        ei_status TEXT,
        submission_guide_url TEXT,
        submission_url TEXT,
        official_website TEXT,
        review_cycle TEXT,
        publication_fee TEXT,
        open_access TEXT,
        acceptance_rate TEXT,
        editorial_board TEXT,
        editor_in_chief TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        contact_address TEXT,
        postal_code TEXT,
        journal_abstract TEXT,
        journal_scope TEXT,
        article_count INTEGER,
        citation_count INTEGER,
        h_index INTEGER,
        data_source TEXT,
        source_url TEXT,
        crawl_timestamp TEXT,
        last_updated TEXT,
        field_conflicts TEXT,
        source_quality_score REAL
    );

    CREATE INDEX IF NOT EXISTS idx_issn_print ON journals(issn_print);
    CREATE INDEX IF NOT EXISTS idx_cn_number ON journals(cn_number);
    CREATE INDEX IF NOT EXISTS idx_data_source ON journals(data_source);

    CREATE TABLE IF NOT EXISTS crawl_state (
        journal_id TEXT PRIMARY KEY,
        issn TEXT,
        last_crawl_time TEXT,
        status TEXT,
        retry_count INTEGER DEFAULT 0,
        sources_completed TEXT,
        checksum TEXT
    );

    CREATE TABLE IF NOT EXISTS crawl_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT,
        start_time TEXT,
        end_time TEXT,
        total_requested INTEGER,
        total_succeeded INTEGER,
        total_failed INTEGER,
        by_source TEXT,
        output_path TEXT,
        errors TEXT
    );
    '''

    ALL_FIELDS = [
        'journal_id', 'journal_name_cn', 'journal_name_en', 'journal_alias',
        'issn_print', 'issn_online', 'cn_number', 'eissn',
        'publisher', 'organizer', 'publication_cycle', 'founding_year',
        'country', 'language', 'subject_category', 'indexed_databases',
        'impact_factor_current', 'impact_factor_5year', 'impact_factor_trend',
        'jcr_partition', 'cas_partition', 'cscd_status', 'pku_core',
        'sci_status', 'ei_status', 'submission_guide_url', 'submission_url',
        'official_website', 'review_cycle', 'publication_fee', 'open_access',
        'acceptance_rate', 'editorial_board', 'editor_in_chief',
        'contact_email', 'contact_phone', 'contact_address', 'postal_code',
        'journal_abstract', 'journal_scope', 'article_count',
        'citation_count', 'h_index', 'data_source', 'source_url',
        'crawl_timestamp', 'last_updated', 'field_conflicts', 'source_quality_score'
    ]

    def __init__(self, config: ConfigLoader, output_format: str = None):
        self.config = config
        self.logger = CrawlLogger().get_logger('StoragePipeline')
        self._lock = threading.Lock()

        storage_cfg = config.get_storage_settings()
        self.output_format = output_format or storage_cfg.get('default_format', 'sqlite')
        self.output_dir = storage_cfg.get('output_dir', 'output')
        self.timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        self.items_buffer: List[dict] = []
        self.flush_threshold = 100
        self._stats = defaultdict(int)

        os.makedirs(self.output_dir, exist_ok=True)

        self._csv_writer = None
        self._csv_file = None
        self._json_file = None
        self._sqlite_conn = None

        self._init_storage()

    def _init_storage(self):
        if self.output_format in ('csv', 'all'):
            self._init_csv()
        if self.output_format in ('json', 'all'):
            self._init_json()
        if self.output_format in ('sqlite', 'all', 'sqlite3'):
            self._init_sqlite()

    def _init_csv(self):
        csv_filename = self.config.get('storage.csv_filename', 'journal_metadata_{timestamp}.csv')
        csv_path = os.path.join(self.output_dir, csv_filename.format(timestamp=self.timestamp))
        self._csv_path = csv_path
        self._csv_file = open(csv_path, 'w', newline='', encoding='utf-8-sig')
        self._csv_writer = csv.DictWriter(self._csv_file, fieldnames=self.ALL_FIELDS, extrasaction='ignore')
        self._csv_writer.writeheader()
        self.logger.info(f'CSV output initialized: {csv_path}')

    def _init_json(self):
        json_filename = self.config.get('storage.json_filename', 'journal_metadata_{timestamp}.json')
        json_path = os.path.join(self.output_dir, json_filename.format(timestamp=self.timestamp))
        self._json_path = json_path
        self._json_file = open(json_path, 'w', encoding='utf-8')
        self._json_file.write('[\n')
        self._json_first_item = True
        self.logger.info(f'JSON output initialized: {json_path}')

    def _init_sqlite(self):
        db_path = self.config.get('storage.sqlite_db_path', os.path.join(self.output_dir, 'journal_metadata.db'))
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._sqlite_path = db_path
        self._sqlite_conn = sqlite3.connect(db_path, check_same_thread=False)
        self._sqlite_conn.row_factory = sqlite3.Row
        self._sqlite_conn.executescript(self.SQLITE_SCHEMA)
        self._sqlite_conn.commit()
        self.logger.info(f'SQLite output initialized: {db_path}')

    @classmethod
    def from_crawler(cls, crawler):
        config = crawler.settings.get('CONFIG_LOADER', ConfigLoader())
        output_format = crawler.settings.get('OUTPUT_FORMAT')
        pipeline = cls(config, output_format)
        crawler.signals.connect(pipeline.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(pipeline.spider_closed, signal=signals.spider_closed)
        return pipeline

    def spider_opened(self, spider):
        spider.logger.info('StoragePipeline initialized')
        self._run_id = f'run_{self.timestamp}'
        self._start_time = datetime.now().isoformat()

    def spider_closed(self, spider):
        if self.items_buffer:
            self._flush()
        self._close_storage()
        self._record_crawl_stats(spider)
        self._generate_quality_report()

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        item_dict = adapter.asdict()

        with self._lock:
            self.items_buffer.append(item_dict)
            self._stats['total'] += 1
            source = item_dict.get('data_source', spider.name)
            self._stats[f'source_{source}'] += 1

            if len(self.items_buffer) >= self.flush_threshold:
                self._flush()

        return item_dict

    def _flush(self):
        items = self.items_buffer[:]
        self.items_buffer.clear()

        if self._csv_writer:
            self._flush_csv(items)
        if self._json_file:
            self._flush_json(items)
        if self._sqlite_conn:
            self._flush_sqlite(items)

        self.logger.debug(f'Flushed {len(items)} items to storage')

    def _serialize_value(self, value):
        if isinstance(value, (list, dict)):
            return json.dumps(value, ensure_ascii=False)
        if value is None:
            return ''
        return value

    def _prepare_row(self, item: dict) -> dict:
        row = {}
        for field in self.ALL_FIELDS:
            val = item.get(field)
            if isinstance(val, (list, dict)):
                row[field] = json.dumps(val, ensure_ascii=False)
            elif val is None:
                row[field] = ''
            else:
                row[field] = val
        return row

    def _flush_csv(self, items: List[dict]):
        for item in items:
            row = self._prepare_row(item)
            self._csv_writer.writerow(row)
        self._csv_file.flush()

    def _flush_json(self, items: List[dict]):
        for item in items:
            if not self._json_first_item:
                self._json_file.write(',\n')
            self._json_first_item = False
            json.dump(item, self._json_file, ensure_ascii=False, default=str)
        self._json_file.flush()

    def _flush_sqlite(self, items: List[dict]):
        placeholders = ', '.join(['?'] * len(self.ALL_FIELDS))
        columns = ', '.join(self.ALL_FIELDS)
        sql = f'INSERT OR REPLACE INTO journals ({columns}) VALUES ({placeholders})'

        rows = []
        for item in items:
            row = []
            for field in self.ALL_FIELDS:
                val = item.get(field)
                if isinstance(val, (list, dict)):
                    row.append(json.dumps(val, ensure_ascii=False))
                elif val is not None:
                    row.append(val)
                else:
                    row.append(None)
            rows.append(row)

        cursor = self._sqlite_conn.cursor()
        cursor.executemany(sql, rows)
        self._sqlite_conn.commit()

        for item in items:
            self._update_crawl_state(item)

    def _update_crawl_state(self, item: dict):
        jid = item.get('journal_id')
        if not jid:
            return
        cursor = self._sqlite_conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO crawl_state
            (journal_id, issn, last_crawl_time, status, sources_completed)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            jid,
            item.get('issn_print', ''),
            datetime.now().isoformat(),
            'completed',
            item.get('data_source', '')
        ))
        self._sqlite_conn.commit()

    def _close_storage(self):
        if self._csv_file:
            self._csv_file.close()
            self.logger.info(f'CSV file saved: {self._csv_path}')
        if self._json_file:
            self._json_file.write('\n]\n')
            self._json_file.close()
            self.logger.info(f'JSON file saved: {self._json_path}')
        if self._sqlite_conn:
            self._sqlite_conn.close()
            self.logger.info(f'SQLite database saved: {self._sqlite_path}')

    def _record_crawl_stats(self, spider):
        db_path = self.config.get('storage.sqlite_db_path')
        if not db_path:
            return
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            by_source = {k.replace('source_', ''): v for k, v in self._stats.items() if k.startswith('source_')}
            cursor.execute('''
                INSERT INTO crawl_stats
                (run_id, start_time, end_time, total_requested, total_succeeded,
                 total_failed, by_source, output_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                self._run_id,
                self._start_time,
                datetime.now().isoformat(),
                self._stats.get('total', 0),
                self._stats.get('total', 0) - self._stats.get('failed', 0),
                self._stats.get('failed', 0),
                json.dumps(by_source, ensure_ascii=False),
                self.output_dir
            ))
            conn.commit()
            conn.close()
        except Exception as e:
            self.logger.error(f'Failed to record crawl stats: {e}')

    def _generate_quality_report(self):
        report = {
            'timestamp': self.timestamp,
            'total_items': self._stats.get('total', 0),
            'by_source': {k.replace('source_', ''): v for k, v in self._stats.items() if k.startswith('source_')},
            'output_files': []
        }
        if hasattr(self, '_csv_path') and os.path.exists(self._csv_path):
            size = os.path.getsize(self._csv_path)
            report['output_files'].append({'format': 'csv', 'path': self._csv_path, 'size_bytes': size})
        if hasattr(self, '_json_path') and os.path.exists(self._json_path):
            size = os.path.getsize(self._json_path)
            report['output_files'].append({'format': 'json', 'path': self._json_path, 'size_bytes': size})
        if hasattr(self, '_sqlite_path') and os.path.exists(self._sqlite_path):
            size = os.path.getsize(self._sqlite_path)
            report['output_files'].append({'format': 'sqlite', 'path': self._sqlite_path, 'size_bytes': size})

        report_path = os.path.join(self.output_dir, f'quality_report_{self.timestamp}.json')
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        self.logger.info(f'Quality report generated: {report_path}')
        self.logger.info('========== Storage Summary ==========')
        self.logger.info(f'Total items stored: {report["total_items"]}')
        for src, count in report['by_source'].items():
            self.logger.info(f'  {src}: {count} items')
        for f in report['output_files']:
            self.logger.info(f'  {f["format"].upper()}: {f["path"]} ({f["size_bytes"]/1024:.1f} KB)')

    def get_crawl_state(self) -> Dict[str, dict]:
        if not self._sqlite_conn:
            db_path = self.config.get('storage.sqlite_db_path')
            if not db_path or not os.path.exists(db_path):
                return {}
            self._sqlite_conn = sqlite3.connect(db_path)
        try:
            cursor = self._sqlite_conn.cursor()
            cursor.execute('SELECT * FROM crawl_state')
            state = {}
            for row in cursor.fetchall():
                if isinstance(row, sqlite3.Row):
                    state[row['journal_id']] = dict(row)
                else:
                    state[row[0]] = row
            return state
        except Exception as e:
            self.logger.warning(f'Failed to get crawl state: {e}')
            return {}
