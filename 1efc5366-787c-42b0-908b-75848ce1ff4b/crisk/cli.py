import os
import sys
import time
from pathlib import Path
from typing import Optional, List
from datetime import datetime

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.progress import Progress, SpinnerColumn, TextColumn

from .__init__ import __version__
from .config import get_config_manager, DEFAULT_DB_PATH
from .db import get_db
from .importer import get_importer
from .analyzer import get_analyzer
from .reporter import get_reporter
from .logger import setup_logger, get_console, print_header, print_success, print_error, print_warning, print_info, print_risk_level

logger = setup_logger("crisk.cli")
console = get_console()

app = typer.Typer(
    name="crisk",
    help="海关缉私情报分析系统 - 进出口货物风险研判与走私线索追踪",
    add_completion=False,
    rich_markup_mode="rich",
)


def version_callback(value: bool):
    if value:
        console.print(f"[bold cyan]CRISK[/bold cyan] - 海关缉私情报分析系统 v{__version__}")
        raise typer.Exit()


@app.callback()
def main(
    version: Optional[bool] = typer.Option(
        None, "--version", "-v", callback=version_callback, is_eager=True,
        help="显示版本信息"
    ),
    debug: bool = typer.Option(False, "--debug", help="启用调试日志"),
):
    """
    海关缉私情报分析系统 - 用于进出口货物风险研判与走私线索追踪

    支持数据导入、异常检测、报告生成、规则管理四大功能模块。
    """
    if debug:
        import logging
        logging.getLogger("crisk").setLevel(logging.DEBUG)
        logger.debug("调试模式已启用")


@app.command("import", short_help="导入报关单、风险布控、查验反馈、历史案件数据")
def import_data(
    files: List[Path] = typer.Argument(..., exists=True, readable=True, help="待导入的文件路径（CSV/Excel）"),
    data_type: str = typer.Option("declarations", "--type", "-t",
        help="数据类型: declarations(报关单), risk_controls(风险布控), inspections(查验反馈), cases(历史案件)"),
    show_errors: bool = typer.Option(True, "--show-errors/--hide-errors", help="是否显示导入错误详情"),
):
    """
    批量导入 CSV 或 Excel 格式的数据文件。

    支持自动识别编码格式（GBK/UTF-8），字段映射校验，按关键字段去重。

    示例:
        crisk import declarations.csv
        crisk import --type cases historical_cases.xlsx
        crisk import file1.csv file2.csv file3.csv
    """
    print_header(f"数据导入 - {data_type}")

    valid_types = ["declarations", "risk_controls", "inspections", "cases"]
    if data_type not in valid_types:
        print_error(f"无效的数据类型: {data_type}。支持: {', '.join(valid_types)}")
        raise typer.Exit(code=1)

    importer = get_importer()

    start_time = time.time()
    results = importer.import_batch([str(f) for f in files], data_type)
    elapsed = time.time() - start_time

    importer.print_summary(results)

    if show_errors:
        importer.print_errors()

    print_success(f"导入完成，耗时: {elapsed:.2f} 秒")


