import logging
import re
import sqlite3
import json
import csv
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

from page_parser import Job
from config import settings

logger = logging.getLogger(__name__)


class DataProcessor:
    def __init__(self):
        self.db_path = settings.database.path
        self.table_name = settings.database.table_name
        self._ensure_database()

    def _ensure_database(self):
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {self.table_name} (
                    job_id TEXT PRIMARY KEY,
                    job_title TEXT,
                    company_name TEXT,
                    work_location TEXT,
                    salary_range TEXT,
                    education TEXT,
                    experience TEXT,
                    recruit_count TEXT,
                    publish_date TEXT,
                    deadline_date TEXT,
                    job_description TEXT,
                    job_url TEXT,
                    source TEXT,
                    crawl_time TEXT,
                    update_time TEXT,
                    is_deleted INTEGER DEFAULT 0
                )
            """)
            cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_publish_date ON {self.table_name}(publish_date)")
            cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_company ON {self.table_name}(company_name)")
            conn.commit()
        logger.info("Database initialized at %s", self.db_path)

    def clean_job(self, job: Job) -> Job:
        job.job_title = self._clean_field(job.job_title)
        job.company_name = self._clean_field(job.company_name)
        job.work_location = self._normalize_location(job.work_location)
        job.salary_range = self._normalize_salary(job.salary_range)
        job.education = self._normalize_education(job.education)
        job.experience = self._normalize_experience(job.experience)
        job.recruit_count = self._normalize_count(job.recruit_count)
        job.publish_date = self._normalize_date(job.publish_date)
        job.deadline_date = self._normalize_date(job.deadline_date)
        job.job_description = self._clean_field(job.job_description, max_len=10000)
        return job

    @staticmethod
    def _clean_field(value: str, max_len: int = 500) -> str:
        if not value:
            return ""
        value = re.sub(r"\s+", " ", value).strip()
        value = re.sub(r"[\u3000]+", "", value)
        if len(value) > max_len:
            value = value[:max_len] + "..."
        return value

    @staticmethod
    def _normalize_location(location: str) -> str:
        if not location:
            return ""
        location = location.strip()
        location = re.sub(r"[工作地点地址：:]+\s*", "", location)
        return location.strip()

    @staticmethod
    def _normalize_salary(salary: str) -> str:
        if not salary:
            return "面议"
        salary = salary.strip()
        if "面议" in salary or "面議" in salary:
            return "面议"
        salary = re.sub(r"[薪资薪酬：:]+\s*", "", salary)
        return salary.strip()

    @staticmethod
    def _normalize_education(edu: str) -> str:
        if not edu:
            return "不限"
        edu = edu.strip()
        mapping = {
            "不限": "不限",
            "学历不限": "不限",
            "大专": "大专",
            "专科": "大专",
            "大专及以上": "大专",
            "本科": "本科",
            "本科及以上": "本科",
            "学士": "本科",
            "硕士": "硕士",
            "硕士及以上": "硕士",
            "研究生": "硕士",
            "博士": "博士",
            "博士及以上": "博士",
            "高中": "高中",
            "中专": "中专",
            "初中": "初中",
        }
        for key, val in mapping.items():
            if key in edu:
                return val
        return edu.strip()

    @staticmethod
    def _normalize_experience(exp: str) -> str:
        if not exp:
            return "不限"
        exp = exp.strip()
        if "不限" in exp or "经验不限" in exp:
            return "不限"
        exp = re.sub(r"[工作经验要求：:]+\s*", "", exp)
        m = re.search(r"(\d+)\s*[-.~至到]\s*(\d+)\s*年", exp)
        if m:
            return f"{m.group(1)}-{m.group(2)}年"
        m = re.search(r"(\d+)\s*年以上", exp)
        if m:
            return f"{m.group(1)}年以上"
        m = re.search(r"(\d+)\s*年", exp)
        if m:
            return f"{m.group(1)}年"
        if "应届" in exp:
            return "应届生"
        return exp.strip()

    @staticmethod
    def _normalize_count(count: str) -> str:
        if not count:
            return "若干"
        count = count.strip()
        m = re.search(r"(\d+)\s*人", count)
        if m:
            return m.group(1)
        if "若干" in count or "多名" in count:
            return "若干"
        return count.strip()

    @staticmethod
    def _normalize_date(date_str: str) -> str:
        if not date_str:
            return ""
        date_str = date_str.strip()
        patterns = [
            r"(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?",
            r"(\d{4})(\d{2})(\d{2})",
        ]
        for pattern in patterns:
            m = re.search(pattern, date_str)
            if m:
                try:
                    y, mo, d = m.group(1), m.group(2), m.group(3)
                    dt = datetime(int(y), int(mo), int(d))
                    return dt.strftime("%Y-%m-%d")
                except ValueError:
                    pass
        return date_str.strip()

    def deduplicate_jobs(self, jobs: List[Job]) -> List[Job]:
        seen_ids = set()
        unique_jobs: List[Job] = []
        for job in jobs:
            if not job.job_id:
                job.job_id = job.generate_id()
            if job.job_id not in seen_ids:
                seen_ids.add(job.job_id)
                unique_jobs.append(job)
        logger.info("Deduplicated: %d -> %d unique jobs", len(jobs), len(unique_jobs))
        return unique_jobs

    def detect_changes(self, new_jobs: List[Job]) -> Dict[str, List[Job]]:
        logger.info("Detecting changes for %d jobs", len(new_jobs))
        result = {"added": [], "modified": [], "deleted": [], "unchanged": []}

        existing_jobs = self.get_all_jobs()
        existing_map = {j.job_id: j for j in existing_jobs}
        new_ids = {j.job_id for j in new_jobs}

        for job in new_jobs:
            if job.job_id in existing_map:
                existing = existing_map[job.job_id]
                if self._has_changed(existing, job):
                    result["modified"].append(job)
                else:
                    result["unchanged"].append(job)
            else:
                result["added"].append(job)

        for job_id, existing in existing_map.items():
            if job_id not in new_ids and existing.is_deleted == 0:
                result["deleted"].append(existing)

        logger.info(
            "Changes detected: added=%d, modified=%d, deleted=%d, unchanged=%d",
            len(result["added"]),
            len(result["modified"]),
            len(result["deleted"]),
            len(result["unchanged"]),
        )
        return result

    @staticmethod
    def _has_changed(old: Job, new: Job) -> bool:
        fields = [
            "job_title", "company_name", "work_location", "salary_range",
            "education", "experience", "recruit_count", "publish_date",
            "deadline_date", "job_description",
        ]
        for field in fields:
            if getattr(old, field, "") != getattr(new, field, ""):
                return True
        return False

    def save_jobs(self, jobs: List[Job]) -> Tuple[int, int]:
        if not jobs:
            return 0, 0

        inserted = 0
        updated = 0
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            for job in jobs:
                job_dict = job.to_dict()
                job_dict["update_time"] = now
                try:
                    cursor.execute(f"""
                        INSERT INTO {self.table_name} 
                        (job_id, job_title, company_name, work_location, salary_range,
                         education, experience, recruit_count, publish_date, deadline_date,
                         job_description, job_url, source, crawl_time, update_time)
                        VALUES (:job_id, :job_title, :company_name, :work_location, :salary_range,
                                :education, :experience, :recruit_count, :publish_date, :deadline_date,
                                :job_description, :job_url, :source, :crawl_time, :update_time)
                    """, job_dict)
                    inserted += 1
                except sqlite3.IntegrityError:
                    job_dict["update_time"] = now
                    cursor.execute(f"""
                        UPDATE {self.table_name} SET
                            job_title = :job_title,
                            company_name = :company_name,
                            work_location = :work_location,
                            salary_range = :salary_range,
                            education = :education,
                            experience = :experience,
                            recruit_count = :recruit_count,
                            publish_date = :publish_date,
                            deadline_date = :deadline_date,
                            job_description = :job_description,
                            job_url = :job_url,
                            source = :source,
                            crawl_time = :crawl_time,
                            update_time = :update_time
                        WHERE job_id = :job_id
                    """, job_dict)
                    updated += 1
            conn.commit()

        logger.info("Saved jobs: inserted=%d, updated=%d", inserted, updated)
        return inserted, updated

    def mark_deleted(self, job_ids: List[str]) -> int:
        if not job_ids:
            return 0
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        placeholders = ",".join("?" * len(job_ids))
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"UPDATE {self.table_name} SET is_deleted = 1, update_time = ? WHERE job_id IN ({placeholders})",
                [now] + job_ids,
            )
            conn.commit()
            count = cursor.rowcount
        logger.info("Marked %d jobs as deleted", count)
        return count

    def get_all_jobs(self) -> List[Job]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(f"SELECT * FROM {self.table_name} WHERE is_deleted = 0")
            rows = cursor.fetchall()
        jobs = []
        for row in rows:
            job = Job()
            for key in row.keys():
                if hasattr(job, key):
                    setattr(job, key, row[key] or "")
            job.is_deleted = row["is_deleted"]
            jobs.append(job)
        return jobs

    def get_jobs_by_date_range(self, start_date: str, end_date: str) -> List[Job]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                f"SELECT * FROM {self.table_name} WHERE is_deleted = 0 AND publish_date BETWEEN ? AND ?",
                (start_date, end_date),
            )
            rows = cursor.fetchall()
        jobs = []
        for row in rows:
            job = Job()
            for key in row.keys():
                if hasattr(job, key):
                    setattr(job, key, row[key] or "")
            jobs.append(job)
        return jobs

    def export_to_json(self, jobs: List[Job], filepath: str) -> int:
        data = [job.to_dict() for job in jobs]
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info("Exported %d jobs to JSON: %s", len(data), filepath)
        return len(data)

    def export_to_csv(self, jobs: List[Job], filepath: str) -> int:
        if not jobs:
            return 0
        fieldnames = list(jobs[0].to_dict().keys())
        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for job in jobs:
                writer.writerow(job.to_dict())
        logger.info("Exported %d jobs to CSV: %s", len(jobs), filepath)
        return len(jobs)

    def get_stats(self) -> Dict[str, Any]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT COUNT(*) FROM {self.table_name} WHERE is_deleted = 0")
            total = cursor.fetchone()[0]
            cursor.execute(f"SELECT COUNT(*) FROM {self.table_name} WHERE is_deleted = 1")
            deleted = cursor.fetchone()[0]
            cursor.execute(
                f"SELECT publish_date, COUNT(*) FROM {self.table_name} WHERE is_deleted = 0 AND publish_date != '' GROUP BY publish_date ORDER BY publish_date DESC LIMIT 10"
            )
            by_date = cursor.fetchall()
        return {
            "total_active": total,
            "total_deleted": deleted,
            "jobs_by_date": by_date,
        }
