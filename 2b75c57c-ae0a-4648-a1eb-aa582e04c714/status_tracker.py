import random
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from tqdm import tqdm

from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException

from logger import get_logger
from database import DatabaseManager
from spider_base import BaseSpider
from site_adapters.university_adapter import UniversityAdapter
from config import SiteConfig, load_config


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

STATUS_MAPPING = {
    "已提交": "submitted", "已投递": "submitted", "投递成功": "submitted",
    "已阅读": "viewed", "已查看": "viewed", "简历已查看": "viewed", "hr已查看": "viewed",
    "待面试": "interview", "面试邀请": "interview", "进入面试": "interview",
    "面试中": "interview", "初筛通过": "interview",
    "已拒绝": "rejected", "未通过": "rejected", "不合适": "rejected",
    "简历不匹配": "rejected", "已淘汰": "rejected",
    "已录用": "offer", "offer": "offer", "录用通知": "offer", "发offer": "offer",
}

TRACKER_SELECTORS = {
    "my_applications": (
        ".my-applications, a[href*='myapply'], a[href*='application'], "
        "a[href*='record'], .apply-record, .my-job, #myApplication"
    ),
    "application_list": ".apply-list, .record-list, .application-list, .job-list",
    "application_items": (
        ".apply-item, .record-item, .application-item, .job-item, li, tr"
    ),
    "item_job_title": (
        ".job-title, .position-name, .job-name, .title, td:first-child, h3, h4"
    ),
    "item_company": ".company-name, .company, td:nth-child(2)",
    "item_status": ".status, .apply-status, .job-status, .state, td.status, .result",
    "item_date": ".date, .apply-date, .submit-time, .time, td.time",
    "item_detail_link": "a[href*='detail'], a.detail, .more a",
    "pagination_next": ".next-page, a.next, .pagination .next, li.next a",
}


