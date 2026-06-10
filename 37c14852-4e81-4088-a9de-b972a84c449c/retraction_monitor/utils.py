import re
import hashlib
import json
from datetime import datetime, timezone
from typing import Optional, List, Tuple, Dict
import logging
import os
import uuid

logger = logging.getLogger(__name__)


def normalize_doi(doi: Optional[str]) -> Optional[str]:
    if not doi:
        return None
    doi = doi.strip().lower()
    for prefix in ["https://doi.org/", "http://doi.org/", "doi:", "urn:doi:"]:
        if doi.startswith(prefix):
            doi = doi[len(prefix):]
    doi = re.sub(r"[<>\"' ]", "", doi)
    doi = doi.rstrip(".,;:/")
    if "/" not in doi:
        return None
    if not re.match(r"^10\.\d{4,9}/[-._;()/:a-z0-9]+$", doi):
        return None
    return doi


def generate_simhash(
    title: str = None,
    authors: List[str] = None,
    journal: str = None,
    year: int = None,
    abstract: str = None,
    f: int = 64,
) -> Optional[str]:
    features = []
    if title:
        clean_title = re.sub(r"[^\w\s]", "", title.lower())
        words = clean_title.split()
        features.extend([(f"t:{w}", 3) for w in words if len(w) > 2])
    if authors:
        for author in authors[:5]:
            clean_author = re.sub(r"[^\w]", "", author.lower())
            if clean_author:
                features.append((f"a:{clean_author}", 2))
    if journal:
        clean_journal = re.sub(r"[^\w\s]", "", journal.lower())
        for word in clean_journal.split():
            if len(word) > 3:
                features.append((f"j:{word}", 1))
    if year:
        features.append((f"y:{year}", 2))
    if abstract:
        clean_abstract = re.sub(r"[^\w\s]", "", abstract.lower())
        words = clean_abstract.split()
        word_counts = {}
        for w in words:
            if len(w) > 3:
                word_counts[w] = word_counts.get(w, 0) + 1
        for w, c in sorted(word_counts.items(), key=lambda x: -x[1])[:20]:
            features.append((f"abs:{w}", min(c, 3)))
    if not features:
        return None
    v = [0] * f
    for feature, weight in features:
        h = int(hashlib.md5(feature.encode("utf-8")).hexdigest(), 16)
        for i in range(f):
            if h & (1 << i):
                v[i] += weight
            else:
                v[i] -= weight
    fingerprint = 0
    for i in range(f):
        if v[i] > 0:
            fingerprint |= 1 << i
    return format(fingerprint, f"0{f//4}x")


def hamming_distance_hex(h1: str, h2: str) -> int:
    return bin(int(h1, 16) ^ int(h2, 16)).count("1")


def generate_content_hash(
    title: str = None,
    authors: str = None,
    retraction_reason: str = None,
    retraction_date: str = None,
) -> Optional[str]:
    components = []
    if title:
        components.append(re.sub(r"\s+", "", title.lower()))
    if authors:
        components.append(re.sub(r"\s+", "", authors.lower()))
    if retraction_reason:
        components.append(re.sub(r"\s+", "", retraction_reason.lower()))
    if retraction_date:
        components.append(retraction_date[:10])
    if not components:
        return None
    content = "|".join(components)
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


def generate_record_id(source: str, identifier: str) -> str:
    raw = f"{source}:{identifier}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def parse_authors(authors_str: str) -> List[str]:
    if not authors_str:
        return []
    authors_str = authors_str.strip()
    parts = re.split(r"[,;]| and ", authors_str)
    authors = []
    for part in parts:
        author = part.strip()
        if author:
            author = re.sub(r"\s+", " ", author)
            authors.append(author)
    return authors


SEVERITY_RULES: Dict[str, Tuple[int, str]] = {
    "fraud": (10, "high"),
    "data fabrication": (10, "high"),
    "data falsification": (10, "high"),
    "fabrication of data": (10, "high"),
    "falsification of data": (10, "high"),
    "造假": (10, "high"),
    "伪造数据": (10, "high"),
    "篡改数据": (10, "high"),
    "数据造假": (10, "high"),
    "image manipulation": (9, "high"),
    "figure manipulation": (9, "high"),
    "图片造假": (9, "high"),
    "图片篡改": (9, "high"),
    "plagiarism": (9, "high"),
    "抄袭": (9, "high"),
    "剽窃": (9, "high"),
    "duplicate publication": (8, "high"),
    "redundant publication": (8, "high"),
    "重复发表": (8, "high"),
    "一稿多投": (8, "high"),
    "concerns about data": (8, "high"),
    "undisclosed conflict of interest": (7, "high"),
    "利益冲突未披露": (7, "high"),
    "ethical concerns": (7, "high"),
    "ethical approval": (7, "high"),
    "伦理问题": (7, "high"),
    "non-reproducible": (6, "medium"),
    "not reproducible": (6, "medium"),
    "results cannot be reproduced": (6, "medium"),
    "无法重复": (6, "medium"),
    "不可复现": (6, "medium"),
    "unreliable data": (6, "medium"),
    "data reliability": (6, "medium"),
    "error in data": (5, "medium"),
    "error in analysis": (5, "medium"),
    "error in figures": (5, "medium"),
    "错误": (5, "medium"),
    "数据错误": (5, "medium"),
    "statistical error": (4, "medium"),
    "统计错误": (4, "medium"),
    "correction": (3, "low"),
    "勘误": (3, "low"),
    "更正": (3, "low"),
    "erratum": (3, "low"),
    "corrigendum": (3, "low"),
    "typo": (2, "low"),
    "排版错误": (2, "low"),
    "withdrawn by author": (5, "medium"),
    "作者撤稿": (5, "medium"),
    "publisher error": (3, "low"),
    "出版社错误": (3, "low"),
}

