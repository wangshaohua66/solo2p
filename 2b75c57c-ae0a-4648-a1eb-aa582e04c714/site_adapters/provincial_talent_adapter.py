import re
import time
from datetime import datetime
from typing import Any, Dict, List

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

from spider_base import BaseSpider
from logger import get_logger


logger = get_logger("adapter.provincial")


class ProvincialTalentAdapter(BaseSpider):
    SELECTORS = {
        "login_username": "#account, input[name='account'], .login-account",
        "login_password": "#password, input[name='password'], .login-password",
        "login_submit": "#loginBtn, .submit-btn, button.login",
        "fair_list": ".fair-list, .jobfair-list, #fairList",
        "fair_items": ".fair-item, .job-fair, .list-item",
        "fair_title": ".title, h3, .fair-name, a.fair-title",
        "fair_meta": ".meta, .fair-info, .info",
        "fair_date": ".date, time, .fair-time",
        "fair_location": ".location, .venue, .place",
        "fair_link": "a[href*='fair'], a.detail, .more a",
        "detail_company_list": ".company-list, #companyList, .exhibitor-list",
        "detail_company_item": ".company-item, .exhibitor-item, .company-card",
        "company_name": ".name, h4, .company-name",
        "company_booth": ".booth, .booth-no, .position-no",
        "company_jobs": ".jobs, .positions, .job-list",
        "job_item": ".job-item, .position-item, li",
        "job_name": ".job-title, .position, .name",
        "job_salary": ".salary, .wage",
        "job_requirements": ".requirements, .req, .condition",
        "company_contact": ".contact, .contact-info, .phone-email",
        "page_next": ".next, .pagination .next a, li.next",
    }

    def login(self) -> bool:
        try:
            logger.info(f"[{self.site.name}] 开始登录: {self.site.login_url}")
            self.safe_get(self.site.login_url)
            self.wait_for_page()

            username_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["login_username"])
            password_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["login_password"])

            if username_el and self.site.username:
                username_el.clear()
                username_el.send_keys(self.site.username)
            if password_el and self.site.password:
                password_el.clear()
                password_el.send_keys(self.site.password)

            submit_btn = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["login_submit"])
            if submit_btn:
                submit_btn.click()
            elif password_el:
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

            items = self.safe_find_elements(By.CSS_SELECTOR, self.SELECTORS["fair_items"])
            if not items:
                items = self.safe_find_elements(By.CSS_SELECTOR, "li, .item")
            logger.info(f"[{self.site.name}] 找到 {len(items)} 条招聘会记录")

            for item in items:
                try:
                    fair = self._parse_fair_item(item)
                    if fair and fair.get("title"):
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
            title = self.safe_text(item)[:80]
        if not title:
            return {}

        date_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["fair_date"], item)
        date_text = self.safe_text(date_el)
        if not date_text:
            meta_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["fair_meta"], item)
            meta_text = self.safe_text(meta_el)
            m = re.search(r"(\d{4}[-/]\d{1,2}[-/]\d{1,2})", meta_text or self.safe_text(item))
            date_text = m.group(1) if m else ""

        loc_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["fair_location"], item)
        location = self.safe_text(loc_el)

        link_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["fair_link"], item)
        if link_el is None and title_el is not None and title_el.tag_name == "a":
            link_el = title_el
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
            "organizer": "省级人才交流中心",
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
            self.scroll_to_bottom()
            self._crawl_stats["pages_crawled"] += 1

            companies: List[Dict[str, Any]] = []
            jobs: List[Dict[str, Any]] = []

            company_items = self.safe_find_elements(By.CSS_SELECTOR, self.SELECTORS["detail_company_item"])
            if not company_items:
                company_items = self.safe_find_elements(By.CSS_SELECTOR, "table tr")

            for item in company_items:
                try:
                    self._parse_company_item(item, fair, companies, jobs)
                except Exception as e:
                    logger.warning(f"[{self.site.name}] 解析企业条目失败: {e}")

            fair["companies"] = companies
            fair["jobs"] = jobs
            fair["company_count"] = len(companies)
            logger.info(f"[{self.site.name}] 解析到 {len(companies)} 家企业, {len(jobs)} 个岗位")
        except Exception as e:
            logger.error(f"[{self.site.name}] 爬取详情失败: {e}")
            self._crawl_stats["errors"] += 1
        return fair

    def _parse_company_item(self, item, fair: Dict[str, Any],
                            companies: List[Dict[str, Any]], jobs: List[Dict[str, Any]]) -> None:
        name_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["company_name"], item)
        company_name = self.safe_text(name_el)
        if not company_name:
            tds = self.safe_find_elements(By.TAG_NAME, "td", item)
            if tds:
                company_name = self.safe_text(tds[0])
        if not company_name or len(company_name) < 2:
            return

        booth_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["company_booth"], item)
        booth = self.safe_text(booth_el)

        contact_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["company_contact"], item)
        contact_text = self.safe_text(contact_el)

        company_id = self.gen_id(fair["fair_id"], company_name, booth)
        company = {
            "company_id": company_id,
            "fair_id": fair["fair_id"],
            "name": company_name,
            "booth_number": booth,
            "industry": "",
            "company_type": "",
            "scale": "",
            "contact_person": self._extract_name(contact_text),
            "contact_phone": self._extract_phone(contact_text),
            "contact_email": self._extract_email(contact_text),
            "address": "",
            "description": "",
        }
        companies.append(company)

        job_items = self.safe_find_elements(By.CSS_SELECTOR, self.SELECTORS["job_item"], item)
        if job_items:
            for jitem in job_items:
                jname_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["job_name"], jitem)
                jname = self.safe_text(jname_el)
                if not jname:
                    jname = self.safe_text(jitem)[:60]
                if not jname:
                    continue

                salary_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["job_salary"], jitem)
                req_el = self.safe_find_element(By.CSS_SELECTOR, self.SELECTORS["job_requirements"], jitem)
                salary_text = self.safe_text(salary_el)
                req_text = self.safe_text(req_el)

                salary_min, salary_max, salary_unit = self._parse_salary(salary_text)
                edu = self._extract_education(req_text)
                major = self._extract_major(req_text)

                job_id = self.gen_id(company_id, jname, major or "", edu or "")
                jobs.append({
                    "job_id": job_id,
                    "company_id": company_id,
                    "fair_id": fair["fair_id"],
                    "title": jname,
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "salary_unit": salary_unit,
                    "education": edu,
                    "major": major,
                    "experience": "",
                    "location": fair.get("location", ""),
                    "job_count": 1,
                    "description": req_text,
                    "requirements": req_text,
                })

    @staticmethod
    def _parse_salary(salary_text: str) -> tuple:
        if not salary_text:
            return None, None, None
        salary_text = salary_text.strip()
        unit = "月"
        if "万" in salary_text and ("年" in salary_text or "年薪" in salary_text):
            unit = "年"
        elif "万/月" in salary_text or "K" in salary_text or "k" in salary_text:
            unit = "月"

        salary_text = salary_text.replace("千", "000").replace("K", "000").replace("k", "000").replace("万", "0000")
        nums = re.findall(r"\d+\.?\d*", salary_text.replace(",", ""))
        if len(nums) >= 2:
            lo, hi = float(nums[0]), float(nums[1])
            if lo < 1000:
                lo *= 1000
                hi *= 1000
            return int(lo), int(hi), unit
        elif len(nums) == 1:
            val = float(nums[0])
            if val < 1000:
                val *= 1000
            return int(val), int(val), unit
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
    def _extract_name(text: str) -> str:
        if not text:
            return ""
        m = re.search(r"([\u4e00-\u9fa5]{2,3})(?:老师|先生|女士)?", text)
        return m.group(1) if m else ""

    @staticmethod
    def _extract_education(text: str) -> str:
        if not text:
            return ""
        for level in ["博士", "硕士", "研究生", "本科", "大专", "专科", "高中"]:
            if level in text:
                return level
        return ""

    @staticmethod
    def _extract_major(text: str) -> str:
        if not text:
            return ""
        m = re.search(r"专业[:：要求]*\s*([\u4e00-\u9fa5、,，]+)", text)
        return m.group(1) if m else ""
