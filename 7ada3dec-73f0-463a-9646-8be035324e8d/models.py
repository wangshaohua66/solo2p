"""
models.py — 数据模型、枚举与 JSON Schema 定义

本模块定义临床试验数据管理 CLI 使用的所有核心数据结构，作为各业务模块
（ingestor / transformer / validator / query_mgr / audit_trail）共享的契约层。
设计原则：
  1. 数据类为不可变值对象（dataclass），便于序列化与稽查追踪。
  2. 枚举使用 StrEnum，可直接作为字符串写入 JSON。
  3. 提供 to_dict / from_dict 以支持持久化与管道传递。
"""
from __future__ import annotations

import enum
import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import jsonschema  # type: ignore
except ImportError:  # pragma: no cover - 运行时由 cli 兜底提示
    jsonschema = None


# =============================================================================
# 枚举定义
# =============================================================================
class Severity(enum.StrEnum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"

    @classmethod
    def ordered(cls) -> list["Severity"]:
        return [cls.ERROR, cls.WARNING, cls.INFO]


class QueryStatus(enum.StrEnum):
    OPEN = "OPEN"
    ANSWERED = "ANSWERED"
    CLOSED = "CLOSED"
    REJECTED = "REJECTED"


class OperationType(enum.StrEnum):
    INGEST = "INGEST"
    TRANSFORM = "TRANSFORM"
    VALIDATE = "VALIDATE"
    CONSISTENCY = "CONSISTENCY"
    QUERY_GENERATE = "QUERY_GENERATE"
    QUERY_CLOSE = "QUERY_CLOSE"
    SNAPSHOT_CREATE = "SNAPSHOT_CREATE"
    SNAPSHOT_DIFF = "SNAPSHOT_DIFF"
    AUDIT_REPORT = "AUDIT_REPORT"
    CONFIG_LOAD = "CONFIG_LOAD"


class SourceFormat(enum.StrEnum):
    XML = "xml"
    EXCEL = "excel"
    CSV = "csv"
    UNKNOWN = "unknown"


class RuleType(enum.StrEnum):
    REQUIRED = "required"
    ENUM = "enum"
    RANGE = "range"
    FORMAT = "format"
    DATE_ORDER = "date_order"
    UNIQUE_KEY = "unique_key"
    CONDITIONAL_REQUIRED = "conditional_required"
    REFERENCE_RANGE = "reference_range"
    VISIT_SEQUENCE = "visit_sequence"


# =============================================================================
# 核心数据类
# =============================================================================
def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class ImportSummary:
    """导入摘要：描述一次数据导入的结果。"""
    source: str
    format: str
    center_id: str | None
    total_rows: int = 0
    accepted_rows: int = 0
    skipped_rows: int = 0
    sheets: list[str] = field(default_factory=list)
    encoding: str = "utf-8"
    warnings: list[str] = field(default_factory=list)
    file_hash: str = ""
    imported_at: str = field(default_factory=_utc_now_iso)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ValidationFinding:
    """单条合规校验发现。"""
    rule_id: str
    rule_name: str
    severity: str
    domain: str
    usubjid: str
    field: str
    value: str
    message: str
    record_index: int = -1
    center_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Query:
    """结构化数据质疑单。"""
    query_id: str
    rule_id: str
    severity: str
    usubjid: str
    field: str
    variable_path: str
    description: str
    center_id: str | None
    status: str = QueryStatus.OPEN.value
    created_at: str = field(default_factory=_utc_now_iso)
    updated_at: str = field(default_factory=_utc_now_iso)
    closed_by: str | None = None
    resolution: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class AuditEntry:
    """稽查轨迹记录，满足 GCP 21 CFR Part 11 要求。"""
    operation: str
    operator: str
    timestamp: str
    input_files: list[str]
    file_hashes: dict[str, str]
    rule_version: str
    result_summary: dict[str, Any]
    context: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SnapshotMeta:
    """数据快照元信息。"""
    snapshot_id: str
    version: str
    created_at: str
    row_count: int
    domain: str
    file_path: str
    checksum: str
    operator: str = "system"
    description: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ConsistencyIssue:
    """跨中心一致性分析发现。"""
    test_code: str
    visit: str
    subject: str
    center_id: str
    value: float
    standard_unit: str
    group_mean: float
    group_std: float
    zscore: float
    reason: str
    severity: str = Severity.WARNING.value

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# =============================================================================
# JSON Schema 定义（用于配置与持久化结构校验）
# =============================================================================
CONFIG_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["rule_version", "sdtm", "units", "validation_rules", "consistency"],
    "properties": {
        "rule_version": {"type": "string"},
        "centers": {"type": "array"},
        "sdtm": {
            "type": "object",
            "required": ["domains", "mappings"],
            "properties": {
                "domains": {"type": "object"},
                "mappings": {"type": "array"},
            },
        },
        "units": {"type": "object"},
        "missing_values": {"type": "object"},
        "controlled_terms": {"type": "object"},
        "validation_rules": {"type": "array", "minItems": 1},
        "consistency": {"type": "object"},
        "audit": {"type": "object"},
        "snapshot": {"type": "object"},
        "logging": {"type": "object"},
    },
}