@app.command("detect", short_help="执行异常模式检测（低报/拆单/伪报/通道异常）")
def detect(
    detection_type: str = typer.Option("all", "--type", "-t",
        help="检测类型: lowprice(低报), split(拆单), fake(伪报), abnormal(通道异常), all(全部)"),
    threshold: Optional[float] = typer.Option(None, "--threshold", "-T",
        help="自定义偏离阈值（覆盖默认 30%）"),
    window_days: Optional[int] = typer.Option(None, "--window-days", "-w",
        help="拆单检测滑动窗口天数（默认 7 天）"),
    min_shipments: Optional[int] = typer.Option(None, "--min-shipments", "-m",
        help="拆单检测最小票数阈值（默认 5 票）"),
    value_threshold: Optional[float] = typer.Option(None, "--value-threshold", "-V",
        help="拆单检测货值阈值（默认 1,000,000）"),
    date_range: Optional[str] = typer.Option(None, "--date-range", "-d",
        help="分析日期范围，格式: YYYY-MM-DD,YYYY-MM-DD"),
    save_clues: bool = typer.Option(True, "--save/--no-save", help="是否保存检测结果到线索表"),
):
    """
    执行异常模式检测，识别走私风险线索。

    支持四种检测类型，可单独或组合执行。检测结果按风险等级排序并保存到线索表。

    示例:
        crisk detect --type lowprice
        crisk detect --type all --date-range 2025-01-01,2025-06-30
        crisk detect --type split --window-days 10 --min-shipments 8
        crisk detect --type lowprice --threshold 0.25
    """
    print_header(f"异常检测 - {detection_type}")

    valid_types = ["lowprice", "split", "fake", "abnormal", "all"]
    if detection_type not in valid_types:
        print_error(f"无效的检测类型: {detection_type}。支持: {', '.join(valid_types)}")
        raise typer.Exit(code=1)

    start_date = end_date = None
    if date_range:
        try:
            start_date, end_date = date_range.split(",")
            start_date = start_date.strip()
            end_date = end_date.strip()
            datetime.strptime(start_date, "%Y-%m-%d")
            datetime.strptime(end_date, "%Y-%m-%d")
        except (ValueError, AttributeError):
            print_error("日期范围格式错误，请使用: YYYY-MM-DD,YYYY-MM-DD")
            raise typer.Exit(code=1)
        print_info(f"分析周期: {start_date} ~ {end_date}")

    analyzer = get_analyzer()

    start_time = time.time()

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
        transient=True,
    ) as progress:
        progress.add_task("[cyan]正在执行风险检测...", total=None)

        clues = analyzer.run_detection(
            detection_type=detection_type,
            start_date=start_date,
            end_date=end_date,
            custom_threshold=threshold,
            window_days=window_days,
            min_shipments=min_shipments,
            value_threshold=value_threshold,
        )

    elapsed = time.time() - start_time

    analyzer.print_results(clues)
    print_success(f"检测完成，耗时: {elapsed:.2f} 秒")

    if clues:
        print_info(f"共发现 {len(clues)} 条异常线索，已写入线索表")
    else:
        print_info("未发现异常线索")


@app.command("report", short_help="生成结构化风险分析报告")
def report(
    output_format: str = typer.Option("html", "--format", "-f",
        help="输出格式: html, markdown"),
    output_path: Optional[Path] = typer.Option(None, "--output", "-o",
        help="输出文件路径"),
    detection_type: Optional[str] = typer.Option(None, "--type", "-t",
        help="按检测类型筛选: lowprice, split, fake, abnormal"),
    risk_level: Optional[str] = typer.Option(None, "--risk", "-r",
        help="按风险等级筛选: 高风险, 中风险, 低风险"),
    date_range: Optional[str] = typer.Option(None, "--date-range", "-d",
        help="报告日期范围，格式: YYYY-MM-DD,YYYY-MM-DD"),
):
    """
    生成结构化的风险分析报告，支持 HTML 和 Markdown 两种格式。

    报告包含统计摘要、异常明细、趋势图表描述和数据库统计信息。

    示例:
        crisk report
        crisk report --format markdown --output report.md
        crisk report --type lowprice --risk 高风险
        crisk report --date-range 2025-01-01,2025-06-30
    """
    print_header("生成报告")

    valid_formats = ["html", "markdown"]
    if output_format not in valid_formats:
        print_error(f"无效的输出格式: {output_format}。支持: {', '.join(valid_formats)}")
        raise typer.Exit(code=1)

    if detection_type and detection_type not in ["lowprice", "split", "fake", "abnormal"]:
        print_error(f"无效的检测类型: {detection_type}")
        raise typer.Exit(code=1)

    if risk_level and risk_level not in ["高风险", "中风险", "低风险"]:
        print_error(f"无效的风险等级: {risk_level}。支持: 高风险, 中风险, 低风险")
        raise typer.Exit(code=1)

    start_date = end_date = None
    if date_range:
        try:
            start_date, end_date = date_range.split(",")
            start_date = start_date.strip()
            end_date = end_date.strip()
            datetime.strptime(start_date, "%Y-%m-%d")
            datetime.strptime(end_date, "%Y-%m-%d")
        except (ValueError, AttributeError):
            print_error("日期范围格式错误，请使用: YYYY-MM-DD,YYYY-MM-DD")
            raise typer.Exit(code=1)

    reporter = get_reporter()

    start_time = time.time()

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
        transient=True,
    ) as progress:
        progress.add_task(f"[cyan]正在生成 {output_format.upper()} 报告...", total=None)

        final_path, data = reporter.generate(
            output_format=output_format,
            output_path=str(output_path) if output_path else None,
            detection_type=detection_type,
            risk_level=risk_level,
            start_date=start_date,
            end_date=end_date,
            return_data=True,
        )

    elapsed = time.time() - start_time

    print_success(f"报告生成完成，耗时: {elapsed:.2f} 秒")
    print_info(f"报告已保存至: [underline]{final_path}[/underline]")

    reporter.print_report_preview(data)


