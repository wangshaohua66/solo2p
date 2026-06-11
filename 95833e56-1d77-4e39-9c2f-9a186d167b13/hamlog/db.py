"""Database management for HAMLOG.

SQLite3 backend with WAL mode, composite indexes, and migration support.
"""

import sqlite3
import os
import re
import logging
from pathlib import Path
from typing import Optional, List, Tuple, Any

logger = logging.getLogger(__name__)

DB_FILENAME = "hamlog.db"
SCHEMA_VERSION = 2


def get_db_path() -> Path:
    """Get the database file path."""
    base_dir = Path(os.environ.get("HAMLOG_DATA_DIR", str(Path.home() / ".hamlog")))
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir / DB_FILENAME


def _regexp_match(pattern: str, string: str) -> bool:
    """REGEXP function for SQLite."""
    if string is None:
        return False
    try:
        return re.search(pattern, string) is not None
    except re.error:
        return False


class Database:
    """SQLite database connection manager with WAL mode."""

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or get_db_path()
        self._conn: Optional[sqlite3.Connection] = None
        self._ensure_directory()

    def _ensure_directory(self):
        """Ensure the database directory exists."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    @property
    def conn(self) -> sqlite3.Connection:
        """Get or create a database connection."""
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.db_path))
            self._conn.row_factory = sqlite3.Row
            self._conn.create_function("REGEXP", 2, _regexp_match)
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA synchronous=NORMAL")
            self._conn.execute("PRAGMA cache_size=-64000")
            self._conn.execute("PRAGMA temp_store=MEMORY")
            self._conn.execute("PRAGMA foreign_keys=ON")
        return self._conn

    def close(self):
        """Close the database connection."""
        if self._conn:
            self._conn.close()
            self._conn = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False

    def init_schema(self):
        """Initialize or migrate the database schema."""
        current_version = self._get_schema_version()
        if current_version < SCHEMA_VERSION:
            self._migrate(current_version)

        self.conn.commit()
        logger.debug("Schema initialized at version %d", SCHEMA_VERSION)

    def _get_schema_version(self) -> int:
        """Get the current schema version."""
        cursor = self.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
        )
        if cursor.fetchone() is None:
            return 0

        cursor = self.conn.execute(
            "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
        )
        row = cursor.fetchone()
        return row["version"] if row else 0

    def _migrate(self, from_version: int):
        """Migrate the schema from a given version."""
        migrations = {
            1: self._migrate_v1,
            2: self._migrate_v2,
        }

        for version in range(from_version + 1, SCHEMA_VERSION + 1):
            logger.info("Migrating schema to version %d", version)
            migrations[version]()
            self.conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (?, datetime('now'))",
                (version,),
            )

    def _migrate_v1(self):
        """Initial schema: QSO table with indexes."""
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS qsos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                callsign TEXT NOT NULL,
                qso_date TEXT NOT NULL,
                qso_time TEXT NOT NULL,
                band TEXT NOT NULL,
                mode TEXT NOT NULL,
                freq REAL,
                rst_sent TEXT,
                rst_rcvd TEXT,
                grid TEXT,
                name TEXT,
                qth TEXT,
                state TEXT,
                cq_zone INTEGER,
                ituzone INTEGER,
                dxcc INTEGER,
                country TEXT,
                operator TEXT,
                station_callsign TEXT,
                my_grid TEXT,
                tx_pwr REAL,
                rig TEXT,
                antenna TEXT,
                comment TEXT,
                notes TEXT,
                contest_id TEXT,
                srx INTEGER,
                srx_string TEXT,
                stx INTEGER,
                stx_string TEXT,
                qsl_rcvd TEXT DEFAULT 'N',
                qsl_sent TEXT DEFAULT 'N',
                lotw_rcvd TEXT DEFAULT 'N',
                lotw_sent TEXT DEFAULT 'N',
                qrzcom_qso_upload_date TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_qso_unique
                ON qsos(callsign, qso_date, qso_time, band, mode);

            CREATE INDEX IF NOT EXISTS idx_qso_callsign ON qsos(callsign);
            CREATE INDEX IF NOT EXISTS idx_qso_date ON qsos(qso_date);
            CREATE INDEX IF NOT EXISTS idx_qso_band_mode ON qsos(band, mode);
            CREATE INDEX IF NOT EXISTS idx_qso_dxcc ON qsos(dxcc);
            CREATE INDEX IF NOT EXISTS idx_qso_state ON qsos(state);
            CREATE INDEX IF NOT EXISTS idx_qso_cq_zone ON qsos(cq_zone);
        """)

    def _migrate_v2(self):
        """Add propagation cache and config tables."""
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS propagation_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cache_date TEXT NOT NULL UNIQUE,
                sfi REAL,
                a_index INTEGER,
                k_index REAL,
                ssn INTEGER,
                solar_wind_speed REAL,
                x_ray REAL,
                flux_line TEXT,
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS dxcc_entities (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                prefix TEXT,
                continent TEXT,
                ituzone INTEGER,
                cq_zone INTEGER,
                deleted INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS us_states (
                abbreviation TEXT PRIMARY KEY,
                name TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cq_zones (
                zone INTEGER PRIMARY KEY,
                name TEXT
            );
        """)

    def execute(self, sql: str, params: Tuple = ()) -> sqlite3.Cursor:
        """Execute a SQL statement."""
        return self.conn.execute(sql, params)

    def executemany(self, sql: str, seq_of_params: List[Tuple]) -> sqlite3.Cursor:
        """Execute many SQL statements."""
        return self.conn.executemany(sql, seq_of_params)

    def query_one(self, sql: str, params: Tuple = ()) -> Optional[sqlite3.Row]:
        """Query a single row."""
        cursor = self.conn.execute(sql, params)
        return cursor.fetchone()

    def query_all(self, sql: str, params: Tuple = ()) -> List[sqlite3.Row]:
        """Query all rows."""
        cursor = self.conn.execute(sql, params)
        return cursor.fetchall()

    def commit(self):
        """Commit the current transaction."""
        self.conn.commit()

    def rollback(self):
        """Rollback the current transaction."""
        self.conn.rollback()