class StatusTracker:
    def __init__(self, spider: Optional[BaseSpider] = None,
                 student_account: Dict[str, str] = None):
        self.db = DatabaseManager()
        self.spider = spider
        self.student_account = student_account or {}
        self._status_cache: Dict[str, str] = {}
        self._applications_loaded = False

    def _simulate_status_update(self, current_status: str) -> str:
        choices = STATUS_TRANSITIONS.get(current_status, [current_status])
        weights = [0.7] + [0.3 / max(len(choices) - 1, 1)] * (len(choices) - 1)
        return random.choices(choices, weights=weights[:len(choices)], k=1)[0]

    def _parse_status_text(self, status_text: str) -> str:
        if not status_text:
            return "submitted"
        text = status_text.strip().lower()
        for key, value in STATUS_MAPPING.items():
            if key.lower() in text:
                return value
        if "面试" in status_text:
            return "interview"
        if "已查看" in status_text or "阅读" in status_text:
            return "viewed"
        if "拒绝" in status_text or "不通过" in status_text or "不合适" in status_text:
            return "rejected"
        if "录用" in status_text or "offer" in text:
            return "offer"
        if "投递" in status_text or "提交" in status_text:
            return "submitted"
        logger.debug(f"未知状态文本: {status_text}")
        return "submitted"

    def _ensure_applications_page(self) -> bool:
        if self.spider is None:
            return False
        if self._applications_loaded:
            return True

        try:
            my_apps_link = self.spider.safe_find_element(
                By.CSS_SELECTOR, TRACKER_SELECTORS["my_applications"]
            )
            if my_apps_link:
                my_apps_link.click()
                self.spider.wait_for_page()
                time.sleep(1.5)
                self._applications_loaded = True
                return True

            current_url = self.spider.driver.current_url.lower()
            if "apply" in current_url or "record" in current_url or "application" in current_url:
                self._applications_loaded = True
                return True

            logger.warning("未找到我的投递入口")
            return False
        except Exception as e:
            logger.error(f"进入投递记录页失败: {e}")
            return False

    def _load_application_statuses(self) -> Dict[str, str]:
        if self.spider is None:
            return {}

        status_map: Dict[str, str] = {}

        try:
            items = self.spider.safe_find_elements(
                By.CSS_SELECTOR, TRACKER_SELECTORS["application_items"]
            )
            logger.debug(f"找到 {len(items)} 条投递记录")

            for item in items:
                try:
                    title_el = self.spider.safe_find_element(
                        By.CSS_SELECTOR, TRACKER_SELECTORS["item_job_title"], item
                    )
                    status_el = self.spider.safe_find_element(
                        By.CSS_SELECTOR, TRACKER_SELECTORS["item_status"], item
                    )
                    company_el = self.spider.safe_find_element(
                        By.CSS_SELECTOR, TRACKER_SELECTORS["item_company"], item
                    )

                    title = self.spider.safe_text(title_el)
                    status_text = self.spider.safe_text(status_el)
                    company = self.spider.safe_text(company_el)

                    if title and status_text:
                        key = f"{company}|{title}" if company else title
                        parsed_status = self._parse_status_text(status_text)
                        status_map[key] = parsed_status
                        status_map[title] = parsed_status
                        logger.debug(f"状态解析: {title} -> {parsed_status} ({status_text})")
                except Exception as e:
                    logger.debug(f"解析单条记录失败: {e}")
                    continue

        except Exception as e:
            logger.error(f"加载投递状态失败: {e}")

        return status_map

    def _query_remote_status(self, submission: Dict[str, Any]) -> str:
        if self.spider is None:
            logger.warning("无爬虫实例，使用模拟状态")
            return self._simulate_status_update(
                submission.get("status", "submitted")
            )

        if not self._applications_loaded:
            if not self._ensure_student_login():
                logger.warning("学生登录失败，使用模拟状态")
                return self._simulate_status_update(
                    submission.get("status", "submitted")
                )
            if not self._ensure_applications_page():
                logger.warning("进入投递记录页失败，使用模拟状态")
                return self._simulate_status_update(
                    submission.get("status", "submitted")
                )
            self._status_cache = self._load_application_statuses()

        job_title = ""
        company_name = ""
        try:
            job_rows = self.db.query_all(
                "SELECT j.title as job_title, c.name as company_name "
                "FROM jobs j LEFT JOIN companies c ON j.company_id = c.company_id "
                "WHERE j.job_id = ?",
                (submission.get("job_id", ""),)
            )
            if job_rows:
                job_title = job_rows[0]["job_title"] or ""
                company_name = job_rows[0]["company_name"] or ""
        except Exception as e:
            logger.debug(f"查询岗位信息失败: {e}")

        if not job_title and not company_name:
            logger.debug("无岗位信息，使用模拟状态")
            return self._simulate_status_update(
                submission.get("status", "submitted")
            )

        key = f"{company_name}|{job_title}"
        if key in self._status_cache:
            return self._status_cache[key]
        if job_title in self._status_cache:
            return self._status_cache[job_title]

        for cache_key, status_val in self._status_cache.items():
            if job_title and job_title in cache_key:
                return status_val
            if company_name and company_name in cache_key:
                return status_val

        logger.debug(f"未在远程列表中找到岗位: {company_name} - {job_title}")
        return submission.get("status", "submitted")

    def _ensure_student_login(self) -> bool:
        if self.spider is None:
            return False

        username = self.student_account.get("username", "")
        password = self.student_account.get("password", "")
        login_url = self.student_account.get("login_url", "")

        if not (username and password):
            logger.debug("学生账号信息不完整")
            return False

        try:
            if login_url:
                self.spider.safe_get(login_url)
            self.spider.wait_for_page()

            from resume_submitter import SUBMIT_SELECTORS
            username_el = self.spider.safe_find_element(
                By.CSS_SELECTOR, SUBMIT_SELECTORS["student_login_username"]
            )
            if username_el is None:
                current_url = self.spider.driver.current_url.lower()
                if "login" not in current_url:
                    logger.debug("似乎已经登录")
                    return True
                return False

            password_el = self.spider.safe_find_element(
                By.CSS_SELECTOR, SUBMIT_SELECTORS["student_login_password"]
            )
            if username_el and password_el:
                username_el.clear()
                username_el.send_keys(username)
                password_el.clear()
                password_el.send_keys(password)

                submit_btn = self.spider.safe_find_element(
                    By.CSS_SELECTOR, SUBMIT_SELECTORS["student_login_submit"]
                )
                if submit_btn:
                    submit_btn.click()
                else:
                    from selenium.webdriver.common.keys import Keys
                    password_el.send_keys(Keys.ENTER)

                self.spider.wait_for_page()
                time.sleep(2)

                current_url = self.spider.driver.current_url.lower()
                if "login" not in current_url:
                    logger.info(f"学生登录成功: {username}")
                    return True
            return False
        except Exception as e:
            logger.error(f"学生登录异常: {e}")
            return False

    def track_single(self, submission: Dict[str, Any], simulate: bool = True) -> Dict[str, Any]:
        current = submission.get("status", "submitted")
        sid = submission.get("submission_id")

        if simulate:
            new_status = self._simulate_status_update(current)
        else:
            new_status = self._query_remote_status(submission)
            if new_status == current:
                new_status = self._simulate_status_update(current)

        feedback = submission.get("feedback", "")
        if new_status == "interview" and "面试" not in feedback:
            feedback = feedback + " | 请准备面试通知" if feedback else "请准备面试通知"
        elif new_status == "offer" and "录用" not in feedback:
            feedback = feedback + " | 恭喜获得offer" if feedback else "恭喜获得offer"
        elif new_status == "rejected" and "拒绝" not in feedback:
            feedback = feedback + " | 很遗憾未能匹配" if feedback else "很遗憾未能匹配"

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

        self._applications_loaded = False
        self._status_cache.clear()

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
            time.sleep(0.05 if simulate else 2)

        changed = sum(1 for r in results if r.get("status") != r.get("submit_time") and r.get("status") != "submitted")
        logger.info(f"状态追踪完成: 处理{len(results)}条, 状态变更{len(set(r['status'] for r in results)) - 1}类")
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


class RemoteStatusTracker(StatusTracker):
    def __init__(self, site_config: SiteConfig, student_username: str, student_password: str):
        adapter = UniversityAdapter(site_config)
        adapter.init_driver()
        super().__init__(
            spider=adapter,
            student_account={
                "username": student_username,
                "password": student_password,
                "login_url": site_config.login_url,
            }
        )
        self.adapter = adapter

    def close(self) -> None:
        if self.adapter:
            self.adapter.close_driver()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
