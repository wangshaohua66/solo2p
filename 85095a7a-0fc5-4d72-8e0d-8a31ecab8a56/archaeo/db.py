import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Type, TypeVar

from .config import get_db_path
from .logger import get_logger
from .models import (
    Artifact,
    ArtifactPhoto,
    Assignment,
    BudgetItem,
    Equipment,
    Person,
    Project,
    ProjectPhase,
    ProjectStatus,
    Sample,
    SampleStatus,
    SampleType,
    Stratum,
    SyncConflict,
    SyncRecord,
    Trench,
)

logger = get_logger(__name__)

T = TypeVar("T")

SCHEMA_VERSION = 1


class Database:
    _instance: Optional["Database"] = None
    _lock = threading.Lock()

    def __new__(cls) -> "Database":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized = True
        self.db_path = get_db_path()
        self._local = threading.local()
        self._migrate()

    @contextmanager
    def get_connection(self) -> Iterator[sqlite3.Connection]:
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA foreign_keys=ON")
            self._local.conn = conn
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    def _migrate(self) -> None:
        with self.get_connection() as conn:
            conn.executescript(_SCHEMA_SQL)
            self._ensure_schema_version(conn)

    def _ensure_schema_version(self, conn: sqlite3.Connection) -> None:
        cursor = conn.execute("PRAGMA user_version")
        version = cursor.fetchone()[0]
        if version < SCHEMA_VERSION:
            conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
            logger.info(f"数据库 schema 升级到版本 {SCHEMA_VERSION}")

    def close(self) -> None:
        conn = getattr(self._local, "conn", None)
        if conn:
            conn.close()
            self._local.conn = None


_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    site_name TEXT NOT NULL,
    site_code TEXT NOT NULL,
    phase TEXT NOT NULL DEFAULT 'prospecting',
    status TEXT NOT NULL DEFAULT 'not_started',
    leader TEXT DEFAULT '',
    start_date TEXT,
    end_date TEXT,
    area REAL DEFAULT 0,
    budget REAL DEFAULT 0,
    description TEXT DEFAULT '',
    phase_checklist TEXT DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trenches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    grid_row INTEGER DEFAULT 0,
    grid_col INTEGER DEFAULT 0,
    x_coordinate REAL DEFAULT 0,
    y_coordinate REAL DEFAULT 0,
    length REAL DEFAULT 0,
    width REAL DEFAULT 0,
    depth REAL DEFAULT 0,
    status TEXT DEFAULT 'not_started',
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trenches_project_id ON trenches(project_id);

