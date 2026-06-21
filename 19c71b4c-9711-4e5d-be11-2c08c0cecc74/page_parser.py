import logging
import re
import time
from datetime import datetime
from typing import List, Dict, Optional, Any
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from config import settings

logger = logging.getLogger(__name__)

REQUIRED_LIST_FIELDS = ["job_url", "job_title"]
REQUIRED_DETAIL_FIELDS = ["job_title"]
CRITICAL_DETAIL_FIELDS = [
    "job_title", "company_name", "work_location", "recruit_count",
    "publish_date", "deadline_date",
]


class Job:
    def __init__(self):
        self.job_id: str = ""
        self.job_title: str = ""
        self.company_name: str = ""
        self.work_location: str = ""
        self.salary_range: str = ""
        self.education: str = ""
        self.experience: str = ""
        self.recruit_count: str = ""
        self.publish_date: str = ""
        self.deadline_date: str = ""
        self.job_description: str = ""
        self.job_url: str = ""
        self.source: str = ""
        self.crawl_time: str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "job_title": self.job_title,
            "company_name": self.company_name,
            "work_location": self.work_location,
            "salary_range": self.salary_range,
            "education": self.education,
            "experience": self.experience,
            "recruit_count": self.recruit_count,
            "publish_date": self.publish_date,
            "deadline_date": self.deadline_date,
            "job_description": self.job_description,
            "job_url": self.job_url,
            "source": self.source,
            "crawl_time": self.crawl_time,
        }

    def generate_id(self) -> str:
        raw = f"{self.job_title}|{self.company_name}|{self.work_location}|{self.publish_date}"
        import hashlib

        return hashlib.md5(raw.encode("utf-8")).hexdigest()


