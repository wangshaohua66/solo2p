import os
import sys
import json
from pathlib import Path

import click

from .logger import get_logger
from .validator import ArchiveValidator, ValidationConfig, ValidationSeverity
from .converter import FormatConverter, InputFormat
from .renamer import ArchiveRenamer, ArchiveNumberConfig
from .scanner import ImageQualityScanner, ScannerConfig, QualitySeverity
from .reporter import ReportGenerator


CONTEXT_SETTINGS = dict(help_option_names=["-h", "--help"])


class ArchiverCLI:
    def __init__(self):
        self.logger = None
        self.validator = None
        self.converter = None
        self.renamer = None
        self.scanner = None
        self.reporter = None

    def init_logger(self, log_level="INFO", log_dir="logs"):
        self.logger = get_logger(log_dir=log_dir, log_level=log_level)
        return self.logger

    def get_validator(self, config=None):
        if self.validator is None:
            val_config = ValidationConfig()
            if config:
                if "required_fields" in config:
                    val_config.required_fields = config["required_fields"]
                if "date_format" in config:
                    val_config.date_format = config["date_format"]
                if "retention_periods" in config:
                    val_config.retention_periods = config["retention_periods"]
                if "secrecy_levels" in config:
                    val_config.secrecy_levels = config["secrecy_levels"]
                if "archive_number_pattern" in config:
                    val_config.archive_number_pattern = config["archive_number_pattern"]
                if "allowed_extensions" in config:
                    val_config.allowed_extensions = config["allowed_extensions"]
                if "max_file_size_mb" in config:
                    val_config.max_file_size_mb = config["max_file_size_mb"]
            self.validator = ArchiveValidator(val_config, self.logger)
        return self.validator

    def get_converter(self):
        if self.converter is None:
            self.converter = FormatConverter(self.logger)
        return self.converter

    def get_renamer(self, config=None):
        if self.renamer is None:
            rename_config = ArchiveNumberConfig()
            if config:
                if "fonds_number" in config:
                    rename_config.fonds_number = config["fonds_number"]
                if "directory_number" in config:
                    rename_config.directory_number = config["directory_number"]
                if "volume_number" in config:
                    rename_config.volume_number = config["volume_number"]
                if "item_number_digits" in config:
                    rename_config.item_number_digits = config["item_number_digits"]
                if "separator" in config:
                    rename_config.separator = config["separator"]
                if "start_item" in config:
                    rename_config.start_item = config["start_item"]
            self.renamer = ArchiveRenamer(rename_config, self.logger)
        return self.renamer

    def get_scanner(self, config=None):
        if self.scanner is None:
            scan_config = ScannerConfig()
            if config:
                if "min_dpi" in config:
                    scan_config.min_dpi = config["min_dpi"]
                if "max_tilt_degrees" in config:
                    scan_config.max_tilt_degrees = config["max_tilt_degrees"]
                if "blank_page_threshold" in config:
                    scan_config.blank_page_threshold = config["blank_page_threshold"]
                if "color_modes" in config:
                    scan_config.color_modes = config["color_modes"]
            self.scanner = ImageQualityScanner(scan_config, self.logger)
        return self.scanner

    def get_reporter(self):
        if self.reporter is None:
            self.reporter = ReportGenerator(self.logger)
        return self.reporter


pass_cli = click.make_pass_decorator(ArchiverCLI, ensure=True)


@click.group(context_settings=CONTEXT_SETTINGS)
@click.option("--log-level", type=click.Choice(["DEBUG", "INFO", "WARNING", "ERROR"]),
              default="INFO", help="日志级别")
@click.option("--log-dir", default="logs", help="日志目录")
@click.option("--config", "config_file", type=click.Path(exists=True), help="配置文件路径")
@pass_cli
def cli(cli_obj, log_level, log_dir, config_file):
    """数字档案管理系统 - 电子档案移交接收工具"""
    cli_obj.init_logger(log_level=log_level, log_dir=log_dir)


@cli.command()
@click.argument("input_path", type=click.Path(exists=True))
@click.option("--output", "-o", type=click.Path(), help="输出结果文件路径 (JSON格式)")
@click.option("--file-dir", type=click.Path(exists=True), help="电子文件目录")
@click.option("--format", "output_format", type=click.Choice(["table", "json"]),
              default="table", help="输出格式")
