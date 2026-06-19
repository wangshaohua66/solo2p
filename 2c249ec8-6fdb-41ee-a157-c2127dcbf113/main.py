#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import argparse
import json
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.config_manager import ConfigManager
from core.importer import DataImporter
from core.trainer import ModelTrainer
from core.predictor import PowerPredictor
from core.evaluator import ModelEvaluator
from utils.formatters import (
    print_success, print_error, print_warning, print_info, print_header,
    format_table, format_metrics, format_data_quality_report,
    format_prediction_result, save_prediction_to_file, generate_html_report
)
from utils.validators import validate_algorithm_name, validate_file_path


def get_parser():
    parser = argparse.ArgumentParser(
        prog='power-forecast',
        description='区域电网新能源功率预测系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  power-forecast import --file data/station001.csv
  power-forecast train --input data/station001.csv --algorithm random_forest
  power-forecast predict --station station001 --horizon 24
  power-forecast evaluate --model model.pkl --test-data test.csv
  power-forecast report --station station001 --output report.html
  power-forecast config --get model.default_algorithm
        """
    )

    parser.add_argument('--config', type=str, default=None, help='配置文件路径')
    parser.add_argument('--verbose', action='store_true', help='输出详细日志')
    parser.add_argument('--quiet', action='store_true', help='静默模式，仅输出结果')

    subparsers = parser.add_subparsers(dest='command', help='子命令')

    import_parser = subparsers.add_parser('import', help='导入数据')
    import_parser.add_argument('--file', '-f', type=str, required=True, help='输入文件路径')
    import_parser.add_argument('--format', '-fmt', type=str, default=None, choices=['csv', 'excel', 'json'],
                                help='文件格式（自动检测）')
    import_parser.add_argument('--output', '-o', type=str, default=None, help='输出清洗后数据的路径')
    import_parser.add_argument('--report', action='store_true', help='生成数据质量报告')

    train_parser = subparsers.add_parser('train', help='训练模型')
    train_parser.add_argument('--input', '-i', type=str, required=True, help='训练数据文件路径')
    train_parser.add_argument('--algorithm', '-a', type=str, default=None,
                               choices=['random_forest', 'gradient_boosting', 'xgboost'],
                               help='算法类型')
    train_parser.add_argument('--output', '-o', type=str, default=None, help='模型输出路径')
    train_parser.add_argument('--station', '-s', type=str, default='default', help='电站ID')
    train_parser.add_argument('--cv', type=int, default=None, help='K折交叉验证折数')
    train_parser.add_argument('--tune', action='store_true', help='启用超参数调优')
    train_parser.add_argument('--test-size', type=float, default=0.2, help='测试集比例')

    predict_parser = subparsers.add_parser('predict', help='发电功率预测')
    predict_parser.add_argument('--station', '-s', type=str, required=True, help='电站ID')
    predict_parser.add_argument('--input', '-i', type=str, default=None, help='输入数据文件')
    predict_parser.add_argument('--model', '-m', type=str, default=None, help='模型文件路径')
    predict_parser.add_argument('--horizon', type=int, default=None, help='预测时间窗口（小时）')
    predict_parser.add_argument('--output', '-o', type=str, default=None, help='输出文件路径')
    predict_parser.add_argument('--format', '-fmt', type=str, default='csv',
                                 choices=['csv', 'excel', 'json', 'html'],
                                 help='输出格式')
    predict_parser.add_argument('--no-confidence', action='store_true', help='不输出置信区间')

    eval_parser = subparsers.add_parser('evaluate', help='模型精度评估')
    eval_parser.add_argument('--model', '-m', type=str, default=None, help='模型文件路径')
    eval_parser.add_argument('--test-data', '-t', type=str, required=True, help='测试数据文件')
    eval_parser.add_argument('--station', '-s', type=str, default='default', help='电站ID')
    eval_parser.add_argument('--output', '-o', type=str, default=None, help='评估报告输出路径')
    eval_parser.add_argument('--sliding-window', action='store_true', help='滑动窗口评估')

    report_parser = subparsers.add_parser('report', help='生成报表')
    report_parser.add_argument('--station', '-s', type=str, default=None, help='电站ID')
    report_parser.add_argument('--input', '-i', type=str, default=None, help='预测结果文件')
    report_parser.add_argument('--output', '-o', type=str, required=True, help='报表输出路径')
    report_parser.add_argument('--format', '-fmt', type=str, default='html',
                                choices=['csv', 'excel', 'json', 'html'],
                                help='报表格式')
    report_parser.add_argument('--aggregate-by', type=str, default=None,
                                choices=['station', 'date', 'hour'],
                                help='聚合方式')

    config_parser = subparsers.add_parser('config', help='配置管理')
    config_parser.add_argument('--get', type=str, default=None, help='获取配置项')
    config_parser.add_argument('--set', type=str, nargs=2, default=None, metavar=('KEY', 'VALUE'),
                                help='设置配置项')
    config_parser.add_argument('--list', action='store_true', help='列出所有配置')
    config_parser.add_argument('--validate', action='store_true', help='验证配置文件')

    batch_parser = subparsers.add_parser('batch', help='批量处理')
    batch_parser.add_argument('--input-dir', '-i', type=str, required=True, help='输入数据目录')
    batch_parser.add_argument('--model-dir', '-m', type=str, default=None, help='模型目录')
    batch_parser.add_argument('--output-dir', '-o', type=str, default=None, help='输出目录')
    batch_parser.add_argument('--horizon', type=int, default=None, help='预测时间窗口（小时）')
    batch_parser.add_argument('--train', action='store_true', help='批量训练模型')

    return parser


def main():
    parser = get_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    config_manager = ConfigManager(args.config)
    config = config_manager.get_config()

    if args.verbose:
        config['logging']['verbose'] = True
    if args.quiet:
        config['logging']['quiet'] = True

    verbose = config.get('logging', {}).get('verbose', False)
    quiet = config.get('logging', {}).get('quiet', False)

    try:
        if args.command == 'import':
            return cmd_import(args, config, verbose, quiet)
        elif args.command == 'train':
            return cmd_train(args, config, verbose, quiet)
        elif args.command == 'predict':
            return cmd_predict(args, config, verbose, quiet)
        elif args.command == 'evaluate':
            return cmd_evaluate(args, config, verbose, quiet)
        elif args.command == 'report':
            return cmd_report(args, config, verbose, quiet)
        elif args.command == 'config':
            return cmd_config(args, config_manager, config, verbose, quiet)
        elif args.command == 'batch':
            return cmd_batch(args, config, verbose, quiet)
        else:
            print_error(f"未知命令: {args.command}")
            return 1
    except KeyboardInterrupt:
        print_warning("\n操作已取消")
        return 130
    except Exception as e:
        print_error(f"执行失败: {str(e)}")
        if verbose:
            import traceback
            traceback.print_exc()
        return 1


def cmd_import(args, config, verbose, quiet):
    if not quiet:
        print_header("数据导入")

    importer = DataImporter(config)

    if verbose and not quiet:
        print_info(f"正在导入文件: {args.file}")

    df = importer.import_data(args.file, args.format)
    quality_report = importer.get_quality_report()

    if not quiet:
        print_success(f"数据导入成功，共 {len(df)} 条记录")
        print()

    if args.report or verbose:
        if not quiet:
            print_info("数据质量报告:")
            print(format_data_quality_report(quality_report))
            print()

    if args.output:
        os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else '.', exist_ok=True)
        if args.output.endswith('.xlsx') or args.output.endswith('.xls'):
            df.to_excel(args.output, index=False, engine='openpyxl')
        elif args.output.endswith('.json'):
            df.to_json(args.output, orient='records', force_ascii=False, indent=2)
        else:
            df.to_csv(args.output, index=False, encoding='utf-8-sig')

        if not quiet:
            print_success(f"清洗后数据已保存到: {args.output}")

    if not quiet:
        print()
        print_info("数据预览:")
        print(df.head(5).to_string())
        print(f"\n共 {len(df)} 行，{len(df.columns)} 列")

    return 0


def cmd_train(args, config, verbose, quiet):
    if not quiet:
        print_header("模型训练")

    algorithm = args.algorithm or config.get('model', {}).get('default_algorithm', 'random_forest')

    if not validate_algorithm_name(algorithm):
        print_error(f"不支持的算法: {algorithm}")
        return 1

    importer = DataImporter(config)
    if verbose and not quiet:
        print_info(f"正在加载训练数据: {args.input}")

    df = importer.import_data(args.input)
    X, y = importer.prepare_features(df)

    if len(X) < config.get('data', {}).get('min_data_points', 100):
        print_warning(f"数据量较少（{len(X)}条），可能影响模型质量")

    if not quiet:
        print_info(f"算法: {algorithm}")
        print_info(f"训练样本: {len(X)} 条")
        print_info(f"特征数量: {X.shape[1]}")
        print()

    trainer = ModelTrainer(config)

    if args.tune:
        if verbose and not quiet:
            print_info("正在进行超参数调优...")
        results = trainer.hyperparameter_tuning(X, y, algorithm=algorithm)
        if not quiet:
            print_success(f"超参数调优完成")
            print_info(f"最佳参数: {results['best_params']}")
            print_info(f"最佳得分: {results['best_score']:.4f}")
            print()
    else:
        if verbose and not quiet:
            print_info("正在训练模型...")

        train_result = trainer.train(X, y, algorithm=algorithm)

        if not quiet:
            print_success("模型训练完成")
            print_info(f"训练时间: {train_result['training_time']:.2f} 秒")
            print_info(f"训练集 MAE: {train_result['train_mae']:.4f}")
            print_info(f"训练集 RMSE: {train_result['train_rmse']:.4f}")
            print()

    if args.cv:
        if verbose and not quiet:
            print_info(f"正在进行 {args.cv} 折交叉验证...")

        cv_results = trainer.cross_validate(X, y, cv_folds=args.cv, algorithm=algorithm)

        if not quiet:
            print_info(f"交叉验证结果 ({args.cv}-fold CV):")
            print(format_metrics(cv_results))
            print()

    model_path = args.output
    if not model_path:
        model_dir = config.get('paths', {}).get('model_dir', './models')
        os.makedirs(model_dir, exist_ok=True)
        model_path = os.path.join(model_dir, f"{args.station}_model.pkl")

    if trainer.save_model(model_path):
        if not quiet:
            print_success(f"模型已保存到: {model_path}")
    else:
        print_error("模型保存失败")
        return 1

    return 0


def cmd_predict(args, config, verbose, quiet):
    if not quiet:
        print_header("功率预测")

    predictor = PowerPredictor(config)

    model_path = args.model
    if not model_path:
        model_dir = config.get('paths', {}).get('model_dir', './models')
        model_path = os.path.join(model_dir, f"{args.station}_model.pkl")

    valid, msg = validate_file_path(model_path, must_exist=True)
    if not valid:
        print_error(f"模型文件错误: {msg}")
        print_info("请先使用 train 命令训练模型")
        return 1

    if verbose and not quiet:
        print_info(f"加载模型: {model_path}")

    predictor.load_model(args.station, model_path)

    input_path = args.input
    if not input_path:
        print_error("请提供输入数据文件 (--input)")
        return 1

    importer = DataImporter(config)
    df = importer.import_data(input_path)

    if not quiet:
        print_info(f"电站: {args.station}")
        print_info(f"输入数据: {len(df)} 条记录")
        print()

    horizon = args.horizon or config.get('prediction', {}).get('horizon_hours', 24)
    include_confidence = not args.no_confidence

    if verbose and not quiet:
        print_info(f"正在预测未来 {horizon} 小时的功率...")

    result = predictor.predict_single_station(
        args.station, df, horizon_hours=horizon, include_confidence=include_confidence
    )

    if not quiet:
        print_success(f"预测完成，耗时: {result['prediction_time']:.4f} 秒")
        print()
        print(format_prediction_result(result))
        print()

    if args.output:
        output_path = args.output
        output_format = args.format
    else:
        output_dir = config.get('paths', {}).get('output_dir', './output')
        os.makedirs(output_dir, exist_ok=True)
        output_format = args.format
        ext_map = {'csv': '.csv', 'excel': '.xlsx', 'json': '.json', 'html': '.html'}
        output_path = os.path.join(output_dir, f"{args.station}_prediction{ext_map.get(output_format, '.csv')}")

    if output_format == 'html':
        success = generate_html_report(result, output_path)
    else:
        success = save_prediction_to_file(result, output_path, output_format)

    if success:
        if not quiet:
            print_success(f"预测结果已保存到: {output_path}")
    else:
        print_error(f"保存预测结果失败")

    return 0


def cmd_evaluate(args, config, verbose, quiet):
    if not quiet:
        print_header("模型评估")

    importer = DataImporter(config)
    test_df = importer.import_data(args.test_data)
    X_test, y_test = importer.prepare_features(test_df)

    model_path = args.model
    if not model_path:
        model_dir = config.get('paths', {}).get('model_dir', './models')
        model_path = os.path.join(model_dir, f"{args.station}_model.pkl")

    trainer = ModelTrainer(config)
    if not trainer.load_model(model_path):
        print_error(f"无法加载模型: {model_path}")
        return 1

    if not quiet:
        print_info(f"测试数据: {len(test_df)} 条记录")
        print_info(f"模型文件: {model_path}")
        print()

    model = trainer.model
    y_pred = model.predict(X_test)

    evaluator = ModelEvaluator(config)
    metrics = evaluator.calculate_metrics(y_test.values, y_pred)

    if not quiet:
        print_info("评估指标:")
        print(format_metrics(metrics))
        print()

    if args.sliding_window:
        if verbose and not quiet:
            print_info("正在进行滑动窗口评估...")

        window_result = evaluator.sliding_window_evaluation(y_test.values, y_pred)

        if not quiet:
            print_info(f"滑动窗口评估 (窗口大小: {window_result['window_size']}):")
            print_info(f"  窗口数量: {window_result['n_windows']}")
            if 'trend' in window_result:
                print_info(f"  MAE趋势: {window_result['trend']['mae_trend']}")
                print_info(f"  MAE变化: {window_result['trend']['mae_change_pct']:.2f}%")
            print()

    if args.output:
        os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else '.', exist_ok=True)
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump({
                'station': args.station,
                'metrics': metrics,
                'n_samples': len(y_test),
            }, f, indent=2, ensure_ascii=False)
        if not quiet:
            print_success(f"评估报告已保存到: {args.output}")

    return 0


def cmd_report(args, config, verbose, quiet):
    if not quiet:
        print_header("生成报表")

    if not args.input and not args.station:
        print_error("请指定输入文件 (--input) 或电站ID (--station)")
        return 1

    output_format = args.format

    if args.input:
        input_path = args.input
    else:
        output_dir = config.get('paths', {}).get('output_dir', './output')
        input_path = os.path.join(output_dir, f"{args.station}_prediction.csv")

    valid, msg = validate_file_path(input_path, must_exist=True)
    if not valid:
        print_error(f"输入文件错误: {msg}")
        return 1

    if input_path.endswith('.xlsx') or input_path.endswith('.xls'):
        df = pd.read_excel(input_path, engine='openpyxl')
    elif input_path.endswith('.json'):
        df = pd.read_json(input_path)
    else:
        df = pd.read_csv(input_path)

    if not quiet:
        print_info(f"数据记录: {len(df)} 条")
        print_info(f"输出格式: {output_format}")
        print()

    if args.aggregate_by:
        if args.aggregate_by == 'station' and 'station_id' in df.columns:
            agg_df = df.groupby('station_id').agg({'power': ['mean', 'max', 'min']})
            agg_df.columns = ['mean_power', 'max_power', 'min_power']
            agg_df = agg_df.reset_index()
            if not quiet:
                print_info("按电站聚合:")
                print(agg_df.to_string())
                print()
        elif args.aggregate_by == 'date' and 'timestamp' in df.columns:
            df['date'] = pd.to_datetime(df['timestamp']).dt.date
            agg_df = df.groupby('date').agg({'power': ['mean', 'max', 'min']})
            agg_df.columns = ['mean_power', 'max_power', 'min_power']
            agg_df = agg_df.reset_index()
            if not quiet:
                print_info("按日期聚合:")
                print(agg_df.head(10).to_string())
                print()

    os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else '.', exist_ok=True)

    if output_format == 'html':
        result = {
            'station_id': args.station or 'N/A',
            'predictions': df.to_dict('records'),
            'metrics': {},
        }
        success = generate_html_report(result, args.output)
    elif output_format == 'excel':
        success = True
        df.to_excel(args.output, index=False, engine='openpyxl')
    elif output_format == 'json':
        success = True
        df.to_json(args.output, orient='records', force_ascii=False, indent=2)
    else:
        success = True
        df.to_csv(args.output, index=False, encoding='utf-8-sig')

    if success:
        if not quiet:
            print_success(f"报表已生成: {args.output}")
    else:
        print_error("报表生成失败")
        return 1

    return 0


def cmd_config(args, config_manager, config, verbose, quiet):
    if args.validate:
        if not quiet:
            print_header("配置验证")
        is_valid, errors = config_manager.validate()
        if is_valid:
            if not quiet:
                print_success("配置文件验证通过")
        else:
            print_error("配置文件验证失败:")
            for err in errors:
                print(f"  - {err}")
            return 1
        return 0

    if args.get:
        value = config_manager.get_config(args.get)
        if value is not None:
            if isinstance(value, (dict, list)):
                print(json.dumps(value, indent=2, ensure_ascii=False))
            else:
                print(value)
        else:
            if not quiet:
                print_warning(f"配置项不存在: {args.get}")
            return 1
        return 0

    if args.set:
        key, value = args.set
        try:
            if value.lower() in ('true', 'false'):
                value = value.lower() == 'true'
            elif value.isdigit():
                value = int(value)
            else:
                try:
                    value = float(value)
                except ValueError:
                    pass
        except Exception:
            pass

        config_manager.set_config(key, value)
        config_manager.save_config()
        if not quiet:
            print_success(f"已设置 {key} = {value}")
        return 0

    if args.list:
        if not quiet:
            print_header("配置列表")
        full_config = config_manager.get_config()
        print(json.dumps(full_config, indent=2, ensure_ascii=False))
        return 0

    if not quiet:
        print_header("配置管理")
        print("使用 --get, --set, --list, 或 --validate 选项")
    return 0


def cmd_batch(args, config, verbose, quiet):
    if not quiet:
        print_header("批量处理")

    if not os.path.isdir(args.input_dir):
        print_error(f"输入目录不存在: {args.input_dir}")
        return 1

    files = []
    for f in os.listdir(args.input_dir):
        if f.endswith('.csv') or f.endswith('.xlsx') or f.endswith('.xls') or f.endswith('.json'):
            files.append(os.path.join(args.input_dir, f))

    if not files:
        print_warning("输入目录中没有找到数据文件")
        return 0

    if not quiet:
        print_info(f"找到 {len(files)} 个数据文件")
        print()

    output_dir = args.output_dir or config.get('paths', {}).get('output_dir', './output')
    model_dir = args.model_dir or config.get('paths', {}).get('model_dir', './models')
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(model_dir, exist_ok=True)

    horizon = args.horizon or config.get('prediction', {}).get('horizon_hours', 24)

    results = []
    start_time = time.time()

    for i, filepath in enumerate(files, 1):
        station_id = os.path.splitext(os.path.basename(filepath))[0]

        try:
            if not quiet:
                print_info(f"[{i}/{len(files)}] 处理 {station_id}...")

            importer = DataImporter(config)
            df = importer.import_data(filepath)

            if args.train:
                trainer = ModelTrainer(config)
                X, y = importer.prepare_features(df)
                trainer.train(X, y)
                model_path = os.path.join(model_dir, f"{station_id}_model.pkl")
                trainer.save_model(model_path)

                if not quiet:
                    print_success(f"  模型训练完成")

            else:
                predictor = PowerPredictor(config)
                model_path = os.path.join(model_dir, f"{station_id}_model.pkl")

                if os.path.exists(model_path):
                    predictor.load_model(station_id, model_path)
                    result = predictor.predict_single_station(
                        station_id, df, horizon_hours=horizon
                    )

                    output_path = os.path.join(output_dir, f"{station_id}_prediction.csv")
                    save_prediction_to_file(result, output_path, 'csv')

                    results.append({
                        'station': station_id,
                        'status': 'success',
                        'predictions': len(result['predictions']),
                    })

                    if not quiet:
                        print_success(f"  预测完成")
                else:
                    results.append({
                        'station': station_id,
                        'status': 'skipped',
                        'reason': 'no model',
                    })
                    if not quiet:
                        print_warning(f"  跳过（无模型）")

        except Exception as e:
            results.append({
                'station': station_id,
                'status': 'error',
                'error': str(e),
            })
            print_error(f"  处理失败: {e}")

    total_time = time.time() - start_time

    if not quiet:
        print()
        print_success(f"批量处理完成，总耗时: {total_time:.2f} 秒")
        print_info(f"  成功: {sum(1 for r in results if r['status'] == 'success')}")
        print_info(f"  跳过: {sum(1 for r in results if r['status'] == 'skipped')}")
        print_info(f"  失败: {sum(1 for r in results if r['status'] == 'error')}")

    return 0


if __name__ == '__main__':
    import pandas as pd
    sys.exit(main())
