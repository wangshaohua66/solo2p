import re
import hashlib
from datetime import datetime
from typing import Any, Dict, List, Set, Tuple

from logger import get_logger
from database import DatabaseManager


logger = get_logger("processor")


EDUCATION_LEVELS = ["博士", "硕士", "研究生", "本科", "大专", "专科", "高中", "中专"]
COMPANY_TYPES = ["国有企业", "民营企业", "外资企业", "合资企业", "事业单位", "政府机关", "其他"]


def clean_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"\s+", " ", str(text)).strip()
    text = text.replace("\u3000", " ")
    return text


def normalize_salary(salary_min, salary_max, unit: str) -> Tuple[int, int, str]:
    if salary_min is None and salary_max is None:
        return 0, 0, "月"
    unit = unit or "月"
    mn = int(salary_min or 0)
    mx = int(salary_max or mn)
    if unit == "年":
        mn = mn // 12 if mn > 0 else mn
        mx = mx // 12 if mx > 0 else mx
        unit = "月"
    elif unit == "时":
        mn = mn * 176 if mn > 0 else mn
        mx = mx * 176 if mx > 0 else mx
        unit = "月"
    return mn, mx, unit


def normalize_education(edu: str) -> str:
    if not edu:
        return ""
    edu = clean_text(edu)
    for level in EDUCATION_LEVELS:
        if level in edu:
            return level
    return ""


def normalize_company_type(text: str) -> str:
    if not text:
        return ""
    text = clean_text(text)
    for t in COMPANY_TYPES:
        if t in text:
            return t
    return ""


def dedupe_fairs(fairs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: Set[str] = set()
    result: List[Dict[str, Any]] = []
    for fair in fairs:
        key = hashlib.md5(
            f"{fair.get('title', '')}|{fair.get('fair_date', '')}|{fair.get('location', '')}".encode()
        ).hexdigest()
        if key in seen:
            logger.debug(f"招聘会去重: {fair.get('title')}")
            continue
        seen.add(key)
        result.append(fair)
    logger.info(f"招聘会去重: 原始{len(fairs)}条, 保留{len(result)}条")
    return result


def dedupe_companies(companies: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: Set[str] = set()
    result: List[Dict[str, Any]] = []
    for c in companies:
        key = hashlib.md5(
            f"{c.get('fair_id', '')}|{c.get('name', '')}|{c.get('booth_number', '')}".encode()
        ).hexdigest()
        if key in seen:
            continue
        seen.add(key)
        c["name"] = clean_text(c.get("name", ""))
        c["booth_number"] = clean_text(c.get("booth_number", ""))
        c["industry"] = clean_text(c.get("industry", ""))
        c["company_type"] = normalize_company_type(c.get("company_type", ""))
        c["contact_phone"] = clean_text(c.get("contact_phone", ""))
        c["contact_email"] = clean_text(c.get("contact_email", "")).lower()
        result.append(c)
    return result


def dedupe_jobs(jobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: Set[str] = set()
    result: List[Dict[str, Any]] = []
    for job in jobs:
        key = hashlib.md5(
            f"{job.get('company_id', '')}|{job.get('title', '')}|{job.get('major', '')}|{job.get('education', '')}".encode()
        ).hexdigest()
        if key in seen:
            continue
        seen.add(key)
        job["title"] = clean_text(job.get("title", ""))
        job["education"] = normalize_education(job.get("education", ""))
        job["major"] = clean_text(job.get("major", ""))
        job["location"] = clean_text(job.get("location", ""))
        mn, mx, unit = normalize_salary(
            job.get("salary_min"), job.get("salary_max"), job.get("salary_unit", "月")
        )
        job["salary_min"] = mn
        job["salary_max"] = mx
        job["salary_unit"] = unit
        result.append(job)
    return result


def process_fair_data(fairs: List[Dict[str, Any]]) -> Tuple[List, List, List]:
    fairs = dedupe_fairs(fairs)
    all_companies: List[Dict[str, Any]] = []
    all_jobs: List[Dict[str, Any]] = []
    for fair in fairs:
        companies = fair.pop("companies", [])
        jobs = fair.pop("jobs", [])
        all_companies.extend(companies)
        all_jobs.extend(jobs)
        fair["title"] = clean_text(fair.get("title", ""))
        fair["location"] = clean_text(fair.get("location", ""))
        fair["organizer"] = clean_text(fair.get("organizer", ""))
    all_companies = dedupe_companies(all_companies)
    all_jobs = dedupe_jobs(all_jobs)
    logger.info(f"数据清洗完成: {len(fairs)}场招聘会, {len(all_companies)}家企业, {len(all_jobs)}个岗位")
    return fairs, all_companies, all_jobs


def save_to_database(fairs: List[Dict[str, Any]], companies: List[Dict[str, Any]],
                     jobs: List[Dict[str, Any]]) -> None:
    db = DatabaseManager()
    for fair in fairs:
        try:
            db.upsert_job_fair(fair)
        except Exception as e:
            logger.error(f"保存招聘会失败 {fair.get('title')}: {e}")
    for c in companies:
        try:
            db.upsert_company(c)
        except Exception as e:
            logger.error(f"保存企业失败 {c.get('name')}: {e}")
    for job in jobs:
        try:
            db.upsert_job(job)
        except Exception as e:
            logger.error(f"保存岗位失败 {job.get('title')}: {e}")
    logger.info(f"数据入库完成: {len(fairs)}场招聘会, {len(companies)}家企业, {len(jobs)}个岗位")


def match_student_jobs(student: Dict[str, Any], jobs: List[Dict[str, Any]],
                       limit: int = 20) -> List[Dict[str, Any]]:
    scored = []
    target_major = student.get("major", "")
    target_edu = student.get("education", "")
    target_salary = student.get("target_salary_min", 0) or 0
    target_industry = student.get("target_industry", "")
    target_position = student.get("target_position", "")

    for job in jobs:
        score = 0
        if job.get("major") and target_major:
            if target_major in job["major"] or job["major"] in target_major:
                score += 40
            elif any(m in job["major"] or job["major"] in m for m in target_major.split("、")):
                score += 30
        if job.get("education") and target_edu:
            edu_order = {e: i for i, e in enumerate(EDUCATION_LEVELS)}
            if edu_order.get(target_edu, 99) <= edu_order.get(job["education"], 99):
                score += 25
        if job.get("salary_max", 0) and target_salary:
            if job["salary_max"] >= target_salary:
                score += 20
            elif job["salary_min"] >= target_salary * 0.8:
                score += 10
        if job.get("title") and target_position:
            if any(kw in job["title"] for kw in target_position.split("、")):
                score += 15
        scored.append((score, job))

    scored.sort(key=lambda x: x[0], reverse=True)
    results = []
    for score, job in scored[:limit]:
        job["match_score"] = score
        results.append(job)
    return results
