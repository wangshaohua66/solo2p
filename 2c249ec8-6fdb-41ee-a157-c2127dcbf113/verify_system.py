#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 60)
print("电网功率预测系统 - 功能验证")
print("=" * 60)
print()

print("1. 测试配置管理模块...")
try:
    from core.config_manager import ConfigManager
    config_mgr = ConfigManager()
    config = config_mgr.get_config()
    print(f"   ✓ 配置加载成功，默认算法: {config['model']['default_algorithm']}")
except Exception as e:
    print(f"   ✗ 配置管理模块失败: {e}")
    sys.exit(1)

print()
print("2. 测试数据导入模块...")
try:
    from core.importer import DataImporter
    importer = DataImporter(config)
    data_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'solar_station_001.csv')
    df = importer.import_data(data_file)
    quality = importer.get_quality_report()
    print(f"   ✓ 数据导入成功，共 {len(df)} 条记录")
    print(f"   ✓ 数据质量评分: {quality['quality_score']:.2f}")
    print(f"   ✓ 列名: {list(df.columns)}")
except Exception as e:
    print(f"   ✗ 数据导入模块失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()
print("3. 测试特征工程...")
try:
    X, y = importer.prepare_features(df)
    print(f"   ✓ 特征生成成功，特征数: {X.shape[1]}, 样本数: {len(X)}")
    print(f"   ✓ 特征列: {list(X.columns)}")
except Exception as e:
    print(f"   ✗ 特征工程失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()
print("4. 测试模型训练模块...")
try:
    from core.trainer import ModelTrainer
    trainer = ModelTrainer(config)
    
    start_time = time.time()
    train_result = trainer.train(X, y, algorithm='random_forest')
    train_time = time.time() - start_time
    
    print(f"   ✓ 模型训练成功，算法: {train_result['algorithm']}")
    print(f"   ✓ 训练时间: {train_time:.2f} 秒")
    print(f"   ✓ 训练集 MAE: {train_result['train_mae']:.4f}")
    print(f"   ✓ 训练集 RMSE: {train_result['train_rmse']:.4f}")
except Exception as e:
    print(f"   ✗ 模型训练失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()
print("5. 测试交叉验证...")
try:
    cv_result = trainer.cross_validate(X, y, cv_folds=3)
    print(f"   ✓ 3折交叉验证完成")
    print(f"   ✓ CV MAE: {cv_result['mae_mean']:.4f} ± {cv_result['mae_std']:.4f}")
    print(f"   ✓ CV RMSE: {cv_result['rmse_mean']:.4f} ± {cv_result['rmse_std']:.4f}")
except Exception as e:
    print(f"   ✗ 交叉验证失败: {e}")
    import traceback
    traceback.print_exc()

print()
print("6. 测试模型保存与加载...")
try:
    model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models', 'test_model.pkl')
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    
    saved = trainer.save_model(model_path)
    print(f"   ✓ 模型保存: {'成功' if saved else '失败'}")
    
    new_trainer = ModelTrainer(config)
    loaded = new_trainer.load_model(model_path)
    print(f"   ✓ 模型加载: {'成功' if loaded else '失败'}")
except Exception as e:
    print(f"   ✗ 模型保存/加载失败: {e}")
    import traceback
    traceback.print_exc()

print()
print("7. 测试预测模块...")
try:
    from core.predictor import PowerPredictor
    predictor = PowerPredictor(config)
    predictor.load_model('test_station', model_path)
    
    start_time = time.time()
    pred_result = predictor.predict_single_station('test_station', df, horizon_hours=24)
    pred_time = time.time() - start_time
    
    print(f"   ✓ 预测完成，耗时: {pred_time:.4f} 秒")
    print(f"   ✓ 预测步数: {len(pred_result['predictions'])}")
    print(f"   ✓ 首条预测: {pred_result['predictions'][0]}")
    print(f"   ✓ 包含置信区间: {'lower_bound' in pred_result['predictions'][0]}")
except Exception as e:
    print(f"   ✗ 预测模块失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()
print("8. 测试模型评估模块...")
try:
    from core.evaluator import ModelEvaluator
    evaluator = ModelEvaluator(config)
    
    test_size = int(len(X) * 0.2)
    X_test = X.tail(test_size)
    y_test = y.tail(test_size)
    
    y_pred = trainer.model.predict(X_test)
    metrics = evaluator.calculate_metrics(y_test.values, y_pred)
    
    print(f"   ✓ 评估完成")
    for k, v in metrics.items():
        print(f"   ✓ {k.upper()}: {v:.4f}")
except Exception as e:
    print(f"   ✗ 模型评估失败: {e}")
    import traceback
    traceback.print_exc()

print()
print("9. 测试工具模块...")
try:
    from utils.validators import validate_config, validate_algorithm_name
    from utils.formatters import format_metrics, colorize
    
    is_valid, errors = validate_config(config)
    print(f"   ✓ 配置验证: {'通过' if is_valid else '失败'}")
    print(f"   ✓ 算法验证(random_forest): {validate_algorithm_name('random_forest')}")
    print(f"   ✓ 指标格式化: 可用")
    print(f"   ✓ 彩色输出: 可用")
except Exception as e:
    print(f"   ✗ 工具模块失败: {e}")
    import traceback
    traceback.print_exc()

print()
print("=" * 60)
print("所有核心功能验证完成！")
print("=" * 60)
print()
print("可用的CLI命令:")
print("  python3 main.py import --file data/solar_station_001.csv --report")
print("  python3 main.py train --input data/solar_station_001.csv --algorithm random_forest --cv 5")
print("  python3 main.py predict --station test --input data/solar_station_001.csv --model models/test_model.pkl --horizon 24")
print("  python3 main.py evaluate --model models/test_model.pkl --test-data data/solar_station_001.csv")
print("  python3 main.py config --list")
print()