RETRACTION_TYPES = [
    "retraction",
    "撤稿",
    "withdrawal",
    "expression of concern",
    "关注声明",
    "editorial expression of concern",
    "correction",
    "勘误",
    "更正",
    "erratum",
    "corrigendum",
    "retraction and replacement",
    "撤稿并替换",
]


def categorize_retraction_reason(reason: str) -> List[str]:
    if not reason:
        return []
    reason_lower = reason.lower()
    categories = []
    if any(k in reason_lower for k in ["fraud", "fabrication", "falsification", "造假", "伪造数据", "篡改数据"]):
        categories.append("学术不端-数据造假")
    if any(k in reason_lower for k in ["plagiarism", "抄袭", "剽窃"]):
        categories.append("学术不端-抄袭")
    if any(k in reason_lower for k in ["image manipulation", "figure manipulation", "图片造假", "图片篡改"]):
        categories.append("学术不端-图片伪造")
    if any(k in reason_lower for k in ["duplicate", "redundant", "重复发表", "一稿多投"]):
        categories.append("学术不端-重复发表")
    if any(k in reason_lower for k in ["ethical", "伦理"]):
        categories.append("伦理问题")
    if any(k in reason_lower for k in ["conflict of interest", "利益冲突"]):
        categories.append("利益冲突")
    if any(k in reason_lower for k in ["reproduc", "重复", "复现"]):
        categories.append("可重复性问题")
    if any(k in reason_lower for k in ["error", "mistake", "错误", "erratum", "corrigendum"]):
        categories.append("技术错误")
    if any(k in reason_lower for k in ["correction", "勘误", "更正"]):
        categories.append("勘误")
    if any(k in reason_lower for k in ["withdrawn by author", "作者撤稿"]):
        categories.append("作者主动撤稿")
    if not categories:
        categories.append("其他原因")
    return categories


def assess_severity(reason: str, retraction_type: str = "retraction") -> Tuple[int, str]:
    if not reason:
        return 5, "medium"
    reason_lower = reason.lower()
    type_lower = (retraction_type or "").lower()
    score = 0
    for keyword, (keyword_score, _) in SEVERITY_RULES.items():
        if keyword in reason_lower or keyword in type_lower:
            score = max(score, keyword_score)
    if score == 0:
        if "retraction" in type_lower or "撤稿" in retraction_type:
            score = 6
            level = "medium"
        elif "concern" in type_lower or "关注" in retraction_type:
            score = 5
            level = "medium"
        else:
            score = 3
            level = "low"
    else:
        if score >= 7:
            level = "high"
        elif score >= 4:
            level = "medium"
        else:
            level = "low"
    return score, level


def determine_retraction_type(text: str) -> str:
    if not text:
        return "unknown"
    text_lower = text.lower()
    for rtype in RETRACTION_TYPES:
        if rtype.lower() in text_lower:
            return rtype
    return "unknown"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def save_raw_html(content: str, source: str, output_dir: str) -> Optional[str]:
    try:
        os.makedirs(output_dir, exist_ok=True)
        safe_source = re.sub(r"[^a-zA-Z0-9_-]", "_", source)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"{safe_source}_{timestamp}_{unique_id}.html"
        filepath = os.path.join(output_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return filepath
    except Exception as e:
        logger.error(f"Failed to save raw HTML: {e}")
        return None


def clean_text(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    text = re.sub(r"\s+", " ", text)
    text = text.replace("\u00a0", " ")
    text = text.strip()
    return text or None


def parse_date(date_str: Optional[str]) -> Optional[str]:
    if not date_str:
        return None
    date_str = date_str.strip()
    formats = [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%d %B %Y",
        "%B %d, %Y",
        "%b %d, %Y",
        "%Y-%m",
        "%Y",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.date().isoformat()
        except ValueError:
            continue
    match = re.search(r"(\d{4})", date_str)
    if match:
        return match.group(1)
    return None


def extract_year(date_str: Optional[str]) -> Optional[int]:
    if not date_str:
        return None
    match = re.search(r"(19|20)\d{2}", date_str)
    if match:
        return int(match.group())
    return None


def format_csv_value(value) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return "; ".join(str(v) for v in value)
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False)
    text = str(value)
    if "," in text or '"' in text or "\n" in text:
        text = '"' + text.replace('"', '""') + '"'
    return text
