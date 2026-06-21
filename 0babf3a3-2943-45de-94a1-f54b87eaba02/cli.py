#!/usr/bin/env python3
import argparse
import sys
import os
from typing import Optional

from config import ConfigManager
from logger import LoggerManager
from validator import DataValidator
from deduplicator import DataDeduplicator
from anomaly_detector import AnomalyDetector
from importer import DataImporter, BatchStatus


class HydroImportCLI:
    def __init__(self):
        self.parser = self._create_parser()
        self.config: Optional[ConfigManager] = None
        self.logger: Optional[LoggerManager] = None
        self.importer: Optional[DataImporter] = None

    def _create_parser(self) -> argparse.ArgumentParser:
        parser = argparse.ArgumentParser(
            prog="hydro-import",
            description="水文监测数据入库系统 - 支持数据校验、去重、异常检测、入库与报表导出",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
示例:
  # 导入单个文件
  hydro-import import --input data/station_001.csv --config config/stations.json

  # 批量导入目录
  hydro-import import --input data/batch/ --config config/stations.json --mode overwrite

  # 仅校验数据
  hydro-import validate --input data/station_001.csv --config config/stations.json

  # 去重分析
  hydro-import dedup --input data/batch/ --config config/stations.json --mode mark

  # 导出入库报表
  hydro-import report --start-date 2024-01-01 --end-date 2024-01-31 --output report.csv
            """
        )

        parser.add_argument("--config", help="站点配置文件路径 (JSON格式)")
        parser.add_argument("--log-level", choices=["DEBUG", "INFO", "WARNING", "ERROR"],
                            default=None, help="日志级别，默认为配置文件中的设置")
        parser.add_argument("--db-path", help="SQLite数据库路径，默认为配置文件中的设置")

        subparsers = parser.add_subparsers(dest="command", required=True,
                                           help="子命令")

        import_parser = subparsers.add_parser("import", help="数据导入命令")
        self._add_common_args(import_parser)
        import_parser.add_argument("--mode", choices=["skip", "overwrite", "mark"],
                                   default=None, help="重复数据处理策略")
        import_parser.add_argument("--threshold-water-level", type=float,
                                   default=None, help="水位跳变阈值(米)")
        import_parser.add_argument("--threshold-flow", type=float,
                                   default=None, help="流量突变阈值(立方米/秒)")
        import_parser.add_argument("--error-output", default=None,
                                   help="错误记录输出目录")

        validate_parser = subparsers.add_parser("validate", help="数据校验命令")
        self._add_common_args(validate_parser)
        validate_parser.add_argument("--output", help="校验结果输出文件")

        dedup_parser = subparsers.add_parser("dedup", help="去重分析命令")
        self._add_common_args(dedup_parser)
        dedup_parser.add_argument("--mode", choices=["skip", "overwrite", "mark"],
                                  default="skip", help="去重策略")
        dedup_parser.add_argument("--output", help="去重报告输出文件")

        report_parser = subparsers.add_parser("report", help="报表导出命令")
        report_parser.add_argument("--start-date", help="开始日期 (YYYY-MM-DD)")
        report_parser.add_argument("--end-date", help="结束日期 (YYYY-MM-DD)")
        report_parser.add_argument("--output", required=True, help="报表输出路径")
        report_parser.add_argument("--type", choices=["progress", "statistics"],
                                   default="statistics", help="报表类型")

        return parser

    def _add_common_args(self, parser: argparse.ArgumentParser):
        parser.add_argument("--input", required=True,
                            help="输入文件或目录路径")

    def _init_components(self, args: argparse.Namespace):
        self.config = ConfigManager(args.config)

        if args.db_path:
            self.config.set_db_path(args.db_path)

        if args.log_level:
            self.config.set_log_level(args.log_level)

        self.logger = LoggerManager(self.config.get_log_config())

        if args.log_level:
            self.logger.set_level(args.log_level)

        self.importer = DataImporter(self.config, self.logger)

        if hasattr(args, "mode") and args.mode:
            self.importer.deduplicator.set_strategy(args.mode)

        if hasattr(args, "threshold_water_level") and args.threshold_water_level is not None:
            self.importer.anomaly_detector.set_thresholds(
                water_level_jump=args.threshold_water_level
            )

        if hasattr(args, "threshold_flow") and args.threshold_flow is not None:
            self.importer.anomaly_detector.set_thresholds(
                flow_surge=args.threshold_flow
            )

    def cmd_import(self, args: argparse.Namespace) -> int:
        input_path = args.input
        error_output = args.error_output

        if os.path.isfile(input_path):
            if error_output:
                if os.path.isdir(error_output):
                    filename = os.path.basename(input_path)
                    error_output = os.path.join(error_output, f"error_{filename}")
            else:
                filename = os.path.basename(input_path)
                error_output = f"error_{filename}"
            result = self.importer.import_file(input_path, error_output)
            self._print_import_result(result)
            return 0 if result.status == BatchStatus.SUCCESS else 1
        elif os.path.isdir(input_path):
            error_dir = error_output or "errors"
            results = self.importer.import_directory(input_path, error_dir)
            success = sum(1 for r in results if r.status == BatchStatus.SUCCESS)
            failed = sum(1 for r in results if r.status == BatchStatus.FAILED)
            total_imported = sum(r.imported_records for r in results)
            total_duplicates = sum(r.duplicate_skipped + r.duplicate_marked for r in results)
            total_anomalies = sum(r.anomaly_marked for r in results)

            print("\n" + "=" * 60)
            print("批量导入汇总")
            print("=" * 60)
            print(f"总文件数: {len(results)}")
            print(f"成功: {success}, 失败: {failed}")
            print(f"入库记录: {total_imported}")
            print(f"重复记录: {total_duplicates}")
            print(f"异常记录: {total_anomalies}")
            print("=" * 60)

            return 0 if failed == 0 else 1
        else:
            print(f"错误: 输入路径不存在: {input_path}", file=sys.stderr)
            return 1

    def cmd_validate(self, args: argparse.Namespace) -> int:
        input_path = args.input
        validator = DataValidator(self.config, self.logger)

        if os.path.isfile(input_path):
            records = self.importer._read_csv_file(input_path)
            valid, invalid = validator.validate_batch(records, os.path.basename(input_path))

            print(f"\n校验结果: {os.path.basename(input_path)}")
            print(f"总记录数: {len(records)}")
            print(f"有效记录: {len(valid)}")
            print(f"无效记录: {len(invalid)}")

            if invalid:
                print("\n无效记录详情:")
                for err in invalid[:10]:
                    print(f"  行{err['line']}: {err['error']}")
                if len(invalid) > 10:
                    print(f"  ... 还有 {len(invalid) - 10} 条错误记录")

            if args.output:
                self.importer._write_error_records(invalid, args.output)
                print(f"\n错误记录已写入: {args.output}")

            return 0 if len(invalid) == 0 else 1
        elif os.path.isdir(input_path):
            total_valid = 0
            total_invalid = 0
            for filename in sorted(os.listdir(input_path)):
                if filename.lower().endswith('.csv'):
                    filepath = os.path.join(input_path, filename)
                    records = self.importer._read_csv_file(filepath)
                    valid, invalid = validator.validate_batch(records, filename)
                    total_valid += len(valid)
                    total_invalid += len(invalid)
                    print(f"{filename}: 有效={len(valid)}, 无效={len(invalid)}")

            print(f"\n总计: 有效={total_valid}, 无效={total_invalid}")
            return 0 if total_invalid == 0 else 1
        else:
            print(f"错误: 输入路径不存在: {input_path}", file=sys.stderr)
            return 1

    def cmd_dedup(self, args: argparse.Namespace) -> int:
        input_path = args.input
        deduplicator = DataDeduplicator(self.config, self.logger)
        deduplicator.set_strategy(args.mode)

        if os.path.isfile(input_path):
            records = self.importer._read_csv_file(input_path)
            existing_keys = self.importer._get_existing_keys(records)
            result = deduplicator.deduplicate_batch(
                records, existing_keys, os.path.basename(input_path)
            )
            report = deduplicator.generate_report(result)

            print(f"\n去重分析: {os.path.basename(input_path)}")
            print(f"总记录数: {len(records)}")
            print(f"唯一条数: {report['unique_count']}")
            print(f"重复条数: {report['total_duplicates']}")
            print(f"重复率: {report['duplicate_rate']:.2%}")
            print(f"策略: {args.mode}")
            print(f"  - 跳过: {result.skipped_count}")
            print(f"  - 覆盖: {result.overwritten_count}")
            print(f"  - 标记: {result.marked_count}")

            return 0
        elif os.path.isdir(input_path):
            total_duplicates = 0
            total_unique = 0
            for filename in sorted(os.listdir(input_path)):
                if filename.lower().endswith('.csv'):
                    filepath = os.path.join(input_path, filename)
                    records = self.importer._read_csv_file(filepath)
                    existing_keys = self.importer._get_existing_keys(records)
                    result = deduplicator.deduplicate_batch(records, existing_keys, filename)
                    report = deduplicator.generate_report(result)
                    total_duplicates += report['total_duplicates']
                    total_unique += report['unique_count']
                    print(f"{filename}: 唯一={report['unique_count']}, "
                          f"重复={report['total_duplicates']}, "
                          f"重复率={report['duplicate_rate']:.2%}")

            total = total_unique + total_duplicates
            rate = total_duplicates / total if total > 0 else 0
            print(f"\n总计: 唯一={total_unique}, 重复={total_duplicates}, 重复率={rate:.2%}")
            return 0
        else:
            print(f"错误: 输入路径不存在: {input_path}", file=sys.stderr)
            return 1

    def cmd_report(self, args: argparse.Namespace) -> int:
        if args.type == "statistics":
            self.importer.export_report(args.output, args.start_date, args.end_date)
            print(f"统计报表已导出: {args.output}")
        else:
            progress = self.importer.query_progress(args.start_date, args.end_date)
            import csv
            fieldnames = ["filename", "total_records", "imported_records",
                          "duplicate_skipped", "anomaly_marked", "failed_records",
                          "status", "start_time", "end_time"]
            with open(args.output, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for row in progress:
                    writer.writerow({k: row.get(k, "") for k in fieldnames})
            print(f"进度报表已导出: {args.output}，共 {len(progress)} 条记录")
        return 0

    def _print_import_result(self, result):
        print("\n" + "=" * 50)
        print(f"文件: {result.filename}")
        print("=" * 50)
        print(f"状态: {result.status}")
        print(f"总记录数: {result.total_records}")
        print(f"有效记录: {result.valid_records}")
        print(f"无效记录: {result.invalid_records}")
        print(f"入库成功: {result.imported_records}")
        print(f"重复跳过: {result.duplicate_skipped}")
        print(f"重复覆盖: {result.duplicate_overwritten}")
        print(f"重复标记: {result.duplicate_marked}")
        print(f"异常标记: {result.anomaly_marked}")
        if result.start_time and result.end_time:
            duration = (result.end_time - result.start_time).total_seconds()
            print(f"处理耗时: {duration:.2f} 秒")
        print("=" * 50)

    def run(self, args=None) -> int:
        parsed_args = self.parser.parse_args(args)

        try:
            self._init_components(parsed_args)
        except Exception as e:
            print(f"初始化失败: {e}", file=sys.stderr)
            return 1

        commands = {
            "import": self.cmd_import,
            "validate": self.cmd_validate,
            "dedup": self.cmd_dedup,
            "report": self.cmd_report
        }

        try:
            return commands[parsed_args.command](parsed_args)
        except KeyboardInterrupt:
            print("\n操作已取消")
            return 130
        except Exception as e:
            print(f"执行错误: {e}", file=sys.stderr)
            if self.logger:
                self.logger.error(f"命令执行失败: {e}")
            return 1


def main():
    cli = HydroImportCLI()
    sys.exit(cli.run())


if __name__ == "__main__":
    main()