@click.option("--strict/--no-strict", default=False, help="严格模式 (所有警告视为错误)")
@pass_cli
def receive(cli_obj, input_path, output, file_dir, output_format, strict):
    """接收校验 - 解析并校验档案元数据"""
    click.echo(click.style("\n=== 档案接收校验 ===", fg="cyan", bold=True))

    converter = cli_obj.get_converter()
    validator = cli_obj.get_validator()

    input_path = Path(input_path)
    fmt = converter.detect_format(str(input_path))
    click.echo(f"检测到文件格式: {click.style(fmt.value, fg='yellow')}")

    try:
        archives = converter.parse(str(input_path), fmt)
        click.echo(f"解析到档案记录: {click.style(str(len(archives)), fg='green')} 条")
    except Exception as e:
        click.echo(click.style(f"解析文件失败: {str(e)}", fg="red", bold=True))
        sys.exit(1)

    with click.progressbar(archives, label="校验进度") as bar:
        results = []
        for archive in bar:
            file_path = None
            if file_dir and "file_name" in archive:
                file_path = os.path.join(file_dir, archive["file_name"])
            result = validator.validate_archive(archive, file_path)
            results.append(result)

    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed
    total_errors = sum(len([i for i in r.issues if i.severity == ValidationSeverity.ERROR]) for r in results)
    total_warnings = sum(len([i for i in r.issues if i.severity == ValidationSeverity.WARNING]) for r in results)

    click.echo("\n" + "=" * 60)
    click.echo(click.style("校验结果汇总", bold=True))
    click.echo(f"  总档案数: {len(results)}")
    click.echo(f"  {click.style('通过', fg='green')}: {passed}")
    click.echo(f"  {click.style('未通过', fg='red')}: {failed}")
    click.echo(f"  错误数: {total_errors}")
    click.echo(f"  警告数: {total_warnings}")
    click.echo(f"  通过率: {passed/len(results)*100:.1f}%" if results else "  通过率: 0%")

    if output_format == "table":
        click.echo("\n" + click.style("问题详情 (前10条):", bold=True))
        issues_displayed = 0
        for result in results:
            if not result.passed and issues_displayed < 10:
                for issue in result.issues:
                    if issue.severity == ValidationSeverity.ERROR:
                        color = "red"
                    else:
                        color = "yellow"
                    click.echo(f"  [{click.style(issue.severity.value.upper(), fg=color)}] "
                               f"{result.archive_id}: {issue.message}")
                    issues_displayed += 1
                    if issues_displayed >= 10:
                        break
    elif output_format == "json":
        results_dict = [r.to_dict() for r in results]
        click.echo(json.dumps(results_dict, ensure_ascii=False, indent=2))

    if output:
        results_dict = [r.to_dict() for r in results]
        with open(output, "w", encoding="utf-8") as f:
            json.dump(results_dict, f, ensure_ascii=False, indent=2)
        click.echo(f"\n校验结果已保存到: {click.style(output, fg='green')}")

    if failed > 0:
        sys.exit(1)


@cli.command()
@click.argument("input_path", type=click.Path(exists=True))
@click.argument("output_path", type=click.Path())
@click.option("--format", "output_format", type=click.Choice(["xml", "excel", "csv", "json"]),
              default="xml", help="输出格式")
@click.option("--package/--no-package", default=False, help="生成完整移交包")
@click.option("--file-dir", type=click.Path(exists=True), help="电子文件目录 (用于移交包)")
@pass_cli
def convert(cli_obj, input_path, output_path, output_format, package, file_dir):
    """格式转换 - 多格式档案数据互转"""
    click.echo(click.style("\n=== 格式转换 ===", fg="cyan", bold=True))

    converter = cli_obj.get_converter()

    input_path = Path(input_path)
    fmt = converter.detect_format(str(input_path))
    click.echo(f"输入格式: {click.style(fmt.value, fg='yellow')}")
    click.echo(f"输出格式: {click.style(output_format, fg='yellow')}")

    try:
        archives = converter.parse(str(input_path), fmt)
        click.echo(f"解析记录: {click.style(str(len(archives)), fg='green')} 条")
    except Exception as e:
        click.echo(click.style(f"解析文件失败: {str(e)}", fg="red", bold=True))
        sys.exit(1)

    if package:
        try:
            package_dir = converter.create_transfer_package(
                archives, output_path, file_dir=file_dir
            )
            click.echo(f"\n{click.style('移交包生成成功!', fg='green', bold=True)}")
            click.echo(f"  路径: {package_dir}")
            click.echo(f"  包含:")
            click.echo(f"    - 元数据/电子档案元数据.xml")
            click.echo(f"    - 元数据/电子档案清单.xlsx")
            click.echo(f"    - 电子文件/")
            click.echo(f"    - 校验报告/")
        except Exception as e:
            click.echo(click.style(f"生成移交包失败: {str(e)}", fg="red", bold=True))
            sys.exit(1)
    else:
        try:
            converter.convert(str(input_path), output_path, output_format)
            click.echo(f"\n{click.style('转换成功!', fg='green', bold=True)}")
            click.echo(f"输出文件: {output_path}")
        except Exception as e:
            click.echo(click.style(f"转换失败: {str(e)}", fg="red", bold=True))
            sys.exit(1)


