import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"
REPORT_DIR = BASE_DIR / "reports"
LOG_DIR = BASE_DIR / "logs"
TEMPLATE_DIR = BASE_DIR / "templates"
DB_PATH = DATA_DIR / "review_system.db"

for directory in [DATA_DIR, REPORT_DIR, LOG_DIR, TEMPLATE_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

PERFORMANCE = {
    "max_memory_mb": 500,
    "max_review_time_minutes": 8,
    "max_parallel_tasks": 8,
    "page_accuracy_threshold": 0.98,
    "seal_false_positive_rate": 0.05,
    "db_query_response_ms": 200,
    "log_retention_days": 90,
}

CTD_MODULES = {
    "Module1": {
        "name": "申报资料目录",
        "required": True,
        "submodules": {},
    },
    "Module2": {
        "name": "综述资料",
        "required": True,
        "submodules": {
            "2.1": "药品说明书及起草说明",
            "2.2": "产品信息",
            "2.3": "综述资料",
            "2.4": "不同研究阶段申请适用的研究资料",
            "2.5": "非临床研究综述",
            "2.6": "临床研究综述",
            "2.7": "安全性摘要",
        },
    },
    "Module3": {
        "name": "药学研究资料",
        "required": True,
        "submodules": {
            "3.2.S": "原料药",
            "3.2.P": "制剂",
            "3.2.A": "附录",
        },
    },
    "Module4": {
        "name": "药理毒理研究资料",
        "required": True,
        "submodules": {
            "4.1": "非临床研究综述",
            "4.2": "非临床研究报告",
        },
    },
    "Module5": {
        "name": "临床研究资料",
        "required": True,
        "submodules": {
            "5.1": "临床研究综述",
            "5.2": "临床研究报告",
            "5.3": "临床研究报告附件",
        },
    },
}

DRUG_TYPE_CONFIG = {
    "chemical": {
        "label": "化学药",
        "naming_pattern": r"^M(\d)(?:\.(\d+))?[-.](\d{3})[-.]?[\u4e00-\u9fa5a-zA-Z0-9_-]+\.(pdf|doc|docx|jpg|png)$",
        "module_prefix": "M",
    },
    "tcm": {
        "label": "中药",
        "naming_pattern": r"^ZY-M(\d)(?:\.(\d+))?[-.](\d{3})[-.]?[\u4e00-\u9fa5a-zA-Z0-9_-]+\.(pdf|doc|docx|jpg|png)$",
        "module_prefix": "ZY-M",
    },
    "biologic": {
        "label": "生物制品",
        "naming_pattern": r"^SW-M(\d)(?:\.(\d+))?[-.](\d{3})[-.]?[\u4e00-\u9fa5a-zA-Z0-9_-]+\.(pdf|doc|docx|jpg|png)$",
        "module_prefix": "SW-M",
    },
}

ISSUE_SEVERITY = {
    "FATAL": {"label": "致命错误", "weight": 3, "color": "\033[91m", "auto_reject": True},
    "DEFECT": {"label": "一般缺陷", "weight": 2, "color": "\033[93m", "auto_reject": False},
    "SUGGESTION": {"label": "建议优化", "weight": 1, "color": "\033[96m", "auto_reject": False},
}

CHECK_STATUS = {
    "PENDING": {"label": "待检", "icon": "○", "color": "\033[90m"},
    "RUNNING": {"label": "检查中", "icon": "◐", "color": "\033[94m"},
    "PASS": {"label": "通过", "icon": "✓", "color": "\033[92m"},
    "WARNING": {"label": "警告", "icon": "⚠", "color": "\033[93m"},
    "ERROR": {"label": "错误", "icon": "✗", "color": "\033[91m"},
}

SIGNATURE_PAGES = {
    "cover_pages": [1],
    "toc_pages": [2, 3],
    "end_pages_ratio": 0.1,
    "key_module_endings": ["Module2", "Module3", "Module4", "Module5"],
}

OVERVIEW_FIELDS = [
    "drug_name",
    "application_type",
    "specification",
    "applicant",
]

REVIEW_MODULES = [
    {"key": "ctd_structure", "name": "CTD目录结构", "weight": 0.20},
    {"key": "file_naming", "name": "文件命名规范", "weight": 0.15},
    {"key": "page_continuity", "name": "页码连续性", "weight": 0.15},
    {"key": "signature_seal", "name": "签字盖章识别", "weight": 0.20},
    {"key": "overview_check", "name": "综述内容抽检", "weight": 0.15},
    {"key": "cross_validate", "name": "交叉校验", "weight": 0.15},
]

DISK_SPACE_THRESHOLD_MB = 2048
SUPPORTED_EXTENSIONS = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".xls", ".xlsx"}

TASK_PRIORITY = {
    "URGENT": 1,
    "NORMAL": 2,
    "LOW": 3,
}