@app.command("rule", short_help="管理分析规则（查看/新增/修改/删除）")
def rule(
    action: str = typer.Argument(..., help="操作: list, add, modify, update, delete, set-threshold, delete-threshold"),
    hs_prefix: Optional[str] = typer.Option(None, "--hs", help="HS 编码前缀（前 6 位）"),
    keywords: Optional[str] = typer.Option(None, "--keywords", "-k", help="关键词列表，用逗号分隔"),
    description: Optional[str] = typer.Option(None, "--desc", help="规则描述"),
    threshold: Optional[float] = typer.Option(None, "--value", "-v", help="阈值数值"),
):
    """
    管理检测规则库，包括 HS 编码-品名映射规则和分类阈值配置。

    操作类型:
      list              查看所有规则
      add               新增/更新 HS 编码规则
      modify            修改 HS 编码规则（同 update）
      update            修改 HS 编码规则（同 modify）
      delete            删除 HS 编码规则
      set-threshold     设置分类阈值
      delete-threshold  删除分类阈值

    示例:
        crisk rule list
        crisk rule add --hs 851712 --keywords 手机,移动电话,smartphone --desc "移动通信设备"
        crisk rule modify --hs 851712 --keywords 手机,iPhone,智能手机
        crisk rule update --hs 851712 --desc "更新的描述"
        crisk rule delete --hs 851712
        crisk rule set-threshold --hs 851712 --value 0.25
        crisk rule delete-threshold --hs 851712
    """
    print_header("规则管理")

    config = get_config_manager()
    valid_actions = ["list", "add", "modify", "update", "delete", "set-threshold", "delete-threshold"]

    if action not in valid_actions:
        print_error(f"无效操作: {action}。支持: {', '.join(valid_actions)}")
        raise typer.Exit(code=1)

    if action == "list":
        rules = config.list_hs_rules()
        thresholds = config.rule_set.custom_thresholds

        table = Table(title="HS 编码规则库", show_header=True, header_style="bold cyan")
        table.add_column("HS 前缀", style="cyan")
        table.add_column("关键词", style="white")
        table.add_column("描述", style="yellow")
        table.add_column("自定义阈值", style="magenta", justify="right")

        for rule in rules:
            th = thresholds.get(rule.hs_prefix, "-")
            th_str = f"{th:.0%}" if th != "-" else "-"
            table.add_row(
                rule.hs_prefix,
                ", ".join(rule.keywords),
                rule.description,
                th_str
            )

        console.print(table)

        if thresholds:
            th_table = Table(title="分类偏离阈值配置", show_header=True, header_style="bold magenta")
            th_table.add_column("HS 前缀", style="cyan")
            th_table.add_column("偏离阈值", style="white", justify="right")
            for hs, th in thresholds.items():
                if not any(r.hs_prefix == hs for r in rules):
                    th_table.add_row(hs, f"{th:.0%}")
            if th_table.row_count > 0:
                console.print(th_table)

    elif action == "add":
        if not hs_prefix or not keywords:
            print_error("请提供 --hs 和 --keywords 参数")
            raise typer.Exit(code=1)

        keyword_list = [k.strip() for k in keywords.split(",") if k.strip()]
        config.add_hs_rule(hs_prefix, keyword_list, description or "")
        print_success(f"已添加/更新规则: {hs_prefix} - {', '.join(keyword_list)}")

    elif action in ["modify", "update"]:
        if not hs_prefix:
            print_error("请提供 --hs 参数")
            raise typer.Exit(code=1)

        if not keywords and not description:
            print_error("请提供至少一个更新参数: --keywords 或 --desc")
            raise typer.Exit(code=1)

        keyword_list = None
        if keywords:
            keyword_list = [k.strip() for k in keywords.split(",") if k.strip()]

        if config.update_hs_rule(hs_prefix, keyword_list, description):
            updates = []
            if keyword_list:
                updates.append(f"关键词: {', '.join(keyword_list)}")
            if description:
                updates.append(f"描述: {description}")
            print_success(f"已更新规则: {hs_prefix} - {', '.join(updates)}")
        else:
            print_warning(f"未找到规则: {hs_prefix}")

    elif action == "delete":
        if not hs_prefix:
            print_error("请提供 --hs 参数")
            raise typer.Exit(code=1)

        if config.delete_hs_rule(hs_prefix):
            print_success(f"已删除规则: {hs_prefix}")
        else:
            print_warning(f"未找到规则: {hs_prefix}")

    elif action == "set-threshold":
        if not hs_prefix or threshold is None:
            print_error("请提供 --hs 和 --value 参数")
            raise typer.Exit(code=1)

        config.set_category_threshold(hs_prefix, threshold)
        print_success(f"已设置分类阈值: {hs_prefix} = {threshold:.0%}")

    elif action == "delete-threshold":
        if not hs_prefix:
            print_error("请提供 --hs 参数")
            raise typer.Exit(code=1)

        if config.delete_category_threshold(hs_prefix):
            print_success(f"已删除分类阈值: {hs_prefix}")
        else:
            print_warning(f"未找到分类阈值: {hs_prefix}")