@cli.command()
@click.argument("input_path", type=click.Path(exists=True))
@click.option("--output", "-o", type=click.Path(), required=True, help="输出目录")
@click.option("--file-dir", type=click.Path(exists=True), help="电子文件目录")
@click.option("--fonds-number", default="DA", help="全宗号")
@click.option("--directory-number", default="01", help="目录号")
@click.option("--volume-number", default="001", help="案卷号")
@click.option("--item-digits", type=int, default=4, help="件号位数")
@click.option("--start-item", type=int, default=1, help="起始件号")
@click.option("--separator", default="-", help="分隔符")
@pass_cli
def rename(cli_obj, input_path, output, file_dir, fonds_number, directory_number,
           volume_number, item_digits, start_item, separator):
    """档号重命名 - 按规则批量编制档号并重命名文件"""
    click.echo(click.style("\n=== 档号重命名 ===", fg="cyan", bold=True))

    from .renamer import ArchiveNumberConfig
    config = ArchiveNumberConfig(
        fonds_number=fonds_number,
        directory_number=directory_number,
        volume_number=volume_number,
        item_number_digits=item_digits,
        separator=separator,
        start_item=start_item,
    )
    renamer = ArchiveRenamer(config, cli_obj.logger)
    converter = cli_obj.get_converter()

    input_path = Path(input_path)
    if input_path.is_file():
        archives = converter.parse(str(input_path))
        click.echo(f"解析档案: {click.style(str(len(archives)), fg='green')} 条")

        Path(output).mkdir(parents=True, exist_ok=True)

        updated_archives, rename_results = renamer.rename_archives(
            archives, output_dir=output, file_dir=file_dir
        )

        success_count = len([r for r in rename_results if r.success])
        click.echo(f"\n档号编制完成:")
        click.echo(f"  总档案数: {len(updated_archives)}")
        click.echo(f"  重命名成功: {success_count}")

        output_file = Path(output) / "档案清单_已重命名.xlsx"
        converter.to_excel(updated_archives, str(output_file))
        click.echo(f"  清单已保存: {output_file}")

    elif input_path.is_dir():
        file_list = []
        for f in sorted(input_path.iterdir()):
            if f.is_file():
                file_list.append(str(f))

        click.echo(f"发现文件: {click.style(str(len(file_list)), fg='green')} 个")

        rename_results = renamer.rename_files(file_list, output, start_item)

        success_count = len([r for r in rename_results if r.success])
        failed_count = len(rename_results) - success_count

        click.echo(f"\n重命名完成:")
        click.echo(f"  {click.style('成功', fg='green')}: {success_count}")
        click.echo(f"  {click.style('失败', fg='red')}: {failed_count}")

        if failed_count > 0:
            click.echo("\n失败详情:")
            for r in rename_results:
                if not r.success:
                    click.echo(f"  - {r.original_name}: {r.error}")


@cli.command()
@click.argument("input_path", type=click.Path(exists=True))
@click.option("--output", "-o", type=click.Path(), default="移交清单.xlsx", help="输出文件路径")
@click.option("--org-name", default="", help="移交单位名称")
@click.option("--receipt/--no-receipt", default=False, help="同时生成PDF接收回执")
@click.option("--receipt-output", default="接收回执.pdf", help="接收回执输出路径")
@click.option("--file-dir", type=click.Path(exists=True), help="电子文件目录 (用于校验)")
@pass_cli
def report(cli_obj, input_path, output, org_name, receipt, receipt_output, file_dir):
    """清单生成 - 生成移交清单和接收回执"""
    click.echo(click.style("\n=== 清单生成 ===", fg="cyan", bold=True))

    converter = cli_obj.get_converter()
    validator = cli_obj.get_validator()
    reporter = cli_obj.get_reporter()

    input_path = Path(input_path)
    archives = converter.parse(str(input_path))
    click.echo(f"档案总数: {click.style(str(len(archives)), fg='green')} 件")

    validation_results = None
    if file_dir:
        click.echo("执行校验...")
        validation_results = []
        with click.progressbar(archives, label="校验进度") as bar:
            for archive in bar:
                fp = None
                if "file_name" in archive:
                    fp = os.path.join(file_dir, archive["file_name"])
                result = validator.validate_archive(archive, fp)
                validation_results.append(result)

        passed = sum(1 for r in validation_results if r.passed)
        click.echo(f"校验通过: {passed}/{len(validation_results)}")

    try:
        reporter.generate_transfer_list(
            archives,
            validation_results=validation_results,
            output_path=output,
            org_name=org_name,
        )
        click.echo(f"\n{click.style('移交清单生成成功!', fg='green', bold=True)}")
        click.echo(f"  文件: {output}")
    except Exception as e:
        click.echo(click.style(f"生成清单失败: {str(e)}", fg="red", bold=True))
        sys.exit(1)

    if receipt:
        try:
            reporter.generate_receipt_pdf(
                archives,
                validation_results=validation_results,
                output_path=receipt_output,
                org_name=org_name,
            )
            click.echo(f"{click.style('接收回执生成成功!', fg='green', bold=True)}")
            click.echo(f"  文件: {receipt_output}")
        except Exception as e:
            click.echo(click.style(f"生成回执失败: {str(e)}", fg="red"))


