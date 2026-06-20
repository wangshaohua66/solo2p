import json
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, timedelta
from difflib import SequenceMatcher

import pandas as pd
import numpy as np
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn, TimeElapsedColumn
from rich.table import Table

from .config import ConfigManager, DetectionThresholds, get_config_manager
from .db import Database, get_db
from .logger import setup_logger, get_console, print_risk_level

logger = setup_logger("crisk.analyzer")
console = get_console()


class BaseAnalyzer:
    def __init__(self, db: Database, config: ConfigManager):
        self.db = db
        self.config = config

    def _determine_risk_level(self, score: float) -> str:
        if score >= 0.7:
            return "高风险"
        elif score >= 0.4:
            return "中风险"
        else:
            return "低风险"


class LowPriceAnalyzer(BaseAnalyzer):
    def detect(self, start_date: Optional[str] = None, end_date: Optional[str] = None,
               custom_threshold: Optional[float] = None) -> List[Dict]:
        logger.info("开始低报检测分析")
        clues = []

        if start_date and end_date:
            df = self.db.get_declarations_by_date_range(start_date, end_date)
        else:
            with self.db.get_connection() as conn:
                df = pd.read_sql_query("SELECT * FROM declarations ORDER BY declare_date", conn)

        if df.empty:
            logger.warning("没有报关单数据可供分析")
            return clues

        hs_groups = df.groupby("hs_prefix6")
        total_groups = len(hs_groups)

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeElapsedColumn(),
            console=console,
            transient=True,
        ) as progress:
            task = progress.add_task("[cyan]低报检测中...", total=total_groups)

            for hs_prefix, group in hs_groups:
                if len(group) < 3:
                    progress.advance(task)
                    continue

                industry_avg = group["unit_price"].median()
                if industry_avg <= 0:
                    progress.advance(task)
                    continue

                threshold = custom_threshold if custom_threshold is not None else \
                    self.config.thresholds.get_threshold_for_category(hs_prefix)

                for _, row in group.iterrows():
                    declared_price = row["unit_price"]
                    if declared_price <= 0:
                        continue

                    deviation = abs(declared_price - industry_avg) / industry_avg

                    if deviation > threshold:
                        deviation_percent = deviation * 100
                        risk_score = min(deviation / 0.5, 1.0)
                        risk_level = self._determine_risk_level(risk_score)

                        clue = {
                            "detection_type": "lowprice",
                            "risk_level": risk_level,
                            "declaration_no": row["declaration_no"],
                            "hs_code": row["hs_code"],
                            "company": row["company"],
                            "consignee": row["consignee"],
                            "analysis_details": json.dumps({
                                "hs_category": hs_prefix,
                                "deviation_direction": "低报" if declared_price < industry_avg else "高报",
                            }, ensure_ascii=False),
                            "deviation_percent": round(deviation_percent, 2),
                            "industry_avg_price": round(industry_avg, 2),
                            "declared_price": round(declared_price, 2),
                        }
                        clues.append(clue)

                progress.advance(task)

        logger.info(f"低报检测完成，发现 {len(clues)} 条线索")
        return clues


class SplitOrderAnalyzer(BaseAnalyzer):
    def detect(self, start_date: Optional[str] = None, end_date: Optional[str] = None,
               window_days: Optional[int] = None, min_shipments: Optional[int] = None,
               value_threshold: Optional[float] = None) -> List[Dict]:
        logger.info("开始拆单识别分析")
        clues = []

        thresholds = self.config.thresholds
        window_days = window_days or thresholds.split_window_days
        min_shipments = min_shipments or thresholds.split_min_shipments
        value_threshold = value_threshold or thresholds.split_value_threshold

        if start_date and end_date:
            df = self.db.get_declarations_by_date_range(start_date, end_date)
        else:
            with self.db.get_connection() as conn:
                df = pd.read_sql_query("SELECT * FROM declarations ORDER BY declare_date", conn)

        if df.empty:
            logger.warning("没有报关单数据可供分析")
            return clues

        df["declare_date_dt"] = pd.to_datetime(df["declare_date"])

        groups = df.groupby(["consignee", "hs_prefix6"])
        total_groups = len(groups)

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeElapsedColumn(),
            console=console,
            transient=True,
        ) as progress:
            task = progress.add_task("[cyan]拆单识别中...", total=total_groups)

            for (consignee, hs_prefix), group in groups:
                if len(group) < min_shipments:
                    progress.advance(task)
                    continue

                group = group.sort_values("declare_date_dt").reset_index(drop=True)

                for i in range(len(group)):
                    window_start = group.loc[i, "declare_date_dt"]
                    window_end = window_start + timedelta(days=window_days)

                    window_mask = (group["declare_date_dt"] >= window_start) & (group["declare_date_dt"] <= window_end)
                    window_group = group[window_mask]

                    shipment_count = len(window_group)
                    total_value = window_group["declared_value"].sum()

                    if shipment_count >= min_shipments or total_value >= value_threshold:
                        risk_score = min((shipment_count / 10) + (total_value / value_threshold) * 0.5, 1.0)
                        risk_level = self._determine_risk_level(risk_score)

                        declaration_nos = window_group["declaration_no"].tolist()
                        first_row = window_group.iloc[0]

                        clue = {
                            "detection_type": "split",
                            "risk_level": risk_level,
                            "declaration_no": declaration_nos[0],
                            "hs_code": first_row["hs_code"],
                            "company": first_row["company"],
                            "consignee": consignee,
                            "analysis_details": json.dumps({
                                "hs_category": hs_prefix,
                                "related_declarations": declaration_nos,
                            }, ensure_ascii=False),
                            "shipment_count": shipment_count,
                            "total_value": round(total_value, 2),
                            "window_start": window_start.strftime("%Y-%m-%d"),
                            "window_end": window_end.strftime("%Y-%m-%d"),
                        }
                        clues.append(clue)
                        break

                progress.advance(task)

        logger.info(f"拆单识别完成，发现 {len(clues)} 条线索")
        return clues


