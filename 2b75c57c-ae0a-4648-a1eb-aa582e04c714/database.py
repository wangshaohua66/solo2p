import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from logger import get_logger


logger = get_logger("database")


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS job_fairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fair_id TEXT UNIQUE NOT NULL,
    site_name TEXT NOT NULL,
    title TEXT NOT NULL,
    fair_date TEXT,
    location TEXT,
    organizer TEXT,
    description TEXT,
    detail_url TEXT,
    company_count INTEGER DEFAULT 0,
    crawl_time TEXT NOT NULL,
    status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT UNIQUE NOT NULL,
    fair_id TEXT NOT NULL,
    name TEXT NOT NULL,
    booth_number TEXT,
    industry TEXT,
    company_type TEXT,
    scale TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    address TEXT,
    description TEXT,
    FOREIGN KEY (fair_id) REFERENCES job_fairs(fair_id)
);

CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT UNIQUE NOT NULL,
    company_id TEXT NOT NULL,
    fair_id TEXT NOT NULL,
    title TEXT NOT NULL,
    salary_min INTEGER,
    salary_max INTEGER,
    salary_unit TEXT,
    education TEXT,
    major TEXT,
    experience TEXT,
    location TEXT,
    job_count INTEGER DEFAULT 1,
    description TEXT,
    requirements TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(company_id)
);

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    gender TEXT,
    university TEXT,
    major TEXT,
    education TEXT,
    phone TEXT,
    email TEXT,
    target_industry TEXT,
    target_position TEXT,
    target_salary_min INTEGER,
    resume_path TEXT,
    create_time TEXT NOT NULL,
    update_time TEXT
);

CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id TEXT UNIQUE NOT NULL,
    student_id TEXT NOT NULL,
    job_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    fair_id TEXT,
    submit_time TEXT NOT NULL,
    status TEXT DEFAULT 'submitted',
    feedback TEXT,
    last_track_time TEXT,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (job_id) REFERENCES jobs(job_id)
);

CREATE TABLE IF NOT EXISTS crawl_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_name TEXT NOT NULL,
    task_type TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    status TEXT NOT NULL,
    record_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    recipient TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    status TEXT DEFAULT 'pending',
    create_time TEXT NOT NULL,
    send_time TEXT
);

