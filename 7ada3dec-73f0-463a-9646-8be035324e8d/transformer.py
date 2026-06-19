"""
transformer.py — CDISC SDTM 域映射与单位换算

职责：
  1. 将 ingestor 产出的统一 DataFrame 按 _domain 拆分到各 SDTM 域。
  2. 依据配置映射规则，将原始变量名重命名为 SDTM 标准变量。
  3. 执行数据类型强转（数值/日期/字符串）。
  4. 对 LB/VS 域执行单位换算，生成标准结果列 (*STRESN / *STRESU)。
  5. 对缺失值按 CDISC 控制术语编码。

输出：{domain_code: SDTM DataFrame}，附带元信息列。
"""
from __future__ import annotations

import re
from typing import Any

import pandas as pd

from models import hash_bytes, now_iso

_META_COLS = ("_center_id", "_source", "_row_index", "_source_sheet")


class SDTMTransformer:
    """SDTM 域映射与转换器。"""

    def __init__(self, config: dict[str, Any]):
        self.config = config
        sdtm = config.get("sdtm", {})
        self.domains: dict[str, dict] = sdtm.get("domains", {})
        self.mappings: list[dict] = sdtm.get("mappings", [])
        units = config.get("units", {})
        self.default_targets: dict[str, str] = units.get("default_targets", {})
        self.conversions: list[dict] = units.get("conversions", [])
        mv = config.get("missing_values", {})
        self.missing_terms: dict[str, str] = {
            k.strip(): v for k, v in mv.get("terms", {}).items()
        }
        self.controlled_terms: dict[str, list[str]] = config.get(
            "controlled_terms", {}
        )
        # 原始规范名 -> (域, 目标SDTM变量, 类型)
        self.raw_to_target: dict[str, tuple[str, str, str]] = {}
        for m in self.mappings:
            aliases = m.get("aliases", [])
            if not aliases:
                continue
            canonical = aliases[0]
            self.raw_to_target[canonical] = (
                m.get("domain", ""),
                m.get("target", canonical),
                m.get("type", "string"),
            )
        # 跨域通用列：受试者标识（STUDYID/USUBJID/SITEID）与访视标识
        # （VISITNUM/VISIT）是多个域的主键组成部分，不论原始映射声明域为何，
        # 均向所有域传播，避免非 DM/SV 域丢失主键导致合并笛卡尔爆炸。
        _UNIVERSAL_COLS = {"STUDYID", "USUBJID", "SITEID", "VISITNUM", "VISIT"}
        self.id_targets: dict[str, tuple[str, str]] = {}
        for m in self.mappings:
            tgt = m.get("target", "")
            if tgt not in _UNIVERSAL_COLS:
                continue
            for a in m.get("aliases", []):
                self.id_targets[a] = (tgt, m.get("type", "string"))
        # 单位换算查找表：(test, from_unit) -> (to_unit, factor, offset, then_divide)
        self.conv_lookup: dict[tuple[str, str], tuple[str, float, float, float | None]] = {}
        for c in self.conversions:
            key = (c["test"], str(c["from"]).strip())
            self.conv_lookup[key] = (
                c["to"], float(c.get("factor", 1.0)),
                float(c.get("offset", 0.0)),
                c.get("then_divide"),
            )

    # ------------------------------------------------------------------
    # 公共接口
    # ------------------------------------------------------------------
    def transform(self, df: pd.DataFrame) -> dict[str, pd.DataFrame]:
        """将统一 DataFrame 转换为 SDTM 域字典。"""
        if df.empty:
            return {}
        bundle: dict[str, pd.DataFrame] = {}
        domains_present = self._domains_in_df(df)
        for domain in domains_present:
            sub = self._slice_domain(df, domain)
            if sub is None or sub.empty:
                continue
            sub = self._rename_to_sdtm(sub, domain)
            sub = self._coerce_types(sub, domain)
            sub = self._convert_units(sub, domain)
            sub = self._code_missing(sub)
            sub = self._normalize_enums(sub)
            sub["DOMAIN"] = domain
            # 保证 SDTM 主键在前
            sub = self._reorder_columns(sub, domain)
            bundle[domain] = sub
        return bundle

    def to_long(self, bundle: dict[str, pd.DataFrame]) -> pd.DataFrame:
        """合并各域为长表，便于跨域校验与快照。"""
        frames = []
        for domain, ddf in bundle.items():
            frames.append(ddf)
        if not frames:
            return pd.DataFrame()
        return pd.concat(frames, ignore_index=True, sort=False)

    def transform_manifest(self, bundle: dict[str, pd.DataFrame]) -> dict[str, Any]:
        """生成转换清单，供稽查轨迹记录。"""
        manifest = {
            "transformed_at": now_iso(),
            "domains": {
                dom: {"rows": len(ddf), "cols": list(ddf.columns)}
                for dom, ddf in bundle.items()
            },
            "total_rows": sum(len(ddf) for ddf in bundle.values()),
            "checksum": self._bundle_checksum(bundle),
        }
        return manifest

    # ------------------------------------------------------------------
    # 内部实现
    # ------------------------------------------------------------------
    def _domains_in_df(self, df: pd.DataFrame) -> list[str]:
        if "_domain" not in df.columns:
            return list(self.domains.keys())
        present = df["_domain"].astype(str).str.upper().replace("", pd.NA).dropna().unique()
        # 既保留数据中出现的域，也保证配置域被遍历
        known = set(self.domains.keys())
        result = [d for d in known if d in present]
        result += [d for d in present if d not in known]
        return result or list(self.domains.keys())

    def _slice_domain(self, df: pd.DataFrame, domain: str) -> pd.DataFrame | None:
        if "_domain" not in df.columns:
            return None
        mask = df["_domain"].astype(str).str.upper() == domain.upper()
        sub = df.loc[mask].copy()
        return sub

    def _rename_to_sdtm(self, sub: pd.DataFrame, domain: str) -> pd.DataFrame:
        rename: dict[str, str] = {}
        keep: set[str] = set()
        for raw, (dom, target, _t) in self.raw_to_target.items():
            if dom.upper() != domain.upper():
                continue
            if raw in sub.columns and raw != target:
                rename[raw] = target
            if raw in sub.columns or target in sub.columns:
                keep.add(target)
        # 跨域传播受试者标识（USUBJID/STUDYID/SITEID），避免非 DM 域丢失主键
        for raw, (target, _t) in self.id_targets.items():
            if raw in sub.columns and raw != target:
                rename[raw] = target
            if raw in sub.columns or target in sub.columns:
                keep.add(target)
        if rename:
            sub = sub.rename(columns=rename)
        # 保留 SDTM 目标列 + 元信息列
        cols = [c for c in sub.columns
                if c in keep or c in _META_COLS or c.startswith("_")]
        return sub[cols].copy()

    def _coerce_types(self, sub: pd.DataFrame, domain: str) -> pd.DataFrame:
        for raw, (dom, target, typ) in self.raw_to_target.items():
            if dom.upper() != domain.upper():
                continue
            if target not in sub.columns:
                continue
            sub = self._coerce_col(sub, target, typ)
        # 同步强转通用标识列类型
        for raw, (target, typ) in self.id_targets.items():
            if target in sub.columns:
                sub = self._coerce_col(sub, target, typ)
        return sub

    @staticmethod
    def _coerce_col(sub: pd.DataFrame, target: str, typ: str) -> pd.DataFrame:
        col = sub[target]
        if typ == "number":
            sub[target] = pd.to_numeric(col, errors="coerce")
        elif typ == "date":
            parsed = pd.to_datetime(col, errors="coerce", format="ISO8601")
            if parsed.notna().mean() < 0.5:
                parsed = pd.to_datetime(col, errors="coerce")
            sub[target] = parsed.dt.strftime("%Y-%m-%d")
        else:
            sub[target] = col.astype(str).str.strip().replace({"nan": "", "NaT": ""})
        return sub

    def _convert_units(self, sub: pd.DataFrame, domain: str) -> pd.DataFrame:
        if domain.upper() == "LB":
            return self._convert_lab_units(sub, "LB")
        if domain.upper() == "VS":
            return self._convert_lab_units(sub, "VS")
        return sub

    def _convert_lab_units(self, sub: pd.DataFrame, prefix: str) -> pd.DataFrame:
        test_col = f"{prefix}TESTCD"
        orres_col = f"{prefix}ORRES"
        orresu_col = f"{prefix}ORRESU"
        stresn_col = f"{prefix}STRESN"
        stresu_col = f"{prefix}STRESU"
        if orres_col in sub.columns:
            sub[stresn_col] = pd.to_numeric(sub[orres_col], errors="coerce")
        else:
            sub[stresn_col] = pd.NA
        if orresu_col not in sub.columns:
            sub[orresu_col] = ""
        sub[stresu_col] = sub[orresu_col].astype(str).str.strip()
        # 标准化结果列：默认等于原始
        sub[stresu_col] = sub[orresu_col].astype(str).str.strip()

        if test_col not in sub.columns:
            return sub
        tests = sub[test_col].astype(str).str.upper()
        units = sub[orresu_col].astype(str).str.strip()
        converted_mask = pd.Series(False, index=sub.index)
        for (test, from_unit), (to_unit, factor, offset, then_div) in self.conv_lookup.items():
            mask = (tests == test.upper()) & (units == from_unit)
            if not mask.any():
                continue
            vals = sub.loc[mask, stresn_col].astype(float)
            converted = (vals + offset) * factor
            if then_div:
                converted = converted / float(then_div)
            sub.loc[mask, stresn_col] = converted
            sub.loc[mask, stresu_col] = to_unit
            converted_mask |= mask
        # 未匹配到换算规则：若单位已是默认标准单位，保持；否则尝试默认目标
        default_mask = (~converted_mask) & sub[stresn_col].notna()
        if default_mask.any():
            for test, tgt in self.default_targets.items():
                m = default_mask & (tests == test.upper())
                if m.any():
                    sub.loc[m, stresu_col] = tgt
        return sub

    def _code_missing(self, sub: pd.DataFrame) -> pd.DataFrame:
        """对字符串列按 CDISC 控制术语编码缺失值。"""
        if not self.missing_terms:
            return sub
        for col in sub.columns:
            if col.startswith("_") or col in ("DOMAIN",):
                continue
            if sub[col].dtype == object or str(sub[col].dtype) == "string":
                s = sub[col].astype(str).str.strip()
                mapped = s.map(self.missing_terms)
                # 仅对命中缺失词的行替换，其余保留原值
                hit = mapped.notna() & (s.isin(self.missing_terms.keys()) | (s == ""))
                sub.loc[hit, col] = mapped[hit]
                # 真正的空值（NaN）也编码
                sub.loc[sub[col].isna(), col] = "未采集"
        return sub

    def _normalize_enums(self, sub: pd.DataFrame) -> pd.DataFrame:
        """将受控术语字段统一大写，便于枚举校验。"""
        for field in self.controlled_terms:
            if field in sub.columns:
                sub[field] = sub[field].astype(str).str.strip().str.upper()
                sub[field] = sub[field].replace({"NAN": "", "": ""})
        return sub

    def _reorder_columns(self, sub: pd.DataFrame, domain: str) -> pd.DataFrame:
        domain_def = self.domains.get(domain, {})
        keys = domain_def.get("keys", [])
        meta = [c for c in _META_COLS if c in sub.columns]
        ordered = [c for c in keys if c in sub.columns]
        rest = [c for c in sub.columns
                if c not in ordered and c not in meta and c != "DOMAIN"]
        return sub[ordered + ["DOMAIN"] + rest + meta].copy()

    def _bundle_checksum(self, bundle: dict[str, pd.DataFrame]) -> str:
        parts = []
        for dom in sorted(bundle):
            parts.append(f"{dom}:{len(bundle[dom])}:{hash_bytes(bundle[dom].to_csv(index=False).encode())[:12]}")
        return hash_bytes("\n".join(parts).encode())[:16]


__all__ = ["SDTMTransformer"]
