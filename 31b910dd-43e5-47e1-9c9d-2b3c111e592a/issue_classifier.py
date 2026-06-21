import re
from collections import Counter
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from config import ISSUE_SEVERITY, REVIEW_MODULES
from database import DatabaseManager
from logger import logger


ISSUE_TYPE_MAPPING = {
    "MISSING_MODULE": {"severity": "FATAL", "category": "结构完整性", "description": "缺失CTD模块"},
    "DUPLICATE_MODULE": {"severity": "DEFECT", "category": "结构完整性", "description": "模块重复"},
    "MISSING_SUBMODULE": {"severity": "DEFECT", "category": "结构完整性", "description": "缺失子模块"},
    "EXTRA_DIRECTORY": {"severity": "SUGGESTION", "category": "目录规范", "description": "额外目录"},
    "DEPTH_MISALIGNMENT": {"severity": "DEFECT", "category": "目录规范", "description": "层级错位"},
    "DIR_ACCESS_DENIED": {"severity": "DEFECT", "category": "文件访问", "description": "目录无法访问"},
    "DIR_READ_ERROR": {"severity": "DEFECT", "category": "文件访问", "description": "目录读取错误"},
    "INVALID_FILENAME": {"severity": "DEFECT", "category": "命名规范", "description": "文件名不规范"},
    "INVALID_MODULE_CODE": {"severity": "DEFECT", "category": "命名规范", "description": "模块编号错误"},
    "DUPLICATE_PAGE_NUMBER": {"severity": "DEFECT", "category": "页码问题", "description": "页码重号"},
    "MISSING_PAGE_NUMBER": {"severity": "DEFECT", "category": "页码问题", "description": "页码缺号"},
    "PAGE_ORDER_ERROR": {"severity": "DEFECT", "category": "页码问题", "description": "页码顺序错误"},
    "LOW_PAGE_RECOGNITION": {"severity": "SUGGESTION", "category": "页码问题", "description": "页码识别率低"},
    "PDF_PARSE_ERROR": {"severity": "DEFECT", "category": "文件解析", "description": "PDF解析失败"},
    "MISSING_SEAL": {"severity": "FATAL", "category": "签字盖章", "description": "缺少公章"},
    "MISSING_SIGNATURE": {"severity": "DEFECT", "category": "签字盖章", "description": "缺少签字"},
    "FUZZY_SEAL": {"severity": "DEFECT", "category": "签字盖章", "description": "印章模糊"},
    "SIGNATURE_INCONSISTENCY": {"severity": "DEFECT", "category": "签字盖章", "description": "签名一致性异常（代签）"},
    "MISSING_OVERVIEW_FIELD": {"severity": "DEFECT", "category": "综述内容", "description": "缺少关键字段"},
    "NAME_MISMATCH": {"severity": "DEFECT", "category": "交叉校验", "description": "信息不一致"},
}


@dataclass
class ClassifiedIssue:
    original: Any
    issue_type: str
    severity: str
    category: str
    description: str
    module: str
    file_path: str
    suggestion: str
    is_common: bool = False
    occurrence_count: int = 0
    matched_issue_id: Optional[int] = None