CREATE TABLE IF NOT EXISTS strata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trench_id INTEGER NOT NULL,
    layer_number TEXT NOT NULL,
    depth_top REAL DEFAULT 0,
    depth_bottom REAL DEFAULT 0,
    soil_color TEXT DEFAULT '',
    soil_texture TEXT DEFAULT '',
    inclusions TEXT DEFAULT '',
    description TEXT DEFAULT '',
    parent_id INTEGER,
    order_index INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trench_id) REFERENCES trenches(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES strata(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_strata_trench_id ON strata(trench_id);

CREATE TABLE IF NOT EXISTS artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    code TEXT NOT NULL UNIQUE,
    category TEXT DEFAULT 'other',
    trench_id INTEGER,
    stratum_id INTEGER,
    layer TEXT DEFAULT '',
    name TEXT DEFAULT '',
    description TEXT DEFAULT '',
    quantity INTEGER DEFAULT 1,
    photo_count INTEGER DEFAULT 0,
    storage_location TEXT DEFAULT '',
    discovered_by TEXT DEFAULT '',
    discovery_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (trench_id) REFERENCES trenches(id) ON DELETE SET NULL,
    FOREIGN KEY (stratum_id) REFERENCES strata(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_artifacts_project_id ON artifacts(project_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_code ON artifacts(code);

CREATE TABLE IF NOT EXISTS artifact_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artifact_id INTEGER,
    file_path TEXT DEFAULT '',
    file_name TEXT DEFAULT '',
    thumbnail_path TEXT DEFAULT '',
    photo_time TEXT,
    gps_latitude REAL,
    gps_longitude REAL,
    is_matched INTEGER DEFAULT 0,
    needs_review INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_photos_artifact_id ON artifact_photos(artifact_id);

CREATE TABLE IF NOT EXISTS samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    code TEXT NOT NULL UNIQUE,
    sample_type TEXT DEFAULT 'other',
    trench_id INTEGER,
    stratum_id INTEGER,
    description TEXT DEFAULT '',
    collected_by TEXT DEFAULT '',
    collection_date TEXT,
    sent_date TEXT,
    lab_name TEXT DEFAULT '',
    expected_days INTEGER DEFAULT 30,
    status TEXT DEFAULT 'collected',
    result TEXT DEFAULT '',
    result_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (trench_id) REFERENCES trenches(id) ON DELETE SET NULL,
    FOREIGN KEY (stratum_id) REFERENCES strata(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_samples_project_id ON samples(project_id);
CREATE INDEX IF NOT EXISTS idx_samples_status ON samples(status);

CREATE TABLE IF NOT EXISTS persons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'worker',
    skills TEXT DEFAULT '[]',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    status TEXT DEFAULT 'available',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    category TEXT DEFAULT '',
    status TEXT DEFAULT 'available',
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    person_id INTEGER,
    equipment_id INTEGER,
    assignment_type TEXT DEFAULT 'person',
    start_date TEXT,
    end_date TEXT,
    role TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE SET NULL,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_assignments_project_id ON assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_assignments_person_id ON assignments(person_id);

CREATE TABLE IF NOT EXISTS budget_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    budgeted REAL DEFAULT 0,
    actual REAL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_budget_project_id ON budget_items(project_id);

CREATE TABLE IF NOT EXISTS sync_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_batch TEXT DEFAULT '',
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    operation TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    synced INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_records_batch ON sync_records(sync_batch);
CREATE INDEX IF NOT EXISTS idx_sync_records_synced ON sync_records(synced);

CREATE TABLE IF NOT EXISTS sync_conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_batch TEXT DEFAULT '',
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    local_data TEXT DEFAULT '{}',
    remote_data TEXT DEFAULT '{}',
    resolved INTEGER DEFAULT 0,
    resolution TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending',
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    last_record_id INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_batches_batch ON sync_batches(batch_id);
"""


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {key: row[key] for key in row.keys()}


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).date()
    except (ValueError, TypeError):
        return None


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def _date_to_str(value: Optional[date]) -> Optional[str]:
    if value is None:
        return None
    return value.isoformat()


def _datetime_to_str(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.isoformat()


def _json_loads(value: Optional[str]) -> Any:
    if not value:
        return None
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return None


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def get_db() -> Database:
    return Database()


def create_project(project: Project) -> Project:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO projects 
            (name, code, site_name, site_code, phase, status, leader, 
             start_date, end_date, area, budget, description, phase_checklist)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project.name,
                project.code,
                project.site_name,
                project.site_code,
                project.phase.value,
                project.status.value,
                project.leader,
                _date_to_str(project.start_date),
                _date_to_str(project.end_date),
                project.area,
                project.budget,
                project.description,
                _json_dumps(project.phase_checklist),
            ),
        )
        project.id = cursor.lastrowid
        _record_sync("projects", cursor.lastrowid, "insert", project.model_dump())
    return get_project(cursor.lastrowid)


def get_project(project_id: int) -> Optional[Project]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_project(row)


def get_project_by_code(code: str) -> Optional[Project]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("SELECT * FROM projects WHERE code = ?", (code,))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_project(row)


def list_projects(status: Optional[ProjectStatus] = None, phase: Optional[ProjectPhase] = None,
                  limit: int = 100, offset: int = 0) -> List[Project]:
    db = get_db()
    query = "SELECT * FROM projects WHERE 1=1"
    params: List[Any] = []
    if status:
        query += " AND status = ?"
        params.append(status.value)
    if phase:
        query += " AND phase = ?"
        params.append(phase.value)
    query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with db.get_connection() as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [_row_to_project(row) for row in rows]


def update_project(project: Project) -> Project:
    db = get_db()
    with db.get_connection() as conn:
        conn.execute(
            """
            UPDATE projects SET 
                name = ?, code = ?, site_name = ?, site_code = ?, 
                phase = ?, status = ?, leader = ?, start_date = ?, 
                end_date = ?, area = ?, budget = ?, description = ?, 
                phase_checklist = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                project.name,
                project.code,
                project.site_name,
                project.site_code,
                project.phase.value,
                project.status.value,
                project.leader,
                _date_to_str(project.start_date),
                _date_to_str(project.end_date),
                project.area,
                project.budget,
                project.description,
                _json_dumps(project.phase_checklist),
                project.id,
            ),
        )
        _record_sync("projects", project.id, "update", project.model_dump())
    return get_project(project.id)


def delete_project(project_id: int) -> bool:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        if cursor.rowcount > 0:
            _record_sync("projects", project_id, "delete", {"id": project_id})
            return True
        return False


def advance_project_phase(project_id: int) -> Project:
    project = get_project(project_id)
    if not project:
        raise ValueError(f"项目 {project_id} 不存在")

    phases = list(ProjectPhase)
    current_idx = phases.index(project.phase)
    if current_idx >= len(phases) - 1:
        raise ValueError("项目已经在最后阶段")

    if not project.can_advance_phase():
        raise ValueError("当前阶段校验清单未完成，无法推进")

    next_phase = phases[current_idx + 1]
    project.phase = next_phase
    return update_project(project)


def _row_to_project(row: sqlite3.Row) -> Project:
    data = _row_to_dict(row)
    data["phase"] = ProjectPhase(data.get("phase", "prospecting"))
    data["status"] = ProjectStatus(data.get("status", "not_started"))
    data["start_date"] = _parse_date(data.get("start_date"))
    data["end_date"] = _parse_date(data.get("end_date"))
    data["created_at"] = _parse_datetime(data.get("created_at"))
    data["updated_at"] = _parse_datetime(data.get("updated_at"))
    data["phase_checklist"] = _json_loads(data.get("phase_checklist")) or {}
    return Project(**data)


def create_trench(trench: Trench) -> Trench:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO trenches 
            (project_id, code, grid_row, grid_col, x_coordinate, y_coordinate,
             length, width, depth, status, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                trench.project_id,
                trench.code,
                trench.grid_row,
                trench.grid_col,
                trench.x_coordinate,
                trench.y_coordinate,
                trench.length,
                trench.width,
                trench.depth,
                trench.status,
                trench.description,
            ),
        )
        trench.id = cursor.lastrowid
        _record_sync("trenches", cursor.lastrowid, "insert", trench.model_dump())
    return get_trench(cursor.lastrowid)


def get_trench(trench_id: int) -> Optional[Trench]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("SELECT * FROM trenches WHERE id = ?", (trench_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_trench(row)


def list_trenches(project_id: Optional[int] = None, limit: int = 100, offset: int = 0) -> List[Trench]:
    db = get_db()
    query = "SELECT * FROM trenches WHERE 1=1"
    params: List[Any] = []
    if project_id:
        query += " AND project_id = ?"
        params.append(project_id)
    query += " ORDER BY code LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with db.get_connection() as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [_row_to_trench(row) for row in rows]


def update_trench(trench: Trench) -> Trench:
    db = get_db()
    with db.get_connection() as conn:
        conn.execute(
            """
            UPDATE trenches SET 
                project_id = ?, code = ?, grid_row = ?, grid_col = ?, 
                x_coordinate = ?, y_coordinate = ?, length = ?, width = ?, 
                depth = ?, status = ?, description = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                trench.project_id,
                trench.code,
                trench.grid_row,
                trench.grid_col,
                trench.x_coordinate,
                trench.y_coordinate,
                trench.length,
                trench.width,
                trench.depth,
                trench.status,
                trench.description,
                trench.id,
            ),
        )
        _record_sync("trenches", trench.id, "update", trench.model_dump())
    return get_trench(trench.id)


def delete_trench(trench_id: int) -> bool:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("DELETE FROM trenches WHERE id = ?", (trench_id,))
        if cursor.rowcount > 0:
            _record_sync("trenches", trench_id, "delete", {"id": trench_id})
            return True
        return False


def _row_to_trench(row: sqlite3.Row) -> Trench:
    data = _row_to_dict(row)
    data["created_at"] = _parse_datetime(data.get("created_at"))
    data["updated_at"] = _parse_datetime(data.get("updated_at"))
    return Trench(**data)


def create_stratum(stratum: Stratum) -> Stratum:
    if stratum.parent_id is not None:
        if _has_circular_reference(stratum.trench_id, stratum.parent_id, stratum.id):
            raise ValueError("层位存在循环引用")
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO strata 
            (trench_id, layer_number, depth_top, depth_bottom, soil_color,
             soil_texture, inclusions, description, parent_id, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                stratum.trench_id,
                stratum.layer_number,
                stratum.depth_top,
                stratum.depth_bottom,
                stratum.soil_color,
                stratum.soil_texture,
                stratum.inclusions,
                stratum.description,
                stratum.parent_id,
                stratum.order_index,
            ),
        )
        stratum.id = cursor.lastrowid
        _record_sync("strata", cursor.lastrowid, "insert", stratum.model_dump())
    return get_stratum(cursor.lastrowid)


def get_stratum(stratum_id: int) -> Optional[Stratum]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("SELECT * FROM strata WHERE id = ?", (stratum_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_stratum(row)


def list_strata(trench_id: Optional[int] = None, limit: int = 500, offset: int = 0) -> List[Stratum]:
    db = get_db()
    query = "SELECT * FROM strata WHERE 1=1"
    params: List[Any] = []
    if trench_id:
        query += " AND trench_id = ?"
        params.append(trench_id)
    query += " ORDER BY order_index, depth_top LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with db.get_connection() as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [_row_to_stratum(row) for row in rows]


def update_stratum(stratum: Stratum) -> Stratum:
    if stratum.parent_id is not None:
        if _has_circular_reference(stratum.trench_id, stratum.parent_id, stratum.id):
            raise ValueError("层位存在循环引用")
    db = get_db()
    with db.get_connection() as conn:
        conn.execute(
            """
            UPDATE strata SET 
                trench_id = ?, layer_number = ?, depth_top = ?, depth_bottom = ?,
                soil_color = ?, soil_texture = ?, inclusions = ?, description = ?,
                parent_id = ?, order_index = ?
            WHERE id = ?
            """,
            (
                stratum.trench_id,
                stratum.layer_number,
                stratum.depth_top,
                stratum.depth_bottom,
                stratum.soil_color,
                stratum.soil_texture,
                stratum.inclusions,
                stratum.description,
                stratum.parent_id,
                stratum.order_index,
                stratum.id,
            ),
        )
        _record_sync("strata", stratum.id, "update", stratum.model_dump())
    return get_stratum(stratum.id)


def delete_stratum(stratum_id: int) -> bool:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("DELETE FROM strata WHERE id = ?", (stratum_id,))
        if cursor.rowcount > 0:
            _record_sync("strata", stratum_id, "delete", {"id": stratum_id})
            return True
        return False


def _has_circular_reference(trench_id: int, parent_id: int, current_id: Optional[int]) -> bool:
    db = get_db()
    visited = set()
    check_id = parent_id
    while check_id is not None:
        if check_id == current_id:
            return True
        if check_id in visited:
            return True
        visited.add(check_id)
        with db.get_connection() as conn:
            cursor = conn.execute(
                "SELECT parent_id FROM strata WHERE id = ? AND trench_id = ?",
                (check_id, trench_id),
            )
            row = cursor.fetchone()
            if not row:
                return False
            check_id = row["parent_id"]
    return False


def _row_to_stratum(row: sqlite3.Row) -> Stratum:
    data = _row_to_dict(row)
    data["created_at"] = _parse_datetime(data.get("created_at"))
    return Stratum(**data)


def create_artifact(artifact: Artifact) -> Artifact:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO artifacts 
            (project_id, code, category, trench_id, stratum_id, layer, name,
             description, quantity, photo_count, storage_location, discovered_by,
             discovery_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                artifact.project_id,
                artifact.code,
                artifact.category.value,
                artifact.trench_id,
                artifact.stratum_id,
                artifact.layer,
                artifact.name,
                artifact.description,
                artifact.quantity,
                artifact.photo_count,
                artifact.storage_location,
                artifact.discovered_by,
                _date_to_str(artifact.discovery_date),
            ),
        )
        artifact.id = cursor.lastrowid
        _record_sync("artifacts", cursor.lastrowid, "insert", artifact.model_dump())
    return get_artifact(cursor.lastrowid)


def get_artifact(artifact_id: int) -> Optional[Artifact]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("SELECT * FROM artifacts WHERE id = ?", (artifact_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_artifact(row)


def get_artifact_by_code(code: str) -> Optional[Artifact]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("SELECT * FROM artifacts WHERE code = ?", (code,))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_artifact(row)


def list_artifacts(project_id: Optional[int] = None, trench_id: Optional[int] = None,
                   category: Optional[str] = None, limit: int = 500, offset: int = 0) -> List[Artifact]:
    db = get_db()
    query = "SELECT * FROM artifacts WHERE 1=1"
    params: List[Any] = []
    if project_id:
        query += " AND project_id = ?"
        params.append(project_id)
    if trench_id:
        query += " AND trench_id = ?"
        params.append(trench_id)
    if category:
        query += " AND category = ?"
        params.append(category)
    query += " ORDER BY code LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with db.get_connection() as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [_row_to_artifact(row) for row in rows]


def update_artifact(artifact: Artifact) -> Artifact:
    db = get_db()
    with db.get_connection() as conn:
        conn.execute(
            """
            UPDATE artifacts SET 
                project_id = ?, code = ?, category = ?, trench_id = ?, stratum_id = ?,
                layer = ?, name = ?, description = ?, quantity = ?, photo_count = ?,
                storage_location = ?, discovered_by = ?, discovery_date = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                artifact.project_id,
                artifact.code,
                artifact.category.value,
                artifact.trench_id,
                artifact.stratum_id,
                artifact.layer,
                artifact.name,
                artifact.description,
                artifact.quantity,
                artifact.photo_count,
                artifact.storage_location,
                artifact.discovered_by,
                _date_to_str(artifact.discovery_date),
                artifact.id,
            ),
        )
        _record_sync("artifacts", artifact.id, "update", artifact.model_dump())
    return get_artifact(artifact.id)


def delete_artifact(artifact_id: int) -> bool:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("DELETE FROM artifacts WHERE id = ?", (artifact_id,))
        if cursor.rowcount > 0:
            _record_sync("artifacts", artifact_id, "delete", {"id": artifact_id})
            return True
        return False


def _row_to_artifact(row: sqlite3.Row) -> Artifact:
    from .models import ArtifactCategory
    data = _row_to_dict(row)
    data["category"] = ArtifactCategory(data.get("category", "other"))
    data["discovery_date"] = _parse_date(data.get("discovery_date"))
    data["created_at"] = _parse_datetime(data.get("created_at"))
    data["updated_at"] = _parse_datetime(data.get("updated_at"))
    return Artifact(**data)


def create_artifact_photo(photo: ArtifactPhoto) -> ArtifactPhoto:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO artifact_photos 
            (artifact_id, file_path, file_name, thumbnail_path, photo_time,
             gps_latitude, gps_longitude, is_matched, needs_review)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                photo.artifact_id,
                photo.file_path,
                photo.file_name,
                photo.thumbnail_path,
                _datetime_to_str(photo.photo_time),
                photo.gps_latitude,
                photo.gps_longitude,
                1 if photo.is_matched else 0,
                1 if photo.needs_review else 0,
            ),
        )
        photo.id = cursor.lastrowid
    return get_artifact_photo(cursor.lastrowid)


def get_artifact_photo(photo_id: int) -> Optional[ArtifactPhoto]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("SELECT * FROM artifact_photos WHERE id = ?", (photo_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_artifact_photo(row)


def list_artifact_photos(artifact_id: Optional[int] = None, needs_review: Optional[bool] = None,
                         limit: int = 1000, offset: int = 0) -> List[ArtifactPhoto]:
    db = get_db()
    query = "SELECT * FROM artifact_photos WHERE 1=1"
    params: List[Any] = []
    if artifact_id:
        query += " AND artifact_id = ?"
        params.append(artifact_id)
    if needs_review is not None:
        query += " AND needs_review = ?"
        params.append(1 if needs_review else 0)
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with db.get_connection() as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [_row_to_artifact_photo(row) for row in rows]


def update_artifact_photo(photo: ArtifactPhoto) -> ArtifactPhoto:
    db = get_db()
    with db.get_connection() as conn:
        conn.execute(
            """
            UPDATE artifact_photos SET 
                artifact_id = ?, file_path = ?, file_name = ?, thumbnail_path = ?,
                photo_time = ?, gps_latitude = ?, gps_longitude = ?,
                is_matched = ?, needs_review = ?
            WHERE id = ?
            """,
            (
                photo.artifact_id,
                photo.file_path,
                photo.file_name,
                photo.thumbnail_path,
                _datetime_to_str(photo.photo_time),
                photo.gps_latitude,
                photo.gps_longitude,
                1 if photo.is_matched else 0,
                1 if photo.needs_review else 0,
                photo.id,
            ),
        )
    return get_artifact_photo(photo.id)


def delete_artifact_photo(photo_id: int) -> bool:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("DELETE FROM artifact_photos WHERE id = ?", (photo_id,))
        return cursor.rowcount > 0


def _row_to_artifact_photo(row: sqlite3.Row) -> ArtifactPhoto:
    data = _row_to_dict(row)
    data["photo_time"] = _parse_datetime(data.get("photo_time"))
    data["is_matched"] = bool(data.get("is_matched", 0))
    data["needs_review"] = bool(data.get("needs_review", 0))
    data["created_at"] = _parse_datetime(data.get("created_at"))
    return ArtifactPhoto(**data)


def create_sample(sample: Sample) -> Sample:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO samples 
            (project_id, code, sample_type, trench_id, stratum_id, description,
             collected_by, collection_date, sent_date, lab_name, expected_days,
             status, result, result_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                sample.project_id,
                sample.code,
                sample.sample_type.value,
                sample.trench_id,
                sample.stratum_id,
                sample.description,
                sample.collected_by,
                _date_to_str(sample.collection_date),
                _date_to_str(sample.sent_date),
                sample.lab_name,
                sample.expected_days,
                sample.status.value,
                sample.result,
                _date_to_str(sample.result_date),
            ),
        )
        sample.id = cursor.lastrowid
        _record_sync("samples", cursor.lastrowid, "insert", sample.model_dump())
    return get_sample(cursor.lastrowid)


def get_sample(sample_id: int) -> Optional[Sample]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("SELECT * FROM samples WHERE id = ?", (sample_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_sample(row)


def get_sample_by_code(code: str) -> Optional[Sample]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("SELECT * FROM samples WHERE code = ?", (code,))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_sample(row)


def list_samples(project_id: Optional[int] = None, status: Optional[SampleStatus] = None,
                 sample_type: Optional[SampleType] = None,
                 limit: int = 500, offset: int = 0) -> List[Sample]:
    db = get_db()
    query = "SELECT * FROM samples WHERE 1=1"
    params: List[Any] = []
    if project_id:
        query += " AND project_id = ?"
        params.append(project_id)
    if status:
        query += " AND status = ?"
        params.append(status.value)
    if sample_type:
        query += " AND sample_type = ?"
        params.append(sample_type.value)
    query += " ORDER BY code LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with db.get_connection() as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [_row_to_sample(row) for row in rows]


def update_sample(sample: Sample) -> Sample:
    db = get_db()
    with db.get_connection() as conn:
        conn.execute(
            """
            UPDATE samples SET 
                project_id = ?, code = ?, sample_type = ?, trench_id = ?, stratum_id = ?,
                description = ?, collected_by = ?, collection_date = ?, sent_date = ?,
                lab_name = ?, expected_days = ?, status = ?, result = ?, result_date = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                sample.project_id,
                sample.code,
                sample.sample_type.value,
                sample.trench_id,
                sample.stratum_id,
                sample.description,
                sample.collected_by,
                _date_to_str(sample.collection_date),
                _date_to_str(sample.sent_date),
                sample.lab_name,
                sample.expected_days,
                sample.status.value,
                sample.result,
                _date_to_str(sample.result_date),
                sample.id,
            ),
        )
        _record_sync("samples", sample.id, "update", sample.model_dump())
    return get_sample(sample.id)


def delete_sample(sample_id: int) -> bool:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("DELETE FROM samples WHERE id = ?", (sample_id,))
        if cursor.rowcount > 0:
            _record_sync("samples", sample_id, "delete", {"id": sample_id})
            return True
        return False


def update_overdue_samples() -> int:
    db = get_db()
    today = date.today()
    count = 0
    with db.get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM samples WHERE status IN ('sent', 'testing') AND sent_date IS NOT NULL"
        )
        rows = cursor.fetchall()
        for row in rows:
            sample = _row_to_sample(row)
            if sample.sent_date and sample.expected_days > 0:
                days_since_sent = (today - sample.sent_date).days
                if days_since_sent > sample.expected_days:
                    sample.status = SampleStatus.OVERDUE
                    update_sample(sample)
                    count += 1
    return count


def _row_to_sample(row: sqlite3.Row) -> Sample:
    from .models import SampleStatus, SampleType
    data = _row_to_dict(row)
    data["sample_type"] = SampleType(data.get("sample_type", "other"))
    data["status"] = SampleStatus(data.get("status", "collected"))
    data["collection_date"] = _parse_date(data.get("collection_date"))
    data["sent_date"] = _parse_date(data.get("sent_date"))
    data["result_date"] = _parse_date(data.get("result_date"))
    data["created_at"] = _parse_datetime(data.get("created_at"))
    data["updated_at"] = _parse_datetime(data.get("updated_at"))
    return Sample(**data)


def create_person(person: Person) -> Person:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO persons (name, role, skills, phone, email, status)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                person.name,
                person.role.value,
                _json_dumps(person.skills),
                person.phone,
                person.email,
                person.status,
            ),
        )
        person.id = cursor.lastrowid
    return get_person(cursor.lastrowid)


def get_person(person_id: int) -> Optional[Person]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("SELECT * FROM persons WHERE id = ?", (person_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_person(row)


def list_persons(role: Optional[str] = None, status: Optional[str] = None,
                 limit: int = 200, offset: int = 0) -> List[Person]:
    db = get_db()
    query = "SELECT * FROM persons WHERE 1=1"
    params: List[Any] = []
    if role:
        query += " AND role = ?"
        params.append(role)
    if status:
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY name LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with db.get_connection() as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [_row_to_person(row) for row in rows]


def update_person(person: Person) -> Person:
    db = get_db()
    with db.get_connection() as conn:
        conn.execute(
            """
            UPDATE persons SET 
                name = ?, role = ?, skills = ?, phone = ?, email = ?, status = ?
            WHERE id = ?
            """,
            (
                person.name,
                person.role.value,
                _json_dumps(person.skills),
                person.phone,
                person.email,
                person.status,
                person.id,
            ),
        )
    return get_person(person.id)


def delete_person(person_id: int) -> bool:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("DELETE FROM persons WHERE id = ?", (person_id,))
        return cursor.rowcount > 0


def _row_to_person(row: sqlite3.Row) -> Person:
    from .models import PersonRole
    data = _row_to_dict(row)
    data["role"] = PersonRole(data.get("role", "worker"))
    data["skills"] = _json_loads(data.get("skills")) or []
    data["created_at"] = _parse_datetime(data.get("created_at"))
    return Person(**data)


def create_equipment(equipment: Equipment) -> Equipment:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO equipment (name, code, category, status, description)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                equipment.name,
                equipment.code,
                equipment.category,
                equipment.status,
                equipment.description,
            ),
        )
        equipment.id = cursor.lastrowid
    return get_equipment(cursor.lastrowid)


def get_equipment(equipment_id: int) -> Optional[Equipment]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("SELECT * FROM equipment WHERE id = ?", (equipment_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_equipment(row)


def list_equipment(category: Optional[str] = None, status: Optional[str] = None,
                   limit: int = 200, offset: int = 0) -> List[Equipment]:
    db = get_db()
    query = "SELECT * FROM equipment WHERE 1=1"
    params: List[Any] = []
    if category:
        query += " AND category = ?"
        params.append(category)
    if status:
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY name LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with db.get_connection() as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [_row_to_equipment(row) for row in rows]


def update_equipment(equipment: Equipment) -> Equipment:
    db = get_db()
    with db.get_connection() as conn:
        conn.execute(
            """
            UPDATE equipment SET 
                name = ?, code = ?, category = ?, status = ?, description = ?
            WHERE id = ?
            """,
            (
                equipment.name,
                equipment.code,
                equipment.category,
                equipment.status,
                equipment.description,
                equipment.id,
            ),
        )
    return get_equipment(equipment.id)


def delete_equipment(equipment_id: int) -> bool:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("DELETE FROM equipment WHERE id = ?", (equipment_id,))
        return cursor.rowcount > 0


def _row_to_equipment(row: sqlite3.Row) -> Equipment:
    data = _row_to_dict(row)
    data["created_at"] = _parse_datetime(data.get("created_at"))
    return Equipment(**data)


def create_assignment(assignment: Assignment) -> Assignment:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO assignments 
            (project_id, person_id, equipment_id, assignment_type, start_date,
             end_date, role, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                assignment.project_id,
                assignment.person_id,
                assignment.equipment_id,
                assignment.assignment_type,
                _date_to_str(assignment.start_date),
                _date_to_str(assignment.end_date),
                assignment.role,
                assignment.notes,
            ),
        )
        assignment.id = cursor.lastrowid
    return get_assignment(cursor.lastrowid)


def get_assignment(assignment_id: int) -> Optional[Assignment]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("SELECT * FROM assignments WHERE id = ?", (assignment_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_assignment(row)


def list_assignments(project_id: Optional[int] = None, person_id: Optional[int] = None,
                     assignment_type: Optional[str] = None,
                     limit: int = 500, offset: int = 0) -> List[Assignment]:
    db = get_db()
    query = "SELECT * FROM assignments WHERE 1=1"
    params: List[Any] = []
    if project_id:
        query += " AND project_id = ?"
        params.append(project_id)
    if person_id:
        query += " AND person_id = ?"
        params.append(person_id)
    if assignment_type:
        query += " AND assignment_type = ?"
        params.append(assignment_type)
    query += " ORDER BY start_date LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with db.get_connection() as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [_row_to_assignment(row) for row in rows]


def update_assignment(assignment: Assignment) -> Assignment:
    db = get_db()
    with db.get_connection() as conn:
        conn.execute(
            """
            UPDATE assignments SET 
                project_id = ?, person_id = ?, equipment_id = ?, assignment_type = ?,
                start_date = ?, end_date = ?, role = ?, notes = ?
            WHERE id = ?
            """,
            (
                assignment.project_id,
                assignment.person_id,
                assignment.equipment_id,
                assignment.assignment_type,
                _date_to_str(assignment.start_date),
                _date_to_str(assignment.end_date),
                assignment.role,
                assignment.notes,
                assignment.id,
            ),
        )
    return get_assignment(assignment.id)


def delete_assignment(assignment_id: int) -> bool:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("DELETE FROM assignments WHERE id = ?", (assignment_id,))
        return cursor.rowcount > 0


def _row_to_assignment(row: sqlite3.Row) -> Assignment:
    data = _row_to_dict(row)
    data["start_date"] = _parse_date(data.get("start_date"))
    data["end_date"] = _parse_date(data.get("end_date"))
    data["created_at"] = _parse_datetime(data.get("created_at"))
    return Assignment(**data)


def create_budget_item(item: BudgetItem) -> BudgetItem:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO budget_items 
            (project_id, category, budgeted, actual, notes)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                item.project_id,
                item.category,
                item.budgeted,
                item.actual,
                item.notes,
            ),
        )
        item.id = cursor.lastrowid
    return get_budget_item(cursor.lastrowid)


def get_budget_item(item_id: int) -> Optional[BudgetItem]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("SELECT * FROM budget_items WHERE id = ?", (item_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_budget_item(row)


def list_budget_items(project_id: Optional[int] = None, limit: int = 200, offset: int = 0) -> List[BudgetItem]:
    db = get_db()
    query = "SELECT * FROM budget_items WHERE 1=1"
    params: List[Any] = []
    if project_id:
        query += " AND project_id = ?"
        params.append(project_id)
    query += " ORDER BY category LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with db.get_connection() as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [_row_to_budget_item(row) for row in rows]


def update_budget_item(item: BudgetItem) -> BudgetItem:
    db = get_db()
    with db.get_connection() as conn:
        conn.execute(
            """
            UPDATE budget_items SET 
                project_id = ?, category = ?, budgeted = ?, actual = ?, notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                item.project_id,
                item.category,
                item.budgeted,
                item.actual,
                item.notes,
                item.id,
            ),
        )
    return get_budget_item(item.id)


def delete_budget_item(item_id: int) -> bool:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute("DELETE FROM budget_items WHERE id = ?", (item_id,))
        return cursor.rowcount > 0


def get_project_budget_summary(project_id: int) -> Dict[str, Any]:
    items = list_budget_items(project_id=project_id)
    total_budgeted = sum(item.budgeted for item in items)
    total_actual = sum(item.actual for item in items)
    execution_rate = (total_actual / total_budgeted * 100) if total_budgeted > 0 else 0.0
    return {
        "total_budgeted": total_budgeted,
        "total_actual": total_actual,
        "execution_rate": execution_rate,
        "item_count": len(items),
        "items": items,
    }


def _row_to_budget_item(row: sqlite3.Row) -> BudgetItem:
    data = _row_to_dict(row)
    data["created_at"] = _parse_datetime(data.get("created_at"))
    data["updated_at"] = _parse_datetime(data.get("updated_at"))
    return BudgetItem(**data)


def _record_sync(table_name: str, record_id: int, operation: str, data: Dict[str, Any]) -> None:
    db = get_db()
    with db.get_connection() as conn:
        conn.execute(
            """
            INSERT INTO sync_records 
            (sync_batch, table_name, record_id, operation, data, synced)
            VALUES (?, ?, ?, ?, ?, 0)
            """,
            ("", table_name, record_id, operation, _json_dumps(data)),
        )


def get_unsynced_records(limit: int = 10000, after_id: int = 0) -> List[SyncRecord]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM sync_records WHERE synced = 0 AND id > ? ORDER BY id LIMIT ?",
            (after_id, limit),
        )
        rows = cursor.fetchall()
        return [_row_to_sync_record(row) for row in rows]


def mark_synced(record_ids: List[int], sync_batch: str) -> None:
    if not record_ids:
        return
    db = get_db()
    with db.get_connection() as conn:
        placeholders = ",".join("?" * len(record_ids))
        conn.execute(
            f"UPDATE sync_records SET synced = 1, sync_batch = ? WHERE id IN ({placeholders})",
            [sync_batch] + record_ids,
        )


def create_sync_batch(batch_id: str, total_records: int = 0) -> None:
    db = get_db()
    with db.get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO sync_batches 
            (batch_id, status, total_records, processed_records, last_record_id)
            VALUES (?, 'pending', ?, 0, 0)
            """,
            (batch_id, total_records),
        )


def update_sync_batch_progress(batch_id: str, processed: int, last_record_id: int, status: str = "in_progress") -> None:
    db = get_db()
    with db.get_connection() as conn:
        conn.execute(
            """
            UPDATE sync_batches 
            SET processed_records = ?, last_record_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE batch_id = ?
            """,
            (processed, last_record_id, status, batch_id),
        )


def complete_sync_batch(batch_id: str) -> None:
    db = get_db()
    with db.get_connection() as conn:
        conn.execute(
            """
            UPDATE sync_batches 
            SET status = 'completed', updated_at = CURRENT_TIMESTAMP
            WHERE batch_id = ?
            """,
            (batch_id,),
        )


def get_sync_batch(batch_id: str) -> Optional[Dict[str, Any]]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM sync_batches WHERE batch_id = ?",
            (batch_id,),
        )
        row = cursor.fetchone()
        if row:
            return _row_to_dict(row)
        return None


def get_pending_sync_batch() -> Optional[Dict[str, Any]]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM sync_batches WHERE status IN ('pending', 'in_progress') ORDER BY id DESC LIMIT 1"
        )
        row = cursor.fetchone()
        if row:
            return _row_to_dict(row)
        return None


def list_sync_batches(limit: int = 20) -> List[Dict[str, Any]]:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM sync_batches ORDER BY id DESC LIMIT ?",
            (limit,),
        )
        rows = cursor.fetchall()
        return [_row_to_dict(row) for row in rows]


def create_sync_conflict(conflict: SyncConflict) -> SyncConflict:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO sync_conflicts 
            (sync_batch, table_name, record_id, local_data, remote_data, resolved, resolution)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                conflict.sync_batch,
                conflict.table_name,
                conflict.record_id,
                _json_dumps(conflict.local_data),
                _json_dumps(conflict.remote_data),
                1 if conflict.resolved else 0,
                conflict.resolution,
            ),
        )
        conflict.id = cursor.lastrowid
    return conflict


def list_sync_conflicts(resolved: Optional[bool] = None, limit: int = 100, offset: int = 0) -> List[SyncConflict]:
    db = get_db()
    query = "SELECT * FROM sync_conflicts WHERE 1=1"
    params: List[Any] = []
    if resolved is not None:
        query += " AND resolved = ?"
        params.append(1 if resolved else 0)
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with db.get_connection() as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [_row_to_sync_conflict(row) for row in rows]


def resolve_sync_conflict(conflict_id: int, resolution: str, use_local: bool = True) -> bool:
    db = get_db()
    with db.get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM sync_conflicts WHERE id = ?",
            (conflict_id,),
        )
        row = cursor.fetchone()
        if not row:
            return False
        conn.execute(
            "UPDATE sync_conflicts SET resolved = 1, resolution = ? WHERE id = ?",
            (resolution, conflict_id),
        )
        return True


def _row_to_sync_record(row: sqlite3.Row) -> SyncRecord:
    data = _row_to_dict(row)
    data["data"] = _json_loads(data.get("data")) or {}
    data["synced"] = bool(data.get("synced", 0))
    data["created_at"] = _parse_datetime(data.get("created_at"))
    return SyncRecord(**data)


def _row_to_sync_conflict(row: sqlite3.Row) -> SyncConflict:
    data = _row_to_dict(row)
    data["local_data"] = _json_loads(data.get("local_data")) or {}
    data["remote_data"] = _json_loads(data.get("remote_data")) or {}
    data["resolved"] = bool(data.get("resolved", 0))
    data["created_at"] = _parse_datetime(data.get("created_at"))
    return SyncConflict(**data)


def generate_artifact_code(site_code: str, trench_code: str, layer: str, seq: int) -> str:
    return f"{site_code}-{trench_code}-{layer}-{seq:04d}"


def generate_sample_code(site_code: str, sample_type: str, seq: int) -> str:
    type_abbr = {
        "carbon_14": "C14",
        "pollen": "POL",
        "phytolith": "PHY",
        "dna": "DNA",
        "other": "OTH",
    }
    abbr = type_abbr.get(sample_type, "OTH")
    return f"{site_code}-{abbr}-{seq:04d}"


def get_next_artifact_seq(project_id: int, site_code: str, trench_code: str, layer: str) -> int:
    artifacts = list_artifacts(project_id=project_id, limit=50000)
    prefix = f"{site_code}-{trench_code}-{layer}-"
    max_seq = 0
    for a in artifacts:
        if a.code.startswith(prefix):
            try:
                seq_str = a.code[len(prefix):]
                seq = int(seq_str)
                if seq > max_seq:
                    max_seq = seq
            except (ValueError, TypeError):
                continue
    return max_seq + 1


def get_next_sample_seq(project_id: int, site_code: str, sample_type: str) -> int:
    samples = list_samples(project_id=project_id, limit=50000)
    type_abbr = {
        "carbon_14": "C14",
        "pollen": "POL",
        "phytolith": "PHY",
        "dna": "DNA",
        "other": "OTH",
    }
    abbr = type_abbr.get(sample_type, "OTH")
    prefix = f"{site_code}-{abbr}-"
    max_seq = 0
    for s in samples:
        if s.code.startswith(prefix):
            try:
                seq_str = s.code[len(prefix):]
                seq = int(seq_str)
                if seq > max_seq:
                    max_seq = seq
            except (ValueError, TypeError):
                continue
    return max_seq + 1


def export_trenches_geojson(project_id: int) -> dict:
    project = get_project(project_id)
    if not project:
        raise ValueError(f"项目 {project_id} 不存在")

    trenches = list_trenches(project_id=project_id, limit=5000)
    features = []

    for trench in trenches:
        x = trench.x_coordinate
        y = trench.y_coordinate
        length = trench.length
        width = trench.width

        if x == 0 and y == 0:
            x = trench.grid_col * length
            y = trench.grid_row * width

        coordinates = [
            [x, y],
            [x + length, y],
            [x + length, y + width],
            [x, y + width],
            [x, y],
        ]

        feature = {
            "type": "Feature",
            "properties": {
                "id": trench.id,
                "code": trench.code,
                "grid_row": trench.grid_row,
                "grid_col": trench.grid_col,
                "length": trench.length,
                "width": trench.width,
                "depth": trench.depth,
                "status": trench.status,
                "description": trench.description,
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [coordinates],
            },
        }
        features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "name": f"{project.name} - 探方分布图",
        "crs": {
            "type": "name",
            "properties": {
                "name": "urn:ogc:def:crs:EPSG::4326"
            }
        },
        "properties": {
            "project_id": project.id,
            "project_name": project.name,
            "project_code": project.code,
            "site_name": project.site_name,
            "trench_count": len(features),
        },
        "features": features,
    }

    return geojson


def get_sample_summary(project_id: Optional[int] = None, sample_type: Optional[str] = None) -> dict:
    db = get_db()
    
    conditions = []
    params = []
    
    if project_id:
        conditions.append("project_id = ?")
        params.append(project_id)
    if sample_type:
        conditions.append("sample_type = ?")
        params.append(sample_type)
    
    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)
    
    sent_conditions = list(conditions)
    sent_conditions.append("sent_date IS NOT NULL")
    sent_where = "WHERE " + " AND ".join(sent_conditions) if sent_conditions else ""
    
    overdue_conditions = list(conditions)
    overdue_conditions.append("status = ?")
    overdue_params = list(params) + ["overdue"]
    overdue_where = "WHERE " + " AND ".join(overdue_conditions) if overdue_conditions else ""
    
    with db.get_connection() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) FROM samples {where_clause}",
            params,
        ).fetchone()[0]
        
        status_query = f"""
            SELECT status, COUNT(*) as cnt 
            FROM samples {where_clause}
            GROUP BY status
        """
        status_rows = conn.execute(status_query, params).fetchall()
        
        type_query = f"""
            SELECT sample_type, COUNT(*) as cnt 
            FROM samples {where_clause}
            GROUP BY sample_type
        """
        type_rows = conn.execute(type_query, params).fetchall()
        
        sent_count = conn.execute(
            f"SELECT COUNT(*) FROM samples {sent_where}",
            params,
        ).fetchone()[0]
        
        overdue_count = conn.execute(
            f"SELECT COUNT(*) FROM samples {overdue_where}",
            overdue_params,
        ).fetchone()[0]
    
    status_counts = {}
    for row in status_rows:
        status_counts[row["status"]] = row["cnt"]
    
    type_counts = {}
    for row in type_rows:
        type_counts[row["sample_type"]] = row["cnt"]
    
    send_rate = (sent_count / total * 100) if total > 0 else 0.0
    
    return {
        "total": total,
        "sent": sent_count,
        "overdue": overdue_count,
        "send_rate": round(send_rate, 2),
        "status_counts": status_counts,
        "type_counts": type_counts,
    }
