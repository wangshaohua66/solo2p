import json
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime

import pandas as pd
from jinja2 import Environment, FileSystemLoader, select_autoescape
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

from .config import DEFAULT_REPORT_DIR
from .db import Database, get_db
from .logger import setup_logger, get_console, print_success, print_info

logger = setup_logger("crisk.reporter")
console = get_console()


class ReportGenerator:
    def __init__(self, db: Optional[Database] = None):
        self.db = db or get_db()
        template_path = Path(__file__).parent / "templates"
        self.env = Environment(
            loader=FileSystemLoader(template_path),
            autoescape=select_autoescape(["html", "xml"]),
            trim_blocks=True,
            lstrip_blocks=True,
        )
        self.env.filters["format_number"] = self._format_number
        self.env.filters["format_percent"] = self._format_percent
        self.env.filters["format_date"] = self._format_date
        self.env.filters["risk_color"] = self._risk_color
        self.env.filters["risk_bg_color"] = self._risk_bg_color

    def _format_number(self, value: Optional[float]) -> str:
        if value is None or pd.isna(value):
            return "-"
        try:
            return f"{float(value):,.2f}"
        except (ValueError, TypeError):
            return str(value)

    def _format_percent(self, value: Optional[float]) -> str:
        if value is None or pd.isna(value):
            return "-"
        try:
            return f"{float(value):.1f}%"
        except (ValueError, TypeError):
            return str(value)

    def _format_date(self, value: Optional[str]) -> str:
        if not value:
            return "-"
        try:
            dt = pd.to_datetime(value)
            return dt.strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            return str(value)

    def _risk_color(self, risk_level: str) -> str:
        colors = {
            "高风险": "#dc2626",
            "中风险": "#d97706",
            "低风险": "#059669",
        }
        return colors.get(risk_level, "#6b7280")

    def _risk_bg_color(self, risk_level: str) -> str:
        colors = {
            "高风险": "#fef2f2",
            "中风险": "#fffbeb",
            "低风险": "#f0fdf4",
        }
        return colors.get(risk_level, "#f3f4f6")

    def _prepare_report_data(self, clues: Optional[List[Dict]] = None,
                             detection_type: Optional[str] = None,
                             risk_level: Optional[str] = None,
                             start_date: Optional[str] = None,
                             end_date: Optional[str] = None) -> Dict[str, Any]:
        if clues is None:
            clues_df = self.db.get_clues(detection_type, risk_level, start_date, end_date, limit=10000)
            clues = clues_df.to_dict("records")

        clues = [dict(c) for c in clues]

        risk_order = {"高风险": 0, "中风险": 1, "低风险": 2}
        clues.sort(key=lambda x: (risk_order.get(x.get("risk_level", ""), 3),
                                   -x.get("deviation_percent", 0),
                                   -x.get("similarity_score", 0)))

        type_names = {
            "lowprice": "低报检测",
            "split": "拆单识别",
            "fake": "伪报检测",
            "abnormal": "通道异常",
        }

        for clue in clues:
            if "analysis_details" in clue and clue["analysis_details"]:
                try:
                    clue["analysis_details_parsed"] = json.loads(clue["analysis_details"])
                except (json.JSONDecodeError, TypeError):
                    clue["analysis_details_parsed"] = {}
            else:
                clue["analysis_details_parsed"] = {}

            if "detection_type" in clue:
                clue["type_name"] = type_names.get(clue["detection_type"], clue["detection_type"])

        summary = {
            "total": len(clues),
            "by_type": {},
            "by_risk": {"高风险": 0, "中风险": 0, "低风险": 0},
            "has_case_matches": sum(1 for c in clues if c.get("similarity_score")),
        }

        for clue in clues:
            dtype = clue.get("detection_type", "unknown")
            if dtype not in summary["by_type"]:
                summary["by_type"][dtype] = {
                    "name": type_names.get(dtype, dtype),
                    "count": 0,
                    "高风险": 0,
                    "中风险": 0,
                    "低风险": 0,
                }
            summary["by_type"][dtype]["count"] += 1
            rlevel = clue.get("risk_level", "")
            if rlevel in summary["by_type"][dtype]:
                summary["by_type"][dtype][rlevel] += 1
            if rlevel in summary["by_risk"]:
                summary["by_risk"][rlevel] += 1

        trends = {"monthly": {}, "weekly": {}, "descriptions": {}}
        if clues:
            clues_trend_df = pd.DataFrame(clues)
            if "detection_date" in clues_trend_df.columns:
                clues_trend_df["detection_date_dt"] = pd.to_datetime(clues_trend_df["detection_date"])
                clues_trend_df["month"] = clues_trend_df["detection_date_dt"].dt.to_period("M").astype(str)
                clues_trend_df["week"] = clues_trend_df["detection_date_dt"].dt.to_period("W").astype(str)

                for dtype in type_names.keys():
                    type_data = clues_trend_df[clues_trend_df["detection_type"] == dtype]

                    if len(type_data) >= 2:
                        monthly_counts = type_data.groupby("month").size().sort_index()
                        weekly_counts = type_data.groupby("week").size().sort_index()

                        trends["monthly"][dtype] = monthly_counts.to_dict()
                        trends["weekly"][dtype] = weekly_counts.to_dict()

                        desc = self._generate_trend_description(type_names[dtype], monthly_counts, weekly_counts)
                        trends["descriptions"][dtype] = desc

                    elif len(type_data) == 1:
                        only_date = type_data["detection_date_dt"].iloc[0]
                        trends["monthly"][dtype] = {only_date.strftime("%Y-%m"): 1}
                        trends["weekly"][dtype] = {only_date.strftime("%Y-W%W"): 1}
                        trends["descriptions"][dtype] = f"{type_names[dtype]}首次检测到异常线索，共 1 条。"

        stats = self.db.get_stats()

        return {
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "report_period": {
                "start": start_date,
                "end": end_date,
            },
            "summary": summary,
            "clues": clues,
            "db_stats": stats,
            "type_names": type_names,
            "trends": trends,
        }

    def _generate_trend_description(self, type_name: str,
                                     monthly_counts: pd.Series,
                                     weekly_counts: pd.Series) -> str:
        if len(monthly_counts) < 2:
            first_month = monthly_counts.index[0] if len(monthly_counts) > 0 else "N/A"
            first_count = monthly_counts.iloc[0] if len(monthly_counts) > 0 else 0
            return f"{type_name}在{first_month}月首次检测到{first_count}条异常线索，暂无历史趋势对比数据。"

        months = list(monthly_counts.index)
        latest_month = months[-1]
        prev_month = months[-2]
        latest_count = monthly_counts.iloc[-1]
        prev_count = monthly_counts.iloc[-2]

        if prev_count > 0:
            change_pct = ((latest_count - prev_count) / prev_count) * 100
            direction = "上升" if change_pct > 0 else "下降"
            abs_pct = abs(change_pct)
        else:
            direction = "新增"
            abs_pct = 100

        weeks = list(weekly_counts.index)
        if len(weeks) >= 2:
            latest_week = weeks[-1]
            prev_week = weeks[-2]
            latest_week_count = weekly_counts.iloc[-1]
            prev_week_count = weekly_counts.iloc[-2]

            if prev_week_count > 0:
                week_change = ((latest_week_count - prev_week_count) / prev_week_count) * 100
                week_direction = "上升" if week_change > 0 else "下降"
                week_abs = abs(week_change)
            else:
                week_direction = "新增"
                week_abs = 100

            return (f"{type_name}月度趋势：{latest_month}月({latest_count}条) 较 {prev_month}月({prev_count}条) "
                    f"{direction}{abs_pct:.1f}%。"
                    f" 周度趋势：{latest_week}周({latest_week_count}条) 较 {prev_week}周({prev_week_count}条) "
                    f"{week_direction}{week_abs:.1f}%。")

        return (f"{type_name}月度趋势：{latest_month}月({latest_count}条) 较 {prev_month}月({prev_count}条) "
                f"{direction}{abs_pct:.1f}%。")

    def generate_html(self, output_path: Path,
                      clues: Optional[List[Dict]] = None,
                      detection_type: Optional[str] = None,
                      risk_level: Optional[str] = None,
                      start_date: Optional[str] = None,
                      end_date: Optional[str] = None) -> Path:
        logger.info(f"生成 HTML 报告: {output_path}")

        data = self._prepare_report_data(clues, detection_type, risk_level, start_date, end_date)

        template = self.env.get_template("report.html.j2")
        html_content = template.render(**data)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        logger.info(f"HTML 报告已生成: {output_path}")
        return output_path

    def generate_markdown(self, output_path: Path,
                          clues: Optional[List[Dict]] = None,
                          detection_type: Optional[str] = None,
                          risk_level: Optional[str] = None,
                          start_date: Optional[str] = None,
                          end_date: Optional[str] = None) -> Path:
        logger.info(f"生成 Markdown 报告: {output_path}")

        data = self._prepare_report_data(clues, detection_type, risk_level, start_date, end_date)

        template = self.env.get_template("report.md.j2")
        md_content = template.render(**data)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(md_content)

        logger.info(f"Markdown 报告已生成: {output_path}")
        return output_path

    def get_report_data(self,
                        detection_type: Optional[str] = None,
                        risk_level: Optional[str] = None,
                        start_date: Optional[str] = None,
                        end_date: Optional[str] = None) -> Dict[str, Any]:
        return self._prepare_report_data(None, detection_type, risk_level, start_date, end_date)

    def generate(self, output_format: str = "html",
                 output_path: Optional[str] = None,
                 clues: Optional[List[Dict]] = None,
                 detection_type: Optional[str] = None,
                 risk_level: Optional[str] = None,
                 start_date: Optional[str] = None,
                 end_date: Optional[str] = None,
                 return_data: bool = False) -> Any:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = Path(output_path).parent if output_path else DEFAULT_REPORT_DIR
        output_dir.mkdir(parents=True, exist_ok=True)

        report_data = None
        if return_data:
            report_data = self._prepare_report_data(clues, detection_type, risk_level, start_date, end_date)

        if output_format == "html":
            default_name = f"risk_report_{timestamp}.html"
            final_path = Path(output_path) if output_path else output_dir / default_name
            result = self.generate_html(final_path, clues, detection_type, risk_level, start_date, end_date)
        elif output_format == "markdown":
            default_name = f"risk_report_{timestamp}.md"
            final_path = Path(output_path) if output_path else output_dir / default_name
            result = self.generate_markdown(final_path, clues, detection_type, risk_level, start_date, end_date)
        else:
            raise ValueError(f"不支持的输出格式: {output_format}")

        if return_data:
            return final_path, report_data
        return final_path

    def print_report_preview(self, data: Dict[str, Any]) -> None:
        summary = data["summary"]
        console.print(f"\n[bold cyan]=== 报告摘要 ===[/bold cyan]")
        console.print(f"生成时间: [white]{data['generated_at']}[/white]")
        if data["report_period"]["start"]:
            console.print(f"分析周期: [white]{data['report_period']['start']} ~ {data['report_period']['end']}[/white]")
        console.print(f"总线索数: [bold white]{summary['total']}[/bold white]")
        console.print(f"  [bright_red]高风险: {summary['by_risk']['高风险']}[/bright_red]")
        console.print(f"  [bright_yellow]中风险: {summary['by_risk']['中风险']}[/bright_yellow]")
        console.print(f"  [bright_green]低风险: {summary['by_risk']['低风险']}[/bright_green]")
        console.print(f"案例关联: [white]{summary['has_case_matches']}[/white] 条线索有关联案件")


def get_reporter(db: Optional[Database] = None) -> ReportGenerator:
    return ReportGenerator(db)
