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

        hs_stats: Dict[str, Dict[str, float]] = {}
        hs_counts: Dict[str, int] = {}

        with self.db.get_connection() as conn:
            if start_date and end_date:
                query = """
                    SELECT hs_prefix6, unit_price
                    FROM declarations
                    WHERE declare_date BETWEEN ? AND ? AND unit_price > 0
                    ORDER BY hs_prefix6
                """
                prices_df = pd.read_sql_query(query, conn, params=(start_date, end_date))
            else:
                query = """
                    SELECT hs_prefix6, unit_price
                    FROM declarations
                    WHERE unit_price > 0
                    ORDER BY hs_prefix6
                """
                prices_df = pd.read_sql_query(query, conn)

        if prices_df.empty:
            logger.warning("没有足够的报关单数据可供分析")
            return clues

        hs_grouped = prices_df.groupby("hs_prefix6")
        stats_data = []
        for hs_prefix, group in hs_grouped:
            if len(group) >= 3:
                stats_data.append({
                    "hs_prefix6": hs_prefix,
                    "cnt": len(group),
                    "median_price": group["unit_price"].median()
                })
        stats_df = pd.DataFrame(stats_data)

        if stats_df.empty:
            logger.warning("没有足够的报关单数据可供分析")
            return clues

        for _, row in stats_df.iterrows():
            hs_prefix = row["hs_prefix6"]
            hs_stats[hs_prefix] = {
                "median": row["median_price"],
                "count": row["cnt"]
            }

        thresholds = self.config.thresholds
        hs_thresholds: Dict[str, float] = {}
        for hs_prefix in hs_stats:
            hs_thresholds[hs_prefix] = custom_threshold if custom_threshold is not None else \
                thresholds.get_threshold_for_category(hs_prefix)

        total_hs = len(hs_stats)
        processed_hs = 0

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeElapsedColumn(),
            console=console,
            transient=True,
        ) as progress:
            task = progress.add_task("[cyan]低报检测中...", total=total_hs)

            for hs_prefix, stats in hs_stats.items():
                industry_avg = stats["median"]
                threshold = hs_thresholds[hs_prefix]

                for chunk in self.db.get_declarations_by_hs_prefix_paginated(hs_prefix, start_date, end_date, chunk_size=10000):
                    chunk = chunk[chunk["unit_price"] > 0].copy()
                    if chunk.empty:
                        continue

                    chunk["deviation"] = np.abs(chunk["unit_price"] - industry_avg) / industry_avg
                    chunk["is_abnormal"] = chunk["deviation"] > threshold

                    abnormal = chunk[chunk["is_abnormal"]].copy()
                    if abnormal.empty:
                        continue

                    abnormal["deviation_percent"] = (abnormal["deviation"] * 100).round(2)
                    abnormal["risk_score"] = np.minimum(abnormal["deviation"] / 0.5, 1.0)
                    abnormal["risk_level"] = np.where(
                        abnormal["risk_score"] >= 0.7, "高风险",
                        np.where(abnormal["risk_score"] >= 0.4, "中风险", "低风险")
                    )
                    abnormal["deviation_direction"] = np.where(
                        abnormal["unit_price"] < industry_avg, "低报", "高报"
                    )
                    abnormal["industry_avg_price"] = round(industry_avg, 2)
                    abnormal["declared_price"] = abnormal["unit_price"].round(2)

                    for _, row in abnormal.iterrows():
                        clue = {
                            "detection_type": "lowprice",
                            "risk_level": row["risk_level"],
                            "declaration_no": row["declaration_no"],
                            "hs_code": row["hs_code"],
                            "company": row["company"],
                            "consignee": row["consignee"],
                            "analysis_details": json.dumps({
                                "hs_category": hs_prefix,
                                "deviation_direction": row["deviation_direction"],
                            }, ensure_ascii=False),
                            "deviation_percent": row["deviation_percent"],
                            "industry_avg_price": row["industry_avg_price"],
                            "declared_price": row["declared_price"],
                        }
                        clues.append(clue)

                processed_hs += 1
                progress.update(task, completed=processed_hs)

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

        all_data = []
        for chunk in self.db.get_declarations_paginated(start_date, end_date, chunk_size=10000):
            all_data.append(chunk[["declaration_no", "hs_code", "hs_prefix6", "declared_value",
                                   "declare_date", "company", "consignee"]])

        if not all_data:
            logger.warning("没有报关单数据可供分析")
            return clues

        df = pd.concat(all_data, ignore_index=True)
        del all_data

        if df.empty:
            logger.warning("没有报关单数据可供分析")
            return clues

        df["declare_date_dt"] = pd.to_datetime(df["declare_date"])
        df = df.sort_values("declare_date_dt").reset_index(drop=True)

        group_counts = df.groupby(["consignee", "hs_prefix6"]).size()
        valid_groups = group_counts[group_counts >= min_shipments].index
        total_groups = len(valid_groups)

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

            for (consignee, hs_prefix) in valid_groups:
                group = df[(df["consignee"] == consignee) & (df["hs_prefix6"] == hs_prefix)].copy()
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

        rules = self.config.rule_set.hs_rules
        if not rules:
            logger.warning("没有检测规则可供分析")
            return clues

        rule_hs_prefixes = [rule.hs_prefix for rule in rules]
        rule_map = {rule.hs_prefix: rule for rule in rules}

        total_count = 0
        with self.db.get_connection() as conn:
            if start_date and end_date:
                query = "SELECT COUNT(*) as cnt FROM declarations WHERE declare_date BETWEEN ? AND ?"
                params = [start_date, end_date]
            else:
                query = "SELECT COUNT(*) as cnt FROM declarations"
                params = []
            total_count = conn.execute(query, params).fetchone()["cnt"]

        if total_count == 0:
            logger.warning("没有报关单数据可供分析")
            return clues

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeElapsedColumn(),
            console=console,
            transient=True,
        ) as progress:
            task = progress.add_task("[cyan]伪报检测中...", total=total_count)
            processed = 0

            for chunk in self.db.get_declarations_paginated(start_date, end_date, chunk_size=10000):
                chunk["hs_prefix6_match"] = chunk["hs_prefix6"]

                rule_descriptions = []
                rule_keywords = []
                expected_keywords = []
                rule_hs_categories = []

                for _, row in chunk.iterrows():
                    hs_prefix = row["hs_prefix6_match"]
                    matching_rule = None
                    for prefix, rule in rule_map.items():
                        if hs_prefix.startswith(prefix):
                            matching_rule = rule
                            break

                    if matching_rule is not None and not matching_rule.matches(row["product_name"]):
                        rule_descriptions.append(matching_rule.description)
                        rule_keywords.append(", ".join(matching_rule.keywords))
                        expected_keywords.append(", ".join(matching_rule.keywords))
                        rule_hs_categories.append(hs_prefix)
                    else:
                        rule_descriptions.append(None)
                        rule_keywords.append(None)
                        expected_keywords.append(None)
                        rule_hs_categories.append(None)

                chunk["rule_description"] = rule_descriptions
                chunk["rule_keywords"] = rule_keywords
                chunk["expected_keywords"] = expected_keywords
                chunk["rule_hs_category"] = rule_hs_categories

                abnormal = chunk[chunk["rule_description"].notna()].copy()
                if not abnormal.empty:
                    abnormal["risk_score"] = 0.6
                    abnormal["risk_level"] = "中风险"

                    for _, row in abnormal.iterrows():
                        clue = {
                            "detection_type": "fake",
                            "risk_level": row["risk_level"],
                            "declaration_no": row["declaration_no"],
                            "hs_code": row["hs_code"],
                            "company": row["company"],
                            "consignee": row["consignee"],
                            "analysis_details": json.dumps({
                                "hs_category": row["rule_hs_category"],
                                "rule_description": row["rule_description"],
                            }, ensure_ascii=False),
                            "expected_keywords": row["expected_keywords"],
                            "actual_description": row["product_name"],
                        }
                        clues.append(clue)

                processed += len(chunk)
                progress.update(task, completed=processed)

        logger.info(f"伪报检测完成，发现 {len(clues)} 条线索")
        return clues


