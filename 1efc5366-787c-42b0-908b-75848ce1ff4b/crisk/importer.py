import os
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from datetime import datetime

import pandas as pd
import chardet
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, \
    TaskProgressColumn, TimeElapsedColumn, TimeRemainingColumn
from rich.table import Table

from .config import REQUIRED_FIELDS, FIELD_MAPPING, WORKSPACE_DIR
from .db import Database, get_db
from .logger import setup_logger, get_console, print_error, print_success, print_warning, print_info

logger = setup_logger("crisk.importer")
console = get_console()


class DataImporter:
    def __init__(self, db: Optional[Database] = None):
        self.db = db or get_db()
        self.errors: List[Dict] = []

    def detect_encoding(self, file_path: Path) -> str:
        with open(file_path, "rb") as f:
            raw_data = f.read(100000)
        result = chardet.detect(raw_data)
        encoding = result["encoding"] or "utf-8"
        confidence = result["confidence"] or 0

        if encoding.lower() in ["gb2312", "gbk", "gb18030"]:
            encoding = "gbk"
        elif encoding.lower() == "ascii":
            encoding = "utf-8"

        logger.info(f"检测到文件编码: {encoding} (置信度: {confidence:.2f})")
        return encoding

    def _map_columns(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        mapped_columns = {}
        missing_fields = []

        for std_field, aliases in FIELD_MAPPING.items():
            found = False
            for alias in aliases:
                for col in df.columns:
                    if str(col).strip().lower() == alias.lower():
                        mapped_columns[col] = std_field
                        found = True
                        break
                if found:
                    break
            if not found:
                missing_fields.append(std_field)

        df = df.rename(columns=mapped_columns)
        return df, missing_fields

    def _clean_data(self, df: pd.DataFrame, source_file: str) -> Tuple[pd.DataFrame, List[Dict]]:
        errors = []
        df = df.copy()

        df["declaration_no"] = df["报关单号"].astype(str).str.strip()
        df["product_name"] = df["品名"].astype(str).str.strip()
        df["hs_code"] = df["HS编码"].astype(str).str.strip().str.replace(r"\D", "", regex=True)
        df["declared_value"] = pd.to_numeric(df["申报货值"], errors="coerce")
        df["quantity"] = pd.to_numeric(df["数量"], errors="coerce")
        df["origin_country"] = df["原产地"].astype(str).str.strip()
        df["destination_country"] = df["目的地"].astype(str).str.strip()
        df["company"] = df["经营单位"].astype(str).str.strip()
        df["transport_mode"] = df["运输方式"].astype(str).str.strip()
        df["consignee"] = df["收货人"].astype(str).str.strip()

        df["declare_date"] = pd.to_datetime(df["申报日期"], errors="coerce").dt.strftime("%Y-%m-%d")

        for idx, row in df.iterrows():
            row_errors = []

            if not row["declaration_no"] or row["declaration_no"] == "nan":
                row_errors.append("报关单号为空")
            if not row["product_name"] or row["product_name"] == "nan":
                row_errors.append("品名为空")
            if not row["hs_code"] or len(row["hs_code"]) < 6:
                row_errors.append("HS编码无效")
            if pd.isna(row["declared_value"]) or row["declared_value"] <= 0:
                row_errors.append("申报货值无效")
            if pd.isna(row["quantity"]) or row["quantity"] <= 0:
                row_errors.append("数量无效")
            if not row["origin_country"] or row["origin_country"] == "nan":
                row_errors.append("原产地为空")
            if not row["destination_country"] or row["destination_country"] == "nan":
                row_errors.append("目的地为空")
            if pd.isna(row["declare_date"]):
                row_errors.append("申报日期格式无效")

            if row_errors:
                errors.append({
                    "row": idx + 2,
                    "declaration_no": row["declaration_no"],
                    "errors": "; ".join(row_errors)
                })

        valid_mask = ~df.index.isin([e["row"] - 2 for e in errors])
        clean_df = df[valid_mask].copy()
        clean_df["source_file"] = source_file

        return clean_df, errors

    def import_file(self, file_path: str, data_type: str = "declarations") -> Dict:
        path = Path(file_path)
        if not path.exists():
            logger.error(f"文件不存在: {file_path}")
            raise FileNotFoundError(f"文件不存在: {file_path}")

        logger.info(f"开始导入文件: {file_path} (类型: {data_type})")

        if path.suffix.lower() == ".csv":
            encoding = self.detect_encoding(path)
            df = pd.read_csv(path, encoding=encoding, low_memory=False)
        elif path.suffix.lower() in [".xlsx", ".xls"]:
            df = pd.read_excel(path)
        else:
            raise ValueError(f"不支持的文件格式: {path.suffix}")

        logger.info(f"读取到 {len(df)} 条记录")

        if data_type == "declarations":
            return self._import_declarations(df, path.name)
        elif data_type == "risk_controls":
            return self._import_risk_controls(df, path.name)
        elif data_type == "inspections":
            return self._import_inspections(df, path.name)
        elif data_type == "cases":
            return self._import_cases(df, path.name)
        else:
            raise ValueError(f"不支持的数据类型: {data_type}")

    def _import_declarations(self, df: pd.DataFrame, source_file: str) -> Dict:
        df, missing_fields = self._map_columns(df)

        if missing_fields:
            error_msg = f"缺少必填字段: {', '.join(missing_fields)}"
            logger.error(error_msg)
            self.errors.append({"file": source_file, "error": error_msg})
            return {"success": False, "error": error_msg, "missing_fields": missing_fields}

        clean_df, row_errors = self._clean_data(df, source_file)
        self.errors.extend([{**e, "file": source_file} for e in row_errors])

        if clean_df.empty:
            return {
                "success": True,
                "inserted": 0,
                "duplicates": 0,
                "errors": len(row_errors),
                "total": len(df),
                "source_file": source_file
            }

        columns_to_keep = [
            "declaration_no", "product_name", "hs_code", "declared_value",
            "quantity", "origin_country", "destination_country", "company",
            "transport_mode", "declare_date", "consignee", "source_file"
        ]
        final_df = clean_df[columns_to_keep].dropna(subset=["declaration_no"])

        inserted, duplicates = self.db.insert_declarations(final_df)

        result = {
            "success": True,
            "inserted": inserted,
            "duplicates": duplicates,
            "errors": len(row_errors),
            "total": len(df),
            "source_file": source_file
        }

        logger.info(f"导入完成: 插入 {inserted} 条, 重复 {duplicates} 条, 错误 {len(row_errors)} 条")
        return result

    def _import_risk_controls(self, df: pd.DataFrame, source_file: str) -> Dict:
        col_map = {}
        for col in df.columns:
            col_lower = str(col).lower()
            if col_lower in ["布控单号", "control_no", "control_id"]:
                col_map[col] = "control_no"
            elif col_lower in ["hs编码", "hs_code", "hs"]:
                col_map[col] = "hs_code"
            elif col_lower in ["经营单位", "company", "enterprise"]:
                col_map[col] = "company"
            elif col_lower in ["原产地", "origin_country", "origin"]:
                col_map[col] = "origin_country"
            elif col_lower in ["风险等级", "risk_level", "level"]:
                col_map[col] = "risk_level"
            elif col_lower in ["布控类型", "control_type", "type"]:
                col_map[col] = "control_type"
            elif col_lower in ["生效日期", "effective_date"]:
                col_map[col] = "effective_date"
            elif col_lower in ["失效日期", "expiry_date"]:
                col_map[col] = "expiry_date"
            elif col_lower in ["描述", "description", "备注"]:
                col_map[col] = "description"

        df = df.rename(columns=col_map)

        for col in ["control_no"]:
            if col not in df.columns:
                return {"success": False, "error": f"缺少必填字段: {col}", "missing_fields": [col]}

        if "effective_date" in df.columns:
            df["effective_date"] = pd.to_datetime(df["effective_date"], errors="coerce").dt.strftime("%Y-%m-%d")
        if "expiry_date" in df.columns:
            df["expiry_date"] = pd.to_datetime(df["expiry_date"], errors="coerce").dt.strftime("%Y-%m-%d")

        for col in ["hs_code", "company", "origin_country", "risk_level", "control_type", "description", "effective_date", "expiry_date"]:
            if col not in df.columns:
                df[col] = None

        columns = ["control_no", "hs_code", "company", "origin_country", "risk_level", "control_type", "effective_date", "expiry_date", "description"]
        final_df = df[columns].fillna("")

        inserted = self.db.insert_risk_controls(final_df)
        return {"success": True, "inserted": inserted, "total": len(df), "source_file": source_file}

    def _import_inspections(self, df: pd.DataFrame, source_file: str) -> Dict:
        col_map = {}
        for col in df.columns:
            col_lower = str(col).lower()
            if col_lower in ["查验单号", "inspection_no"]:
                col_map[col] = "inspection_no"
            elif col_lower in ["报关单号", "declaration_no"]:
                col_map[col] = "declaration_no"
            elif col_lower in ["查验日期", "inspection_date"]:
                col_map[col] = "inspection_date"
            elif col_lower in ["查验结果", "inspection_result", "result"]:
                col_map[col] = "inspection_result"
            elif col_lower in ["查验发现", "findings", "发现问题"]:
                col_map[col] = "findings"
            elif col_lower in ["hs编码", "hs_code"]:
                col_map[col] = "hs_code"
            elif col_lower in ["经营单位", "company"]:
                col_map[col] = "company"

        df = df.rename(columns=col_map)

        for col in ["inspection_no"]:
            if col not in df.columns:
                return {"success": False, "error": f"缺少必填字段: {col}", "missing_fields": [col]}

        if "inspection_date" in df.columns:
            df["inspection_date"] = pd.to_datetime(df["inspection_date"], errors="coerce").dt.strftime("%Y-%m-%d")

        for col in ["declaration_no", "inspection_result", "findings", "hs_code", "company", "inspection_date"]:
            if col not in df.columns:
                df[col] = None

        columns = ["inspection_no", "declaration_no", "inspection_date", "inspection_result", "findings", "hs_code", "company"]
        final_df = df[columns].fillna("")

        inserted = self.db.insert_inspections(final_df)
        return {"success": True, "inserted": inserted, "total": len(df), "source_file": source_file}

    def _import_cases(self, df: pd.DataFrame, source_file: str) -> Dict:
        col_map = {}
        for col in df.columns:
            col_lower = str(col).lower()
            if col_lower in ["案件编号", "case_no", "案件号"]:
                col_map[col] = "case_no"
            elif col_lower in ["案件日期", "case_date", "立案日期"]:
                col_map[col] = "case_date"
            elif col_lower in ["案件类型", "case_type", "类型"]:
                col_map[col] = "case_type"
            elif col_lower in ["hs编码", "hs_code"]:
                col_map[col] = "hs_code"
            elif col_lower in ["经营单位", "company", "涉案企业"]:
                col_map[col] = "company"
            elif col_lower in ["原产地", "origin_country", "来源国"]:
                col_map[col] = "origin_country"
            elif col_lower in ["收货人", "consignee"]:
                col_map[col] = "consignee"
            elif col_lower in ["涉案金额", "involved_value", "案值"]:
                col_map[col] = "involved_value"
            elif col_lower in ["案件摘要", "case_summary", "摘要"]:
                col_map[col] = "case_summary"
            elif col_lower in ["判决结果", "verdict", "处理结果"]:
                col_map[col] = "verdict"

        df = df.rename(columns=col_map)

        for col in ["case_no"]:
            if col not in df.columns:
                return {"success": False, "error": f"缺少必填字段: {col}", "missing_fields": [col]}

        if "case_date" in df.columns:
            df["case_date"] = pd.to_datetime(df["case_date"], errors="coerce").dt.strftime("%Y-%m-%d")
        if "involved_value" in df.columns:
            df["involved_value"] = pd.to_numeric(df["involved_value"], errors="coerce")

        for col in ["case_date", "case_type", "hs_code", "company", "origin_country", "consignee", "involved_value", "case_summary", "verdict"]:
            if col not in df.columns:
                df[col] = None

        columns = ["case_no", "case_date", "case_type", "hs_code", "company", "origin_country", "consignee", "involved_value", "case_summary", "verdict"]
        final_df = df[columns].fillna("")

        inserted = self.db.insert_cases(final_df)
        return {"success": True, "inserted": inserted, "total": len(df), "source_file": source_file}

    def import_batch(self, file_paths: List[str], data_type: str = "declarations") -> List[Dict]:
        results = []
        total_files = len(file_paths)

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeElapsedColumn(),
            TimeRemainingColumn(),
            console=console,
        ) as progress:
            task = progress.add_task(f"[cyan]导入 {total_files} 个文件...", total=total_files)

            for file_path in file_paths:
                progress.update(task, description=f"[cyan]导入: {Path(file_path).name}")
                try:
                    result = self.import_file(file_path, data_type)
                    results.append(result)
                    if result["success"]:
                        progress.advance(task)
                    else:
                        logger.error(f"导入失败: {file_path} - {result.get('error', '未知错误')}")
                except Exception as e:
                    logger.error(f"导入异常: {file_path} - {str(e)}")
                    results.append({
                        "success": False,
                        "file": file_path,
                        "error": str(e)
                    })
                    progress.advance(task)

        return results

    def print_errors(self) -> None:
        if not self.errors:
            return

        table = Table(title="导入错误清单", show_header=True, header_style="bold magenta")
        table.add_column("文件", style="cyan")
        table.add_column("行号", style="yellow", justify="right")
        table.add_column("报关单号", style="white")
        table.add_column("错误描述", style="red")

        for err in self.errors[:50]:
            table.add_row(
                err.get("file", ""),
                str(err.get("row", "")),
                err.get("declaration_no", ""),
                err.get("errors", err.get("error", ""))
            )

        if len(self.errors) > 50:
            console.print(f"[dim]... 还有 {len(self.errors) - 50} 条错误未显示[/dim]")

        console.print(table)
        error_file = WORKSPACE_DIR / f"import_errors_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        error_file.parent.mkdir(parents=True, exist_ok=True)
        pd.DataFrame(self.errors).to_csv(error_file, index=False, encoding="utf-8-sig")
        print_warning(f"错误清单已保存至: {error_file}")

    def print_summary(self, results: List[Dict]) -> None:
        total_inserted = sum(r.get("inserted", 0) for r in results if r["success"])
        total_duplicates = sum(r.get("duplicates", 0) for r in results if r["success"])
        total_errors = sum(r.get("errors", 0) for r in results if r["success"])
        total_records = sum(r.get("total", 0) for r in results if r["success"])
        failed_files = [r for r in results if not r["success"]]

        table = Table(title="导入汇总", show_header=True, header_style="bold green")
        table.add_column("指标", style="cyan")
        table.add_column("数值", style="white", justify="right")

        table.add_row("文件总数", str(len(results)))
        table.add_row("成功文件", str(len(results) - len(failed_files)))
        table.add_row("失败文件", str(len(failed_files)))
        table.add_row("总记录数", str(total_records))
        table.add_row("成功插入", f"[green]{total_inserted}[/green]")
        table.add_row("重复跳过", f"[yellow]{total_duplicates}[/yellow]")
        table.add_row("数据错误", f"[red]{total_errors}[/red]")

        console.print(table)

        if failed_files:
            err_table = Table(title="失败文件", show_header=True, header_style="bold red")
            err_table.add_column("文件", style="cyan")
            err_table.add_column("错误", style="red")
            for r in failed_files:
                err_table.add_row(r.get("file", r.get("source_file", "")), r.get("error", "未知错误"))
            console.print(err_table)


def get_importer(db: Optional[Database] = None) -> DataImporter:
    return DataImporter(db)