class FakeDeclarationAnalyzer(BaseAnalyzer):
    def detect(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict]:
        logger.info("开始伪报检测分析")
        clues = []

        if start_date and end_date:
            df = self.db.get_declarations_by_date_range(start_date, end_date)
        else:
            with self.db.get_connection() as conn:
                df = pd.read_sql_query("SELECT * FROM declarations ORDER BY declare_date", conn)

        if df.empty:
            logger.warning("没有报关单数据可供分析")
            return clues

        rules = self.config.rule_set.hs_rules
        rule_map = {rule.hs_prefix: rule for rule in rules}

        total_rows = len(df)

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeElapsedColumn(),
            console=console,
            transient=True,
        ) as progress:
            task = progress.add_task("[cyan]伪报检测中...", total=total_rows)

            for _, row in df.iterrows():
                hs_code = row["hs_code"]
                product_name = row["product_name"]
                hs_prefix = hs_code[:6]

                matching_rule = None
                for prefix, rule in rule_map.items():
                    if hs_prefix.startswith(prefix):
                        matching_rule = rule
                        break

                if matching_rule is None:
                    progress.advance(task)
                    continue

                if not matching_rule.matches(product_name):
                    risk_score = 0.6
                    risk_level = self._determine_risk_level(risk_score)

                    clue = {
                        "detection_type": "fake",
                        "risk_level": risk_level,
                        "declaration_no": row["declaration_no"],
                        "hs_code": hs_code,
                        "company": row["company"],
                        "consignee": row["consignee"],
                        "analysis_details": json.dumps({
                            "hs_category": hs_prefix,
                            "rule_description": matching_rule.description,
                        }, ensure_ascii=False),
                        "expected_keywords": ", ".join(matching_rule.keywords),
                        "actual_description": product_name,
                    }
                    clues.append(clue)

                progress.advance(task)

        logger.info(f"伪报检测完成，发现 {len(clues)} 条线索")
        return clues


