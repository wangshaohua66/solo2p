"""
query_mgr.py — 数据质疑自动生成与状态追踪

职责：
  1. 将校验发现 (ValidationFinding) 转换为结构化质疑单 (Query)。
  2. 持久化质疑单至 JSON 存储，支持增量去重（相同 rule+受试者+字段不重复生成）。
  3. 提供状态追踪：OPEN / ANSWERED / CLOSED / REJECTED。
  4. 支持批量关闭、按条件筛选与统计。

质疑单编号：Q-<6位序号>，全局递增。
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from models import Query, QueryStatus, Severity, ValidationFinding, now_iso, to_json


class QueryManager:
    """数据质疑管理器。"""

    def __init__(self, store_path: str | Path = "queries.json"):
        self.store_path = Path(store_path)
        self.queries: list[Query] = []
        self._counter = 0
        self.load()

    # ------------------------------------------------------------------
    # 生成
    # ------------------------------------------------------------------
    def generate(self, findings: list[ValidationFinding],
                 severities: tuple[str, ...] = (Severity.ERROR.value,
                                                Severity.WARNING.value)
                 ) -> list[Query]:
        """由校验发现生成质疑单（增量去重）。返回本次新生成的质疑单。"""
        self.load()
        existing_keys = {
            (q.rule_id, q.usubjid, q.field) for q in self.queries
            if q.status in (QueryStatus.OPEN.value, QueryStatus.ANSWERED.value)
        }
        created: list[Query] = []
        for f in findings:
            if f.severity not in severities:
                continue
            key = (f.rule_id, f.usubjid, f.field)
            if key in existing_keys:
                continue
            existing_keys.add(key)
            q = self._build_query(f)
            self.queries.append(q)
            created.append(q)
        self.save()
        return created

    def _build_query(self, f: ValidationFinding) -> Query:
        self._counter += 1
        qid = f"Q-{self._counter:06d}"
        var_path = f"{f.domain}.{f.usubjid}.{f.field}"
        description = (f"[{f.rule_id}] {f.rule_name} | {f.message} "
                       f"(当前值: {f.value or '空'})")
        return Query(
            query_id=qid,
            rule_id=f.rule_id,
            severity=f.severity,
            usubjid=f.usubjid,
            field=f.field,
            variable_path=var_path,
            description=description,
            center_id=f.center_id,
        )

    # ------------------------------------------------------------------
    # 状态追踪
    # ------------------------------------------------------------------
    def update_status(self, query_id: str, status: str,
                      resolution: str | None = None,
                      closed_by: str | None = None) -> Query | None:
        self.load()
        for q in self.queries:
            if q.query_id == query_id:
                q.status = status
                q.updated_at = now_iso()
                if resolution is not None:
                    q.resolution = resolution
                if closed_by is not None:
                    q.closed_by = closed_by
                self.save()
                return q
        return None

    def close(self, query_ids: list[str], resolution: str = "已核实修正",
              closed_by: str = "system") -> int:
        """批量关闭质疑单，返回关闭数量。"""
        self.load()
        ids = set(query_ids)
        closed = 0
        for q in self.queries:
            if q.query_id in ids and q.status != QueryStatus.CLOSED.value:
                q.status = QueryStatus.CLOSED.value
                q.resolution = resolution
                q.closed_by = closed_by
                q.updated_at = now_iso()
                closed += 1
        self.save()
        return closed

    # ------------------------------------------------------------------
    # 查询与统计
    # ------------------------------------------------------------------
    def list_queries(self, status: str | None = None,
                     severity: str | None = None,
                     center_id: str | None = None,
                     rule_id: str | None = None) -> list[Query]:
        self.load()
        result = self.queries
        if status:
            result = [q for q in result if q.status == status]
        if severity:
            result = [q for q in result if q.severity == severity]
        if center_id:
            result = [q for q in result if q.center_id == center_id]
        if rule_id:
            result = [q for q in result if q.rule_id == rule_id]
        return result

    def statistics(self) -> dict[str, Any]:
        self.load()
        total = len(self.queries)
        by_status: dict[str, int] = {}
        by_severity: dict[str, int] = {}
        by_center: dict[str, int] = {}
        by_rule: dict[str, int] = {}
        for q in self.queries:
            by_status[q.status] = by_status.get(q.status, 0) + 1
            by_severity[q.severity] = by_severity.get(q.severity, 0) + 1
            c = q.center_id or "UNKNOWN"
            by_center[c] = by_center.get(c, 0) + 1
            by_rule[q.rule_id] = by_rule.get(q.rule_id, 0) + 1
        return {
            "total": total,
            "by_status": dict(sorted(by_status.items())),
            "by_severity": dict(sorted(by_severity.items())),
            "by_center": dict(sorted(by_center.items(), key=lambda x: -x[1])),
            "by_rule": dict(sorted(by_rule.items(), key=lambda x: -x[1])),
            "open_count": by_status.get(QueryStatus.OPEN.value, 0),
            "closed_count": by_status.get(QueryStatus.CLOSED.value, 0),
        }

    # ------------------------------------------------------------------
    # 持久化
    # ------------------------------------------------------------------
    def load(self) -> None:
        if not self.store_path.exists():
            self.queries = []
            return
        try:
            data = json.loads(self.store_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            self.queries = []
            return
        self.queries = [Query.from_dict(d) if hasattr(Query, "from_dict")
                        else self._dict_to_query(d) for d in data.get("queries", [])]
        self._counter = data.get("counter", 0)
        # 重建计数器避免编号冲突
        for q in self.queries:
            try:
                n = int(q.query_id.split("-")[-1])
                if n > self._counter:
                    self._counter = n
            except (ValueError, IndexError):
                continue

    def _dict_to_query(self, d: dict[str, Any]) -> Query:
        return Query(**{k: d.get(k) for k in Query.__dataclass_fields__})  # type: ignore[arg-type]

    def save(self) -> None:
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "counter": self._counter,
            "updated_at": now_iso(),
            "queries": [q.to_dict() for q in self.queries],
        }
        self.store_path.write_text(to_json(payload), encoding="utf-8")


__all__ = ["QueryManager"]
