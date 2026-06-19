import time
from abc import abstractmethod
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Iterator, Callable

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

    FREQ_ALIASES = {
        'hourly': timedelta(hours=1),
        'bi_hourly': timedelta(hours=2),
        'daily': timedelta(days=1),
        'semi_daily': timedelta(hours=12),
        'weekly': timedelta(weeks=1),
        'bi_weekly': timedelta(weeks=2),
        'monthly': timedelta(days=30),
        'quarterly': timedelta(days=90),
        'yearly': timedelta(days=365),
        'never': timedelta(weeks=52 * 10),
    }

    def __init__(self, config: Optional[ConfigLoader] = None, target_issns: Optional[List[str]] = None,
                 incremental: bool = True, failed_requests: Optional[List[Dict]] = None,
                 progress_callback: Optional[Callable] = None,
                 stats_callback: Optional[Callable] = None,
                 *args, **kwargs):
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
        self.pending_retries: List[dict] = failed_requests or []
        self.retried_ids: set = set()
        self.progress_callback = progress_callback
        self.stats_callback = stats_callback
        self.start_time = time.time()

        self._update_interval = self._parse_update_frequency()
        self._load_progress_state()
        self._remove_retried_from_db(failed_requests or [])
        self._log_startup_info()

    def _parse_update_frequency(self) -> timedelta:
        freq_cfg = self.config.get('incremental.update_frequency', 'weekly')
        cfg_seconds = self.config.get('incremental.update_frequency_seconds')
        cfg_minutes = self.config.get('incremental.update_frequency_minutes')
        cfg_hours = self.config.get('incremental.update_frequency_hours')
        cfg_days = self.config.get('incremental.update_frequency_days')

        if cfg_seconds is not None:
            try:
                return timedelta(seconds=float(cfg_seconds))
            except (ValueError, TypeError):
                pass
        if cfg_minutes is not None:
            try:
                return timedelta(minutes=float(cfg_minutes))
            except (ValueError, TypeError):
                pass
        if cfg_hours is not None:
            try:
                return timedelta(hours=float(cfg_hours))
            except (ValueError, TypeError):
                pass
        if cfg_days is not None:
            try:
                return timedelta(days=float(cfg_days))
            except (ValueError, TypeError):
                pass

        if isinstance(freq_cfg, (int, float)):
            try:
                return timedelta(hours=float(freq_cfg))
            except (ValueError, TypeError):
                pass

        if isinstance(freq_cfg, str):
            freq_lower = freq_cfg.strip().lower()
            if freq_lower in self.FREQ_ALIASES:
                return self.FREQ_ALIASES[freq_lower]
            import re
            match = re.match(r'^(\d+(?:\.\d+)?)\s*(h|hour|hours|d|day|days|m|min|minute|minutes|w|week|weeks|s|sec|seconds)$', freq_lower)
            if match:
                value = float(match.group(1))
                unit = match.group(2)
                if unit in ('h', 'hour', 'hours'):
                    return timedelta(hours=value)
                elif unit in ('d', 'day', 'days'):
                    return timedelta(days=value)
                elif unit in ('m', 'min', 'minute', 'minutes'):
                    return timedelta(minutes=value)
                elif unit in ('w', 'week', 'weeks'):
                    return timedelta(weeks=value)
                elif unit in ('s', 'sec', 'seconds'):
                    return timedelta(seconds=value)
            match = re.match(r'^(\d+)\s*-\s*(\d+)\s*-\s*(\d+)$', freq_cfg.strip())
            if match:
                try:
                    return timedelta(
                        days=int(match.group(1)),
                        hours=int(match.group(2)),
                        minutes=int(match.group(3))
                    )
                except (ValueError, TypeError):
                    pass

        self.logger_instance.warning(
            f'Unrecognized update_frequency: {freq_cfg!r}, falling back to default (7 days)'
        )
        return self.FREQ_ALIASES['weekly']

    def _log_startup_info(self):
        self.logger_instance.info(f'Spider {self.name} initialized')
        self.logger_instance.info(f'Target ISSNs: {len(self.target_issns)}')
        self.logger_instance.info(f'Incremental mode: {self.incremental}')
        self.logger_instance.info(f'Update frequency: {self._update_interval}')
        self.logger_instance.info(f'Already processed: {len(self.processed_issns)}')
        self.logger_instance.info(f'Pending retries: {len(self.pending_retries)}')

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

    def _remove_retried_from_db(self, failed_list: List[Dict]):
        if not failed_list:
            return
        ids_to_remove = [f['id'] for f in failed_list if f.get('id')]
        if not ids_to_remove:
            return
        state_path = self.config.get('storage.resume_db_path')
        if not state_path:
            return
        try:
            import sqlite3
            import os
            if os.path.exists(state_path):
                conn = sqlite3.connect(state_path)
                cursor = conn.cursor()
                cursor.executemany(
                    'DELETE FROM failed_requests WHERE id = ?',
                    [(i,) for i in ids_to_remove]
                )
                removed = cursor.rowcount
                conn.commit()
                conn.close()
                if removed > 0:
                    self.logger_instance.info(
                        f'Removed {removed} requests from failed_requests table for retry processing'
                    )
        except Exception as e:
            self.logger_instance.warning(f'Failed to clean retried requests from DB: {e}')

    def generate_retry_requests(self) -> Iterator[scrapy.Request]:
        if not self.pending_retries:
            return
        self.logger_instance.info(
            f'Starting retry of {len(self.pending_retries)} previously failed requests...'
        )
        for retry_meta in self.pending_retries:
            try:
                url = retry_meta.get('url', '')
                if not url:
                    continue
                rid = retry_meta.get('id')
                if rid and rid in self.retried_ids:
                    continue
                self.retried_ids.add(rid)

                meta = retry_meta.get('meta', {}) or {}
                meta['_is_retry'] = True
                meta['_retry_id'] = rid
                meta['_retry_count'] = retry_meta.get('retry_count', 0) + 1
                meta['_retry_reason'] = retry_meta.get('reason', '')

                issn = meta.get('issn', '')
                journal_name = meta.get('journal_name', '')
                if self.progress_callback:
                    self.progress_callback(self.name, journal_name, issn, url)

                self.logger_instance.debug(
                    f'Retrying #{rid} ({retry_meta.get("reason", "unknown")}): {url[:80]}'
                )

                yield scrapy.Request(
                    url=url,
                    callback=self._retry_callback,
                    errback=self._retry_errback,
                    meta=meta,
                    priority=100,
                    dont_filter=True,
                )
            except Exception as e:
                self.logger_instance.error(f'Error creating retry request: {e}')
                self.fail_count += 1
                self._invoke_stats_callback()

        self.logger_instance.info('Retry queue exhausted, continuing with normal crawl tasks')

    def _retry_callback(self, response, **kwargs):
        meta = response.meta
        issn = meta.get('issn', '')
        journal_name = meta.get('journal_name', '')
        if self.progress_callback:
            self.progress_callback(self.name, journal_name, issn, response.url)
        rid = meta.get('_retry_id')
        if rid:
            self.logger_instance.info(f'Retry #{rid} succeeded: {response.url[:80]}')
        return self.parse_journal_detail(response, **kwargs)

    def _retry_errback(self, failure):
        request = failure.request
        rid = request.meta.get('_retry_id')
        reason = str(failure.value)
        self.logger_instance.error(f'Retry #{rid} FAILED again: {reason}')
        self.failed_requests.append({
            'source': self.name,
            'url': request.url,
            'reason': f'retry_failed: {reason}',
            'meta': dict(request.meta),
            'timestamp': time.time(),
        })
        self.fail_count += 1
        self._invoke_stats_callback()

    @abstractmethod
    def start_requests(self) -> Iterator[scrapy.Request]:
        pass

    @abstractmethod
    def parse(self, response, **kwargs):
        pass

    @abstractmethod
    def parse_journal_detail(self, response, **kwargs):
        pass

    def _notify_progress(self, journal_name: str = '', issn: str = '', url: str = ''):
        if self.progress_callback:
            try:
                self.progress_callback(self.name, journal_name, issn, url)
            except Exception as e:
                self.logger_instance.debug(f'Progress callback error: {e}')

    def _invoke_stats_callback(self):
        if self.stats_callback:
            try:
                self.stats_callback(
                    self.name,
                    success=1 if self.success_count > 0 else 0,
                    fail=1 if self.fail_count > 0 else 0,
                    total=1
                )
            except Exception as e:
                self.logger_instance.debug(f'Stats callback error: {e}')

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
            update_interval = self._update_interval

            clean_issn = issn.replace('-', '')
            cursor.execute('''
                SELECT last_crawl_time FROM crawl_state
                WHERE (issn = ? OR issn = ?) AND sources_completed LIKE ?
                ORDER BY last_crawl_time DESC LIMIT 1
            ''', (clean_issn, issn, f'%{self.name}%'))
            row = cursor.fetchone()
            conn.close()

            if row and row[0]:
                try:
                    last_time = datetime.fromisoformat(str(row[0]))
                    elapsed = datetime.now() - last_time
                    if elapsed < update_interval:
                        remaining = update_interval - elapsed
                        self.logger_instance.debug(
                            f'{issn} skipped (last crawled {elapsed.total_seconds()/3600:.1f}h ago, '
                            f'next in {remaining.total_seconds()/3600:.1f}h)'
                        )
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
            remaining_targets = max(0, len(self.target_issns) - self.total_count)
            remaining = remaining_targets / rate if rate > 0 else 0
            self.logger_instance.info(
                f'Progress: {self.total_count}/{len(self.target_issns)} '
                f'({self.total_count/max(1,len(self.target_issns))*100:.1f}%) | '
                f'Success: {self.success_count}, Fail: {self.fail_count} | '
                f'Rate: {rate:.1f}/s | ETA: {remaining/60:.1f}min'
            )
        if self.stats_callback:
            try:
                self.stats_callback(self.name, success=0, fail=0, total=1)
            except Exception:
                pass

    def record_result(self, is_success: bool):
        if is_success:
            self.success_count += 1
        else:
            self.fail_count += 1
        if self.stats_callback:
            try:
                self.stats_callback(
                    self.name,
                    success=1 if is_success else 0,
                    fail=0 if is_success else 1,
                    total=0
                )
            except Exception:
                pass

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
        if self.pending_retries:
            success_retries = len(self.retried_ids) - self.failed_requests.count(
                lambda x: 'retry_failed' in x.get('reason', '')
            ) if hasattr(self.failed_requests, '__iter__') else 0
            self.logger_instance.info(
                f'Retry summary: {len(self.retried_ids)} attempted, '
                f'{len(self.failed_requests)} remaining failed'
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
                meta = req.get('meta', {}) or {}
                retry_count = meta.get('_retry_count', meta.get('retry_times', 0))
                existing_reason = str(req.get('reason', ''))
                if existing_reason.startswith('retry_failed:'):
                    retry_count = int(meta.get('_retry_count', 0)) + 1
                cursor.execute('''
                    INSERT INTO failed_requests
                    (source, url, reason, meta, timestamp, retry_count)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    req.get('source', self.name),
                    req.get('url', ''),
                    existing_reason,
                    json.dumps(meta, ensure_ascii=False),
                    datetime.fromtimestamp(req.get('timestamp', time.time())).isoformat(),
                    retry_count
                ))
            conn.commit()
            conn.close()
            self.logger_instance.info(f'Saved {len(self.failed_requests)} failed requests for retry')
        except Exception as e:
            self.logger_instance.error(f'Failed to save failed requests: {e}')