@app.command("stats", short_help="查看数据库统计信息")
def stats(
    db_path: Optional[Path] = typer.Option(None, "--db", help="数据库路径"),
):
    """
    查看数据库统计信息，包括各数据表记录数和数据时间范围。
    """
    print_header("数据库统计")

    db = get_db(str(db_path) if db_path else None)
    stats = db.get_stats()

    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("数据表", style="cyan")
    table.add_column("记录数", style="white", justify="right")
    table.add_column("说明", style="dim")

    table_names = {
        "declarations": ("报关单数据", "已入库的进出口报关单"),
        "risk_controls": ("风险布控指令", "海关风险布控指令"),
        "inspections": ("口岸查验反馈", "现场查验结果反馈"),
        "cases": ("历史案件库", "已结案走私案件"),
        "clues": ("风险线索", "系统检测异常线索"),
    }

    for key, (name, desc) in table_names.items():
        count = stats.get(key, 0)
        table.add_row(name, f"{count:,}", desc)

    console.print(table)

    if stats.get("date_range") and stats["date_range"][0]:
        console.print(f"\n📅 数据时间范围: [bold white]{stats['date_range'][0]}[/bold white] 至 [bold white]{stats['date_range'][1]}[/bold white]")

    console.print(f"\n💾 数据库路径: {db.db_path}")


def entry_point():
    """程序入口点，用于 setup.py 配置"""
    try:
        app()
    except KeyboardInterrupt:
        print_warning("\n操作已取消")
        sys.exit(130)
    except Exception as e:
        logger.exception(f"程序异常: {str(e)}")
        print_error(f"程序异常: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    entry_point()
