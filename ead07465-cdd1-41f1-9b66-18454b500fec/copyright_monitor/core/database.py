import sqlite3
import os
import json
from datetime import datetime
from loguru import logger


class DatabaseManager:
    _instance = None

    def __new__(cls, db_path=None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, db_path=None):
        if self._initialized:
            return
        if db_path is None:
            db_path = os.path.join("data", "copyright_monitor.db")
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.db_path = db_path
        self.conn = None
        self._connect()
        self._create_tables()
        self._create_indexes()
        self._initialized = True

    def _connect(self):
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA synchronous=NORMAL")
        self.conn.execute("PRAGMA cache_size=-64000")
        self.conn.execute("PRAGMA temp_store=MEMORY")
        self.conn.row_factory = sqlite3.Row

    def _create_tables(self):
        cursor = self.conn.cursor()
        cursor.executescript("""
            CREATE TABLE IF NOT EXISTS copyrighted_works (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT,
                genre TEXT,
                keywords TEXT,
                original_text TEXT,
                key_paragraphs TEXT,
                ngram_fingerprint TEXT,
                similarity_threshold REAL DEFAULT 0.75,
                registration_date TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS crawled_pages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                work_id TEXT NOT NULL,
                platform_key TEXT NOT NULL,
                platform_name TEXT,
                result_title TEXT,
                result_author TEXT,
                result_url TEXT,
                result_summary TEXT,
                content_text TEXT,
                search_keyword TEXT,
                entry_type TEXT,
                crawl_time TEXT DEFAULT (datetime('now')),
                UNIQUE(work_id, platform_key, result_url)
            );

            CREATE TABLE IF NOT EXISTS comparison_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                work_id TEXT NOT NULL,
                platform_key TEXT NOT NULL,
                platform_name TEXT,
                result_url TEXT,
                result_title TEXT,
                result_author TEXT,
                title_similarity REAL,
                paragraph_similarity REAL,
                ngram_similarity REAL,
                overall_similarity REAL,
                is_infringement INTEGER DEFAULT 0,
                match_type TEXT,
                matched_paragraphs TEXT,
                crawl_time TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (work_id) REFERENCES copyrighted_works(id)
            );

            CREATE TABLE IF NOT EXISTS forensics_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                comparison_id INTEGER,
                work_id TEXT NOT NULL,
                result_url TEXT,
                screenshot_path TEXT,
                html_archive_path TEXT,
                sha256_hash TEXT,
                html_sha256 TEXT,
                forensics_time TEXT DEFAULT (datetime('now')),
                forensics_status TEXT DEFAULT 'pending',
                FOREIGN KEY (comparison_id) REFERENCES comparison_results(id),
                FOREIGN KEY (work_id) REFERENCES copyrighted_works(id)
            );

            CREATE TABLE IF NOT EXISTS scan_schedule (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                work_id TEXT NOT NULL,
                platform_key TEXT NOT NULL,
                last_scan_time TEXT,
                next_scan_time TEXT,
                scan_priority INTEGER DEFAULT 5,
                scan_status TEXT DEFAULT 'pending',
                consecutive_failures INTEGER DEFAULT 0,
                FOREIGN KEY (work_id) REFERENCES copyrighted_works(id),
                UNIQUE(work_id, platform_key)
            );

            CREATE TABLE IF NOT EXISTS scan_statistics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_date TEXT NOT NULL,
                platform_key TEXT,
                pages_crawled INTEGER DEFAULT 0,
                infringements_found INTEGER DEFAULT 0,
                avg_response_time REAL DEFAULT 0,
                success_rate REAL DEFAULT 1.0,
                ban_rate REAL DEFAULT 0.0,
                captcha_count INTEGER DEFAULT 0,
                errors TEXT,
                UNIQUE(scan_date, platform_key)
            );

            CREATE TABLE IF NOT EXISTS scan_checkpoints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                spider_name TEXT NOT NULL,
                work_id TEXT NOT NULL,
                platform_key TEXT NOT NULL,
                last_processed_url TEXT,
                last_processed_keyword TEXT,
                checkpoint_time TEXT DEFAULT (datetime('now')),
                UNIQUE(spider_name, work_id, platform_key)
            );
        """)
        self.conn.commit()

    def _create_indexes(self):
        cursor = self.conn.cursor()
        cursor.executescript("""
            CREATE INDEX IF NOT EXISTS idx_crawled_work_platform ON crawled_pages(work_id, platform_key);
            CREATE INDEX IF NOT EXISTS idx_crawled_url ON crawled_pages(result_url);
            CREATE INDEX IF NOT EXISTS idx_crawled_time ON crawled_pages(crawl_time);
            CREATE INDEX IF NOT EXISTS idx_comparison_work ON comparison_results(work_id);
            CREATE INDEX IF NOT EXISTS idx_comparison_similarity ON comparison_results(overall_similarity);
            CREATE INDEX IF NOT EXISTS idx_comparison_infringement ON comparison_results(is_infringement);
            CREATE INDEX IF NOT EXISTS idx_forensics_work ON forensics_records(work_id);
            CREATE INDEX IF NOT EXISTS idx_forensics_hash ON forensics_records(sha256_hash);
            CREATE INDEX IF NOT EXISTS idx_schedule_next ON scan_schedule(next_scan_time, scan_priority);
            CREATE INDEX IF NOT EXISTS idx_schedule_status ON scan_schedule(scan_status);
            CREATE INDEX IF NOT EXISTS idx_stats_date ON scan_statistics(scan_date);
        """)
        self.conn.commit()

    def execute(self, sql, params=None):
        try:
            cursor = self.conn.cursor()
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)
            self.conn.commit()
            return cursor
        except sqlite3.Error as e:
            logger.error(f"SQLite error: {e}, SQL: {sql}")
            self.conn.rollback()
            return None

    def fetchone(self, sql, params=None):
        cursor = self.conn.cursor()
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        return cursor.fetchone()

    def fetchall(self, sql, params=None):
        cursor = self.conn.cursor()
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        return cursor.fetchall()

    def close(self):
        if self.conn:
            self.conn.close()
            self.conn = None
            DatabaseManager._instance = None
