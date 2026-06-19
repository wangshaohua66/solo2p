import time
from abc import abstractmethod
from datetime import datetime
from typing import List, Dict, Optional, Iterator

import scrapy
from itemloaders import ItemLoader

from items.journal_item import JournalItem
from utils.logger import CrawlLogger
from utils.config_loader import ConfigLoader


class BaseJournalSpider(scrapy.Spider):
    custom_settings = {
        'ITEM_PIPELINES': {
            'pipelines.deduplication_pipeline.DeduplicationPipeline': 100,
            'pipelines.validation_pipeline.ValidationPipeline': 200,
            'pipelines.storage_pipeline.StoragePipeline': 300,
        },
        'DOWNLOADER_MIDDLEWARES': {
            'middlewares.useragent_middleware.UserAgentMiddleware': 400,
            'middlewares.auth_middleware.AuthMiddleware': 500,
            'middlewares.retry_middleware.ExponentialBackoffRetryMiddleware': 550,
        },
    }

    def __init__(self, config: Optional[ConfigLoader] = None, target_issns: Optional[List[str]] = None,
                 incremental: bool = True, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.config = config or ConfigLoader()
        self.target_issns = target_issns or self.config.get_target_issns()
        self.incremental = incremental and self.config.get('incremental.enabled', True)
        self.logger_instance = CrawlLogger().get_logger(self.name)
        self.success_count = 0
        self.fail_count = 0
        self.total_count = 0
        self.processed_issns: set = set()
        self.failed_requests: List[dict] = []
        self.start_time = time.time()

        self._load_progress_state()
        self._log_startup_info()

    def _log_startup_info(self):
        self.logger_instance.info(f'Spider {self.name} initialized')
        self.logger_instance.info(f'Target ISSNs: {len(self.target_issns)}')
        self.logger_instance.info(f'Incremental mode: {self.incremental}')
        self.logger_instance.info(f'Already processed: {len(self.processed_issns)}')

    def _load_progress_state(self):
        state_path = self.config.get('storage.resume_db_path')
        if not state_path:
            return
        try:
            import sqlite3
            import os
            if os.path.exists(state_path):
                conn = sqlite3.connect(state_path)
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='progress'")
                if cursor.fetchone():
                    cursor.execute(
                        'SELECT issn FROM progress WHERE source = ? AND status = ?',
                        (self.name, 'completed')
                    )
                    for row in cursor.fetchall():
                        if row[0]:
                            self.processed_issns.add(row[0])
                conn.close()
        except Exception as e:
            self.logger_instance.warning(f'Failed to load progress state: {e}')

    @abstractmethod
    def start_requests(self) -> Iterator[scrapy.Request]:
        pass

    @abstractmethod
    def parse(self, response, **kwargs):
        pass

    @abstractmethod
    def parse_journal_detail(self, response, **kwargs):
        pass

    def build_item(self, data: Dict, source_url: str = '') -> JournalItem:
        loader = ItemLoader(item=JournalItem())
        now = datetime.now().isoformat()

        for key, value in data.items():
            if key in loader.item.fields and value is not None:
                loader.add_value(key, value)

        loader.add_value('data_source', self.name)
        loader.add_value('source_url', source_url)
        loader.add_value('crawl_timestamp', now)
        loader.add_value('last_updated', now)

        return loader.load_item()

    def should_skip_issn(self, issn: str) -> bool:
        if not issn:
            return False
        clean_issn = issn.replace('-', '').replace(' ', '')
        if clean_issn in self.processed_issns:
            return True
        if self.incremental and self._is_recently_crawled(issn):
            return True
        return False

    def _is_recently_crawled(self, issn: str) -> bool:
        db_path = self.config.get('storage.sqlite_db_path')
        if not db_path:
            return False
        try:
            import sqlite3
            import os
            if not os.path.exists(db_path):
                return False
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            freq = self.config.get('incremental.update_frequency', 'weekly')
            hours = {
                'daily': 24,
                'weekly': 24 * 7,
                'monthly': 24 * 30,
            }.get(freq, 24 * 7)

            cursor.execute('''
                SELECT last_crawl_time FROM crawl_state
                WHERE issn = ? AND sources_completed LIKE ?
                ORDER BY last_crawl_time DESC LIMIT 1
            ''', (issn.replace('-', ''), f'%{self.name}%'))
            row = cursor.fetchone()
            conn.close()

            if row and row[0]:
                try:
                    last_time = datetime.fromisoformat(row[0])
                    elapsed = (datetime.now() - last_time).total_seconds() / 3600
                    if elapsed < hours:
                        return True
                except (ValueError, TypeError):
                    pass
        except Exception as e:
            self.logger_instance.debug(f'Incremental check failed for {issn}: {e}')
        return False

    def record_progress(self, issn: str, status: str):
        clean = issn.replace('-', '').replace(' ', '') if issn else ''
        if status == 'completed' and clean:
            self.processed_issns.add(clean)
        self._save_progress(clean, status)

    def _save_progress(self, issn: str, status: str):
        state_path = self.config.get('storage.resume_db_path')
        if not state_path:
            return
        try:
            import sqlite3
            import os
            os.makedirs(os.path.dirname(state_path), exist_ok=True)
            conn = sqlite3.connect(state_path)
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS progress (
                    issn TEXT,
                    source TEXT,
                    status TEXT,
                    timestamp TEXT,
                    PRIMARY KEY (issn, source)
                )
            ''')
            cursor.execute('''
                INSERT OR REPLACE INTO progress (issn, source, status, timestamp)
                VALUES (?, ?, ?, ?)
            ''', (issn, self.name, status, datetime.now().isoformat()))
            conn.commit()
            conn.close()
        except Exception as e:
            self.logger_instance.debug(f'Failed to save progress: {e}')

    def report_progress(self):
        self.total_count += 1
        if self.total_count % 100 == 0:
            elapsed = time.time() - self.start_time
            rate = self.total_count / elapsed if elapsed > 0 else 0
            remaining = (len(self.target_issns) - self.total_count) / rate if rate > 0 else 0
            self.logger_instance.info(
                f'Progress: {self.total_count}/{len(self.target_issns)} '
                f'({self.total_count/len(self.target_issns)*100:.1f}%) | '
                f'Success: {self.success_count}, Fail: {self.fail_count} | '
                f'Rate: {rate:.1f}/s | ETA: {remaining/60:.1f}min'
            )

    def get_journal_detail_url(self, issn: str) -> str:
        raise NotImplementedError

    def safe_extract(self, response, xpath: str, default: str = '') -> str:
        try:
            result = response.xpath(xpath).get()
            return result.strip() if result else default
        except Exception:
            return default

    def safe_extract_all(self, response, xpath: str) -> List[str]:
        try:
            results = response.xpath(xpath).getall()
            return [r.strip() for r in results if r and r.strip()]
        except Exception:
            return []

    def closed(self, reason):
        elapsed = time.time() - self.start_time
        self.logger_instance.info(f'Spider {self.name} closed. Reason: {reason}')
        CrawlLogger().log_crawl_end(
            self.name, self.success_count, self.fail_count, elapsed
        )
        if self.failed_requests:
            self._save_failed_requests()

    def _save_failed_requests(self):
        state_path = self.config.get('storage.resume_db_path')
        if not state_path:
            return
        try:
            import sqlite3
            import os
            import json
            os.makedirs(os.path.dirname(state_path), exist_ok=True)
            conn = sqlite3.connect(state_path)
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS failed_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source TEXT,
                    url TEXT,
                    reason TEXT,
                    meta TEXT,
                    timestamp TEXT,
                    retry_count INTEGER DEFAULT 0
                )
            ''')
            for req in self.failed_requests:
                cursor.execute('''
                    INSERT INTO failed_requests
                    (source, url, reason, meta, timestamp, retry_count)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    req.get('source', self.name),
                    req.get('url', ''),
                    req.get('reason', ''),
                    json.dumps(req.get('meta', {}), ensure_ascii=False),
                    datetime.fromtimestamp(req.get('timestamp', time.time())).isoformat(),
                    req.get('meta', {}).get('retry_times', 0)
                ))
            conn.commit()
            conn.close()
            self.logger_instance.info(f'Saved {len(self.failed_requests)} failed requests for retry')
        except Exception as e:
            self.logger_instance.error(f'Failed to save failed requests: {e}')
