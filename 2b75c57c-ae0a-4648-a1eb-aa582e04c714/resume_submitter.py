import time
import hashlib
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from tqdm import tqdm

from spider_base import BaseSpider
from logger import get_logger
from database import DatabaseManager


logger = get_logger("submitter")


class ResumeSubmitter:
    def __init__(self, spider: Optional[BaseSpider] = None):
        self.spider = spider
        self.db = DatabaseManager()

    def _gen_submission_id(self, student_id: str, job_id: str) -> str:
        raw = f"{student_id}|{job_id}|{datetime.now().isoformat()}"
        return hashlib.md5(raw.encode()).hexdigest()

    def submit_single(self, student: Dict[str, Any], job: Dict[str, Any],
                      simulate: bool = True) -> Dict[str, Any]:
        submission_id = self._gen_submission_id(student.get("student_id", ""), job.get("job_id", ""))
        submission = {
            "submission_id": submission_id,
            "student_id": student.get("student_id"),
            "job_id": job.get("job_id"),
            "company_id": job.get("company_id"),
            "fair_id": job.get("fair_id"),
            "submit_time": datetime.now().isoformat(),
            "status": "submitted",
            "feedback": "",
            "last_track_time": None,
        }

        if not simulate and self.spider is not None:
            try:
                self._simulate_submit(student, job)
                submission["status"] = "submitted"
            except Exception as e:
                submission["status"] = "failed"
                submission["feedback"] = str(e)
                logger.error(f"投递失败 student={student.get('name')} job={job.get('title')}: {e}")

        try:
            self.db.upsert_submission(submission)
        except Exception as e:
            logger.error(f"保存投递记录失败: {e}")

        return submission

    def _simulate_submit(self, student: Dict[str, Any], job: Dict[str, Any]) -> None:
        if self.spider is None:
            return
        logger.debug(f"模拟投递: {student.get('name')} -> {job.get('title')}")
        time.sleep(0.2)

    def submit_batch(self, student: Dict[str, Any], jobs: List[Dict[str, Any]],
                     rate_per_minute: int = 20, simulate: bool = True,
                     show_progress: bool = True) -> List[Dict[str, Any]]:
        results = []
        interval = 60.0 / max(rate_per_minute, 1)
        iterator = tqdm(jobs, desc=f"投递中 ({student.get('name', '')})", disable=not show_progress)

        for job in iterator:
            try:
                sub = self.submit_single(student, job, simulate=simulate)
                results.append(sub)
                if sub.get("status") == "submitted":
                    iterator.set_postfix(status="成功")
                else:
                    iterator.set_postfix(status="失败")
            except Exception as e:
                logger.error(f"批量投递异常: {e}")
            time.sleep(interval)

        success = sum(1 for r in results if r.get("status") == "submitted")
        logger.info(f"批量投递完成: 成功{success}/{len(results)} (学生: {student.get('name')})")
        return results

    def match_and_submit(self, student: Dict[str, Any], all_jobs: List[Dict[str, Any]],
                         top_n: int = 20, rate_per_minute: int = 20,
                         simulate: bool = True) -> List[Dict[str, Any]]:
        from data_processor import match_student_jobs
        matched = match_student_jobs(student, all_jobs, limit=top_n)
        logger.info(f"匹配到 {len(matched)} 个岗位 (学生: {student.get('name')})")
        return self.submit_batch(student, matched, rate_per_minute=rate_per_minute, simulate=simulate)