class PageParser:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or settings.crawler.base_url

    def parse_job_list(self, html: str) -> List[Dict[str, str]]:
        logger.debug("Parsing job list page")
        soup = BeautifulSoup(html, "lxml")
        jobs: List[Dict[str, str]] = []

        list_selectors = [
            "div.job-list ul li",
            "div.job-list div.job-item",
            "ul.job-list li",
            "div.job-item",
            "li.job-item",
            "div.jobs div.item",
            "table.job-list tr",
        ]

        job_items = []
        for selector in list_selectors:
            items = soup.select(selector)
            if items:
                logger.debug("Found job list with selector: %s, count=%d", selector, len(items))
                job_items = items
                break

        if not job_items:
            logger.warning("No job list items found with common selectors")
            return jobs

        for item in job_items:
            try:
                job_info = self._extract_list_item(item)
                if job_info is None:
                    continue
                missing_required = [
                    f for f in REQUIRED_LIST_FIELDS
                    if not job_info.get(f)
                ]
                if missing_required:
                    logger.warning(
                        "List item skipped: required fields missing %s | raw_html=%s",
                        missing_required,
                        str(item)[:200].replace("\n", " "),
                    )
                    continue
                if job_info.get("job_url"):
                    jobs.append(job_info)
            except Exception as e:
                logger.warning("Error parsing job list item: %s", str(e))
                continue

        logger.info("Parsed %d jobs from list page", len(jobs))
        return jobs

    def _extract_list_item(self, item) -> Optional[Dict[str, str]]:
        result: Dict[str, str] = {}

        link = item.find("a", href=True)
        if link:
            result["job_url"] = urljoin(self.base_url, link["href"])
            result["job_title"] = self._clean_text(link.get_text())
        else:
            logger.debug(
                "No <a href> link found in list item; raw=%s",
                str(item)[:150].replace("\n", " "),
            )

        title_selectors = [".job-title", ".title", "h3", "h4", ".name", ".position"]
        for sel in title_selectors:
            el = item.select_one(sel)
            if el and not result.get("job_title"):
                result["job_title"] = self._clean_text(el.get_text())
                break

        if not result.get("job_title"):
            all_text = self._clean_text(item.get_text())
            if all_text and len(all_text) >= 2:
                result["job_title"] = all_text[:60]
                logger.debug(
                    "Falling back job_title to extracted text fragment: '%s'",
                    result["job_title"],
                )

        company_selectors = [".company", ".company-name", ".org-name", ".employer"]
        for sel in company_selectors:
            el = item.select_one(sel)
            if el:
                result["company_name"] = self._clean_text(el.get_text())
                break
        if not result.get("company_name"):
            logger.debug("Missing optional field: company_name for item title=%s", result.get("job_title"))

        location_selectors = [".location", ".work-location", ".place", ".area", ".address"]
        for sel in location_selectors:
            el = item.select_one(sel)
            if el:
                result["work_location"] = self._clean_text(el.get_text())
                break
        if not result.get("work_location"):
            logger.debug("Missing optional field: work_location for item title=%s", result.get("job_title"))

        salary_selectors = [".salary", ".wage", ".pay", ".price"]
        for sel in salary_selectors:
            el = item.select_one(sel)
            if el:
                result["salary_range"] = self._clean_text(el.get_text())
                break
        if not result.get("salary_range"):
            logger.debug("Missing optional field: salary_range for item title=%s", result.get("job_title"))

        date_selectors = [".publish-date", ".date", ".time", ".publish-time", ".create-time"]
        for sel in date_selectors:
            el = item.select_one(sel)
            if el:
                result["publish_date"] = self._clean_text(el.get_text())
                break
        if not result.get("publish_date"):
            logger.debug("Missing optional field: publish_date for item title=%s", result.get("job_title"))

        return result

    def parse_job_detail(self, html: str, job_url: str = "") -> Job:
        logger.debug("Parsing job detail page: %s", job_url)
        soup = BeautifulSoup(html, "lxml")
        job = Job()
        job.job_url = job_url

        field_selectors = {
            "job_title": [".job-title", "h1.job-title", "h1", ".title h1", ".position-name"],
            "company_name": [".company-name", ".company", ".org-name", ".employer-name", "div.company h2"],
            "work_location": [".work-location", ".location", ".work-place", ".place", ".address"],
            "salary_range": [".salary", ".wage", ".pay", ".salary-range"],
            "education": [".education", ".edu", ".degree", ".education-requirement"],
            "experience": [".experience", ".work-experience", ".exp", ".experience-requirement"],
            "recruit_count": [".recruit-count", ".hire-count", ".headcount", ".num", ".people-count", ".number"],
            "publish_date": [".publish-date", ".publish-time", ".release-date", ".date", ".create-time"],
            "deadline_date": [".deadline", ".end-date", ".close-date", ".expire-date", ".apply-deadline"],
            "job_description": [".job-description", ".description", ".job-detail", ".content", ".job-content", ".detail-content"],
        }

        for field, selectors in field_selectors.items():
            for sel in selectors:
                el = soup.select_one(sel)
                if el:
                    text = self._clean_text(el.get_text(separator="\n", strip=True))
                    if text:
                        setattr(job, field, text)
                        break

        job = self._parse_text_fields(soup.get_text(), job)

        if not job.job_title:
            title_tag = soup.find("title")
            if title_tag:
                job.job_title = self._clean_text(title_tag.get_text())
                logger.debug("Using <title> as fallback job_title: '%s'", job.job_title)

        missing_required = [
            f for f in REQUIRED_DETAIL_FIELDS
            if not getattr(job, f, "")
        ]
        if missing_required:
            logger.warning(
                "Job detail missing REQUIRED fields %s | url=%s | title=%s",
                missing_required, job_url, job.job_title,
            )

        missing_critical = [
            f for f in CRITICAL_DETAIL_FIELDS
            if f not in missing_required and not getattr(job, f, "")
        ]
        if missing_critical:
            logger.info(
                "Job detail has empty non-required critical fields %s | url=%s | title=%s",
                missing_critical, job_url, job.job_title,
            )

        if missing_required and not job.job_id:
            try:
                job.job_id = job.generate_id()
            except Exception as e:
                logger.warning("Failed to generate job_id: %s | url=%s", str(e), job_url)
                import hashlib
                job.job_id = hashlib.md5(
                    f"{job_url}|{time.time()}".encode("utf-8")
                ).hexdigest()

        job.job_id = job.generate_id() if not job.job_id else job.job_id
        job.source = self.base_url
        job.crawl_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        logger.debug("Parsed job: %s - %s", job.job_title, job.company_name)
        return job

    def _parse_text_fields(self, text: str, job: Job) -> Job:
        patterns = {
            "work_location": [
                r"工作地点[：:]\s*([^\n\r，,；;]+)",
                r"工作地点\s*([^\n\r，,；;]+)",
                r"地点[：:]\s*([^\n\r，,；;]+)",
            ],
            "salary_range": [
                r"薪资[：:]\s*([^\n\r，,；;]+)",
                r"薪酬[：:]\s*([^\n\r，,；;]+)",
                r"工资[：:]\s*([^\n\r，,；;]+)",
            ],
            "education": [
                r"学历要求?[：:]\s*([^\n\r，,；;]+)",
                r"学历[：:]\s*([^\n\r，,；;]+)",
            ],
            "experience": [
                r"工作经验[：:]\s*([^\n\r，,；;]+)",
                r"经验要求?[：:]\s*([^\n\r，,；;]+)",
                r"经验[：:]\s*([^\n\r，,；;]+)",
            ],
            "recruit_count": [
                r"招聘人数[：:]\s*([^\n\r，,；;]+)",
                r"招\s*(\d+)\s*人",
                r"人数[：:]\s*([^\n\r，,；;]+)",
            ],
            "publish_date": [
                r"发布日期[：:]\s*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)",
                r"发布时间[：:]\s*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)",
            ],
            "deadline_date": [
                r"截止日期[：:]\s*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)",
                r"报名截止[：:]\s*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)",
            ],
        }

        for field, regexes in patterns.items():
            current_value = getattr(job, field, "")
            if current_value:
                continue
            for pattern in regexes:
                m = re.search(pattern, text)
                if m:
                    setattr(job, field, self._clean_text(m.group(1)))
                    break

        return job

    def extract_pagination_links(self, html: str) -> List[str]:
        logger.debug("Extracting pagination links")
        soup = BeautifulSoup(html, "lxml")
        links: List[str] = []

        pagination_selectors = [".pagination a", ".pager a", "div.page a", "ul.pagination li a"]
        for sel in pagination_selectors:
            for a in soup.select(sel):
                href = a.get("href")
                if href and "javascript" not in href.lower():
                    full_url = urljoin(self.base_url, href)
                    if full_url not in links:
                        links.append(full_url)
            if links:
                break

        return links

    @staticmethod
    def _clean_text(text: str) -> str:
        if not text:
            return ""
        text = re.sub(r"\s+", " ", text)
        text = text.strip()
        return text