QUERY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["query_id", "rule_id", "severity", "usubjid", "field", "status"],
    "properties": {
        "query_id": {"type": "string"},
        "rule_id": {"type": "string"},
        "severity": {"enum": [s.value for s in Severity]},
        "usubjid": {"type": "string"},
        "field": {"type": "string"},
        "variable_path": {"type": "string"},
        "description": {"type": "string"},
        "status": {"enum": [s.value for s in QueryStatus]},
    },
}


def validate_config(config: dict[str, Any]) -> list[str]:
    """校验配置结构，返回错误信息列表（空列表表示通过）。"""
    if jsonschema is None:
        return ["jsonschema 未安装，无法校验配置"]
    errors: list[str] = []
    validator = jsonschema.Draft7Validator(CONFIG_SCHEMA)
    for err in sorted(validator.iter_errors(config), key=lambda e: e.path):
        loc = ".".join(str(p) for p in err.absolute_path) or "<root>"
        errors.append(f"{loc}: {err.message}")
    return errors


def validate_query_record(record: dict[str, Any]) -> bool:
    """校验单条质疑记录是否符合 schema。"""
    if jsonschema is None:
        return True
    try:
        jsonschema.validate(record, QUERY_SCHEMA)
        return True
    except jsonschema.ValidationError:
        return False


# =============================================================================
# 工具函数
# =============================================================================
def hash_file(path: str | Path, algo: str = "sha256", chunk: int = 1 << 20) -> str:
    """计算文件哈希，用于稽查轨迹。"""
    h = hashlib.new(algo)
    with open(path, "rb") as f:
        while True:
            buf = f.read(chunk)
            if not buf:
                break
            h.update(buf)
    return h.hexdigest()


def hash_bytes(data: bytes, algo: str = "sha256") -> str:
    return hashlib.new(algo, data).hexdigest()


def now_iso() -> str:
    return _utc_now_iso()


def to_json(obj: Any, indent: int = 2, ensure_ascii: bool = False) -> str:
    """将 dataclass / dict 序列化为 JSON 字符串。"""
    def default(o: Any) -> Any:
        if hasattr(o, "to_dict"):
            return o.to_dict()
        if isinstance(o, (enum.Enum,)):
            return o.value
        if isinstance(o, (datetime,)):
            return o.isoformat()
        if isinstance(o, Path):
            return str(o)
        raise TypeError(f"不可序列化对象: {type(o)}")
    return json.dumps(obj, default=default, indent=indent, ensure_ascii=ensure_ascii)


__all__ = [
    "Severity", "QueryStatus", "OperationType", "SourceFormat", "RuleType",
    "ImportSummary", "ValidationFinding", "Query", "AuditEntry",
    "SnapshotMeta", "ConsistencyIssue",
    "CONFIG_SCHEMA", "QUERY_SCHEMA",
    "validate_config", "validate_query_record",
    "hash_file", "hash_bytes", "now_iso", "to_json",
]