@cli.command()
@click.argument("input_path", type=click.Path(exists=True))
@click.option("--output", "-o", type=click.Path(), default="质检报告.xlsx", help="质检报告输出路径")
@click.option("--min-dpi", type=int, default=300, help="最低分辨率要求 (dpi)")
@click.option("--max-tilt", type=float, default=5.0, help="最大倾斜度 (度)")
@click.option("--blank-threshold", type=float, default=0.05, help="空白页阈值 (内容占比)")
@click.option("--format", "output_format", type=click.Choice(["table", "json"]),
              default="table", help="输出格式")
@pass_cli
def quality(cli_obj, input_path, output, min_dpi, max_tilt, blank_threshold, output_format):
    """扫描件质检 - 数字化扫描件质量检测"""
    click.echo(click.style("\n=== 扫描件质量检测 ===", fg="cyan", bold=True))

    from .scanner import ScannerConfig, QualitySeverity
    config = ScannerConfig(
        min_dpi=min_dpi,
        max_tilt_degrees=max_tilt,
        blank_page_threshold=blank_threshold,
    )
    scanner = ImageQualityScanner(config, cli_obj.logger)
    reporter = cli_obj.get_reporter()

    input_path = Path(input_path)
    if input_path.is_file():
        click.echo(f"检测文件: {input_path.name}")
        results = scanner.scan_file(str(input_path))
    elif input_path.is_dir():
        click.echo(f"扫描目录: {input_path}")
        results = scanner.scan_directory(str(input_path))
    else:
        click.echo(click.style("无效的路径", fg="red", bold=True))
        sys.exit(1)

    total = len(results)
    passed = sum(1 for r in results if r.overall == QualitySeverity.PASS)
    warnings = sum(1 for r in results if r.overall == QualitySeverity.WARNING)
    failed = sum(1 for r in results if r.overall == QualitySeverity.FAIL)

    click.echo(f"\n{click.style('质检结果汇总', bold=True)}")
    click.echo(f"  总页数: {total}")
    click.echo(f"  {click.style('合格', fg='green')}: {passed}")
    click.echo(f"  {click.style('警告', fg='yellow')}: {warnings}")
    click.echo(f"  {click.style('不合格', fg='red')}: {failed}")
    click.echo(f"  合格率: {passed/total*100:.1f}%" if total > 0 else "  合格率: 0%")

    blank_pages = sum(1 for r in results if r.blank_page)
    if blank_pages > 0:
        click.echo(f"  空白页: {blank_pages}")

    if output_format == "table":
        issue_types = {}
        for r in results:
            for issue in r.issues:
                t = issue.get("type", "unknown")
                issue_types[t] = issue_types.get(t, 0) + 1

        if issue_types:
            click.echo(f"\n{click.style('问题类型分布:', bold=True)}")
            for issue_type, count in sorted(issue_types.items(), key=lambda x: -x[1]):
                click.echo(f"  - {issue_type}: {count} 次")

    elif output_format == "json":
        results_dict = [r.to_dict() for r in results]
        click.echo(json.dumps(results_dict, ensure_ascii=False, indent=2))

    try:
        reporter.generate_quality_report(results, output)
        click.echo(f"\n{click.style('质检报告生成成功!', fg='green', bold=True)}")
        click.echo(f"  文件: {output}")
    except Exception as e:
        click.echo(click.style(f"生成质检报告失败: {str(e)}", fg="red"))

    if failed > 0:
        sys.exit(1)


def main():
    cli()


if __name__ == "__main__":
    main()