CREATE INDEX IF NOT EXISTS idx_fairs_date ON job_fairs(fair_date);
CREATE INDEX IF NOT EXISTS idx_companies_fair ON companies(fair_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_fair ON jobs(fair_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_job ON submissions(job_id);
CREATE INDEX IF NOT EXISTS idx_crawl_logs_time ON crawl_logs(start_time);
"""


class DatabaseManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, db_path: str = ""):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self, db_path: str = ""):
        if self._initialized:
            return
        self._initialized = True
        if db_path:
            self.db_path = db_path
        else:
            from config import load_config
            cfg = load_config()
            self.db_path = cfg.database.db_path
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._local = threading.local()
        self._init_schema()
        logger.info(f"数据库初始化完成: {self.db_path}")

    def _get_conn(self) -> sqlite3.Connection:
        if not hasattr(self._local, "conn") or self._local.conn is None:
            self._local.conn = sqlite3.connect(
                self.db_path,
                check_same_thread=False,
                timeout=30
            )
            self._local.conn.row_factory = sqlite3.Row
            self._local.conn.execute("PRAGMA journal_mode=WAL")
            self._local.conn.execute("PRAGMA synchronous=NORMAL")
            self._local.conn.execute("PRAGMA cache_size=-64000")
        return self._local.conn

    @contextmanager
    def get_cursor(self):
        conn = self._get_conn()
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"数据库操作失败: {e}")
            raise
        finally:
            cursor.close()

    def _init_schema(self) -> None:
        with self.get_cursor() as cur:
            cur.executescript(SCHEMA_SQL)

    def upsert_job_fair(self, fair: Dict[str, Any]) -> int:
        sql = """
        INSERT INTO job_fairs (fair_id, site_name, title, fair_date, location, organizer,
                               description, detail_url, company_count, crawl_time, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(fair_id) DO UPDATE SET
            title=excluded.title,
            fair_date=excluded.fair_date,
            location=excluded.location,
            organizer=excluded.organizer,
            description=excluded.description,
            company_count=excluded.company_count,
            crawl_time=excluded.crawl_time,
            status=excluded.status
        """
        with self.get_cursor() as cur:
            cur.execute(sql, (
                fair.get("fair_id"), fair.get("site_name"), fair.get("title"),
                fair.get("fair_date"), fair.get("location"), fair.get("organizer"),
                fair.get("description"), fair.get("detail_url"),
                fair.get("company_count", 0), fair.get("crawl_time", datetime.now().isoformat()),
                fair.get("status", "active")
            ))
            return cur.lastrowid

    def upsert_company(self, company: Dict[str, Any]) -> int:
        sql = """
        INSERT INTO companies (company_id, fair_id, name, booth_number, industry, company_type,
                               scale, contact_person, contact_phone, contact_email, address, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(company_id) DO UPDATE SET
            fair_id=excluded.fair_id,
            name=excluded.name,
            booth_number=excluded.booth_number,
            industry=excluded.industry,
            company_type=excluded.company_type,
            scale=excluded.scale,
            contact_person=excluded.contact_person,
            contact_phone=excluded.contact_phone,
            contact_email=excluded.contact_email,
            address=excluded.address,
            description=excluded.description
        """
        with self.get_cursor() as cur:
            cur.execute(sql, (
                company.get("company_id"), company.get("fair_id"), company.get("name"),
                company.get("booth_number"), company.get("industry"), company.get("company_type"),
                company.get("scale"), company.get("contact_person"), company.get("contact_phone"),
                company.get("contact_email"), company.get("address"), company.get("description")
            ))
            return cur.lastrowid

    def upsert_job(self, job: Dict[str, Any]) -> int:
        sql = """
        INSERT INTO jobs (job_id, company_id, fair_id, title, salary_min, salary_max, salary_unit,
                          education, major, experience, location, job_count, description, requirements)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(job_id) DO UPDATE SET
            title=excluded.title,
            salary_min=excluded.salary_min,
            salary_max=excluded.salary_max,
            salary_unit=excluded.salary_unit,
            education=excluded.education,
            major=excluded.major,
            experience=excluded.experience,
            location=excluded.location,
            job_count=excluded.job_count,
            description=excluded.description,
            requirements=excluded.requirements
        """
        with self.get_cursor() as cur:
            cur.execute(sql, (
                job.get("job_id"), job.get("company_id"), job.get("fair_id"),
                job.get("title"), job.get("salary_min"), job.get("salary_max"),
                job.get("salary_unit"), job.get("education"), job.get("major"),
                job.get("experience"), job.get("location"), job.get("job_count", 1),
                job.get("description"), job.get("requirements")
            ))
            return cur.lastrowid

    def upsert_student(self, student: Dict[str, Any]) -> int:
        sql = """
        INSERT INTO students (student_id, name, gender, university, major, education, phone,
                              email, target_industry, target_position, target_salary_min,
                              resume_path, create_time, update_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(student_id) DO UPDATE SET
            name=excluded.name,
            gender=excluded.gender,
            university=excluded.university,
            major=excluded.major,
            education=excluded.education,
            phone=excluded.phone,
            email=excluded.email,
            target_industry=excluded.target_industry,
            target_position=excluded.target_position,
            target_salary_min=excluded.target_salary_min,
            resume_path=excluded.resume_path,
            update_time=excluded.update_time
        """
        now = datetime.now().isoformat()
        with self.get_cursor() as cur:
            cur.execute(sql, (
                student.get("student_id"), student.get("name"), student.get("gender"),
                student.get("university"), student.get("major"), student.get("education"),
                student.get("phone"), student.get("email"), student.get("target_industry"),
                student.get("target_position"), student.get("target_salary_min"),
                student.get("resume_path"), now, now
            ))
            return cur.lastrowid

    def upsert_submission(self, submission: Dict[str, Any]) -> int:
        sql = """
        INSERT INTO submissions (submission_id, student_id, job_id, company_id, fair_id,
                                 submit_time, status, feedback, last_track_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(submission_id) DO UPDATE SET
            status=excluded.status,
            feedback=excluded.feedback,
            last_track_time=excluded.last_track_time
        """
        with self.get_cursor() as cur:
            cur.execute(sql, (
                submission.get("submission_id"), submission.get("student_id"),
                submission.get("job_id"), submission.get("company_id"),
                submission.get("fair_id"),
                submission.get("submit_time", datetime.now().isoformat()),
                submission.get("status", "submitted"), submission.get("feedback"),
                submission.get("last_track_time")
            ))
            return cur.lastrowid

    def log_crawl(self, log: Dict[str, Any]) -> int:
        sql = """
        INSERT INTO crawl_logs (site_name, task_type, start_time, end_time, status,
                                record_count, error_count, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        with self.get_cursor() as cur:
            cur.execute(sql, (
                log.get("site_name"), log.get("task_type"),
                log.get("start_time", datetime.now().isoformat()),
                log.get("end_time"), log.get("status"),
                log.get("record_count", 0), log.get("error_count", 0),
                log.get("error_message")
            ))
            return cur.lastrowid

    def update_crawl_log(self, log_id: int, **kwargs) -> None:
        if not kwargs:
            return
        fields = ", ".join(f"{k}=?" for k in kwargs)
        values = list(kwargs.values()) + [log_id]
        sql = f"UPDATE crawl_logs SET {fields} WHERE id=?"
        with self.get_cursor() as cur:
            cur.execute(sql, values)

    def add_notification(self, notif: Dict[str, Any]) -> int:
        sql = """
        INSERT INTO notifications (notification_id, type, recipient, title, content,
                                   status, create_time, send_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        with self.get_cursor() as cur:
            cur.execute(sql, (
                notif.get("notification_id"), notif.get("type"), notif.get("recipient"),
                notif.get("title"), notif.get("content"),
                notif.get("status", "pending"),
                notif.get("create_time", datetime.now().isoformat()),
                notif.get("send_time")
            ))
            return cur.lastrowid

    def query_submissions_by_status(self, status: str) -> List[sqlite3.Row]:
        sql = "SELECT * FROM submissions WHERE status=?"
        with self.get_cursor() as cur:
            cur.execute(sql, (status,))
            return cur.fetchall()

    def query_recent_fairs(self, limit: int = 50) -> List[sqlite3.Row]:
        sql = "SELECT * FROM job_fairs ORDER BY fair_date DESC LIMIT ?"
        with self.get_cursor() as cur:
            cur.execute(sql, (limit,))
            return cur.fetchall()

    def query_jobs_by_fair(self, fair_id: str) -> List[sqlite3.Row]:
        sql = "SELECT * FROM jobs WHERE fair_id=?"
        with self.get_cursor() as cur:
            cur.execute(sql, (fair_id,))
            return cur.fetchall()

    def query_companies_by_fair(self, fair_id: str) -> List[sqlite3.Row]:
        sql = "SELECT * FROM companies WHERE fair_id=?"
        with self.get_cursor() as cur:
            cur.execute(sql, (fair_id,))
            return cur.fetchall()

    def query_all(self, sql: str, params: Tuple = ()) -> List[sqlite3.Row]:
        with self.get_cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()

    def execute(self, sql: str, params: Tuple = ()) -> int:
        with self.get_cursor() as cur:
            cur.execute(sql, params)
            return cur.rowcount

    def close(self) -> None:
        if hasattr(self._local, "conn") and self._local.conn is not None:
            self._local.conn.close()
            self._local.conn = None
