import re
from typing import Optional
from collections import Counter

import jieba
import jieba.analyse
from loguru import logger

from config.settings import Settings


_RISK_LEVELS = ("general", "attention", "warning", "urgent")
_RISK_PRIORITY = {level: idx for idx, level in enumerate(_RISK_LEVELS)}

_COMPANY_PATTERNS = [
    re.compile(r"([\u4e00-\u9fa5]{2,6}(?:有限公司|股份公司|集团公司|有限责任公司|股份有限公司))"),
    re.compile(r"([\u4e00-\u9fa5]{2,4}(?:公司|集团|工厂|商行|商店))"),
    re.compile(r"([A-Z][a-zA-Z]{1,15}(?:\s[A-Z][a-zA-Z]{1,15})*(?:\s?(?:Inc|Corp|Ltd|LLC|Co)))\.?"),
]

_PRODUCT_PATTERNS = [
    re.compile(r"(?:品牌|型号|产品)[：:]?\s*([\u4e00-\u9fa5A-Za-z0-9\-+]{2,30})"),
    re.compile(r"([\u4e00-\u9fa5]{2,8}(?:手机|电视|冰箱|空调|洗衣机|电脑|平板|手表|耳机))"),
]


class ClassifyPipeline:
    _instance = None
    _init_done = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, settings: Optional[Settings] = None):
        if ClassifyPipeline._init_done:
            return
        self._settings = settings or Settings()
        self._risk_keywords = self._settings.get_risk_keywords()
        self._categories = self._settings.get_complaint_categories()
        self._category_index = self._build_category_index()
        self._load_custom_dict()
        ClassifyPipeline._init_done = True
        logger.info("ClassifyPipeline initialized")

    def _build_category_index(self) -> dict:
        index = {}
        for cat in self._categories:
            name = cat.get("name", "")
            for kw in cat.get("keywords", []):
                index[kw] = name
        return index

    def _load_custom_dict(self):
        dict_path = self._settings.dict_path
        if dict_path.exists():
            jieba.load_userdict(str(dict_path))
            logger.info(f"Loaded custom dictionary: {dict_path}")
        else:
            logger.warning(f"Custom dictionary not found: {dict_path}")

    def extract_keywords(self, text: str, topk: int = 10) -> list:
        if not text:
            return []
        keywords = jieba.analyse.extract_tags(text, topK=topk, withWeight=True)
        return [(word, round(weight, 4)) for word, weight in keywords]

    def classify_category(self, text: str) -> str:
        if not text:
            return "其他"
        words = jieba.cut(text)
        category_counts = Counter()
        for word in words:
            if word in self._category_index:
                category_counts[self._category_index[word]] += 1
        if category_counts:
            return category_counts.most_common(1)[0][0]
        return "其他"

    def assess_risk(self, text: str) -> str:
        if not text:
            return "general"
        highest_level = "general"
        for level in ("urgent", "warning", "attention"):
            keywords = self._risk_keywords.get(level, [])
            for kw in keywords:
                if kw in text:
                    if _RISK_PRIORITY[level] > _RISK_PRIORITY[highest_level]:
                        highest_level = level
                    break
        return highest_level

    def extract_companies(self, text: str) -> list:
        if not text:
            return []
        companies = []
        for pattern in _COMPANY_PATTERNS:
            matches = pattern.findall(text)
            companies.extend(matches)
        return list(set(companies))

    def extract_products(self, text: str) -> list:
        if not text:
            return []
        products = []
        for pattern in _PRODUCT_PATTERNS:
            matches = pattern.findall(text)
            products.extend(matches)
        return list(set(products))

    def process(self, item: dict) -> dict:
        title = item.get("title", "")
        content = item.get("content", "")
        text = f"{title} {content}" if content else title

        category = self.classify_category(text)
        risk_level = self.assess_risk(text)
        keywords = self.extract_keywords(text, topk=10)
        companies = self.extract_companies(text)
        products = self.extract_products(text)

        item["category"] = category
        item["risk_level"] = risk_level
        item["keywords"] = [kw for kw, _ in keywords]
        item["keyword_weights"] = keywords
        item["companies"] = companies
        item["products"] = products

        return item

    def batch_classify(self, items: list) -> list:
        results = []
        for item in items:
            try:
                classified = self.process(item)
                results.append(classified)
            except Exception as e:
                logger.error(f"Classification failed for item: {e}")
                item["category"] = "其他"
                item["risk_level"] = "general"
                results.append(item)
        return results