class AbnormalChannelAnalyzer(BaseAnalyzer):
    def detect(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict]:
        logger.info("开始通道异常检测分析")
        clues = []

        all_data = []
        for chunk in self.db.get_declarations_paginated(start_date, end_date, chunk_size=10000):
            all_data.append(chunk[["declaration_no", "hs_code", "company", "consignee",
                                   "declare_date", "trade_route"]])

        if not all_data:
            logger.warning("没有报关单数据可供分析")
            return clues

        df = pd.concat(all_data, ignore_index=True)
        del all_data

        if df.empty:
            logger.warning("没有报关单数据可供分析")
            return clues

        df["declare_date_dt"] = pd.to_datetime(df["declare_date"])
        df = df.sort_values("declare_date_dt").reset_index(drop=True)

        company_first_dates = df.groupby("company")["declare_date_dt"].min()
        company_max_dates = df.groupby("company")["declare_date_dt"].max()

        companies = df["company"].unique()
        total_companies = len(companies)

        with self.db.get_connection() as conn:
            all_company_routes: Dict[str, pd.DataFrame] = {}
            for company in companies:
                max_date = company_max_dates[company].strftime("%Y-%m-%d")
                routes_df = pd.read_sql_query("""
                    SELECT DISTINCT trade_route, declare_date
                    FROM declarations 
                    WHERE company = ? AND declare_date < ?
                    ORDER BY declare_date
                """, conn, params=(company, max_date))
                all_company_routes[company] = routes_df

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
                company_df = df[df["company"] == company].copy().sort_values("declare_date_dt").reset_index(drop=True)
                company_first = company_first_dates[company]

                historical_routes_df = all_company_routes.get(company, pd.DataFrame())

                known_routes: set = set()
                if not historical_routes_df.empty:
                    company_first_str = company_first.strftime("%Y-%m-%d")
                    before_first = historical_routes_df[historical_routes_df["declare_date"] < company_first_str]
                    known_routes = set(before_first["trade_route"].unique())

                for _, row in company_df.iterrows():
                    current_route = row["trade_route"]
                    declare_date = row["declare_date_dt"]
                    declare_date_str = declare_date.strftime("%Y-%m-%d")

                    is_new_company = declare_date <= company_first + timedelta(days=30)

                    if not is_new_company and not historical_routes_df.empty:
                        before_current = historical_routes_df[historical_routes_df["declare_date"] < declare_date_str]
                        known_routes.update(before_current["trade_route"].unique())

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
    def __init__(self, db: Database, config: ConfigManager):
        super().__init__(db, config)
        self._cases_cache: Optional[pd.DataFrame] = None
        self._cache_timestamp: Optional[datetime] = None
        self._cache_ttl = 3600

    def _get_cases(self) -> pd.DataFrame:
        now = datetime.now()
        if self._cases_cache is None or (self._cache_timestamp is None or
                                         (now - self._cache_timestamp).total_seconds() > self._cache_ttl):
            self._cases_cache = self.db.get_all_cases()
            self._cache_timestamp = now

            if not self._cases_cache.empty:
                self._cases_cache["hs_prefix6"] = self._cases_cache["hs_code"].apply(
                    lambda x: str(x)[:6] if pd.notna(x) else ""
                )
                self._cases_cache["hs_prefix4"] = self._cases_cache["hs_prefix6"].str[:4]
                self._cases_cache["company_clean"] = self._cases_cache["company"].fillna("")
                self._cases_cache["origin_clean"] = self._cases_cache["origin_country"].fillna("")

        return self._cases_cache

    def _batch_get_origins(self, declaration_nos: List[str]) -> Dict[str, str]:
        if not declaration_nos:
            return {}

        origins: Dict[str, str] = {}
        batch_size = 500

        for i in range(0, len(declaration_nos), batch_size):
            batch = declaration_nos[i:i + batch_size]
            placeholders = ", ".join(["?"] * len(batch))

            with self.db.get_connection() as conn:
                query = f"""
                    SELECT declaration_no, origin_country
                    FROM declarations
                    WHERE declaration_no IN ({placeholders})
                """
                cur = conn.execute(query, batch)
                for row in cur.fetchall():
                    origins[row["declaration_no"]] = row["origin_country"] or ""

        return origins

    def _vectorized_similarity(self, target: str, series: pd.Series) -> np.ndarray:
        if not target:
            return np.zeros(len(series), dtype=np.float64)

        target_len = len(target)
        series_list = series.tolist()

        scores = np.zeros(len(series_list), dtype=np.float64)

        for i, s in enumerate(series_list):
            if not s:
                scores[i] = 0.0
                continue
            s_len = len(s)
            if abs(target_len - s_len) > max(target_len, s_len) * 0.5:
                scores[i] = 0.0
                continue
            scores[i] = SequenceMatcher(None, target, s).ratio()

        return scores

    def match_cases(self, clues: List[Dict]) -> List[Dict]:
        if not clues:
            return clues

        logger.info("开始案例关联匹配")
        cases_df = self._get_cases()

        if cases_df.empty:
            logger.warning("没有历史案件数据可供匹配")
            return clues

        declaration_nos = [c["declaration_no"] for c in clues if c.get("declaration_no")]
        origin_map = self._batch_get_origins(declaration_nos)

        clue_hs_list = []
        clue_company_list = []
        clue_origin_list = []
        clue_hs4_list = []

        for clue in clues:
            clue_hs = clue.get("hs_code", "")[:6]
            clue_company = clue.get("company", "")
            clue_origin = origin_map.get(clue.get("declaration_no", ""), "")

            clue_hs_list.append(clue_hs)
            clue_company_list.append(clue_company)
            clue_origin_list.append(clue_origin)
            clue_hs4_list.append(clue_hs[:4])

        case_hs6 = cases_df["hs_prefix6"].values
        case_hs4 = cases_df["hs_prefix4"].values
        case_company = cases_df["company_clean"].values
        case_origin = cases_df["origin_clean"].values
        case_nos = cases_df["case_no"].values

        batch_case_matches = []

        for clue_idx, clue in enumerate(clues):
            clue_hs = clue_hs_list[clue_idx]
            clue_hs4 = clue_hs4_list[clue_idx]
            clue_company = clue_company_list[clue_idx]
            clue_origin = clue_origin_list[clue_idx]

            scores = np.zeros(len(cases_df), dtype=np.float64)
            dimensions_list: List[List[str]] = [[] for _ in range(len(cases_df))]

            if clue_hs:
                hs6_match_mask = (case_hs6 == clue_hs) & (case_hs6 != "")
                scores[hs6_match_mask] += 0.4
                for i in np.where(hs6_match_mask)[0]:
                    dimensions_list[i].append("HS编码匹配")

                hs4_match_mask = ~hs6_match_mask & (case_hs4 == clue_hs4) & (case_hs4 != "")
                scores[hs4_match_mask] += 0.2
                for i in np.where(hs4_match_mask)[0]:
                    dimensions_list[i].append("HS编码前4位匹配")

            if clue_company:
                company_sims = self._vectorized_similarity(clue_company, cases_df["company_clean"])
                high_sim_mask = company_sims > 0.8
                scores[high_sim_mask] += 0.35
                for i in np.where(high_sim_mask)[0]:
                    dimensions_list[i].append(f"经营单位相似 ({company_sims[i]:.2f})")

                med_sim_mask = ~high_sim_mask & (company_sims > 0.5)
                scores[med_sim_mask] += 0.15

            if clue_origin:
                origin_match_mask = (case_origin == clue_origin) & (case_origin != "")
                scores[origin_match_mask] += 0.25
                for i in np.where(origin_match_mask)[0]:
                    dimensions_list[i].append("原产地匹配")

            match_mask = scores >= 0.3
            match_indices = np.where(match_mask)[0]

            if len(match_indices) > 0:
                match_scores = scores[match_indices]
                sort_order = np.argsort(-match_scores)
                sorted_indices = match_indices[sort_order]

                matches = []
                for i in sorted_indices:
                    matches.append({
                        "case_no": case_nos[i],
                        "score": round(float(scores[i]), 3),
                        "dimensions": dimensions_list[i],
                    })

                if matches:
                    top_match = matches[0]
                    clue["similarity_score"] = top_match["score"]
                    clue["matched_cases"] = json.dumps([m["case_no"] for m in matches[:5]], ensure_ascii=False)

                    if "clue_no" in clue:
                        for m in matches[:3]:
                            batch_case_matches.append((
                                clue["clue_no"],
                                m["case_no"],
                                m["score"],
                                ", ".join(m["dimensions"])
                            ))

        if batch_case_matches:
            with self.db.get_connection() as conn:
                conn.executemany("""
                    INSERT OR IGNORE INTO case_matches
                    (clue_no, case_no, similarity_score, match_dimensions)
                    VALUES (?, ?, ?, ?)
                """, batch_case_matches)

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
