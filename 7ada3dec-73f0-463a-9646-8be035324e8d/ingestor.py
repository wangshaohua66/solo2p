"""
ingestor.py — 多格式数据源读取与统一 DataFrame 转换

支持的输入格式：
  1. XML   —— Medidata Rave 导出的 ODM 风格嵌套结构 / 扁平记录结构
  2. Excel —— 多 Sheet 模板，每个 Sheet 对应一个 SDTM 域
  3. CSV   —— 自定义单表格式，列名为原始变量

输出：统一的 pandas.DataFrame，列名已归一化为「原始变量规范名」，
日期列已统一为 ISO-8601 (YYYY-MM-DD) 字符串，并附带元信息列：
  _domain    域标识（可推断时填充）
  _center_id 中心编号
  _source    源文件名
  _row_index 源内行号
"""
from __future__ import annotations

import io
import re
from pathlib import Path
from typing import Any

import pandas as pd
from lxml import etree

from models import ImportSummary, SourceFormat, hash_file

# 尝试解码顺序：兼顾中文中心常见编码
_ENCODINGS = ("utf-8-sig", "utf-8", "gb18030", "gbk", "latin-1")

# 日期解析候选格式（按优先级）
_DATE_FORMATS = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%Y%m%d",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%d-%m-%Y",
    "%d.%m.%Y",
    "%Y年%m月%d日",
)

_DOMAIN_PATTERN = re.compile(r"\b(DM|VS|LB|AE|EX|MH|CM|DS|SV|TU)\b", re.IGNORECASE)


