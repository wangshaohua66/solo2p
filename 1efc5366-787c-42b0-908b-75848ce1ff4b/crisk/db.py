import sqlite3
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any, Iterator
from contextlib import contextmanager
from datetime import datetime

import pandas as pd

from .config import DEFAULT_DB_PATH
from .logger import setup_logger, print_info, print_success

logger = setup_logger("crisk.db")


SCHEMA_VERSION = 1


CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS declarations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    declaration_no TEXT UNIQUE NOT NULL,
    product_name TEXT NOT NULL,
    hs_code TEXT NOT NULL,
    hs_prefix6 TEXT GENERATED ALWAYS AS (SUBSTRING(hs_code, 1, 6)) STORED,
    declared_value REAL NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL GENERATED ALWAYS AS (declared_value / MAX(quantity, 0.0001)) STORED,
    origin_country TEXT NOT NULL,
    destination_country TEXT NOT NULL,
    company TEXT NOT NULL,
    transport_mode TEXT NOT NULL,
    declare_date DATE NOT NULL,
    consignee TEXT NOT NULL,
    trade_route TEXT GENERATED ALWAYS AS (origin_country || '->' || destination_country || '::' || transport_mode) STORED,
    source_file TEXT,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS risk_controls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    control_no TEXT UNIQUE NOT NULL,
    hs_code TEXT,
    company TEXT,
    origin_country TEXT,
    risk_level TEXT,
    control_type TEXT,
    effective_date DATE,
    expiry_date DATE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_no TEXT UNIQUE NOT NULL,
    declaration_no TEXT,
    inspection_date DATE,
    inspection_result TEXT,
    findings TEXT,
    hs_code TEXT,
    company TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_no TEXT UNIQUE NOT NULL,
    case_date DATE,
    case_type TEXT,
    hs_code TEXT,
    company TEXT,
    origin_country TEXT,
    consignee TEXT,
    involved_value REAL,
    case_summary TEXT,
    verdict TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clue_no TEXT UNIQUE NOT NULL,
    detection_type TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    declaration_no TEXT,
    hs_code TEXT,
    company TEXT,
    consignee TEXT,
    detection_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    analysis_details TEXT,
    deviation_percent REAL,
    industry_avg_price REAL,
    declared_price REAL,
    shipment_count INTEGER,
    total_value REAL,
    window_start DATE,
    window_end DATE,
    expected_keywords TEXT,
    actual_description TEXT,
    route TEXT,
    historical_routes TEXT,
    matched_cases TEXT,
    similarity_score REAL,
    status TEXT DEFAULT 'new',
    notes TEXT,
    FOREIGN KEY (declaration_no) REFERENCES declarations (declaration_no)
);

CREATE TABLE IF NOT EXISTS case_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clue_no TEXT NOT NULL,
    case_no TEXT NOT NULL,
    similarity_score REAL NOT NULL,
    match_dimensions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clue_no) REFERENCES clues (clue_no),
    FOREIGN KEY (case_no) REFERENCES cases (case_no),
    UNIQUE (clue_no, case_no)
);

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


CREATE_INDEXES_SQL = [
    "CREATE INDEX IF NOT EXISTS idx_declarations_hs_prefix6 ON declarations (hs_prefix6);",
    "CREATE INDEX IF NOT EXISTS idx_declarations_declare_date ON declarations (declare_date);",
    "CREATE INDEX IF NOT EXISTS idx_declarations_company ON declarations (company);",
    "CREATE INDEX IF NOT EXISTS idx_declarations_consignee ON declarations (consignee);",
    "CREATE INDEX IF NOT EXISTS idx_declarations_route ON declarations (trade_route);",
    "CREATE INDEX IF NOT EXISTS idx_declarations_unit_price ON declarations (unit_price);",
    "CREATE INDEX IF NOT EXISTS idx_declarations_composite ON declarations (hs_prefix6, declare_date, unit_price);",
    "CREATE INDEX IF NOT EXISTS idx_declarations_consignee_hs ON declarations (consignee, hs_prefix6, declare_date);",
    "CREATE INDEX IF NOT EXISTS idx_clues_detection_type ON clues (detection_type);",
    "CREATE INDEX IF NOT EXISTS idx_clues_risk_level ON clues (risk_level);",
    "CREATE INDEX IF NOT EXISTS idx_clues_detection_date ON clues (detection_date);",
    "CREATE INDEX IF NOT EXISTS idx_cases_hs ON cases (hs_code);",
    "CREATE INDEX IF NOT EXISTS idx_cases_company ON cases (company);",
    "CREATE INDEX IF NOT EXISTS idx_cases_origin ON cases (origin_country);",
    "CREATE INDEX IF NOT EXISTS idx_case_matches_clue ON case_matches (clue_no);",
    "CREATE INDEX IF NOT EXISTS idx_case_matches_score ON case_matches (similarity_score DESC);",
]


