import os
import time
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from tqdm import tqdm

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import TimeoutException, NoSuchElementException

from spider_base import BaseSpider
from logger import get_logger
from database import DatabaseManager
from site_adapters.university_adapter import UniversityAdapter
from config import load_config, SiteConfig


logger = get_logger("submitter")

SUBMIT_SELECTORS = {
    "student_login_username": "input[name='username'], #username, .student-username",
    "student_login_password": "input[name='password'], #password, .student-password",
    "student_login_submit": "button[type='submit'], .login-btn, #studentLoginBtn",
    "job_apply_btn": (
        "button.apply-btn, .apply-button, .btn-apply, a.apply-link, "
        "[onclick*='apply'], [id*='apply'], button[type='apply']"
    ),
    "apply_form_name": "input[name='name'], #name, .form-name",
    "apply_form_phone": "input[name='phone'], #phone, .form-phone",
    "apply_form_email": "input[name='email'], #email, .form-email",
    "apply_form_major": "input[name='major'], #major, .form-major",
    "apply_form_education": ("select[name='education'], #education, .form-education, "
                             "input[name='education']"),
    "apply_form_resume": ("input[type='file'], #resumeFile, .resume-upload, "
                          "input[name='resume'], input[name='file']"),
    "apply_form_submit": ("button[type='submit'], .submit-btn, #submitBtn, "
                          "button.submit-apply, .confirm-btn"),
    "apply_success_msg": (".success-msg, .apply-success, .success-message, "
                          "#successMsg, .toast-success"),
    "apply_error_msg": ".error-msg, .apply-error, .error-message, #errorMsg",
    "my_applications_link": (".my-applications, a[href*='application'], "
                             "a[href*='myjob'], .student-center"),
    "application_status": ".status, .apply-status, .job-status, .resume-status",
    "application_list_items": ".application-item, .apply-record, .record-item, li",
}


