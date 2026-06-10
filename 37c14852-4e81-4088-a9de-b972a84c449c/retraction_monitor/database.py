import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta
import json
import os
import logging

logger = logging.getLogger(__name__)

LOCAL = threading.local()


def get_connection(db_path: str, wal_mode: bool = True) -> sqlite3.Connection:
    conn = getattr(LOCAL, "db_conn", None)
    if conn is None:
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        if wal_mode:
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("PRAGMA synchronous = NORMAL")
            conn.execute("PRAGMA cache_size = -64000")
            conn.execute("PRAGMA temp_store = MEMORY")
            conn.execute("PRAGMA mmap_size = 1073741824")
        LOCAL.db_conn = conn
    return conn


@contextmanager
def transaction(db_path: str, wal_mode: bool = True):
    conn = get_connection(db_path, wal_mode)
    try:
        conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.execute("COMMIT")
    except Exception as e:
        logger.error(f"Database transaction failed: {e}")
        conn.execute("ROLLBACK")
        raise


def init_database(db_path: str, wal_mode: bool = True) -> None:
    with transaction(db_path, wal_mode) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS retraction_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id TEXT UNIQUE,
                source TEXT NOT NULL,
                source_url TEXT,
                crawl_time TEXT NOT NULL,
                doi TEXT,
                normalized_doi TEXT,
                title TEXT,
                authors TEXT,
                author_list TEXT,
                journal TEXT,
                publisher TEXT,
                publication_date TEXT,
                year INTEGER,
                volume TEXT,
                issue TEXT,
                pages TEXT,
                retraction_type TEXT,
                retraction_reason TEXT,
                reason_categories TEXT,
                retraction_date TEXT,
                retraction_notice_url TEXT,
                retraction_notice_doi TEXT,
                severity_score INTEGER,
                severity_level TEXT,
                is_high_risk INTEGER DEFAULT 0,
                simhash TEXT,
                content_hash TEXT,
                abstract TEXT,
                keywords TEXT,
                affiliations TEXT,
                corresponding_author TEXT,
                corresponding_email TEXT,
                paper_url TEXT,
                pdf_url TEXT,
                raw_html_path TEXT,
                matched_team_papers TEXT,
                alert_sent INTEGER DEFAULT 0,
                alert_channels TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_retraction_normalized_doi
            ON retraction_records(normalized_doi)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_retraction_simhash
            ON retraction_records(simhash)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_retraction_source_time
            ON retraction_records(source, crawl_time DESC)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_retraction_severity
            ON retraction_records(severity_level, is_high_risk)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_retraction_year_journal
            ON retraction_records(year, journal)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_retraction_crawl_time
            ON retraction_records(crawl_time DESC)
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS dedup_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dedup_key TEXT UNIQUE,
                source TEXT,
                first_seen TEXT NOT NULL,
                last_seen TEXT NOT NULL,
                record_count INTEGER DEFAULT 1
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot_date TEXT UNIQUE NOT NULL,
                record_count INTEGER NOT NULL,
                snapshot_path TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS team_references (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bibtex_key TEXT UNIQUE,
                doi TEXT,
                normalized_doi TEXT,
                title TEXT,
                authors TEXT,
                journal TEXT,
                year INTEGER,
                bibtex_raw TEXT,
                tags TEXT,
                added_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_checked TEXT
            )
            """
        )

        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_team_doi
            ON team_references(normalized_doi)
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id TEXT,
                channel TEXT NOT NULL,
                severity_level TEXT,
                sent_at TEXT NOT NULL,
                status TEXT NOT NULL,
                retry_count INTEGER DEFAULT 0,
                error_message TEXT,
                FOREIGN KEY (record_id) REFERENCES retraction_records(record_id)
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS alert_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id TEXT,
                payload TEXT NOT NULL,
                channels TEXT NOT NULL,
                priority INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                next_attempt_at TEXT,
                retry_count INTEGER DEFAULT 0,
                failed INTEGER DEFAULT 0
            )
            """
        )

        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_alert_queue_next
            ON alert_queue(next_attempt_at ASC) WHERE failed = 0
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS crawl_statistics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                date TEXT NOT NULL,
                records_crawled INTEGER DEFAULT 0,
                records_new INTEGER DEFAULT 0,
                records_duplicate INTEGER DEFAULT 0,
                records_alerted INTEGER DEFAULT 0,
                duration_seconds REAL,
                error_count INTEGER DEFAULT 0,
                UNIQUE(source, date)
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS failed_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                source TEXT,
                http_status INTEGER,
                error_type TEXT,
                error_message TEXT,
                response_body_path TEXT,
                timestamp TEXT NOT NULL,
                retry_count INTEGER DEFAULT 0,
                resolved INTEGER DEFAULT 0
            )
            """
        )


def insert_retraction_record(conn: sqlite3.Connection, item: dict) -> int:
    now = datetime.utcnow().isoformat()
    cursor = conn.execute(
        """
        INSERT OR REPLACE INTO retraction_records (
            record_id, source, source_url, crawl_time, doi, normalized_doi,
            title, authors, author_list, journal, publisher, publication_date, year,
            volume, issue, pages, retraction_type, retraction_reason, reason_categories,
            retraction_date, retraction_notice_url, retraction_notice_doi,
            severity_score, severity_level, is_high_risk, simhash, content_hash,
            abstract, keywords, affiliations, corresponding_author, corresponding_email,
            paper_url, pdf_url, raw_html_path, matched_team_papers, alert_sent,
            alert_channels, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(record_id) DO UPDATE SET
            updated_at = EXCLUDED.updated_at,
            severity_score = EXCLUDED.severity_score,
            severity_level = EXCLUDED.severity_level,
            is_high_risk = EXCLUDED.is_high_risk,
            alert_sent = EXCLUDED.alert_sent,
            alert_channels = EXCLUDED.alert_channels,
            matched_team_papers = EXCLUDED.matched_team_papers
        """,
        (
            item.get("record_id"),
            item.get("source"),
            item.get("source_url"),
            item.get("crawl_time", now),
            item.get("doi"),
            item.get("normalized_doi"),
            item.get("title"),
            item.get("authors"),
            json.dumps(item.get("author_list", []), ensure_ascii=False) if item.get("author_list") else None,
            item.get("journal"),
            item.get("publisher"),
            item.get("publication_date"),
            item.get("year"),
            item.get("volume"),
            item.get("issue"),
            item.get("pages"),
            item.get("retraction_type"),
            item.get("retraction_reason"),
            json.dumps(item.get("reason_categories", []), ensure_ascii=False) if item.get("reason_categories") else None,
            item.get("retraction_date"),
            item.get("retraction_notice_url"),
            item.get("retraction_notice_doi"),
            item.get("severity_score"),
            item.get("severity_level"),
            1 if item.get("is_high_risk") else 0,
            item.get("simhash"),
            item.get("content_hash"),
            item.get("abstract"),
            json.dumps(item.get("keywords", []), ensure_ascii=False) if item.get("keywords") else None,
            json.dumps(item.get("affiliations", []), ensure_ascii=False) if item.get("affiliations") else None,
            item.get("corresponding_author"),
            item.get("corresponding_email"),
            item.get("paper_url"),
            item.get("pdf_url"),
            item.get("raw_html_path"),
            json.dumps(item.get("matched_team_papers", []), ensure_ascii=False) if item.get("matched_team_papers") else None,
            1 if item.get("alert_sent") else 0,
            json.dumps(item.get("alert_channels", []), ensure_ascii=False) if item.get("alert_channels") else None,
            item.get("notes"),
            now,
            now,
        ),
    )
    return cursor.lastrowid


def find_duplicate(conn: sqlite3.Connection, dedup_key: str, window_hours: int = 72) -> bool:
    cutoff = (datetime.utcnow() - timedelta(hours=window_hours)).isoformat()
    cursor = conn.execute(
        """
        SELECT 1 FROM dedup_cache
        WHERE dedup_key = ? AND last_seen >= ?
        LIMIT 1
        """,
        (dedup_key, cutoff),
    )
    return cursor.fetchone() is not None


def update_dedup_cache(conn: sqlite3.Connection, dedup_key: str, source: str) -> None:
    now = datetime.utcnow().isoformat()
    conn.execute(
        """
        INSERT INTO dedup_cache (dedup_key, source, first_seen, last_seen, record_count)
        VALUES (?, ?, ?, ?, 1)
        ON CONFLICT(dedup_key) DO UPDATE SET
            last_seen = EXCLUDED.last_seen,
            record_count = record_count + 1
        """,
        (dedup_key, source, now, now),
    )


def check_dedup_by_simhash(
    conn: sqlite3.Connection,
    simhash: str,
    source: str,
    threshold: int = 3,
    window_hours: int = 72,
) -> bool:
    if not simhash:
        return False
    cutoff = (datetime.utcnow() - timedelta(hours=window_hours)).isoformat()
    cursor = conn.execute(
        """
        SELECT simhash FROM retraction_records
        WHERE source = ? AND crawl_time >= ? AND simhash IS NOT NULL
        """,
        (source, cutoff),
    )
    target = int(simhash, 16)
    for row in cursor.fetchall():
        existing = int(row["simhash"], 16)
        distance = bin(target ^ existing).count("1")
        if distance <= threshold:
            return True
    return False


def get_records_by_criteria(
    conn: sqlite3.Connection,
    start_date: str = None,
    end_date: str = None,
    journal: str = None,
    author: str = None,
    affiliation: str = None,
    severity_level: str = None,
    source: str = None,
    limit: int = None,
) -> list:
    query = "SELECT * FROM retraction_records WHERE 1=1"
    params = []
    if start_date:
        query += " AND crawl_time >= ?"
        params.append(start_date)
    if end_date:
        query += " AND crawl_time <= ?"
        params.append(end_date)
    if journal:
        query += " AND journal LIKE ?"
        params.append(f"%{journal}%")
    if author:
        query += " AND authors LIKE ?"
        params.append(f"%{author}%")
    if affiliation:
        query += " AND affiliations LIKE ?"
        params.append(f"%{affiliation}%")
    if severity_level:
        query += " AND severity_level = ?"
        params.append(severity_level)
    if source:
        query += " AND source = ?"
        params.append(source)
    query += " ORDER BY crawl_time DESC"
    if limit:
        query += " LIMIT ?"
        params.append(limit)
    cursor = conn.execute(query, params)
    return cursor.fetchall()


def get_new_records_since(conn: sqlite3.Connection, last_snapshot: str) -> list:
    cursor = conn.execute(
        """
        SELECT * FROM retraction_records
        WHERE crawl_time > ?
        ORDER BY crawl_time DESC
        """,
        (last_snapshot,),
    )
    return cursor.fetchall()


def upsert_team_reference(conn: sqlite3.Connection, ref: dict) -> int:
    now = datetime.utcnow().isoformat()
    cursor = conn.execute(
        """
        INSERT OR REPLACE INTO team_references (
            bibtex_key, doi, normalized_doi, title, authors, journal, year,
            bibtex_raw, tags, added_at, last_checked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT added_at FROM team_references WHERE bibtex_key = ?), ?), ?)
        RETURNING id
        """,
        (
            ref.get("bibtex_key"),
            ref.get("doi"),
            ref.get("normalized_doi"),
            ref.get("title"),
            ref.get("authors"),
            ref.get("journal"),
            ref.get("year"),
            ref.get("bibtex_raw"),
            json.dumps(ref.get("tags", []), ensure_ascii=False) if ref.get("tags") else None,
            ref.get("bibtex_key"),
            now,
            now,
        ),
    )
    row = cursor.fetchone()
    return row["id"] if row else 0


def match_team_references(
    conn: sqlite3.Connection,
    normalized_doi: str = None,
    title: str = None,
    authors: list = None,
) -> list:
    matches = []
    if normalized_doi:
        cursor = conn.execute(
            """
            SELECT * FROM team_references WHERE normalized_doi = ?
            """,
            (normalized_doi,),
        )
        matches.extend(cursor.fetchall())
    if not matches and title and authors:
        cursor = conn.execute(
            """
            SELECT * FROM team_references
            WHERE title LIKE ?
            """,
            (f"%{title[:50]}%",),
        )
        for row in cursor.fetchall():
            row_authors = row["authors"] or ""
            for author in authors[:3]:
                if author and author in row_authors:
                    matches.append(row)
                    break
    return matches


def log_failed_request(
    conn: sqlite3.Connection,
    url: str,
    source: str,
    http_status: int = None,
    error_type: str = None,
    error_message: str = None,
    response_body_path: str = None,
) -> None:
    now = datetime.utcnow().isoformat()
    conn.execute(
        """
        INSERT INTO failed_requests (
            url, source, http_status, error_type, error_message,
            response_body_path, timestamp, retry_count, resolved
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
        """,
        (url, source, http_status, error_type, error_message, response_body_path, now),
    )


def save_alert_queue(
    conn: sqlite3.Connection,
    record_id: str,
    payload: dict,
    channels: list,
    priority: int = 0,
) -> int:
    now = datetime.utcnow().isoformat()
    cursor = conn.execute(
        """
        INSERT INTO alert_queue (
            record_id, payload, channels, priority,
            created_at, next_attempt_at, retry_count, failed
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0)
        RETURNING id
        """,
        (
            record_id,
            json.dumps(payload, ensure_ascii=False),
            json.dumps(channels, ensure_ascii=False),
            priority,
            now,
            now,
        ),
    )
    row = cursor.fetchone()
    return row["id"] if row else 0


def get_pending_alerts(conn: sqlite3.Connection, limit: int = 100) -> list:
    now = datetime.utcnow().isoformat()
    cursor = conn.execute(
        """
        SELECT * FROM alert_queue
        WHERE failed = 0 AND next_attempt_at <= ?
        ORDER BY priority DESC, next_attempt_at ASC
        LIMIT ?
        """,
        (now, limit),
    )
    return cursor.fetchall()


def update_alert_queue(
    conn: sqlite3.Connection,
    queue_id: int,
    success: bool,
    error_message: str = None,
) -> None:
    if success:
        conn.execute(
            """
            DELETE FROM alert_queue WHERE id = ?
            """,
            (queue_id,),
        )
    else:
        next_attempt = (
            datetime.utcnow() + timedelta(minutes=5)
        ).isoformat()
        conn.execute(
            """
            UPDATE alert_queue SET
                retry_count = retry_count + 1,
                next_attempt_at = ?,
                error_message = ?,
                failed = CASE WHEN retry_count >= 5 THEN 1 ELSE 0 END
            WHERE id = ?
            """,
            (next_attempt, error_message, queue_id),
        )


def log_alert(
    conn: sqlite3.Connection,
    record_id: str,
    channel: str,
    severity_level: str,
    status: str,
    error_message: str = None,
) -> None:
    now = datetime.utcnow().isoformat()
    conn.execute(
        """
        INSERT INTO alerts (
            record_id, channel, severity_level, sent_at,
            status, retry_count, error_message
        ) VALUES (?, ?, ?, ?, ?, 0, ?)
        """,
        (record_id, channel, severity_level, now, status, error_message),
    )


def save_snapshot_metadata(
    conn: sqlite3.Connection,
    snapshot_date: str,
    record_count: int,
    snapshot_path: str,
) -> int:
    cursor = conn.execute(
        """
        INSERT OR REPLACE INTO snapshots (
            snapshot_date, record_count, snapshot_path
        ) VALUES (?, ?, ?)
        RETURNING id
        """,
        (snapshot_date, record_count, snapshot_path),
    )
    row = cursor.fetchone()
    return row["id"] if row else 0


def get_last_snapshot(conn: sqlite3.Connection) -> dict:
    cursor = conn.execute(
        """
        SELECT * FROM snapshots ORDER BY snapshot_date DESC LIMIT 1
        """
    )
    return cursor.fetchone()


def update_crawl_statistics(
    conn: sqlite3.Connection,
    source: str,
    date: str,
    records_crawled: int = 0,
    records_new: int = 0,
    records_duplicate: int = 0,
    records_alerted: int = 0,
    duration_seconds: float = None,
    error_count: int = 0,
) -> None:
    conn.execute(
        """
        INSERT INTO crawl_statistics (
            source, date, records_crawled, records_new, records_duplicate,
            records_alerted, duration_seconds, error_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source, date) DO UPDATE SET
            records_crawled = records_crawled + EXCLUDED.records_crawled,
            records_new = records_new + EXCLUDED.records_new,
            records_duplicate = records_duplicate + EXCLUDED.records_duplicate,
            records_alerted = records_alerted + EXCLUDED.records_alerted,
            duration_seconds = COALESCE(EXCLUDED.duration_seconds, crawl_statistics.duration_seconds),
            error_count = error_count + EXCLUDED.error_count
        """,
        (
            source, date, records_crawled, records_new, records_duplicate,
            records_alerted, duration_seconds, error_count,
        ),
    )