class Database:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or DEFAULT_DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn: Optional[sqlite3.Connection] = None
        self._initialize()

    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(self.db_path, timeout=30)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA cache_size = -100000;")
        conn.execute("PRAGMA temp_store = MEMORY;")
        conn.execute("PRAGMA mmap_size = 2147483648;")
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def _initialize(self) -> None:
        logger.info(f"初始化数据库: {self.db_path}")
        with self.get_connection() as conn:
            conn.executescript(CREATE_TABLES_SQL)
            for idx_sql in CREATE_INDEXES_SQL:
                conn.execute(idx_sql)
            self._check_schema_version(conn)
        logger.info("数据库初始化完成")

    def _check_schema_version(self, conn: sqlite3.Connection) -> None:
        cur = conn.execute("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1")
        row = cur.fetchone()
        if row is None:
            conn.execute("INSERT INTO schema_version (version) VALUES (?)", (SCHEMA_VERSION,))
            logger.info(f"数据库模式版本已设置为 v{SCHEMA_VERSION}")
        elif row["version"] < SCHEMA_VERSION:
            self._migrate(conn, row["version"])

    def _migrate(self, conn: sqlite3.Connection, current_version: int) -> None:
        logger.info(f"执行数据库迁移: v{current_version} -> v{SCHEMA_VERSION}")
        conn.execute("INSERT INTO schema_version (version) VALUES (?)", (SCHEMA_VERSION,))

    def insert_declarations(self, df: pd.DataFrame) -> Tuple[int, int]:
        if df.empty:
            return 0, 0

        total = len(df)
        duplicates = 0

        columns = [
            "declaration_no", "product_name", "hs_code", "declared_value",
            "quantity", "origin_country", "destination_country", "company",
            "transport_mode", "declare_date", "consignee", "source_file"
        ]

        insert_sql = f"""
        INSERT OR IGNORE INTO declarations 
        ({', '.join(columns)})
        VALUES ({', '.join(['?'] * len(columns))})
        """

        with self.get_connection() as conn:
            cur = conn.cursor()
            data = [
                tuple(row[c] for c in columns)
                for _, row in df.iterrows()
            ]
            cur.executemany(insert_sql, data)
            inserted = cur.rowcount
            duplicates = total - inserted

        return inserted, duplicates

    def insert_risk_controls(self, df: pd.DataFrame) -> int:
        if df.empty:
            return 0
        columns = ["control_no", "hs_code", "company", "origin_country", "risk_level", "control_type", "effective_date", "expiry_date", "description"]
        insert_sql = f"INSERT OR IGNORE INTO risk_controls ({', '.join(columns)}) VALUES ({', '.join(['?'] * len(columns))})"
        with self.get_connection() as conn:
            data = [tuple(row[c] for c in columns) for _, row in df.iterrows()]
            cur = conn.execute(insert_sql, data) if len(data) == 1 else conn.executemany(insert_sql, data)
            return cur.rowcount

    def insert_inspections(self, df: pd.DataFrame) -> int:
        if df.empty:
            return 0
        columns = ["inspection_no", "declaration_no", "inspection_date", "inspection_result", "findings", "hs_code", "company"]
        insert_sql = f"INSERT OR IGNORE INTO inspections ({', '.join(columns)}) VALUES ({', '.join(['?'] * len(columns))})"
        with self.get_connection() as conn:
            data = [tuple(row[c] for c in columns) for _, row in df.iterrows()]
            cur = conn.executemany(insert_sql, data)
            return cur.rowcount

    def insert_cases(self, df: pd.DataFrame) -> int:
        if df.empty:
            return 0
        columns = ["case_no", "case_date", "case_type", "hs_code", "company", "origin_country", "consignee", "involved_value", "case_summary", "verdict"]
        insert_sql = f"INSERT OR IGNORE INTO cases ({', '.join(columns)}) VALUES ({', '.join(['?'] * len(columns))})"
        with self.get_connection() as conn:
            data = [tuple(row[c] for c in columns) for _, row in df.iterrows()]
            cur = conn.executemany(insert_sql, data)
            return cur.rowcount

    def insert_clue(self, clue_data: Dict[str, Any]) -> str:
        clue_no = f"CLUE{datetime.now().strftime('%Y%m%d%H%M%S')}{abs(hash(str(clue_data))) % 10000:04d}"
        clue_data["clue_no"] = clue_no

        columns = list(clue_data.keys())
        placeholders = ", ".join(["?"] * len(columns))
        insert_sql = f"INSERT INTO clues ({', '.join(columns)}) VALUES ({placeholders})"

        with self.get_connection() as conn:
            conn.execute(insert_sql, tuple(clue_data.values()))
        return clue_no

    def insert_clue_batch(self, clues: List[Dict[str, Any]]) -> List[str]:
        if not clues:
            return []

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        clue_nos = []
        for idx, clue in enumerate(clues):
            clue_no = f"CLUE{timestamp}{idx:06d}"
            clue["clue_no"] = clue_no
            clue_nos.append(clue_no)

        all_columns = set()
        for clue in clues:
            all_columns.update(clue.keys())
        columns = sorted(all_columns)

        placeholders = ", ".join(["?"] * len(columns))
        insert_sql = f"INSERT INTO clues ({', '.join(columns)}) VALUES ({placeholders})"

        with self.get_connection() as conn:
            data = [tuple(clue.get(c, None) for c in columns) for clue in clues]
            conn.executemany(insert_sql, data)
        return clue_nos

    def get_declarations_by_date_range(self, start_date: str, end_date: str) -> pd.DataFrame:
        with self.get_connection() as conn:
            query = """
            SELECT * FROM declarations
            WHERE declare_date BETWEEN ? AND ?
            ORDER BY declare_date
            """
            return pd.read_sql_query(query, conn, params=(start_date, end_date))

    def get_declarations_paginated(self, start_date: Optional[str] = None,
                                   end_date: Optional[str] = None,
                                   chunk_size: int = 10000) -> Iterator[pd.DataFrame]:
        offset = 0
        while True:
            with self.get_connection() as conn:
                query = "SELECT * FROM declarations WHERE 1=1"
                params = []
                if start_date and end_date:
                    query += " AND declare_date BETWEEN ? AND ?"
                    params.extend([start_date, end_date])
                query += " ORDER BY declare_date LIMIT ? OFFSET ?"
                params.extend([chunk_size, offset])

                chunk = pd.read_sql_query(query, conn, params=params)

            if chunk.empty:
                break

            yield chunk
            offset += chunk_size

            if len(chunk) < chunk_size:
                break

    def get_declarations_by_hs_prefix_paginated(self, hs_prefix: str,
                                                start_date: Optional[str] = None,
                                                end_date: Optional[str] = None,
                                                chunk_size: int = 10000) -> Iterator[pd.DataFrame]:
        offset = 0
        while True:
            with self.get_connection() as conn:
                query = "SELECT * FROM declarations WHERE hs_prefix6 = ?"
                params = [hs_prefix]
                if start_date and end_date:
                    query += " AND declare_date BETWEEN ? AND ?"
                    params.extend([start_date, end_date])
                query += " ORDER BY declare_date LIMIT ? OFFSET ?"
                params.extend([chunk_size, offset])

                chunk = pd.read_sql_query(query, conn, params=params)

            if chunk.empty:
                break

            yield chunk
            offset += chunk_size

            if len(chunk) < chunk_size:
                break

    def get_declarations_by_hs_prefix(self, hs_prefix: str, start_date: Optional[str] = None,
                                      end_date: Optional[str] = None) -> pd.DataFrame:
        with self.get_connection() as conn:
            query = "SELECT * FROM declarations WHERE hs_prefix6 = ?"
            params = [hs_prefix]
            if start_date and end_date:
                query += " AND declare_date BETWEEN ? AND ?"
                params.extend([start_date, end_date])
            query += " ORDER BY declare_date"
            return pd.read_sql_query(query, conn, params=params)

    def get_all_hs_prefixes(self) -> List[str]:
        with self.get_connection() as conn:
            cur = conn.execute("SELECT DISTINCT hs_prefix6 FROM declarations ORDER BY hs_prefix6")
            return [row["hs_prefix6"] for row in cur.fetchall()]

    def get_company_routes(self, company: str) -> List[str]:
        with self.get_connection() as conn:
            cur = conn.execute(
                "SELECT DISTINCT trade_route FROM declarations WHERE company = ? ORDER BY trade_route",
                (company,)
            )
            return [row["trade_route"] for row in cur.fetchall()]

    def get_all_companies(self) -> List[str]:
        with self.get_connection() as conn:
            cur = conn.execute("SELECT DISTINCT company FROM declarations ORDER BY company")
            return [row["company"] for row in cur.fetchall()]

    def get_clues(self, detection_type: Optional[str] = None,
                  risk_level: Optional[str] = None,
                  start_date: Optional[str] = None,
                  end_date: Optional[str] = None,
                  limit: int = 1000) -> pd.DataFrame:
        with self.get_connection() as conn:
            query = "SELECT * FROM clues WHERE 1=1"
            params = []
            if detection_type:
                query += " AND detection_type = ?"
                params.append(detection_type)
            if risk_level:
                query += " AND risk_level = ?"
                params.append(risk_level)
            if start_date and end_date:
                query += " AND DATE(detection_date) BETWEEN ? AND ?"
                params.extend([start_date, end_date])
            query += " ORDER BY detection_date DESC LIMIT ?"
            params.append(limit)
            return pd.read_sql_query(query, conn, params=params)

    def get_all_cases(self) -> pd.DataFrame:
        with self.get_connection() as conn:
            return pd.read_sql_query("SELECT * FROM cases ORDER BY case_date DESC", conn)

    def get_declaration_count(self) -> int:
        with self.get_connection() as conn:
            cur = conn.execute("SELECT COUNT(*) as cnt FROM declarations")
            return cur.fetchone()["cnt"]

    def get_clue_count(self) -> int:
        with self.get_connection() as conn:
            cur = conn.execute("SELECT COUNT(*) as cnt FROM clues")
            return cur.fetchone()["cnt"]

    def vacuum(self) -> None:
        with self.get_connection() as conn:
            conn.execute("VACUUM")
            logger.info("数据库压缩完成")

    def get_stats(self) -> Dict[str, Any]:
        with self.get_connection() as conn:
            stats = {}
            for table in ["declarations", "risk_controls", "inspections", "cases", "clues"]:
                cur = conn.execute(f"SELECT COUNT(*) as cnt FROM {table}")
                stats[table] = cur.fetchone()["cnt"]

            cur = conn.execute("SELECT MIN(declare_date) as min_date, MAX(declare_date) as max_date FROM declarations")
            row = cur.fetchone()
            stats["date_range"] = (row["min_date"], row["max_date"]) if row["min_date"] else None

            return stats

    def insert_case_match(self, clue_no: str, case_no: str, score: float, dimensions: str) -> None:
        with self.get_connection() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO case_matches (clue_no, case_no, similarity_score, match_dimensions) VALUES (?, ?, ?, ?)",
                (clue_no, case_no, score, dimensions)
            )

    def get_case_matches_for_clue(self, clue_no: str) -> pd.DataFrame:
        with self.get_connection() as conn:
            return pd.read_sql_query(
                """
                SELECT cm.*, c.case_type, c.case_date, c.case_summary
                FROM case_matches cm
                JOIN cases c ON cm.case_no = c.case_no
                WHERE cm.clue_no = ?
                ORDER BY cm.similarity_score DESC
                """,
                conn,
                params=(clue_no,)
            )


def get_db(db_path: Optional[Path] = None) -> Database:
    return Database(db_path)
