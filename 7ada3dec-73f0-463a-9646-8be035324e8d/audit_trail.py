"""
audit_trail.py — 操作日志记录与稽查报告生成

满足 GCP / 21 CFR Part 11 稽查要求：
  - 记录每次操作的完整上下文：操作人、时间戳(UTC)、输入文件及其哈希、
    规则版本、结果摘要、扩展上下文。
  - 不可追加修改：仅追加 (append-only) JSONL 存储。
  - 支持按时间范围与操作类型筛选生成稽查报告 (Markdown)。
  - 同步写入 loguru 文件日志，便于模块级过滤。
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from loguru import logger

from models import AuditEntry, OperationType, hash_file, now_iso, to_json


def _parse_dt(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


class AuditTrail:
    """稽查轨迹记录器与报告生成器。"""

    def __init__(self, config: dict[str, Any], operator: str = "system"):
        self.config = config
        self.operator = operator
        audit_cfg = config.get("audit", {})
        self.enabled = audit_cfg.get("enabled", True)
        self.hash_algo = audit_cfg.get("hash_algo", "sha256")
        self.report_dir = Path(audit_cfg.get("report_dir", "audit_reports"))
        log_file_tpl = audit_cfg.get("log_file", "logs/audit_{date}.log")
        date_str = datetime.now().strftime("%Y%m%d")
        self.log_file = Path(str(log_file_tpl).replace("{date}", date_str))
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        # JSONL 不可变轨迹
        self.trail_file = self.log_file.parent / "audit_trail.jsonl"
        if self.enabled:
            logger.configure(extra={"component": "audit_trail"})
            logger.add(str(self.trail_file.with_suffix(".jsonl")),
                       level="DEBUG", enqueue=True,
                       filter=lambda r: r["extra"].get("component") == "audit_trail")

    # ------------------------------------------------------------------
    # 记录
    # ------------------------------------------------------------------
    def record(self, operation: str | OperationType,
               input_files: list[str | Path] | None = None,
               result_summary: dict[str, Any] | None = None,
               context: dict[str, Any] | None = None,
               rule_version: str | None = None) -> AuditEntry:
        """记录一条操作轨迹并持久化，返回该条目。"""
        input_files = [str(f) for f in (input_files or [])]
        file_hashes: dict[str, str] = {}
        for f in input_files:
            try:
                file_hashes[f] = hash_file(f, self.hash_algo)
            except OSError:
                file_hashes[f] = "UNREADABLE"
        entry = AuditEntry(
            operation=operation.value if isinstance(operation, OperationType) else str(operation),
            operator=self.operator,
            timestamp=now_iso(),
            input_files=input_files,
            file_hashes=file_hashes,
            rule_version=rule_version or self.config.get("rule_version", "unknown"),
            result_summary=result_summary or {},
            context=context or {},
        )
        if self.enabled:
            self._append(entry)
            logger.bind(component="audit_trail").info(
                "{} | {} | files={} | summary={}",
                entry.operation, entry.operator, len(entry.input_files),
                json.dumps(entry.result_summary, ensure_ascii=False),
            )
        return entry

    def _append(self, entry: AuditEntry) -> None:
        self.trail_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.trail_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry.to_dict(), ensure_ascii=False) + "\n")

    # ------------------------------------------------------------------
    # 读取与筛选
    # ------------------------------------------------------------------
    def load_entries(self) -> list[AuditEntry]:
        if not self.trail_file.exists():
            return []
        entries: list[AuditEntry] = []
        for line in self.trail_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
                entries.append(AuditEntry(**d))
            except (json.JSONDecodeError, TypeError):
                continue
        return entries

    def filter_entries(self, start: str | None = None, end: str | None = None,
                       operation: str | None = None) -> list[AuditEntry]:
        entries = self.load_entries()
        result = []
        for e in entries:
            ts = _parse_dt(e.timestamp)
            if start:
                try:
                    if ts < _parse_dt(start):
                        continue
                except ValueError:
                    pass
            if end:
                try:
                    if ts > _parse_dt(end):
                        continue
                except ValueError:
                    pass
            if operation and e.operation.upper() != str(operation).upper():
                continue
            result.append(e)
        return result

    # ------------------------------------------------------------------
    # 报告生成
    # ------------------------------------------------------------------
    def generate_report(self, start: str | None = None, end: str | None = None,
                        operation: str | None = None,
                        output: str | Path | None = None) -> Path:
        """生成 Markdown 稽查报告，返回报告路径。"""
        entries = self.filter_entries(start, end, operation)
        self.report_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        out = Path(output) if output else self.report_dir / f"audit_report_{ts}.md"

        by_op: dict[str, int] = {}
        for e in entries:
            by_op[e.operation] = by_op.get(e.operation, 0) + 1

        lines: list[str] = []
        lines.append("# 临床试验数据管理稽查报告 (GCP Audit Report)")
        lines.append("")
        lines.append(f"- 生成时间(UTC): {now_iso()}")
        lines.append(f"- 规则版本: {self.config.get('rule_version', 'unknown')}")
        lines.append(f"- 生成人: {self.operator}")
        rng = ""
        if start or end:
            rng = f"{start or '…'} 至 {end or '…'}"
        lines.append(f"- 时间范围: {rng or '全部'}")
        lines.append(f"- 操作筛选: {operation or '全部'}")
        lines.append(f"- 记录总数: {len(entries)}")
        lines.append("")
        lines.append("## 操作类型汇总")
        lines.append("")
        lines.append("| 操作类型 | 次数 |")
        lines.append("| --- | --- |")
        for op, n in sorted(by_op.items()):
            lines.append(f"| {op} | {n} |")
        lines.append("")
        lines.append("## 操作明细")
        lines.append("")
        for e in entries:
            lines.append(f"### {e.operation} @ {e.timestamp}")
            lines.append(f"- 操作人: {e.operator}")
            lines.append(f"- 规则版本: {e.rule_version}")
            if e.input_files:
                lines.append("- 输入文件与哈希:")
                for f, h in zip(e.input_files, e.file_hashes.values(), strict=False):
                    lines.append(f"  - `{f}` → {self.hash_algo}:{h}")
            if e.result_summary:
                lines.append("- 结果摘要:")
                for k, v in e.result_summary.items():
                    lines.append(f"  - **{k}**: {v}")
            if e.context:
                lines.append("- 上下文:")
                for k, v in e.context.items():
                    lines.append(f"  - {k}: {v}")
            lines.append("")
        out.write_text("\n".join(lines), encoding="utf-8")
        return out


__all__ = ["AuditTrail"]
