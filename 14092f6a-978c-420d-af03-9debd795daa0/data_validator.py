"""
data_validator.py
================================================================================
数据校验模块：负责身份证号校验、工资基数合规性检查、跨表数据一致性校验。

校验内容：
  1. 身份证号格式与校验位校验（GB 11643-1999 标准）
  2. 工资/缴费基数合规性检查（上下限、五险一致性）
  3. 跨表数据一致性校验（人员名单 vs 工资表，检测漏报/错报）
  4. 生成结构化差异报告供人工确认
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)

# 身份证号 18 位校验位权重因子（GB 11643-1999）
_ID_WEIGHTS: Tuple[int, ...] = (7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2)
# 校验位对应表（sum % 11 -> 校验码）
_ID_CHECK_CODES: Tuple[str, ...] = ("1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2")


@dataclass
class ValidationIssue:
    """单条校验问题记录。"""
    level: str  # ERROR / WARNING / INFO
    field: str
    message: str
    row_index: Optional[int] = None
    id_card: Optional[str] = None
    name: Optional[str] = None
    context: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationResult:
    """一次校验的整体结果。"""
    ok: bool
    issues: List[ValidationIssue] = field(default_factory=list)
    summary: str = ""

    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues if i.level == "ERROR")

    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.level == "WARNING")

    def add(self, level: str, field_name: str, message: str,
            row_index: Optional[int] = None, id_card: Optional[str] = None,
            **context: Any) -> None:
        self.issues.append(ValidationIssue(
            level=level, field=field_name, message=message,
            row_index=row_index, id_card=id_card, context=context,
        ))
        if level == "ERROR":
            self.ok = False

    def merge(self, other: "ValidationResult") -> None:
        self.issues.extend(other.issues)
        if not other.ok:
            self.ok = False


@dataclass
class ConsistencyReport:
    """跨表一致性差异报告。"""
    only_in_personnel: List[str] = field(default_factory=list)
    only_in_wage: List[str] = field(default_factory=list)
    name_mismatch: List[Tuple[str, str, str]] = field(default_factory=list)
    duplicate_ids: List[str] = field(default_factory=list)
    total_personnel: int = 0
    total_wage: int = 0

    @property
    def has_issue(self) -> bool:
        return bool(self.only_in_personnel or self.only_in_wage
                    or self.name_mismatch or self.duplicate_ids)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "only_in_personnel": self.only_in_personnel,
            "only_in_wage": self.only_in_wage,
            "name_mismatch": [
                {"id_card": i, "personnel_name": p, "wage_name": w}
                for i, p, w in self.name_mismatch
            ],
            "duplicate_ids": self.duplicate_ids,
            "total_personnel": self.total_personnel,
            "total_wage": self.total_wage,
        }


class DataValidator:
    """数据校验器：根据 config 中的校验规则对解析后的结构化数据校验。"""

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config
        rules: Dict[str, Any] = config.get("validation", {})
        self.id_rules: Dict[str, Any] = rules.get("id_card", {})
        self.wage_rules: Dict[str, Any] = rules.get("wage_base", {})
        self.consistency_rules: Dict[str, Any] = rules.get("consistency", {})

    # ---------------------------- 身份证号校验 ----------------------------

    @staticmethod
    def compute_check_code(body17: str) -> Optional[str]:
        """根据前 17 位计算校验位，非法字符返回 None。"""
        if len(body17) != 17 or not body17.isdigit():
            return None
        total = sum(int(ch) * w for ch, w in zip(body17, _ID_WEIGHTS))
        return _ID_CHECK_CODES[total % 11]

    def validate_id_card(self, id_card: str, row_index: Optional[int] = None,
                         name: Optional[str] = None) -> ValidationIssue:
        """校验单个身份证号，返回单个 issue（通过则 level=INFO）。"""
        raw = "" if id_card is None else str(id_card).strip()
        norm = raw.upper().replace(" ", "")
        required_len = int(self.id_rules.get("length", 18))
        check_sum = bool(self.id_rules.get("check_checksum", True))

        if not norm:
            return ValidationIssue("ERROR", "id_card", "身份证号为空",
                                   row_index=row_index, id_card=raw, name=name)
        if len(norm) != required_len:
            return ValidationIssue("ERROR", "id_card",
                                   f"身份证号长度应为 {required_len} 位，实际 {len(norm)} 位",
                                   row_index=row_index, id_card=raw, name=name)
        if not re.match(r"^\d{17}[\dX]$", norm):
            return ValidationIssue("ERROR", "id_card",
                                   "身份证号含非法字符（前17位须为数字，末位为数字或X）",
                                   row_index=row_index, id_card=raw, name=name)
        # 出生日期合法性
        try:
            birth = datetime.strptime(norm[6:14], "%Y%m%d").date()
            if birth > date.today():
                return ValidationIssue("ERROR", "id_card",
                                       f"出生日期 {birth} 晚于今天",
                                       row_index=row_index, id_card=raw, name=name)
        except ValueError:
            return ValidationIssue("ERROR", "id_card",
                                   "身份证号中出生日期段非法",
                                   row_index=row_index, id_card=raw, name=name)
        # 校验位
        if check_sum:
            expected = self.compute_check_code(norm[:17])
            if expected is None or expected != norm[-1]:
                return ValidationIssue("ERROR", "id_card",
                                       f"身份证号校验位错误（期望 {expected}，实际 {norm[-1]}）",
                                       row_index=row_index, id_card=raw, name=name)
        return ValidationIssue("INFO", "id_card", "身份证号校验通过",
                               row_index=row_index, id_card=norm, name=name)

    # ---------------------------- 工资基数合规性 ----------------------------

    def validate_wage_base(self, base_value: Any, field_name: str = "base_salary",
                           row_index: Optional[int] = None,
                           id_card: Optional[str] = None) -> ValidationIssue:
        """校验单个工资/缴费基数是否在合规区间内。"""
        try:
            base = self._to_float(base_value)
        except (TypeError, ValueError):
            return ValidationIssue("ERROR", field_name,
                                   f"基数无法解析为数值：{base_value!r}",
                                   row_index=row_index, id_card=id_card)
        if base is None or base != base:  # NaN
            return ValidationIssue("ERROR", field_name,
                                   f"基数缺失或为 NaN：{base_value!r}",
                                   row_index=row_index, id_card=id_card)
        if base < 0:
            return ValidationIssue("ERROR", field_name,
                                   f"基数为负数：{base}",
                                   row_index=row_index, id_card=id_card)
        min_base = float(self.wage_rules.get("min_base", 0))
        max_base = float(self.wage_rules.get("max_base", float("inf")))
        if base < min_base:
            return ValidationIssue("WARNING", field_name,
                                    f"基数 {base:.2f} 低于下限 {min_base:.2f}（需人工确认）",
                                    row_index=row_index, id_card=id_card, context={"value": base})
        if base > max_base:
            return ValidationIssue("ERROR", field_name,
                                   f"基数 {base:.2f} 超过上限 {max_base:.2f}",
                                   row_index=row_index, id_card=id_card, context={"value": base})
        return ValidationIssue("INFO", field_name, "基数合规",
                               row_index=row_index, id_card=id_card, context={"value": base})

    def validate_insurance_type(self, ins_type: str,
                               row_index: Optional[int] = None,
                               id_card: Optional[str] = None) -> ValidationIssue:
        """校验参保类型是否在允许范围内。"""
        valid = self.wage_rules.get("valid_insurance_types", [])
        if not ins_type:
            return ValidationIssue("ERROR", "insurance_type", "参保类型为空",
                                   row_index=row_index, id_card=id_card)
        if valid and str(ins_type).strip() not in valid:
            return ValidationIssue("ERROR", "insurance_type",
                                   f"参保类型 {ins_type!r} 不在允许列表 {valid}",
                                   row_index=row_index, id_card=id_card)
        return ValidationIssue("INFO", "insurance_type", "参保类型合法",
                               row_index=row_index, id_card=id_card)

    # ---------------------------- 工资表行校验 ----------------------------

    def validate_wage_row(self, row: Dict[str, Any], row_index: int) -> ValidationResult:
        """校验工资表单行：身份证、各险种基数。"""
        result = ValidationResult(ok=True)
        id_card = str(row.get("id_card", "")).strip()
        name = str(row.get("name", "")).strip()

        id_issue = self.validate_id_card(id_card, row_index=row_index, name=name)
        result.issues.append(id_issue)
        if id_issue.level == "ERROR":
            result.ok = False

        # 校验所有以 _base 结尾的字段
        for key, value in row.items():
            if key.endswith("_base") and value not in (None, ""):
                b_issue = self.validate_wage_base(value, field_name=key,
                                                  row_index=row_index, id_card=id_card)
                result.issues.append(b_issue)
                if b_issue.level == "ERROR":
                    result.ok = False

        # 五险基数一致性（可选）
        if self.wage_rules.get("require_consistent"):
            bases = [row.get(k) for k in ("pension_base", "medical_base",
                                          "unemployment_base", "workinjury_base",
                                          "maternity_base") if row.get(k) not in (None, "")]
            if bases:
                try:
                    nums = [self._to_float(b) for b in bases]
                    if any(n != nums[0] for n in nums):
                        result.add("WARNING", "wage_consistency",
                                   f"五险基数不一致：{bases}",
                                   row_index=row_index, id_card=id_card)
                except (TypeError, ValueError):
                    result.add("ERROR", "wage_consistency",
                               "五险基数含非法数值",
                               row_index=row_index, id_card=id_card)
        return result

    def validate_wage_table(self, rows: Sequence[Dict[str, Any]]) -> ValidationResult:
        """批量校验工资表，并检测重复身份证。"""
        result = ValidationResult(ok=True)
        seen: Dict[str, int] = {}
        for idx, row in enumerate(rows):
            sub = self.validate_wage_row(row, row_index=idx)
            result.merge(sub)
            id_card = str(row.get("id_card", "")).strip().upper().replace(" ", "")
            if id_card:
                if id_card in seen:
                    result.add("ERROR", "id_card",
                               f"身份证号重复：{id_card}（首次出现在第 {seen[id_card]} 行）",
                               row_index=idx, id_card=id_card)
                else:
                    seen[id_card] = idx
        result.summary = (f"工资表校验完成：共 {len(rows)} 行，"
                          f"错误 {result.error_count}，警告 {result.warning_count}")
        logger.info(result.summary)
        return result

    # ---------------------------- 人员变动表校验 ----------------------------

    def validate_personnel_table(self, rows: Sequence[Dict[str, Any]]) -> ValidationResult:
        """校验人员增减变动表：身份证、参保类型、变动日期。"""
        result = ValidationResult(ok=True)
        seen: Dict[str, int] = {}
        for idx, row in enumerate(rows):
            id_card = str(row.get("id_card", "")).strip()
            name = str(row.get("name", "")).strip()
            id_issue = self.validate_id_card(id_card, row_index=idx, name=name)
            result.issues.append(id_issue)
            if id_issue.level == "ERROR":
                result.ok = False
            ins = str(row.get("insurance_type", "")).strip()
            ins_issue = self.validate_insurance_type(ins, row_index=idx, id_card=id_card)
            result.issues.append(ins_issue)
            if ins_issue.level == "ERROR":
                result.ok = False
            # 变动日期
            change_date = row.get("change_date")
            if change_date not in (None, ""):
                if not self._is_valid_date(change_date):
                    result.add("WARNING", "change_date",
                               f"变动日期格式异常：{change_date!r}",
                               row_index=idx, id_card=id_card)
            # 重复
            norm_id = id_card.upper().replace(" ", "")
            if norm_id:
                if norm_id in seen:
                    result.add("ERROR", "id_card",
                               f"人员变动表身份证号重复：{norm_id}（第 {seen[norm_id]} 行）",
                               row_index=idx, id_card=norm_id)
                else:
                    seen[norm_id] = idx
        result.summary = (f"人员变动表校验完成：共 {len(rows)} 行，"
                          f"错误 {result.error_count}，警告 {result.warning_count}")
        logger.info(result.summary)
        return result

    # ---------------------------- 跨表一致性校验 ----------------------------

    def check_consistency(self, personnel_rows: Sequence[Dict[str, Any]],
                          wage_rows: Sequence[Dict[str, Any]]) -> Tuple[ConsistencyReport, ValidationResult]:
        """跨表核对人员名单与工资表是否一致。

        返回差异报告与对应的校验结果。match_by_id=True 时按身份证号匹配，
        否则按姓名匹配。
        """
        match_by_id = bool(self.consistency_rules.get("match_by_id", True))
        report = ConsistencyReport(total_personnel=len(personnel_rows),
                                   total_wage=len(wage_rows))
        result = ValidationResult(ok=True)

        if match_by_id:
            p_map = self._index_by_id(personnel_rows)
            w_map = self._index_by_id(wage_rows)
        else:
            p_map = {str(r.get("name", "")).strip(): r for r in personnel_rows}
            w_map = {str(r.get("name", "")).strip(): r for r in wage_rows}

        p_keys = set(p_map.keys())
        w_keys = set(w_map.keys())

        # 仅在人员表
        for key in sorted(p_keys - w_keys):
            report.only_in_personnel.append(key)
            result.add("WARNING", "consistency",
                       f"人员表中存在但工资表缺失：{key}",
                       id_card=key if match_by_id else None)
        # 仅在工资表
        for key in sorted(w_keys - p_keys):
            report.only_in_wage.append(key)
            result.add("WARNING", "consistency",
                       f"工资表中存在但人员表缺失：{key}",
                       id_card=key if match_by_id else None)
        # 姓名不一致
        for key in sorted(p_keys & w_keys):
            p_name = str(p_map[key].get("name", "")).strip()
            w_name = str(w_map[key].get("name", "")).strip()
            if p_name and w_name and p_name != w_name:
                report.name_mismatch.append((key, p_name, w_name))
                result.add("WARNING", "consistency",
                           f"姓名不一致（{key}）：人员表={p_name}，工资表={w_name}",
                           id_card=key if match_by_id else None)
        # 重复身份证
        for src, label in ((personnel_rows, "人员表"), (wage_rows, "工资表")):
            seen: Dict[str, int] = {}
            for r in src:
                k = str(r.get("id_card", "")).strip().upper().replace(" ", "") \
                    if match_by_id else str(r.get("name", "")).strip()
                if not k:
                    continue
                if k in seen:
                    report.duplicate_ids.append(k)
                    result.add("ERROR", "consistency",
                               f"{label}中重复：{k}")
                else:
                    seen[k] = 1
        result.summary = (
            f"跨表一致性校验：人员表 {report.total_personnel} 人，"
            f"工资表 {report.total_wage} 人，"
            f"仅人员表 {len(report.only_in_personnel)}，"
            f"仅工资表 {len(report.only_in_wage)}，"
            f"姓名不一致 {len(report.name_mismatch)}，"
            f"重复 {len(report.duplicate_ids)}"
        )
        logger.info(result.summary)
        return report, result

    # ---------------------------- 回单与申报金额比对 ----------------------------

    def match_receipt_to_declaration(self, receipt_amount: float,
                                     declared_amount: float,
                                     tolerance: float = 0.01) -> ValidationIssue:
        """比对回单实缴金额与申报应缴金额是否一致（允许误差）。"""
        diff = abs(receipt_amount - declared_amount)
        if diff <= tolerance:
            return ValidationIssue("INFO", "amount",
                                   f"金额一致：{receipt_amount:.2f}")
        return ValidationIssue("ERROR", "amount",
                               f"回单金额 {receipt_amount:.2f} 与申报金额 "
                               f"{declared_amount:.2f} 不一致（差异 {diff:.2f}）")

    # ---------------------------- 工具方法 ----------------------------

    @staticmethod
    def _to_float(value: Any) -> float:
        if value is None:
            raise TypeError("None")
        if isinstance(value, (int, float)):
            return float(value)
        text = str(value).strip().replace(",", "").replace("¥", "").replace("￥", "")
        return float(text)

    @staticmethod
    def _is_valid_date(value: Any) -> bool:
        if isinstance(value, (datetime, date)):
            return True
        text = str(value).strip()
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d", "%Y年%m月%d日", "%d/%m/%Y"):
            try:
                datetime.strptime(text, fmt)
                return True
            except ValueError:
                continue
        return False

    @staticmethod
    def _index_by_id(rows: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        index: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            k = str(r.get("id_card", "")).strip().upper().replace(" ", "")
            if k:
                index.setdefault(k, r)
        return index


def summarize_result(result: ValidationResult) -> str:
    """将校验结果转为可读摘要字符串。"""
    lines = [result.summary or "校验完成"]
    errs = [i for i in result.issues if i.level == "ERROR"]
    warns = [i for i in result.issues if i.level == "WARNING"]
    if errs:
        lines.append(f"--- 错误（{len(errs)}）---")
        for e in errs[:50]:
            loc = f"行{e.row_index} " if e.row_index is not None else ""
            lines.append(f"[ERROR] {loc}{e.field}: {e.message}")
    if warns:
        lines.append(f"--- 警告（{len(warns)}）---")
        for w in warns[:30]:
            loc = f"行{w.row_index} " if w.row_index is not None else ""
            lines.append(f"[WARN]  {loc}{w.field}: {w.message}")
    return "\n".join(lines)
