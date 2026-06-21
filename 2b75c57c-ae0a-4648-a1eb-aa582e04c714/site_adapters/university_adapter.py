import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

from selenium.webdriver.support import expected_conditions as EC

from spider_base import BaseSpider
from logger import get_logger
from captcha_solver import CaptchaSolver


logger = get_logger("adapter.university")


class UniversityAdapter(BaseSpider):
    SELECTORS = {
        "login_username": "input[name='username'], #username, .username-input",
        "login_password": "input[name='password'], #password, .password-input",
        "login_captcha": "input[name='captcha'], #captcha, .captcha-input",
        "login_captcha_img": "img[src*='captcha'], img[src*='verify'], .captcha-img, #captchaImg",
        "login_submit": "button[type='submit'], .login-btn, #loginBtn",
        "login_error": ".error-msg, .login-error, .message-error, #errorMsg",
        "fair_list_items": ".jobfair-item, .fair-item, .jobfair-list li, table.jobfair-table tr",
        "fair_title": ".title, a.fair-title, h3, .jobfair-name",
        "fair_date": ".date, .fair-date, time, .jobfair-time",
        "fair_location": ".location, .fair-location, .venue",
        "fair_detail_link": "a.detail-link, a[href*='detail'], a[href*='jobfair']",
        "detail_table": "table.company-table, .booth-table, table.job-table",
        "detail_rows": "tr",
        "company_name": "td:nth-child(1), .company-name, td.name",
        "booth_number": "td:nth-child(2), .booth, td.booth",
        "job_title": "td:nth-child(3), .job-title, td.position",
        "job_major": "td:nth-child(4), .major, td.major",
        "job_education": "td:nth-child(5), .education, td.edu",
        "job_salary": "td:nth-child(6), .salary, td.salary",
        "contact_info": "td:nth-child(7), .contact, td.contact, .contact-info",
        "pagination_next": ".next-page, a.next, li.next a",
    }

    def __init__(self, site_config, app_config=None):
        super().__init__(site_config, app_config)
        self._captcha_solver: Optional[CaptchaSolver] = None

    def _get_captcha_solver(self) -> Optional[CaptchaSolver]:
        if self._captcha_solver is None:
            try:
                self._captcha_solver = CaptchaSolver(self.config)
            except Exception as e:
                logger.warning(f"[{self.site.name}] 验证码识别器初始化失败: {e}")
        return self._captcha_solver

    def _solve_captcha(self, captcha_input_el, captcha_img_el) -> bool:
        solver = self._get_captcha_solver()
        if solver is None:
            return False

        img_bytes = solver.get_captcha_from_element(captcha_img_el)
        if not img_bytes:
            logger.warning(f"[{self.site.name}] 获取验证码图片失败")
            return False

        code, confidence = solver.solve_image(img_bytes, site_name=self.site.name)
        if not code:
            logger.warning(f"[{self.site.name}] 验证码识别失败")
            return False

        logger.info(f"[{self.site.name}] 验证码识别: {code} (置信度: {confidence:.2f})")
        try:
            captcha_input_el.clear()
            captcha_input_el.send_keys(code)
            return True
        except Exception as e:
            logger.warning(f"[{self.site.name}] 填入验证码失败: {e}")
            return False

    def _check_login_error(self) -> str:
        err_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["login_error"])
        if err_el is not None:
            text = self.safe_text(err_el)
            if text:
                return text
        return ""

    def _refresh_captcha(self, captcha_img_el) -> None:
        try:
            if captcha_img_el is not None:
                self.driver.execute_script("arguments[0].click();", captcha_img_el)
                time.sleep(1.5)
        except Exception as e:
            logger.debug(f"[{self.site.name}] 刷新验证码失败: {e}")

    def login(self) -> bool:
        if not self.site.need_captcha:
            return self._login_simple()
        return self._login_with_captcha()

    def _login_simple(self) -> bool:
        try:
            logger.info(f"[{self.site.name}] 开始登录: {self.site.login_url}")
            self.safe_get(self.site.login_url)
            self.wait_for_page()

            username_el = self.wait_for_element(By.CSS_SELECTOR, self.SELECTORS["login_username"])
            password_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["login_password"])

            if username_el and self.site.username:
                username_el.clear()
                username_el.send_keys(self.site.username)
            if password_el and self.site.password:
                password_el.clear()
                password_el.send_keys(self.site.password)

            self._submit_login(password_el)
            self.wait_for_page()
            logger.info(f"[{self.site.name}] 登录完成")
            return True
        except Exception as e:
            logger.error(f"[{self.site.name}] 登录失败: {e}")
            return False

    def _submit_login(self, password_el) -> None:
        submit_btn = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["login_submit"])
        if submit_btn:
            submit_btn.click()
        elif password_el:
            password_el.send_keys(Keys.ENTER)
        time.sleep(2)

    def _login_with_captcha(self) -> bool:
        max_attempts = self.config.retry.max_retries if self.config else 3
        solver = self._get_captcha_solver()

        try:
            logger.info(f"[{self.site.name}] 开始登录(含验证码): {self.site.login_url}")
            self.safe_get(self.site.login_url)
            self.wait_for_page()

            username_el = self.wait_for_element(By.CSS_SELECTOR, self.SELECTORS["login_username"])
            password_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["login_password"])
            captcha_input_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["login_captcha"])
            captcha_img_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["login_captcha_img"])

            if username_el and self.site.username:
                username_el.clear()
                username_el.send_keys(self.site.username)
            if password_el and self.site.password:
                password_el.clear()
                password_el.send_keys(self.site.password)

            if captcha_input_el is None or captcha_img_el is None:
                logger.warning(f"[{self.site.name}] 未找到验证码元素，尝试直接登录")
                self._submit_login(password_el)
                return self._verify_login_result()

            for attempt in range(max_attempts):
                try:
                    success = self._solve_captcha(captcha_input_el, captcha_img_el)
                    if not success:
                        logger.warning(f"[{self.site.name}] 验证码识别重试 ({attempt + 1}/{max_attempts})")
                        self._refresh_captcha(captcha_img_el)
                        captcha_input_el.clear()
                        continue

                    self._submit_login(password_el)
                    error_msg = self._check_login_error()

                    if error_msg and ("验证码" in error_msg or "captcha" in error_msg.lower()):
                        logger.warning(f"[{self.site.name}] 验证码错误: {error_msg}")
                        if solver:
                            solver.fail_count += 1
                            if solver.fail_count >= 5:
                                solver._alert_failure(self.site.name)
                        if attempt < max_attempts - 1:
                            self._refresh_captcha(captcha_img_el)
                            captcha_input_el.clear()
                            if password_el:
                                password_el.clear()
                                password_el.send_keys(self.site.password)
                            continue
                    elif error_msg:
                        logger.error(f"[{self.site.name}] 登录失败: {error_msg}")
                        return False
                    else:
                        logger.info(f"[{self.site.name}] 登录成功 (第{attempt + 1}次尝试)")
                        if solver:
                            solver.reset_fail_counter()
                        return True

                except Exception as e:
                    logger.warning(f"[{self.site.name}] 登录尝试 #{attempt + 1} 异常: {e}")
                    if attempt < max_attempts - 1:
                        time.sleep(2)

            logger.error(f"[{self.site.name}] 登录失败: 超过最大重试次数({max_attempts})")
            return False

        except Exception as e:
            logger.error(f"[{self.site.name}] 登录异常: {e}")
            return False

    def _verify_login_result(self) -> bool:
        time.sleep(2)
        error_msg = self._check_login_error()
        if error_msg:
            logger.error(f"[{self.site.name}] 登录失败: {error_msg}")
            return False
        current_url = self.driver.current_url
        if "login" in current_url.lower():
            logger.warning(f"[{self.site.name}] 可能仍在登录页，URL未跳转")
            return False
        return True

    def crawl_job_fairs(self) -> List[Dict[str, Any]]:
        fairs: List[Dict[str, Any]] = []
        try:
            logger.info(f"[{self.site.name}] 开始爬取招聘会列表: {self.site.list_url}")
            self.safe_get(self.site.list_url)
            self.wait_for_page()

            items = self.safe_find_elements(By.CSS_SELECTOR, self.SELECTORS["fair_list_items"])
            logger.info(f"[{self.site.name}] 找到 {len(items)} 条招聘会记录")

            for item in items:
                try:
                    fair = self._parse_fair_item(item)
                    if fair:
                        fairs.append(fair)
                        self._crawl_stats["items_extracted"] += 1
                except Exception as e:
                    logger.warning(f"[{self.site.name}] 解析招聘会条目失败: {e}")
                    self._crawl_stats["errors"] += 1

            self._crawl_stats["pages_crawled"] += 1
            logger.info(f"[{self.site.name}] 成功解析 {len(fairs)} 条招聘会")
        except Exception as e:
            logger.error(f"[{self.site.name}] 爬取招聘会列表失败: {e}")
            self._crawl_stats["errors"] += 1
        return fairs

    def _parse_fair_item(self, item) -> Dict[str, Any]:
        title_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["fair_title"], item)
        title = self.safe_text(title_el)
        if not title:
            title = self.safe_text(item)[:50]

        date_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["fair_date"], item)
        date_text = self.safe_text(date_el)

        loc_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["fair_location"], item)
        location = self.safe_text(loc_el)

        link_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["fair_detail_link"], item)
        if link_el is None:
            link_el = title_el if title_el and title_el.tag_name == "a" else None
        detail_url = self.safe_attr(link_el, "href")
        if detail_url and not detail_url.startswith("http"):
            detail_url = self.site.base_url.rstrip("/") + "/" + detail_url.lstrip("/")

        fair_id = self.gen_id(self.site.name, title, date_text or "", detail_url or "")

        return {
            "fair_id": fair_id,
            "site_name": self.site.name,
            "title": title,
            "fair_date": date_text,
            "location": location,
            "organizer": self.site.name,
            "description": "",
            "detail_url": detail_url,
            "company_count": 0,
            "crawl_time": datetime.now().isoformat(),
            "status": "active",
            "companies": [],
            "jobs": [],
        }

    def crawl_fair_detail(self, fair: Dict[str, Any]) -> Dict[str, Any]:
        if not fair.get("detail_url"):
            return fair

        try:
            logger.info(f"[{self.site.name}] 爬取详情: {fair['title']}")
            self.safe_get(fair["detail_url"])
            self.wait_for_page()
            self._crawl_stats["pages_crawled"] += 1

            table = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["detail_table"])
            if table is None:
                table = self.safe_find_element(By.TAG_NAME, "table")

            companies: List[Dict[str, Any]] = []
            jobs: List[Dict[str, Any]] = []

            if table is not None:
                rows = self.safe_find_elements(By.CSS_SELECTOR, self.SELECTORS["detail_rows"], table)
                for row in rows[1:]:
                    cells = self.safe_find_elements(By.TAG_NAME, "td", row)
                    if len(cells) < 3:
                        continue

                    company_name = self.safe_text(cells[0]) if len(cells) > 0 else ""
                    booth = self.safe_text(cells[1]) if len(cells) > 1 else ""
                    job_title = self.safe_text(cells[2]) if len(cells) > 2 else ""
                    major = self.safe_text(cells[3]) if len(cells) > 3 else ""
                    education = self.safe_text(cells[4]) if len(cells) > 4 else ""
                    salary_text = self.safe_text(cells[5]) if len(cells) > 5 else ""
                    contact = self.safe_text(cells[6]) if len(cells) > 6 else ""

                    if not company_name:
                        continue

                    company_id = self.gen_id(fair["fair_id"], company_name, booth)
                    company = {
                        "company_id": company_id,
                        "fair_id": fair["fair_id"],
                        "name": company_name,
                        "booth_number": booth,
                        "industry": "",
                        "company_type": "",
                        "scale": "",
                        "contact_person": self._extract_contact_person(contact),
                        "contact_phone": self._extract_phone(contact),
                        "contact_email": self._extract_email(contact),
                        "address": "",
                        "description": "",
                    }
                    companies.append(company)

                    if job_title:
                        for single_job in self._split_jobs(job_title):
                            salary_min, salary_max, salary_unit = self._parse_salary(salary_text)
                            job_id = self.gen_id(company_id, single_job, major, education)
                            jobs.append({
                                "job_id": job_id,
                                "company_id": company_id,
                                "fair_id": fair["fair_id"],
                                "title": single_job,
                                "salary_min": salary_min,
                                "salary_max": salary_max,
                                "salary_unit": salary_unit,
                                "education": education,
                                "major": major,
                                "experience": "",
                                "location": fair.get("location", ""),
                                "job_count": 1,
                                "description": "",
                                "requirements": "",
                            })

            fair["companies"] = companies
            fair["jobs"] = jobs
            fair["company_count"] = len(companies)
            logger.info(f"[{self.site.name}] 解析到 {len(companies)} 家企业, {len(jobs)} 个岗位")
        except Exception as e:
            logger.error(f"[{self.site.name}] 爬取详情失败: {e}")
            self._crawl_stats["errors"] += 1
        return fair

    @staticmethod
    def _split_jobs(job_text: str) -> List[str]:
        if not job_text:
            return []
        parts = re.split(r"[、,，;；\s]+", job_text.strip())
        return [p.strip() for p in parts if p.strip()]

    @staticmethod
    def _parse_salary(salary_text: str) -> tuple:
        if not salary_text:
            return None, None, None
        salary_text = salary_text.strip()
        unit = "月"
        if "年" in salary_text:
            unit = "年"
        elif "小时" in salary_text or "时" in salary_text:
            unit = "时"

        nums = re.findall(r"\d+", salary_text.replace(",", ""))
        if len(nums) >= 2:
            return int(nums[0]), int(nums[1]), unit
        elif len(nums) == 1:
            return int(nums[0]), int(nums[0]), unit
        return None, None, unit

    @staticmethod
    def _extract_phone(text: str) -> str:
        if not text:
            return ""
        m = re.search(r"1[3-9]\d{9}", text)
        if m:
            return m.group()
        m = re.search(r"0\d{2,3}-?\d{7,8}", text)
        return m.group() if m else ""

    @staticmethod
    def _extract_email(text: str) -> str:
        if not text:
            return ""
        m = re.search(r"[\w.-]+@[\w.-]+\.\w+", text)
        return m.group() if m else ""

    @staticmethod
    def _extract_contact_person(text: str) -> str:
        if not text:
            return ""
        m = re.search(r"([\u4e00-\u9fa5]{2,3})\s*老师", text)
        if m:
            return m.group(1) + "老师"
        m = re.search(r"联系人[:：]\s*([\u4e00-\u9fa5]{2,3})", text)
        return m.group(1) if m else ""