class IssueClassifier:
    def __init__(self, db: Optional[DatabaseManager] = None) -> None:
        self.db = db or DatabaseManager()
        self.classified_issues: List[ClassifiedIssue] = []
        self.stats: Dict[str, Any] = {}

    def classify_issue(self, issue: Any) -> ClassifiedIssue:
        issue_type = getattr(issue, "issue_type", "UNKNOWN")
        mapping = ISSUE_TYPE_MAPPING.get(issue_type, {
            "severity": "DEFECT",
            "category": "其他问题",
            "description": issue_type,
        })

        return ClassifiedIssue(
            original=issue,
            issue_type=issue_type,
            severity=mapping["severity"],
            category=mapping["category"],
            description=getattr(issue, "description", str(issue)),
            module=getattr(issue, "module", "unknown"),
            file_path=getattr(issue, "file_path", ""),
            suggestion=getattr(issue, "suggestion", ""),
        )

    def match_with_historical(self, classified: ClassifiedIssue) -> ClassifiedIssue:
        matched = self.db.find_matching_common_issue(
            classified.issue_type, classified.description
        )
        if matched:
            classified.is_common = True
            classified.occurrence_count = matched.get("occurrence_count", 1)
            classified.matched_issue_id = matched.get("id")
            if matched.get("typical_suggestion") and not classified.suggestion:
                classified.suggestion = matched["typical_suggestion"]
        return classified

    def update_common_library(self, classified_issues: List[ClassifiedIssue]) -> None:
        type_counts: Counter = Counter()
        type_details: Dict[str, Dict[str, str]] = {}

        for ci in classified_issues:
            type_counts[ci.issue_type] += 1
            if ci.issue_type not in type_details:
                type_details[ci.issue_type] = {
                    "severity": ci.severity,
                    "description": ci.description[:500],
                    "suggestion": ci.suggestion,
                }

        for issue_type, details in type_details.items():
            self.db.update_common_issue(
                issue_type=issue_type,
                severity=details["severity"],
                description=details["description"],
                suggestion=details["suggestion"],
            )
        logger.info(f"已更新 {len(type_details)} 类问题到历史问题库")

    def classify_all(self, issues: List[Any], project_id: Optional[int] = None) -> Dict[str, Any]:
        logger.info(f"开始分类 {len(issues)} 个问题")
        self.classified_issues = []

        for issue in issues:
            classified = self.classify_issue(issue)
            classified = self.match_with_historical(classified)
            self.classified_issues.append(classified)

        self.update_common_library(self.classified_issues)

        self.stats = self._compute_statistics()
        logger.info("问题分类完成")
        return self.stats

    def _compute_statistics(self) -> Dict[str, Any]:
        stats: Dict[str, Any] = {
            "total": len(self.classified_issues),
            "by_severity": Counter(),
            "by_category": Counter(),
            "by_module": Counter(),
            "by_type": Counter(),
            "common_count": 0,
            "fatal_count": 0,
            "has_auto_reject": False,
        }

        for ci in self.classified_issues:
            stats["by_severity"][ci.severity] += 1
            stats["by_category"][ci.category] += 1
            stats["by_module"][ci.module] += 1
            stats["by_type"][ci.issue_type] += 1
            if ci.is_common:
                stats["common_count"] += 1
            if ci.severity == "FATAL":
                stats["fatal_count"] += 1
                if ISSUE_SEVERITY.get(ci.severity, {}).get("auto_reject"):
                    stats["has_auto_reject"] = True

        stats["module_scores"] = self._compute_module_scores()
        stats["overall_score"] = self._compute_overall_score(stats["module_scores"])
        stats["recommendation"] = self._make_recommendation(stats)
        return stats

    def _compute_module_scores(self) -> Dict[str, float]:
        scores: Dict[str, float] = {}
        module_issue_weights: Dict[str, int] = {}

        for ci in self.classified_issues:
            weight = ISSUE_SEVERITY.get(ci.severity, {}).get("weight", 1)
            module_issue_weights[ci.module] = module_issue_weights.get(ci.module, 0) + weight

        for mod in REVIEW_MODULES:
            key = mod["key"]
            deduction = min(module_issue_weights.get(key, 0) * 5, 50)
            scores[key] = max(0, 100 - deduction)
        return scores

    def _compute_overall_score(self, module_scores: Dict[str, float]) -> float:
        total = 0.0
        for mod in REVIEW_MODULES:
            key = mod["key"]
            total += module_scores.get(key, 0) * mod["weight"]
        return round(total, 1)

    def _make_recommendation(self, stats: Dict[str, Any]) -> str:
        if stats.get("has_auto_reject"):
            return "REJECT"
        fatal = stats["by_severity"].get("FATAL", 0)
        defects = stats["by_severity"].get("DEFECT", 0)
        if fatal > 0:
            return "REJECT"
        if defects > 10:
            return "REVISE"
        if defects > 3:
            return "SUPPLEMENT"
        return "PASS"

    def get_issues_by_severity(self, severity: str) -> List[ClassifiedIssue]:
        return [ci for ci in self.classified_issues if ci.severity == severity]

    def get_issues_by_module(self, module: str) -> List[ClassifiedIssue]:
        return [ci for ci in self.classified_issues if ci.module == module]

    def get_common_issues(self) -> List[ClassifiedIssue]:
        return [ci for ci in self.classified_issues if ci.is_common]

    def get_top_issue_types(self, n: int = 10) -> List[Tuple[str, int]]:
        counter: Counter = Counter(ci.issue_type for ci in self.classified_issues)
        return counter.most_common(n)

    def to_db_records(self) -> List[Dict[str, Any]]:
        records = []
        for ci in self.classified_issues:
            records.append({
                "module": ci.module,
                "severity": ci.severity,
                "issue_type": ci.issue_type,
                "file_path": ci.file_path,
                "description": ci.description,
                "suggestion": ci.suggestion,
                "is_common": ci.is_common,
                "matched_issue_id": ci.matched_issue_id,
            })
        return records

    def print_summary(self) -> None:
        stats = self.stats
        print("\n" + "=" * 60)
        print("问题统计摘要")
        print("=" * 60)
        print(f"问题总数: {stats['total']}")
        print(f"  致命错误: {stats['by_severity'].get('FATAL', 0)}")
        print(f"  一般缺陷: {stats['by_severity'].get('DEFECT', 0)}")
        print(f"  建议优化: {stats['by_severity'].get('SUGGESTION', 0)}")
        print(f"常见问题: {stats['common_count']} 个")
        print(f"综合评分: {stats['overall_score']} / 100")
        rec_map = {"REJECT": "不予受理（存在致命错误）", "REVISE": "退回修改",
                   "SUPPLEMENT": "补充资料", "PASS": "形式审查通过"}
        print(f"审查建议: {rec_map.get(stats['recommendation'], stats['recommendation'])}")
        print("-" * 60)
        print("按模块统计:")
        for mod_key, score in sorted(stats["module_scores"].items()):
            mod_name = next((m["name"] for m in REVIEW_MODULES if m["key"] == mod_key), mod_key)
            issues_count = stats["by_module"].get(mod_key, 0)
            print(f"  {mod_name}: 得分 {score} | 问题 {issues_count} 个")
        print("-" * 60)
        print("高频问题类型 TOP10:")
        for issue_type, count in self.get_top_issue_types(10):
            type_info = ISSUE_TYPE_MAPPING.get(issue_type, {})
            label = type_info.get("description", issue_type)
            print(f"  [{count:3d}] {label} ({issue_type})")
        print("=" * 60)