class AbnormalChannelAnalyzer(BaseAnalyzer):
    def detect(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict]:
        logger.info("开始通道异常检测分析")
        clues = []

        if start_date and end_date:
            df = self.db.get_declarations_by_date_range(start_date, end_date)
        else:
            with self.db.get_connection() as conn:
                df = pd.read_sql_query("SELECT * FROM declarations ORDER BY declare_date", conn)

        if df.empty:
            logger.warning("没有报关单数据可供分析")
            return clues

        df["declare_date_dt"] = pd.to_datetime(df["declare_date"])

        company_first_dates = df.groupby("company")["declare_date_dt"].min()

        with self.db.get_connection() as conn:
            historical_df = pd.read_sql_query("""
                SELECT DISTINCT company, trade_route 
                FROM declarations 
                WHERE declare_date < (SELECT MIN(declare_date) FROM declarations)
            """, conn)

        historical_routes: Dict[str, set] = {}
        for _, row in historical_df.iterrows():
            if row["company"] not in historical_routes:
                historical_routes[row["company"]] = set()
            historical_routes[row["company"]].add(row["trade_route"])

        companies = df["company"].unique()
        total_companies = len(companies)

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeElapsedColumn(),
            console=console,
            transient=True,
        ) as progress:
            task = progress.add_task("[cyan]通道异常检测中...", total=total_companies)

            for company in companies:
                company_df = df[df["company"] == company].copy()
                company_first = company_first_dates[company]

                known_routes = historical_routes.get(company, set())

                for _, row in company_df.iterrows():
                    current_route = row["trade_route"]
                    declare_date = row["declare_date_dt"]

                    is_new_company = declare_date <= company_first + timedelta(days=30)

                    prev_routes = company_df[company_df["declare_date_dt"] < declare_date]["trade_route"].unique()
                    known_routes.update(prev_routes)

                    if current_route not in known_routes and not is_new_company:
                        all_routes = sorted(known_routes)
                        risk_score = 0.5
                        risk_level = self._determine_risk_level(risk_score)

                        clue = {
                            "detection_type": "abnormal",
                            "risk_level": risk_level,
                            "declaration_no": row["declaration_no"],
                            "hs_code": row["hs_code"],
                            "company": company,
                            "consignee": row["consignee"],
                            "analysis_details": json.dumps({
                                "is_first_appearance": True,
                                "historical_route_count": len(all_routes),
                            }, ensure_ascii=False),
                            "route": current_route,
                            "historical_routes": ", ".join(all_routes[:10]) + ("..." if len(all_routes) > 10 else ""),
                        }
                        clues.append(clue)
                        known_routes.add(current_route)

                progress.advance(task)

        logger.info(f"通道异常检测完成，发现 {len(clues)} 条线索")
        return clues


class CaseMatcher(BaseAnalyzer):
    def match_cases(self, clues: List[Dict]) -> List[Dict]:
        if not clues:
            return clues

        logger.info("开始案例关联匹配")
        cases_df = self.db.get_all_cases()

        if cases_df.empty:
            logger.warning("没有历史案件数据可供匹配")
            return clues

        for clue in clues:
            matches = []
            clue_hs = clue.get("hs_code", "")[:6]
            clue_company = clue.get("company", "")
            clue_origin = ""

            if clue.get("declaration_no"):
                with self.db.get_connection() as conn:
                    row = conn.execute(
                        "SELECT origin_country FROM declarations WHERE declaration_no = ?",
                        (clue["declaration_no"],)
                    ).fetchone()
                    if row:
                        clue_origin = row["origin_country"]

            for _, case in cases_df.iterrows():
                score = 0.0
                dimensions = []

                case_hs = str(case["hs_code"])[:6] if pd.notna(case["hs_code"]) else ""
                if clue_hs and case_hs and clue_hs == case_hs:
                    score += 0.4
                    dimensions.append("HS编码匹配")
                elif clue_hs and case_hs and clue_hs[:4] == case_hs[:4]:
                    score += 0.2
                    dimensions.append("HS编码前4位匹配")

                case_company = case["company"] if pd.notna(case["company"]) else ""
                if clue_company and case_company:
                    sim = SequenceMatcher(None, clue_company, case_company).ratio()
                    if sim > 0.8:
                        score += 0.35
                        dimensions.append(f"经营单位相似 ({sim:.2f})")
                    elif sim > 0.5:
                        score += 0.15

                case_origin = case["origin_country"] if pd.notna(case["origin_country"]) else ""
                if clue_origin and case_origin and clue_origin == case_origin:
                    score += 0.25
                    dimensions.append("原产地匹配")

                if score >= 0.3:
                    matches.append({
                        "case_no": case["case_no"],
                        "score": round(score, 3),
                        "dimensions": dimensions,
                    })

            if matches:
                matches.sort(key=lambda x: x["score"], reverse=True)
                top_match = matches[0]
                clue["similarity_score"] = top_match["score"]
                clue["matched_cases"] = json.dumps([m["case_no"] for m in matches[:5]], ensure_ascii=False)

                if "clue_no" in clue:
                    for m in matches[:3]:
                        self.db.insert_case_match(
                            clue["clue_no"],
                            m["case_no"],
                            m["score"],
                            ", ".join(m["dimensions"])
                        )

        logger.info(f"案例关联完成，{sum(1 for c in clues if c.get('similarity_score'))} 条线索找到关联案件")
        return clues


