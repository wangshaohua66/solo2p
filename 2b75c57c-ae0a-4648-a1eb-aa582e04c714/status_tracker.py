import random
import time
from datetime import datetime
from typing import Any, Dict, List

from tqdm import tqdm

from logger import get_logger
from database import DatabaseManager


logger = get_logger("tracker")

STATUS_TRANSITIONS = {
    "submitted": ["submitted", "viewed", "rejected", "interview"],
    "viewed": ["viewed", "interview", "rejected"],
    "interview": ["interview", "offer", "rejected"],
    "rejected": ["rejected"],
    "offer": ["offer"],
}

STATUS_LABELS = {
    "submitted": "已投递",
    "viewed": "已查看",
    "interview": "待面试",
    "rejected": "已拒绝",
    "offer": "已录用",
}


class StatusTracker:
    def __init__(self):
        self.db = DatabaseManager()

    def _simulate_status_update(self, current_status: str) -> str:
        choices = STATUS_TRANSITIONS.get(current_status, [current_status])
        weights = [0.7] + [0.3 / max(len(choices) - 1, 1)] * (len(choices) - 1)
        return random.choices(choices, weights=weights[:len(choices)], k=1)[0]

    def track_single(self, submission: Dict[str, Any], simulate: bool = True) -> Dict[str, Any]:
        current = submission.get("status", "submitted")
        sid = submission.get("submission_id")

        if simulate:
            new_status = self._simulate_status_update(current)
        else:
            new_status = self._query_remote_status(submission)

        feedback = submission.get("feedback", "")
        if new_status == "interview" and "面试" not in feedback:
            feedback = feedback + " | 请准备面试通知" if feedback else "请准备面试通知"
        elif new_status == "offer" and "录用" not in feedback:
            feedback = feedback + " | 恭喜获得offer" if feedback else "恭喜获得offer"

        update = {
            "submission_id": sid,
            "student_id": submission.get("student_id"),
            "job_id": submission.get("job_id"),
            "company_id": submission.get("company_id"),
            "fair_id": submission.get("fair_id"),
            "submit_time": submission.get("submit_time"),
            "status": new_status,
            "feedback": feedback,
            "last_track_time": datetime.now().isoformat(),
        }
        self.db.upsert_submission(update)

        if new_status != current:
            logger.info(
                f"状态变更: {sid} {STATUS_LABELS.get(current, current)} -> "
                f"{STATUS_LABELS.get(new_status, new_status)}"
            )
            self._notify_status_change(submission, current, new_status)

        return update

    def _query_remote_status(self, submission: Dict[str, Any]) -> str:
        return submission.get("status", "submitted")

    def _notify_status_change(self, submission: Dict[str, Any], old: str, new: str) -> None:
        from notifier import Notifier
        try:
            notifier = Notifier()
            title = f"简历状态更新: {STATUS_LABELS.get(new, new)}"
            content = (
                f"您投递的岗位状态已更新\n"
                f"原状态: {STATUS_LABELS.get(old, old)}\n"
                f"新状态: {STATUS_LABELS.get(new, new)}"
            )
            notifier.notify_student(submission.get("student_id", ""), title, content)
        except Exception as e:
            logger.debug(f"状态通知失败: {e}")

    def track_all(self, statuses: List[str] = None, simulate: bool = True,
                  show_progress: bool = True) -> List[Dict[str, Any]]:
        if statuses is None:
            statuses = ["submitted", "viewed", "interview"]

        all_rows = []
        for s in statuses:
            all_rows.extend(self.db.query_submissions_by_status(s))

        results = []
        iterator = tqdm(all_rows, desc="追踪简历状态", disable=not show_progress)
        for row in iterator:
            sub = dict(row)
            try:
                updated = self.track_single(sub, simulate=simulate)
                results.append(updated)
            except Exception as e:
                logger.error(f"追踪失败 {sub.get('submission_id')}: {e}")
            time.sleep(0.05)

        changed = sum(1 for r in results if r.get("status") != "submitted")
        logger.info(f"状态追踪完成: 处理{len(results)}条, 状态变更{changed}条")
        return results

    def get_student_submissions(self, student_id: str) -> List[Dict[str, Any]]:
        rows = self.db.query_all(
            "SELECT s.*, j.title as job_title, c.name as company_name "
            "FROM submissions s "
            "LEFT JOIN jobs j ON s.job_id = j.job_id "
            "LEFT JOIN companies c ON s.company_id = c.company_id "
            "WHERE s.student_id = ? ORDER BY s.submit_time DESC",
            (student_id,)
        )
        return [dict(r) for r in rows]
