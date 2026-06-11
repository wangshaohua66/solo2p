import sqlite3
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from contextlib import contextmanager
from utils.logger import get_logger
from utils.config import load_config

logger = get_logger()

MIGRATIONS = [
    {
        "version": 1,
        "description": "Initial schema - inks, inventory, recipes, journal",
        "sql": [
            """
            CREATE TABLE IF NOT EXISTS inks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand TEXT NOT NULL,
                line TEXT,
                color_name TEXT NOT NULL,
                volume_ml REAL NOT NULL,
                price REAL,
                l REAL NOT NULL,
                a REAL NOT NULL,
                b REAL NOT NULL,
                ink_type TEXT NOT NULL DEFAULT 'dye',
                tags TEXT,
                purchase_date TEXT,
                expiration_date TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ink_id INTEGER NOT NULL,
                bottle_count INTEGER NOT NULL DEFAULT 1,
                current_ml REAL NOT NULL,
                location TEXT,
                batch_number TEXT,
                FOREIGN KEY (ink_id) REFERENCES inks (id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS recipes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                target_l REAL NOT NULL,
                target_a REAL NOT NULL,
                target_b REAL NOT NULL,
                delta_e REAL,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS recipe_components (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipe_id INTEGER NOT NULL,
                ink_id INTEGER NOT NULL,
                volume_ratio REAL NOT NULL,
                FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE,
                FOREIGN KEY (ink_id) REFERENCES inks (id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS journal (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                pen TEXT NOT NULL,
                nib TEXT,
                ink_id INTEGER NOT NULL,
                paper TEXT NOT NULL,
                humidity INTEGER,
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ink_id) REFERENCES inks (id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
                description TEXT
            )
            """,
            "INSERT OR IGNORE INTO schema_version (version, description) VALUES (0, 'initial')",
        ],
    },
    {
        "version": 2,
        "description": "Add indexes for performance",
        "sql": [
            "CREATE INDEX IF NOT EXISTS idx_inks_type ON inks(ink_type)",
            "CREATE INDEX IF NOT EXISTS idx_inks_brand ON inks(brand)",
            "CREATE INDEX IF NOT EXISTS idx_journal_date ON journal(date)",
            "CREATE INDEX IF NOT EXISTS idx_journal_pen ON journal(pen)",
            "CREATE INDEX IF NOT EXISTS idx_journal_paper ON journal(paper)",
            "CREATE INDEX IF NOT EXISTS idx_inventory_ink ON inventory(ink_id)",
        ],
    },
    {
        "version": 3,
        "description": "Add mixing predictions table",
        "sql": [
            """
            CREATE TABLE IF NOT EXISTS mixing_predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipe_id INTEGER,
                result_l REAL NOT NULL,
                result_a REAL NOT NULL,
                result_b REAL NOT NULL,
                paper_white_l REAL DEFAULT 95,
                paper_white_a REAL DEFAULT 0,
                paper_white_b REAL DEFAULT 0,
                color_shift_notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE SET NULL
            )
            """,
        ],
    },
]


class DatabaseError(Exception):
    pass


class Database:
    _instance: Optional["Database"] = None

    def __new__(cls, db_path: Optional[str] = None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, db_path: Optional[str] = None):
        if self._initialized:
            return
        self._initialized = True

        if db_path is None:
            config = load_config()
            db_path = config.db_path

        db_path = Path(db_path).expanduser()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db_path = str(db_path)
        logger.info(f"Initializing database at {self.db_path}")
        self._migrate()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
        finally:
            conn.close()

    def _get_schema_version(self) -> int:
        with self._get_connection() as conn:
            try:
                result = conn.execute(
                    "SELECT MAX(version) as version FROM schema_version"
                ).fetchone()
                return result["version"] if result else 0
            except sqlite3.OperationalError:
                return 0

    def _migrate(self) -> None:
        current_version = self._get_schema_version()
        logger.info(f"Current schema version: {current_version}")

        for migration in MIGRATIONS:
            if migration["version"] > current_version:
                logger.info(
                    f"Applying migration v{migration['version']}: {migration['description']}"
                )
                with self._get_connection() as conn:
                    try:
                        for sql in migration["sql"]:
                            conn.execute(sql)
                        conn.execute(
                            "INSERT INTO schema_version (version, description) VALUES (?, ?)",
                            (migration["version"], migration["description"]),
                        )
                        conn.commit()
                        logger.info(
                            f"Migration v{migration['version']} applied successfully"
                        )
                    except Exception as e:
                        conn.rollback()
                        logger.error(f"Migration v{migration['version']} failed: {e}")
                        raise DatabaseError(f"Migration failed: {e}") from e

    def execute(self, sql: str, params: Tuple = ()) -> int:
        try:
            with self._get_connection() as conn:
                cursor = conn.execute(sql, params)
                conn.commit()
                return cursor.lastrowid
        except sqlite3.IntegrityError as e:
            logger.error(f"DB constraint violation: {e}")
            raise DatabaseError(f"Data constraint error: {e}") from e
        except sqlite3.Error as e:
            logger.error(f"DB error: {e}")
            raise DatabaseError(f"Database error: {e}") from e

    def query(self, sql: str, params: Tuple = ()) -> List[Dict[str, Any]]:
        try:
            with self._get_connection() as conn:
                cursor = conn.execute(sql, params)
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
        except sqlite3.Error as e:
            logger.error(f"DB query error: {e}")
            raise DatabaseError(f"Database query error: {e}") from e

    def query_one(self, sql: str, params: Tuple = ()) -> Optional[Dict[str, Any]]:
        results = self.query(sql, params)
        return results[0] if results else None

    def execute_script(self, sql_script: str) -> None:
        with self._get_connection() as conn:
            conn.executescript(sql_script)
            conn.commit()


def get_db() -> Database:
    return Database()