class RiskAnalyzer:
    def __init__(self, db: Optional[Database] = None, config: Optional[ConfigManager] = None):
        self.db = db or get_db()
        self.config = config or get_config_manager()
        self.low_price = LowPriceAnalyzer(self.db, self.config)
        self.split_order = SplitOrderAnalyzer(self.db, self.config)
        self.fake_declaration = FakeDeclarationAnalyzer(self.db, self.config)
        self.abnormal_channel = AbnormalChannelAnalyzer(self.db, self.config)
        self.case_matcher = CaseMatcher(self.db, self.config)

    def run_detection(self, detection_type: str = "all",
                      start_date: Optional[str] = None,
                      end_date: Optional[str] = None,
                      custom_threshold: Optional[float] = None,
                      window_days: Optional[int] = None,
                      min_shipments: Optional[int] = None,
                      value_threshold: Optional[float] = None) -> List[Dict]:
        all_clues = []

        if detection_type in ["lowprice", "all"]:
            all_clues.extend(self.low_price.detect(start_date, end_date, custom_threshold))

        if detection_type in ["split", "all"]:
            all_clues.extend(self.split_order.detect(start_date, end_date, window_days, min_shipments, value_threshold))

        if detection_type in ["fake", "all"]:
            all_clues.extend(self.fake_declaration.detect(start_date, end_date))

        if detection_type in ["abnormal", "all"]:
            all_clues.extend(self.abnormal_channel.detect(start_date, end_date))

        if all_clues:
            all_clues = self.case_matcher.match_cases(all_clues)
            self.db.insert_clue_batch(all_clues)

        return all_clues

    def print_results(self, clues: List[Dict]) -> None:
        if not clues:
            console.print("[yellow]未检测到异常线索[/yellow]")
            return

        type_names = {
            "lowprice": "低报检测",
            "split": "拆单识别",
            "fake": "伪报检测",
            "abnormal": "通道异常",
        }

        summary = {}
        for clue in clues:
            dtype = clue["detection_type"]
            rlevel = clue["risk_level"]
            if dtype not in summary:
                summary[dtype] = {"高风险": 0, "中风险": 0, "低风险": 0, "total": 0}
            summary[dtype][rlevel] += 1
            summary[dtype]["total"] += 1

        sum_table = Table(title="检测结果汇总", show_header=True, header_style="bold cyan")
        sum_table.add_column("检测类型", style="cyan")
        sum_table.add_column("高风险", style="bright_red", justify="right")
        sum_table.add_column("中风险", style="bright_yellow", justify="right")
        sum_table.add_column("低风险", style="bright_green", justify="right")
        sum_table.add_column("合计", style="white", justify="right")

        for dtype, counts in summary.items():
            sum_table.add_row(
                type_names.get(dtype, dtype),
                f"[bright_red]{counts['高风险']}[/bright_red]",
                f"[bright_yellow]{counts['中风险']}[/bright_yellow]",
                f"[bright_green]{counts['低风险']}[/bright_green]",
                str(counts["total"])
            )

        console.print(sum_table)

        high_risk = [c for c in clues if c["risk_level"] == "高风险"]
        if high_risk:
            detail_table = Table(title="高风险线索明细", show_header=True, header_style="bold red")
            detail_table.add_column("线索编号", style="cyan")
            detail_table.add_column("类型", style="white")
            detail_table.add_column("风险等级", style="bright_red")
            detail_table.add_column("报关单号", style="white")
            detail_table.add_column("经营单位", style="white")
            detail_table.add_column("详情", style="yellow")

            for clue in high_risk[:20]:
                detail = self._format_clue_detail(clue)
                detail_table.add_row(
                    clue.get("clue_no", ""),
                    type_names.get(clue["detection_type"], clue["detection_type"]),
                    print_risk_level(clue["risk_level"]),
                    clue.get("declaration_no", ""),
                    clue.get("company", ""),
                    detail
                )

            console.print(detail_table)
            if len(high_risk) > 20:
                console.print(f"[dim]... 还有 {len(high_risk) - 20} 条高风险线索未显示[/dim]")

    def _format_clue_detail(self, clue: Dict) -> str:
        dtype = clue["detection_type"]
        if dtype == "lowprice":
            return f"偏离 {clue.get('deviation_percent', 0):.1f}%，均价 {clue.get('industry_avg_price', 0):.2f}，申报 {clue.get('declared_price', 0):.2f}"
        elif dtype == "split":
            return f"{clue.get('shipment_count', 0)} 票，总值 {clue.get('total_value', 0):,.2f}，窗口 {clue.get('window_start', '')} ~ {clue.get('window_end', '')}"
        elif dtype == "fake":
            return f"期望关键词: {clue.get('expected_keywords', '')[:30]}，实际: {clue.get('actual_description', '')[:30]}"
        elif dtype == "abnormal":
            return f"新通道: {clue.get('route', '')}"
        return ""


def get_analyzer(db: Optional[Database] = None, config: Optional[ConfigManager] = None) -> RiskAnalyzer:
    return RiskAnalyzer(db, config)