class ResumeSubmitter:
    def __init__(self, spider: Optional[BaseSpider] = None, student_account: Dict[str, str] = None):
        self.spider = spider
        self.db = DatabaseManager()
        self.student_account = student_account or {}
        self._logged_in = False
        self._login_url = ""

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

        if not simulate:
            try:
                success = self._do_submit(student, job)
                if success:
                    submission["status"] = "submitted"
                    submission["feedback"] = "投递成功"
                else:
                    submission["status"] = "failed"
                    submission["feedback"] = "投递失败"
            except Exception as e:
                submission["status"] = "failed"
                submission["feedback"] = str(e)
                logger.error(f"投递失败 student={student.get('name')} job={job.get('title')}: {e}")
        else:
            logger.debug(f"[模拟] 投递: {student.get('name')} -> {job.get('title')}")
            time.sleep(0.2)

        try:
            self.db.upsert_submission(submission)
        except Exception as e:
            logger.error(f"保存投递记录失败: {e}")

        return submission

    def _ensure_student_login(self) -> bool:
        if self._logged_in:
            return True
        if self.spider is None:
            logger.warning("无可用爬虫实例，无法执行真实投递")
            return False

        username = self.student_account.get("username", "")
        password = self.student_account.get("password", "")
        login_url = self.student_account.get("login_url", "")

        if not (username and password):
            logger.warning("学生账号信息不完整，跳过登录")
            return False

        try:
            if login_url:
                self.spider.safe_get(login_url)
            else:
                login_url = getattr(self.spider.site, "login_url", "")
                if login_url:
                    self.spider.safe_get(login_url)

            self.spider.wait_for_page()

            username_el = self.spider.safe_find_element(
                By.CSS_SELECTOR, SUBMIT_SELECTORS["student_login_username"]
            )
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

                current_url = self.spider.driver.current_url
                if "login" not in current_url.lower() or username_el is None:
                    self._logged_in = True
                    logger.info(f"学生登录成功: {username}")
                    return True
                else:
                    logger.warning("学生登录可能失败，URL仍包含login")
                    return False

            logger.warning("未找到学生登录表单")
            return False
        except Exception as e:
            logger.error(f"学生登录异常: {e}")
            return False

    def _navigate_to_job(self, job: Dict[str, Any]) -> bool:
        if self.spider is None:
            return False

        detail_url = job.get("detail_url", "")
        if detail_url:
            try:
                self.spider.safe_get(detail_url)
                self.spider.wait_for_page()
                return True
            except Exception as e:
                logger.warning(f"导航到岗位详情页失败: {e}")

        fair_id = job.get("fair_id", "")
        company_id = job.get("company_id", "")
        job_title = job.get("title", "")

        if fair_id and job_title:
            try:
                fairs = self.db.query_all(
                    "SELECT detail_url FROM job_fairs WHERE fair_id=?", (fair_id,)
                )
                if fairs and fairs[0]["detail_url"]:
                    self.spider.safe_get(fairs[0]["detail_url"])
                    self.spider.wait_for_page()
                    return True
            except Exception as e:
                logger.debug(f"通过招聘会ID导航失败: {e}")

        logger.warning(f"无法导航到岗位页面: {job_title}")
        return False

    def _fill_apply_form(self, student: Dict[str, Any], resume_path: str) -> bool:
        if self.spider is None:
            return False

        try:
            name_input = self.spider.safe_find_element(
                By.CSS_SELECTOR, SUBMIT_SELECTORS["apply_form_name"]
            )
            if name_input and student.get("name"):
                name_input.clear()
                name_input.send_keys(student["name"])

            phone_input = self.spider.safe_find_element(
                By.CSS_SELECTOR, SUBMIT_SELECTORS["apply_form_phone"]
            )
            if phone_input and student.get("phone"):
                phone_input.clear()
                phone_input.send_keys(student["phone"])

            email_input = self.spider.safe_find_element(
                By.CSS_SELECTOR, SUBMIT_SELECTORS["apply_form_email"]
            )
            if email_input and student.get("email"):
                email_input.clear()
                email_input.send_keys(student["email"])

            major_input = self.spider.safe_find_element(
                By.CSS_SELECTOR, SUBMIT_SELECTORS["apply_form_major"]
            )
            if major_input and student.get("major"):
                major_input.clear()
                major_input.send_keys(student["major"])

            education_el = self.spider.safe_find_element(
                By.CSS_SELECTOR, SUBMIT_SELECTORS["apply_form_education"]
            )
            if education_el and student.get("education"):
                tag = education_el.tag_name.lower()
                if tag == "select":
                    from selenium.webdriver.support.ui import Select
                    try:
                        select = Select(education_el)
                        select.select_by_visible_text(student["education"])
                    except Exception:
                        try:
                            select.select_by_value(student["education"])
                        except Exception:
                            pass
                elif tag == "input":
                    education_el.clear()
                    education_el.send_keys(student["education"])

            resume_file = student.get("resume_path") or resume_path
            if resume_file and os.path.exists(resume_file):
                file_input = self.spider.safe_find_element(
                    By.CSS_SELECTOR, SUBMIT_SELECTORS["apply_form_resume"]
                )
                if file_input:
                    abs_path = os.path.abspath(resume_file)
                    file_input.send_keys(abs_path)
                    logger.debug(f"简历文件已上传: {abs_path}")
                else:
                    logger.debug("未找到简历上传控件")

            return True
        except Exception as e:
            logger.error(f"填写投递表单失败: {e}")
            return False

    def _submit_form_and_verify(self) -> bool:
        if self.spider is None:
            return False

        try:
            submit_btn = self.spider.safe_find_element(
                By.CSS_SELECTOR, SUBMIT_SELECTORS["apply_form_submit"]
            )
            if submit_btn is None:
                apply_btn = self.spider.safe_find_element(
                    By.CSS_SELECTOR, SUBMIT_SELECTORS["job_apply_btn"]
                )
                if apply_btn:
                    apply_btn.click()
                    time.sleep(1)
                    submit_btn = self.spider.safe_find_element(
                        By.CSS_SELECTOR, SUBMIT_SELECTORS["apply_form_submit"]
                    )

            if submit_btn is not None:
                submit_btn.click()
            else:
                logger.warning("未找到提交按钮")
                return False

            time.sleep(3)

            success_el = self.spider.safe_find_element(
                By.CSS_SELECTOR, SUBMIT_SELECTORS["apply_success_msg"]
            )
            if success_el and self.spider.safe_text(success_el):
                return True

            error_el = self.spider.safe_find_element(
                By.CSS_SELECTOR, SUBMIT_SELECTORS["apply_error_msg"]
            )
            if error_el and self.spider.safe_text(error_el):
                logger.warning(f"投递失败提示: {self.spider.safe_text(error_el)}")
                return False

            current_url = self.spider.driver.current_url
            if "success" in current_url.lower() or "apply" not in current_url.lower():
                return True

            logger.debug("无法确定投递结果，默认视为成功")
            return True

        except Exception as e:
            logger.error(f"提交表单异常: {e}")
            return False

    def _do_submit(self, student: Dict[str, Any], job: Dict[str, Any]) -> bool:
        if self.spider is None:
            raise RuntimeError("无可用爬虫实例，无法执行真实投递")

        logger.info(f"真实投递: {student.get('name')} -> {job.get('title')}")

        if not self._ensure_student_login():
            logger.warning("学生登录未完成，继续尝试投递")

        if not self._navigate_to_job(job):
            logger.warning("无法导航到岗位页面")
            return False

        apply_btn = self.spider.safe_find_element(
            By.CSS_SELECTOR, SUBMIT_SELECTORS["job_apply_btn"]
        )
        if apply_btn is None:
            logger.warning("未找到投递按钮，可能已投递或不可投递")
            return False

        try:
            apply_btn.click()
            time.sleep(2)
        except Exception as e:
            logger.debug(f"点击投递按钮异常: {e}")

        resume_path = student.get("resume_path", "")
        if not self._fill_apply_form(student, resume_path):
            logger.warning("填写表单失败")
            return False

        return self._submit_form_and_verify()

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


class StudentPortalSubmitter(ResumeSubmitter):
    def __init__(self, site_config: SiteConfig, student_username: str, student_password: str):
        adapter = UniversityAdapter(site_config)
        adapter.init_driver()
        super().__init__(spider=adapter, student_account={
            "username": student_username,
            "password": student_password,
            "login_url": site_config.login_url,
        })
        self.adapter = adapter

    def close(self) -> None:
        if self.adapter:
            self.adapter.close_driver()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
