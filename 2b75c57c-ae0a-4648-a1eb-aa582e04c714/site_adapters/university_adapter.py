import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

from spider_base import BaseSpider
from logger import get_logger


logger = get_logger("adapter.university")


class UniversityAdapter(BaseSpider):
    SELECTORS = {
        "login_username": "input[name='username'], #username, .username-input",
        "login_password": "input[name='password'], #password, .password-input",
        "login_captcha": "input[name='captcha'], #captcha, .captcha-input",
        "login_submit": "button[type='submit'], .login-btn, #loginBtn",
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

    def login(self) -> bool:
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

            if self.site.need_captcha:
                captcha_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["login_captcha"])
                if captcha_el:
                    logger.warning(f"[{self.site.name}] 需要人工输入验证码，等待15秒...")
                    time.sleep(15)

            submit_btn = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["login_submit"])
            if submit_btn:
                submit_btn.click()
            else:
                if password_el:
                    password_el.send_keys(Keys.ENTER)

            self.wait_for_page()
            logger.info(f"[{self.site.name}] 登录完成")
            return True
        except Exception as e:
            logger.error(f"[{self.site.name}] 登录失败: {e}")
            return False

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