class DataIngestor:
    """多源数据导入器。"""

    def __init__(self, mappings: list[dict[str, Any]] | None = None,
                 centers: list[dict[str, Any]] | None = None):
        self.mappings = mappings or []
        self.centers = centers or []
        # 别名(小写) -> 规范原始变量名（取每个 mapping 的首个别名）
        self.alias_map: dict[str, str] = {}
        self.date_fields: set[str] = set()
        for m in self.mappings:
            aliases: list[str] = m.get("aliases", [])
            if not aliases:
                continue
            canonical = aliases[0]
            for a in aliases:
                self.alias_map[str(a).strip().lower()] = canonical
            if m.get("type") == "date":
                self.date_fields.add(canonical)
        self.center_by_id = {c["id"]: c for c in self.centers}

    # ------------------------------------------------------------------
    # 公共接口
    # ------------------------------------------------------------------
    def detect_format(self, path: str | Path) -> SourceFormat:
        """根据扩展名与文件头识别数据源格式。"""
        p = Path(path)
        ext = p.suffix.lower().lstrip(".")
        if ext == "xml":
            return SourceFormat.XML
        if ext in ("xlsx", "xlsm", "xls"):
            return SourceFormat.EXCEL
        if ext in ("csv", "tsv", "txt"):
            return SourceFormat.CSV
        # 内容嗅探
        try:
            head = p.read_bytes()[:512].lstrip()
            if head.startswith(b"<?xml") or head.startswith(b"<"):
                return SourceFormat.XML
        except OSError:
            pass
        return SourceFormat.UNKNOWN

    def ingest(self, path: str | Path, center_id: str | None = None,
               encoding: str | None = None) -> tuple[pd.DataFrame, ImportSummary]:
        """读取数据源，返回统一 DataFrame 与导入摘要。"""
        p = Path(path)
        fmt = self.detect_format(p)
        if fmt == SourceFormat.UNKNOWN:
            raise ValueError(f"无法识别的数据源格式: {p}")
        file_hash = hash_file(p)
        warnings: list[str] = []

        if fmt == SourceFormat.XML:
            df, enc = self._ingest_xml(p)
        elif fmt == SourceFormat.EXCEL:
            df, enc = self._ingest_excel(p, warnings)
        else:
            df, enc = self._ingest_csv(p, encoding, warnings)

        # 中心编号：显式 > 从文件名推断 > 从中心注册表
        cid = center_id or self._infer_center(p)
        df = self._annotate(df, p, cid, fmt.value)

        # 列名归一化
        df = self._normalize_columns(df, warnings)

        # 日期格式归一化
        df = self._normalize_dates(df, warnings)

        # _domain 推断：确保列存在，并对空值行按列特征补齐域标识
        if "_domain" not in df.columns:
            df["_domain"] = ""
        else:
            df["_domain"] = df["_domain"].astype(str).str.strip().str.upper()
            df.loc[df["_domain"].isin(["", "NAN", "NONE"]), "_domain"] = ""
        df = self._infer_domain(df)

        summary = ImportSummary(
            source=str(p),
            format=fmt.value,
            center_id=cid,
            total_rows=len(df),
            accepted_rows=len(df),
            skipped_rows=0,
            sheets=self._last_sheets,
            encoding=enc,
            warnings=warnings,
            file_hash=file_hash,
        )
        return df, summary

    # ------------------------------------------------------------------
    # 各格式解析
    # ------------------------------------------------------------------
    def _ingest_xml(self, p: Path) -> tuple[pd.DataFrame, str]:
        """解析 XML（Rave ODM 嵌套结构或扁平记录）。

        采用 start/end 事件流式解析：start 时记录域上下文与受试者属性，
        ItemData 的 end 时取值（兼容属性值与文本值两种写法），
        ItemGroupData 的 end 时收尾成行。降低内存峰值。
        """
        rows: list[dict[str, Any]] = []
        context = etree.iterparse(str(p), events=("start", "end"),
                                  recover=True, huge_tree=True)
        domain_stack: list[str] = []
        subject: dict[str, Any] = {}
        current_row: dict[str, Any] | None = None
        # Rave 属性名 -> 标准原始变量名（便于跨域传播受试者标识）
        _subj_attr_map = {"SubjectKey": "SUBJID", "StudyOID": "STUDYID", "SiteOID": "SITEID"}
        for event, elem in context:
            tag = etree.QName(elem).localname
            if event == "start":
                if tag in ("SubjectData", "Subject", "Patient"):
                    subject = {
                        _subj_attr_map.get(a, a): elem.get(a)
                        for a in ("SubjectKey", "StudyOID", "SiteOID")
                        if elem.get(a) is not None
                    }
                elif tag in ("FormData", "Form", "FormDef"):
                    oid = (elem.get("FormOID") or elem.get("OID")
                           or elem.get("name") or "")
                    domain_stack.append(str(oid).upper())
                elif tag in ("ItemGroupData", "Record", "row"):
                    current_row = dict(subject)
            else:  # end
                if tag == "ItemData" and current_row is not None:
                    oid = elem.get("ItemOID") or elem.get("OID")
                    if oid:
                        val = elem.get("Value")
                        if val is None and elem.text:
                            val = elem.text.strip()
                        current_row[oid] = val
                elif tag in ("ItemGroupData", "Record", "row") and current_row is not None:
                    current_row["_domain"] = domain_stack[-1] if domain_stack else ""
                    rows.append(current_row)
                    current_row = None
                elif tag in ("FormData", "Form", "FormDef") and domain_stack:
                    domain_stack.pop()
                elif tag in ("SubjectData", "Subject", "Patient"):
                    subject = {}
                # 仅在 end 事件清理元素，避免在 start 时清除尚未解析的子节点
                elem.clear()
        df = pd.DataFrame(rows)
        if df.empty:
            df = self._ingest_xml_flat(p)
        return df, "utf-8"

    def _ingest_xml_flat(self, p: Path) -> pd.DataFrame:
        """极简兜底解析：每个 <Record> 子元素为字段。"""
        tree = etree.parse(str(p))
        root = tree.getroot()
        records = []
        rec_tag = None
        for child in root.iter():
            lt = etree.QName(child).localname
            if lt in ("Record", "record", "ItemGroupData", "row"):
                rec_tag = lt
                break
        for elem in root.iter(rec_tag):
            row = {etree.QName(c).localname: (c.text or "").strip()
                   for c in elem if isinstance(c.tag, str)}
            if elem.get("domain"):
                row["_domain"] = elem.get("domain")
            records.append(row)
        return pd.DataFrame(records)

    def _ingest_excel(self, p: Path, warnings: list[str]) -> tuple[pd.DataFrame, str]:
        """多 Sheet 模板解析：每个 Sheet 视为一个域。"""
        sheets = pd.read_excel(p, sheet_name=None, dtype=str, engine="openpyxl")
        self._last_sheets = list(sheets.keys())
        frames: list[pd.DataFrame] = []
        for sheet_name, sdf in sheets.items():
            if sdf is None or sdf.empty:
                continue
            sdf = sdf.copy()
            match = _DOMAIN_PATTERN.search(str(sheet_name))
            domain = match.group(1).upper() if match else str(sheet_name).upper()
            sdf["_domain"] = domain
            sdf["_source_sheet"] = sheet_name
            frames.append(sdf)
        if not frames:
            return pd.DataFrame(), "utf-8"
        df = pd.concat(frames, ignore_index=True, sort=False)
        return df, "utf-8"

    def _ingest_csv(self, p: Path, encoding: str | None,
                    warnings: list[str]) -> tuple[pd.DataFrame, str]:
        """CSV 解析，处理编码差异与分隔符差异。"""
        enc = encoding or self._detect_encoding(p)
        sep = self._detect_separator(p, enc)
        try:
            df = pd.read_csv(p, dtype=str, sep=sep, encoding=enc,
                            keep_default_na=False, na_values=[""])
        except UnicodeDecodeError:
            warnings.append(f"编码 {enc} 解码失败，回退 gb18030")
            enc = "gb18030"
            df = pd.read_csv(p, dtype=str, sep=sep, encoding=enc,
                             keep_default_na=False, na_values=[""])
        if "_domain" not in df.columns:
            # 自定义 CSV 常用 DOMAIN 列标识行所属域，映射至 _domain
            dom_col = next((c for c in df.columns
                            if str(c).strip().lower() == "domain"), None)
            if dom_col is not None:
                df["_domain"] = df[dom_col].astype(str).str.upper()
                if dom_col != "_domain":
                    df = df.drop(columns=[dom_col])
            else:
                df["_domain"] = ""
        return df, enc

    # ------------------------------------------------------------------
    # 编码与分隔符探测
    # ------------------------------------------------------------------
    def _detect_encoding(self, p: Path) -> str:
        sample = p.read_bytes()[:65536]
        for enc in _ENCODINGS:
            try:
                sample.decode(enc)
            except (UnicodeDecodeError, LookupError):
                continue
            # 含中文时 gb18030 可能误判 latin-1；优先带 BOM / utf-8
            return enc
        return "latin-1"

    def _detect_separator(self, p: Path, enc: str) -> str:
        try:
            head = p.read_text(encoding=enc)[:4096]
        except (UnicodeDecodeError, OSError):
            return ","
        first_line = head.splitlines()[0] if head.splitlines() else ""
        counts = {sep: first_line.count(sep) for sep in (",", "\t", ";", "|")}
        return max(counts, key=counts.get) if max(counts.values()) > 0 else ","

    # ------------------------------------------------------------------
    # 归一化
    # ------------------------------------------------------------------
    def _annotate(self, df: pd.DataFrame, p: Path, center_id: str | None,
                  fmt: str) -> pd.DataFrame:
        df = df.copy()
        df["_source"] = p.name
        if center_id:
            df["_center_id"] = center_id
        elif "SITEID" in df.columns:
            # 文件名未体现中心时，按行取 SITEID 作为中心标识
            df["_center_id"] = df["SITEID"].astype(str).str.strip()
        else:
            df["_center_id"] = ""
        df["_row_index"] = range(len(df))
        self._last_sheets = getattr(self, "_last_sheets", [])
        return df

    def _normalize_columns(self, df: pd.DataFrame,
                           warnings: list[str]) -> pd.DataFrame:
        if not self.alias_map and not df.columns.duplicated().any():
            df.columns = [str(c).strip() for c in df.columns]
            return df
        rename: dict[str, str] = {}
        for col in df.columns:
            key = str(col).strip().lower()
            if key in self.alias_map and col != self.alias_map[key]:
                rename[col] = self.alias_map[key]
        if rename:
            df = df.rename(columns=rename)
        # 剩余未识别列名剔除首尾空格
        df.columns = [str(c).strip() for c in df.columns]
        # 不同源/Sheet 可能用不同别名指向同一 SDTM 变量，重命名后产生重复列：
        # 将重复列按行合并（取首个非空值），避免后续 concat/校验报错。
        df = self._coalesce_duplicate_columns(df)
        unmapped = [c for c in df.columns
                    if c not in self.alias_map and not str(c).startswith("_")]
        if unmapped and len(unmapped) <= 20:
            warnings.append(f"未映射的列(将原样保留): {', '.join(unmapped)}")
        return df

    def _coalesce_duplicate_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        names = list(df.columns)
        if len(set(names)) == len(names):
            return df
        out = pd.DataFrame(index=df.index)
        added: set[str] = set()
        for name in names:
            if name in added:
                continue
            added.add(name)
            positions = [i for i, n in enumerate(names) if n == name]
            block = df.iloc[:, positions]
            if block.shape[1] == 1:
                out[name] = block.iloc[:, 0]
            else:
                # 按行取首个非空，合并多列
                out[name] = block.bfill(axis=1).iloc[:, 0]
        return out

    def _normalize_dates(self, df: pd.DataFrame,
                         warnings: list[str]) -> pd.DataFrame:
        for col in list(df.columns):
            if col in self.date_fields and col in df.columns:
                parsed = self._try_parse_date_series(df[col])
                if parsed is not None:
                    df[col] = parsed
        return df

    def _try_parse_date_series(self, s: pd.Series) -> pd.Series | None:
        s = s.astype(str).str.strip()
        for fmt in _DATE_FORMATS:
            try:
                parsed = pd.to_datetime(s, format=fmt, errors="coerce")
            except (ValueError, TypeError):
                continue
            ratio = parsed.notna().mean()
            if ratio > 0.8:
                return parsed.dt.strftime("%Y-%m-%d")
        # 回退：让 pandas 自动推断
        try:
            parsed = pd.to_datetime(s, errors="coerce", dayfirst=False)
            return parsed.dt.strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            return None

    def _infer_domain(self, df: pd.DataFrame) -> pd.DataFrame:
        """对无 _domain 的行，依据列特征推断域。"""
        if "_domain" not in df.columns:
            df["_domain"] = ""
        mask = (df["_domain"].astype(str) == "") | df["_domain"].isna()
        if not mask.any():
            return df
        cols = set(df.columns)
        hints = [
            ({"LBTESTCD", "LBORRES", "LBSTRESN"}, "LB"),
            ({"VSTESTCD", "VSORRES", "VSSTRESN"}, "VS"),
            ({"AETERM", "AESEV"}, "AE"),
            ({"EXTRT", "EXDOSE"}, "EX"),
            ({"CMTRT"}, "CM"),
            ({"DSDECOD"}, "DS"),
            ({"VISITNUM", "SVSTDTC"}, "SV"),
            ({"SEX", "AGE", "USUBJID"}, "DM"),
        ]
        for idx in df.index[mask]:
            row_cols = {c for c in cols
                        if c in df.columns and pd.notna(df.at[idx, c])}
            for fields, dom in hints:
                if fields & row_cols:
                    df.at[idx, "_domain"] = dom
                    break
        return df

    def _infer_center(self, p: Path) -> str | None:
        name = p.stem.upper()
        for cid in self.center_by_id:
            if cid.upper() in name:
                return cid
        m = re.search(r"C0\d", name)
        return m.group(0) if m else None


__all__ = ["DataIngestor"]
