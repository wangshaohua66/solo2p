import math
import hashlib
import re
from collections import Counter
from datetime import datetime
from loguru import logger
from core.database import DatabaseManager
from core.constants import SYNONYM_DICT
from core.settings import (
    SIMILARITY_THRESHOLD_TITLE,
    SIMILARITY_THRESHOLD_PARAGRAPH,
    SIMILARITY_THRESHOLD_NGRAM,
    NGRAM_SIZE,
    HIGH_SIMILARITY_ALERT,
)
from items import CrawledPageItem, ComparisonResultItem


class ComparisonPipeline:
    def __init__(self):
        self.db = None
        self.work_cache = {}
        self.comparison_count = 0
        self.infringement_count = 0
        self.high_similarity_alerts = []

    def open_spider(self, spider):
        self.db = DatabaseManager()

    def close_spider(self, spider):
        logger.info(
            f"ComparisonPipeline: comparisons={self.comparison_count}, "
            f"infringements={self.infringement_count}, "
            f"high_similarity_alerts={len(self.high_similarity_alerts)}"
        )

    def process_item(self, item, spider):
        if not isinstance(item, CrawledPageItem):
            return item

        work_id = item.get("work_id")
        content_text = item.get("content_text", "")
        result_title = item.get("result_title", "")

        if not content_text or len(content_text) < 20:
            return item

        work = self._get_work(work_id)
        if not work:
            return item

        original_text = work.get("original_text", "")
        key_paragraphs_raw = work.get("key_paragraphs", "[]")
        if isinstance(key_paragraphs_raw, str):
            try:
                key_paragraphs = eval(key_paragraphs_raw) if key_paragraphs_raw else []
            except Exception:
                key_paragraphs = []
        else:
            key_paragraphs = key_paragraphs_raw

        ngram_fingerprint_raw = work.get("ngram_fingerprint", "")
        if isinstance(ngram_fingerprint_raw, str):
            try:
                original_ngrams = set(eval(ngram_fingerprint_raw)) if ngram_fingerprint_raw else set()
            except Exception:
                original_ngrams = set()
        else:
            original_ngrams = set(ngram_fingerprint_raw)

        title_sim = self._title_similarity(result_title, work["title"])
        para_sim = self._paragraph_similarity(content_text, key_paragraphs) if key_paragraphs else 0.0
        ngram_sim = self._ngram_similarity(content_text, original_ngrams) if original_ngrams else 0.0

        overall_sim = max(title_sim * 0.3 + para_sim * 0.4 + ngram_sim * 0.3, title_sim, para_sim, ngram_sim)

        threshold = work.get("similarity_threshold", SIMILARITY_THRESHOLD_PARAGRAPH)
        is_infringement = overall_sim >= threshold

        match_type = self._determine_match_type(title_sim, para_sim, ngram_sim)

        matched_paragraphs = []
        if key_paragraphs and para_sim > 0.3:
            matched_paragraphs = self._find_matched_paragraphs(content_text, key_paragraphs)

        self.comparison_count += 1

        result = ComparisonResultItem()
        result["work_id"] = work_id
        result["work_title"] = work["title"]
        result["platform_key"] = item.get("platform_key", "")
        result["platform_name"] = item.get("platform_name", "")
        result["result_url"] = item.get("result_url", "")
        result["result_title"] = result_title
        result["result_author"] = item.get("result_author", "")
        result["title_similarity"] = round(title_sim, 4)
        result["paragraph_similarity"] = round(para_sim, 4)
        result["ngram_similarity"] = round(ngram_sim, 4)
        result["overall_similarity"] = round(overall_sim, 4)
        result["is_infringement"] = 1 if is_infringement else 0
        result["match_type"] = match_type
        result["matched_paragraphs"] = str(matched_paragraphs)[:5000]
        result["crawl_time"] = datetime.now().isoformat()

        self._save_result(result)

        if is_infringement:
            self.infringement_count += 1
            if overall_sim >= HIGH_SIMILARITY_ALERT:
                alert_msg = (
                    f"HIGH SIMILARITY ALERT: {work['title']} vs {result_title} "
                    f"on {item.get('platform_name', '')} - similarity={overall_sim:.2%}"
                )
                logger.error(alert_msg)
                self.high_similarity_alerts.append({
                    "work_title": work["title"],
                    "result_title": result_title,
                    "platform": item.get("platform_name", ""),
                    "similarity": overall_sim,
                    "url": item.get("result_url", ""),
                })

        return result

    def _get_work(self, work_id):
        if work_id in self.work_cache:
            return self.work_cache[work_id]
        row = self.db.fetchone("SELECT * FROM copyrighted_works WHERE id=?", (work_id,))
        if row:
            self.work_cache[work_id] = dict(row)
            return self.work_cache[work_id]
        return None

    def _title_similarity(self, title1, title2):
        if not title1 or not title2:
            return 0.0
        t1 = re.sub(r"[^\u4e00-\u9fffa-zA-Z0-9]", "", title1.lower())
        t2 = re.sub(r"[^\u4e00-\u9fffa-zA-Z0-9]", "", title2.lower())
        if t1 == t2:
            return 1.0
        t1_variant = self._apply_synonyms(t1)
        t2_variant = self._apply_synonyms(t2)
        if t1_variant == t2_variant:
            return 0.95
        return self._cosine_similarity(t1, t2)

    def _paragraph_similarity(self, content_text, key_paragraphs):
        if not key_paragraphs or not content_text:
            return 0.0
        content_clean = re.sub(r"\s+", "", content_text)
        max_sim = 0.0
        matched = 0
        for para in key_paragraphs:
            para_clean = re.sub(r"\s+", "", str(para))
            if not para_clean or len(para_clean) < 10:
                continue
            if para_clean in content_clean:
                max_sim = max(max_sim, 1.0)
                matched += 1
                continue
            para_variant = self._apply_synonyms(para_clean)
            if para_variant in content_clean:
                max_sim = max(max_sim, 0.92)
                matched += 1
                continue
            sim = self._cosine_similarity(para_clean, content_clean[:len(para_clean) * 3])
            max_sim = max(max_sim, sim)
        if matched > 0 and len(key_paragraphs) > 0:
            return max(max_sim, matched / len(key_paragraphs))
        return max_sim

    def _ngram_similarity(self, content_text, original_ngrams):
        if not original_ngrams or not content_text:
            return 0.0
        content_clean = re.sub(r"\s+", "", content_text)
        content_ngrams = self._extract_ngrams(content_clean, NGRAM_SIZE)
        if not content_ngrams:
            return 0.0
        intersection = original_ngrams & content_ngrams
        union = original_ngrams | content_ngrams
        if not union:
            return 0.0
        jaccard = len(intersection) / len(union)
        containment = len(intersection) / len(original_ngrams) if original_ngrams else 0
        return max(jaccard, containment)

    @staticmethod
    def _extract_ngrams(text, n=5):
        chars = re.sub(r"[^\u4e00-\u9fff]", "", text)
        if len(chars) < n:
            return set()
        return {chars[i:i + n] for i in range(len(chars) - n + 1)}

    @staticmethod
    def _cosine_similarity(text1, text2):
        if not text1 or not text2:
            return 0.0
        c1 = Counter(text1)
        c2 = Counter(text2)
        intersection = set(c1.keys()) & set(c2.keys())
        if not intersection:
            return 0.0
        numerator = sum(c1[x] * c2[x] for x in intersection)
        d1 = math.sqrt(sum(v ** 2 for v in c1.values()))
        d2 = math.sqrt(sum(v ** 2 for v in c2.values()))
        if d1 == 0 or d2 == 0:
            return 0.0
        return numerator / (d1 * d2)

    @staticmethod
    def _apply_synonyms(text):
        result = text
        for original, synonyms in SYNONYM_DICT.items():
            for syn in synonyms:
                result = result.replace(syn, original)
        return result

    @staticmethod
    def _determine_match_type(title_sim, para_sim, ngram_sim):
        types = []
        if title_sim >= SIMILARITY_THRESHOLD_TITLE:
            types.append("title_exact")
        if para_sim >= SIMILARITY_THRESHOLD_PARAGRAPH:
            types.append("paragraph_similar")
        if ngram_sim >= SIMILARITY_THRESHOLD_NGRAM:
            types.append("ngram_fingerprint")
        return ",".join(types) if types else "low_similarity"

    def _find_matched_paragraphs(self, content_text, key_paragraphs):
        matched = []
        content_clean = re.sub(r"\s+", "", content_text)
        for para in key_paragraphs:
            para_clean = re.sub(r"\s+", "", str(para))
            if not para_clean or len(para_clean) < 10:
                continue
            if para_clean in content_clean:
                matched.append(para_clean[:200])
            else:
                para_variant = self._apply_synonyms(para_clean)
                if para_variant in content_clean:
                    matched.append(f"[洗稿]{para_clean[:200]}")
        return matched[:10]

    def _save_result(self, result):
        try:
            self.db.execute(
                """INSERT OR REPLACE INTO comparison_results
                   (work_id, platform_key, platform_name, result_url, result_title, result_author,
                    title_similarity, paragraph_similarity, ngram_similarity, overall_similarity,
                    is_infringement, match_type, matched_paragraphs, crawl_time)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    result["work_id"], result["platform_key"], result["platform_name"],
                    result["result_url"], result["result_title"], result["result_author"],
                    result["title_similarity"], result["paragraph_similarity"],
                    result["ngram_similarity"], result["overall_similarity"],
                    result["is_infringement"], result["match_type"],
                    result["matched_paragraphs"], result["crawl_time"],
                ),
            )
        except Exception as e:
            logger.error(f"Failed to save comparison result: {e}")
