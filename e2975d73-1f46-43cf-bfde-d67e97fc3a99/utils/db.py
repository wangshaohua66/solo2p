import sqlite3
import json
import os
from datetime import datetime
from contextlib import contextmanager
from typing import List, Dict, Optional, Any
from config.settings import DB_PATH, DB_INIT_SQL
from utils.logger import logger, log_error_with_context


class DatabaseManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        self.conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA synchronous=NORMAL")
        self.conn.execute("PRAGMA cache_size=-20000")
        self.conn.execute("PRAGMA temp_store=MEMORY")
        self._init_tables()

    def _init_tables(self):
        try:
            cursor = self.conn.cursor()
            cursor.executescript(DB_INIT_SQL)
            self.conn.commit()
            logger.info("Database tables initialized successfully")
        except Exception as e:
            log_error_with_context(logger, e, "Failed to initialize database tables")
            self.conn.rollback()
            raise

    @contextmanager
    def get_cursor(self):
        cursor = self.conn.cursor()
        try:
            yield cursor
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def init_database(self):
        self._init_tables()
        logger.info("Database re-initialized")

    def insert_policy(self, policy_data: Dict[str, Any]) -> Optional[int]:
        try:
            with self.get_cursor() as cursor:
                attachments_json = json.dumps(policy_data.get('attachments', []), ensure_ascii=False)
                keywords_json = json.dumps(policy_data.get('keywords', []), ensure_ascii=False)

                cursor.execute('''
                    INSERT OR REPLACE INTO policies 
                    (url, title, content, category, sub_category, policy_type, publish_date, 
                     source, site_name, keywords, summary, attachments, raw_html, updated_at, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    policy_data.get('url', ''),
                    policy_data.get('title', ''),
                    policy_data.get('content', ''),
                    policy_data.get('category', ''),
                    policy_data.get('sub_category', ''),
                    policy_data.get('policy_type', ''),
                    policy_data.get('publish_date', ''),
                    policy_data.get('source', ''),
                    policy_data.get('site_name', ''),
                    keywords_json,
                    policy_data.get('summary', ''),
                    attachments_json,
                    policy_data.get('raw_html', ''),
                    datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    policy_data.get('status', 'active')
                ))
                return cursor.lastrowid
        except Exception as e:
            log_error_with_context(logger, e, f"Failed to insert policy: {policy_data.get('url', 'unknown')}")
            return None

    def batch_insert_policies(self, policies: List[Dict[str, Any]]) -> int:
        count = 0
        for policy in policies:
            if self.insert_policy(policy):
                count += 1
        return count

    def get_policy_by_url(self, url: str) -> Optional[Dict[str, Any]]:
        try:
            with self.get_cursor() as cursor:
                cursor.execute('SELECT * FROM policies WHERE url = ?', (url,))
                row = cursor.fetchone()
                if row:
                    return self._row_to_dict(row)
                return None
        except Exception as e:
            log_error_with_context(logger, e, f"Failed to get policy by URL: {url}")
            return None

    def policy_exists(self, url: str) -> bool:
        try:
            with self.get_cursor() as cursor:
                cursor.execute('SELECT 1 FROM policies WHERE url = ?', (url,))
                return cursor.fetchone() is not None
        except Exception as e:
            log_error_with_context(logger, e, f"Failed to check policy existence: {url}")
            return False

    def update_crawl_record(self, url: str, status: str = 'success', 
                           last_modified: str = None, etag: str = None):
        try:
            with self.get_cursor() as cursor:
                now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                cursor.execute('''
                    INSERT OR REPLACE INTO crawl_records 
                    (url, last_crawled, last_modified, etag, status, retry_count)
                    VALUES (?, ?, ?, ?, ?, COALESCE((SELECT retry_count FROM crawl_records WHERE url = ?), 0) + 1)
                ''', (url, now, last_modified, etag, status, url))
        except Exception as e:
            log_error_with_context(logger, e, f"Failed to update crawl record: {url}")

    def get_crawl_record(self, url: str) -> Optional[Dict[str, Any]]:
        try:
            with self.get_cursor() as cursor:
                cursor.execute('SELECT * FROM crawl_records WHERE url = ?', (url,))
                row = cursor.fetchone()
                if row:
                    return self._row_to_dict(row)
                return None
        except Exception as e:
            log_error_with_context(logger, e, f"Failed to get crawl record: {url}")
            return None

    def should_crawl(self, url: str, incremental: bool = True) -> bool:
        if not incremental:
            return True
        try:
            with self.get_cursor() as cursor:
                cursor.execute('SELECT last_crawled FROM crawl_records WHERE url = ? AND status = ?', 
                               (url, 'success'))
                row = cursor.fetchone()
                if row:
                    return False
                return True
        except Exception as e:
            log_error_with_context(logger, e, f"Failed to check should crawl: {url}")
            return True

    def insert_relation(self, policy_id: int, referenced_title: str, 
                       relation_type: str = 'reference', 
                       referenced_policy_id: int = None):
        try:
            with self.get_cursor() as cursor:
                cursor.execute('''
                    INSERT INTO policy_relations 
                    (policy_id, referenced_policy_id, referenced_title, relation_type)
                    VALUES (?, ?, ?, ?)
                ''', (policy_id, referenced_policy_id, referenced_title, relation_type))
                return cursor.lastrowid
        except Exception as e:
            log_error_with_context(logger, e, f"Failed to insert relation for policy {policy_id}")
            return None

    def get_policies(self, category: str = None, start_date: str = None, 
                    end_date: str = None, limit: int = None, 
                    offset: int = 0) -> List[Dict[str, Any]]:
        try:
            query = 'SELECT * FROM policies WHERE 1=1'
            params = []

            if category:
                query += ' AND category = ?'
                params.append(category)
            if start_date:
                query += ' AND publish_date >= ?'
                params.append(start_date)
            if end_date:
                query += ' AND publish_date <= ?'
                params.append(end_date)

            query += ' ORDER BY publish_date DESC'

            if limit:
                query += ' LIMIT ? OFFSET ?'
                params.extend([limit, offset])

            with self.get_cursor() as cursor:
                cursor.execute(query, params)
                rows = cursor.fetchall()
                return [self._row_to_dict(row) for row in rows]
        except Exception as e:
            log_error_with_context(logger, e, "Failed to get policies")
            return []

    def search_policies(self, keyword: str, category: str = None, 
                       limit: int = 100) -> List[Dict[str, Any]]:
        try:
            query = '''
                SELECT * FROM policies 
                WHERE (title LIKE ? OR content LIKE ? OR keywords LIKE ?)
            '''
            params = [f'%{keyword}%', f'%{keyword}%', f'%{keyword}%']

            if category:
                query += ' AND category = ?'
                params.append(category)

            query += ' ORDER BY publish_date DESC LIMIT ?'
            params.append(limit)

            with self.get_cursor() as cursor:
                cursor.execute(query, params)
                rows = cursor.fetchall()
                return [self._row_to_dict(row) for row in rows]
        except Exception as e:
            log_error_with_context(logger, e, f"Failed to search policies with keyword: {keyword}")
            return []

    def get_policy_relations(self, policy_id: int) -> List[Dict[str, Any]]:
        try:
            with self.get_cursor() as cursor:
                cursor.execute('''
                    SELECT pr.*, p.title as policy_title, rp.title as referenced_policy_title
                    FROM policy_relations pr
                    LEFT JOIN policies p ON pr.policy_id = p.id
                    LEFT JOIN policies rp ON pr.referenced_policy_id = rp.id
                    WHERE pr.policy_id = ? OR pr.referenced_policy_id = ?
                ''', (policy_id, policy_id))
                rows = cursor.fetchall()
                return [self._row_to_dict(row) for row in rows]
        except Exception as e:
            log_error_with_context(logger, e, f"Failed to get policy relations: {policy_id}")
            return []

    def get_statistics(self) -> Dict[str, Any]:
        try:
            with self.get_cursor() as cursor:
                cursor.execute('SELECT COUNT(*) as total FROM policies')
                total = cursor.fetchone()['total']

                cursor.execute('''
                    SELECT category, COUNT(*) as count 
                    FROM policies 
                    GROUP BY category 
                    ORDER BY count DESC
                ''')
                by_category = [dict(row) for row in cursor.fetchall()]

                cursor.execute('''
                    SELECT substr(publish_date, 1, 7) as month, COUNT(*) as count
                    FROM policies
                    WHERE publish_date IS NOT NULL AND publish_date != ''
                    GROUP BY month
                    ORDER BY month DESC
                    LIMIT 12
                ''')
                by_month = [dict(row) for row in cursor.fetchall()]

                cursor.execute('SELECT COUNT(*) as total_relations FROM policy_relations')
                total_relations = cursor.fetchone()['total_relations']

                return {
                    'total_policies': total,
                    'by_category': by_category,
                    'by_month': by_month,
                    'total_relations': total_relations
                }
        except Exception as e:
            log_error_with_context(logger, e, "Failed to get statistics")
            return {}

    def get_update_report(self, days: int = 1) -> Dict[str, Any]:
        try:
            with self.get_cursor() as cursor:
                date_limit = datetime.now().strftime(f'%Y-%m-%d 00:00:00')
                cursor.execute('''
                    SELECT * FROM policies 
                    WHERE updated_at >= ? 
                    ORDER BY updated_at DESC
                ''', (date_limit,))
                updated = [self._row_to_dict(row) for row in cursor.fetchall()]

                cursor.execute('''
                    SELECT * FROM crawl_records 
                    WHERE last_crawled >= ? AND status != 'success'
                    ORDER BY last_crawled DESC
                ''', (date_limit,))
                failed = [self._row_to_dict(row) for row in cursor.fetchall()]

                return {
                    'period_days': days,
                    'updated_count': len(updated),
                    'failed_count': len(failed),
                    'updated_policies': updated,
                    'failed_urls': failed
                }
        except Exception as e:
            log_error_with_context(logger, e, "Failed to generate update report")
            return {}

    def close(self):
        if self.conn:
            self.conn.close()

    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        data = dict(row)
        for key in ['keywords', 'attachments']:
            if key in data and data[key]:
                try:
                    data[key] = json.loads(data[key])
                except (json.JSONDecodeError, TypeError):
                    pass
        return data


db = DatabaseManager()
