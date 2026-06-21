import sqlite3
import json
import time
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from config import DB_PATH
from logger import logger


class DatabaseManager:
    _instance: Optional["DatabaseManager"] = None

    def __new__(cls, db_path: Path = DB_PATH) -> "DatabaseManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init(db_path)
        return cls._instance

    def _init(self, db_path: Path) -> None:
        self.db_path = db_path
        self._ensure_db()
        self._create_indexes()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"数据库操作失败: {e}", exception=e)
            raise
        finally:
            conn.close()

    def _ensure_db(self) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS review_projects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_name TEXT NOT NULL,
                    drug_type TEXT NOT NULL,
                    applicant TEXT,
                    folder_path TEXT NOT NULL,
                    priority TEXT DEFAULT 'NORMAL',
                    status TEXT DEFAULT 'PENDING',
                    total_files INTEGER DEFAULT 0,
                    total_size_mb REAL DEFAULT 0,
                    started_at TEXT,
                    completed_at TEXT,
                    progress REAL DEFAULT 0,
                    checkpoint_data TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS review_issues (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    module TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    issue_type TEXT NOT NULL,
                    file_path TEXT,
                    description TEXT NOT NULL,
                    suggestion TEXT,
                    is_common INTEGER DEFAULT 0,
                    matched_issue_id INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES review_projects(id)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS common_issue_library (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    issue_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    description_pattern TEXT NOT NULL,
                    category TEXT,
                    occurrence_count INTEGER DEFAULT 1,
                    first_seen TEXT DEFAULT CURRENT_TIMESTAMP,
                    last_seen TEXT DEFAULT CURRENT_TIMESTAMP,
                    typical_suggestion TEXT
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ctd_specs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    drug_type TEXT NOT NULL,
                    module_name TEXT NOT NULL,
                    submodule_code TEXT,
                    required INTEGER DEFAULT 0,
                    naming_rule TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS review_progress (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    module_key TEXT NOT NULL,
                    status TEXT DEFAULT 'PENDING',
                    issues_count INTEGER DEFAULT 0,
                    started_at TEXT,
                    completed_at TEXT,
                    duration_seconds REAL DEFAULT 0,
                    FOREIGN KEY (project_id) REFERENCES review_projects(id)
                )
            """)

    def _create_indexes(self) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            indexes = [
                ("idx_projects_status", "review_projects(status)"),
                ("idx_projects_priority", "review_projects(priority)"),
                ("idx_issues_project", "review_issues(project_id)"),
                ("idx_issues_severity", "review_issues(severity)"),
                ("idx_issues_type", "review_issues(issue_type)"),
                ("idx_common_issue_type", "common_issue_library(issue_type)"),
                ("idx_progress_project", "review_progress(project_id)"),
            ]
            for idx_name, idx_cols in indexes:
                cursor.execute(
                    f"CREATE INDEX IF NOT EXISTS {idx_name} ON {idx_cols}"
                )

    def create_project(
        self,
        project_name: str,
        drug_type: str,
        folder_path: str,
        applicant: str = "",
        priority: str = "NORMAL",
        total_files: int = 0,
        total_size_mb: float = 0,
    ) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO review_projects
                   (project_name, drug_type, applicant, folder_path, priority,
                    total_files, total_size_mb, started_at, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RUNNING')""",
                (
                    project_name, drug_type, applicant, folder_path, priority,
                    total_files, total_size_mb, datetime.now().isoformat(),
                ),
            )
            return cursor.lastrowid

    def update_project(self, project_id: int, **kwargs) -> None:
        kwargs["updated_at"] = datetime.now().isoformat()
        fields = ", ".join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values()) + [project_id]
        with self._get_connection() as conn:
            conn.execute(f"UPDATE review_projects SET {fields} WHERE id = ?", values)

    def complete_project(self, project_id: int) -> None:
        with self._get_connection() as conn:
            conn.execute(
                """UPDATE review_projects
                   SET status = 'COMPLETED', completed_at = ?, progress = 100,
                       updated_at = ?
                   WHERE id = ?""",
                (datetime.now().isoformat(), datetime.now().isoformat(), project_id),
            )

    def get_project(self, project_id: int) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM review_projects WHERE id = ?", (project_id,)
            ).fetchone()
            return dict(row) if row else None

    def list_projects(self, status: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        query = "SELECT * FROM review_projects"
        params: List[Any] = []
        if status:
            query += " WHERE status = ?"
            params.append(status)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        with self._get_connection() as conn:
            rows = conn.execute(query, params).fetchall()
            return [dict(r) for r in rows]

    def save_checkpoint(self, project_id: int, checkpoint_data: Dict[str, Any]) -> None:
        with self._get_connection() as conn:
            conn.execute(
                "UPDATE review_projects SET checkpoint_data = ?, updated_at = ? WHERE id = ?",
                (json.dumps(checkpoint_data, ensure_ascii=False), datetime.now().isoformat(), project_id),
            )

    def load_checkpoint(self, project_id: int) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT checkpoint_data FROM review_projects WHERE id = ?", (project_id,)
            ).fetchone()
            if row and row["checkpoint_data"]:
                return json.loads(row["checkpoint_data"])
            return None

    def insert_issues(self, project_id: int, issues: List[Dict[str, Any]]) -> List[int]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            ids = []
            for issue in issues:
                cursor.execute(
                    """INSERT INTO review_issues
                       (project_id, module, severity, issue_type, file_path,
                        description, suggestion, is_common, matched_issue_id)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        project_id,
                        issue.get("module", ""),
                        issue.get("severity", "DEFECT"),
                        issue.get("issue_type", ""),
                        issue.get("file_path", ""),
                        issue.get("description", ""),
                        issue.get("suggestion", ""),
                        1 if issue.get("is_common") else 0,
                        issue.get("matched_issue_id"),
                    ),
                )
                ids.append(cursor.lastrowid)
            return ids

    def get_project_issues(
        self, project_id: int, severity: Optional[str] = None,
        issue_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        query = "SELECT * FROM review_issues WHERE project_id = ?"
        params: List[Any] = [project_id]
        if severity:
            query += " AND severity = ?"
            params.append(severity)
        if issue_type:
            query += " AND issue_type = ?"
            params.append(issue_type)
        query += " ORDER BY severity, created_at"
        with self._get_connection() as conn:
            rows = conn.execute(query, params).fetchall()
            return [dict(r) for r in rows]

    def find_matching_common_issue(
        self, issue_type: str, description: str
    ) -> Optional[Dict[str, Any]]:
        start = time.time()
        with self._get_connection() as conn:
            row = conn.execute(
                """SELECT * FROM common_issue_library
                   WHERE issue_type = ? ORDER BY occurrence_count DESC LIMIT 1""",
                (issue_type,),
            ).fetchone()
            elapsed = (time.time() - start) * 1000
            if elapsed > 50:
                logger.warning(f"历史问题库查询耗时: {elapsed:.0f}ms")
            return dict(row) if row else None

    def update_common_issue(self, issue_type: str, severity: str, description: str,
                            suggestion: str = "") -> None:
        with self._get_connection() as conn:
            existing = conn.execute(
                "SELECT id, occurrence_count FROM common_issue_library WHERE issue_type = ?",
                (issue_type,),
            ).fetchone()
            if existing:
                conn.execute(
                    """UPDATE common_issue_library
                       SET occurrence_count = occurrence_count + 1,
                           last_seen = ?, severity = ?, typical_suggestion = ?
                       WHERE id = ?""",
                    (datetime.now().isoformat(), severity, suggestion, existing["id"]),
                )
            else:
                conn.execute(
                    """INSERT INTO common_issue_library
                       (issue_type, severity, description_pattern, typical_suggestion)
                       VALUES (?, ?, ?, ?)""",
                    (issue_type, severity, description[:500], suggestion),
                )

    def get_common_issue_stats(self, limit: int = 20) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            rows = conn.execute(
                """SELECT issue_type, severity, occurrence_count, typical_suggestion
                   FROM common_issue_library
                   ORDER BY occurrence_count DESC LIMIT ?""",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    def update_module_progress(
        self, project_id: int, module_key: str, status: str,
        issues_count: int = 0, duration_seconds: float = 0,
    ) -> None:
        with self._get_connection() as conn:
            existing = conn.execute(
                "SELECT id FROM review_progress WHERE project_id = ? AND module_key = ?",
                (project_id, module_key),
            ).fetchone()
            now = datetime.now().isoformat()
            if existing:
                updates = {"status": status, "issues_count": issues_count}
                if status == "RUNNING":
                    updates["started_at"] = now
                elif status in ("PASS", "WARNING", "ERROR"):
                    updates["completed_at"] = now
                    updates["duration_seconds"] = duration_seconds
                fields = ", ".join(f"{k} = ?" for k in updates.keys())
                conn.execute(
                    f"UPDATE review_progress SET {fields} WHERE id = ?",
                    list(updates.values()) + [existing["id"]],
                )
            else:
                conn.execute(
                    """INSERT INTO review_progress
                       (project_id, module_key, status, issues_count, started_at)
                       VALUES (?, ?, ?, ?, ?)""",
                    (project_id, module_key, status, issues_count, now),
                )

    def get_module_progress(self, project_id: int) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM review_progress WHERE project_id = ? ORDER BY id",
                (project_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    def backup_database(self, backup_path: Optional[Path] = None) -> Path:
        if backup_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = self.db_path.parent / f"backup_{timestamp}.db"
        source = sqlite3.connect(str(self.db_path))
        target = sqlite3.connect(str(backup_path))
        source.backup(target)
        source.close()
        target.close()
        logger.info(f"数据库已备份至: {backup_path}")
        return backup_path

    def export_project_data(self, project_id: int, export_path: Path) -> None:
        project = self.get_project(project_id)
        issues = self.get_project_issues(project_id)
        progress = self.get_module_progress(project_id)
        export_data = {
            "project": project,
            "issues": issues,
            "progress": progress,
            "exported_at": datetime.now().isoformat(),
        }
        export_path.write_text(json.dumps(export_data, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info(f"项目数据已导出至: {export_path}")
