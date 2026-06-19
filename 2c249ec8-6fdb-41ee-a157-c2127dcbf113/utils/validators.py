import os
import re
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

import pandas as pd
import numpy as np


class ValidationError(Exception):
    pass


def validate_config(config: Dict[str, Any]) -> Tuple[bool, List[str]]:
    errors = []
    
    if not isinstance(config, dict):
        return False, ["配置必须是字典类型"]
    
    required_sections = ['model', 'paths', 'prediction', 'data', 'evaluation']
    for section in required_sections:
        if section not in config:
            errors.append(f"缺少必需的配置节: {section}")
    
    if 'model' in config:
        model_cfg = config['model']
        if 'default_algorithm' not in model_cfg:
            errors.append("缺少默认算法配置")
        elif model_cfg['default_algorithm'] not in ['random_forest', 'gradient_boosting', 'xgboost', 'lstm']:
            errors.append(f"不支持的算法: {model_cfg['default_algorithm']}")
    
    if 'paths' in config:
        paths_cfg = config['paths']
        for path_key in ['data_dir', 'model_dir', 'output_dir']:
            if path_key not in paths_cfg:
                errors.append(f"缺少路径配置: {path_key}")
    
    if 'prediction' in config:
        pred_cfg = config['prediction']
        if 'horizon_hours' in pred_cfg:
            h = pred_cfg['horizon_hours']
            if not isinstance(h, int) or h < 1 or h > 72:
                errors.append(f"预测时间窗口必须在1-72小时之间，当前值: {h}")
        if 'confidence_level' in pred_cfg:
            cl = pred_cfg['confidence_level']
            if not isinstance(cl, (int, float)) or cl <= 0 or cl >= 1:
                errors.append(f"置信水平必须在0-1之间，当前值: {cl}")
    
    if 'data' in config:
        data_cfg = config['data']
        if 'outlier_threshold' in data_cfg:
            ot = data_cfg['outlier_threshold']
            if not isinstance(ot, (int, float)) or ot <= 0:
                errors.append(f"异常值阈值必须大于0，当前值: {ot}")
    
    return len(errors) == 0, errors


def validate_dataframe(df: pd.DataFrame, required_columns: Optional[List[str]] = None) -> Tuple[bool, List[str]]:
    errors = []
    
    if df is None or df.empty:
        return False, ["数据框为空"]
    
    if required_columns:
        for col in required_columns:
            if col not in df.columns:
                errors.append(f"缺少必需的列: {col}")
    
    if df.isnull().all().any():
        errors.append("存在全部为空的列")
    
    if len(df) == 0:
        errors.append("数据框没有行数据")
    
    return len(errors) == 0, errors


def validate_station_id(station_id: str) -> bool:
    if not station_id or not isinstance(station_id, str):
        return False
    pattern = r'^[A-Za-z0-9_-]{1,50}$'
    return bool(re.match(pattern, station_id))


def validate_file_path(file_path: str, must_exist: bool = True) -> Tuple[bool, Optional[str]]:
    if not file_path or not isinstance(file_path, str):
        return False, "文件路径无效"
    
    if must_exist and not os.path.exists(file_path):
        return False, f"文件不存在: {file_path}"
    
    if must_exist and not os.path.isfile(file_path):
        return False, f"路径不是文件: {file_path}"
    
    return True, None


def validate_date_range(start_date: str, end_date: str, date_format: str = '%Y-%m-%d') -> Tuple[bool, Optional[str]]:
    try:
        start = datetime.strptime(start_date, date_format)
        end = datetime.strptime(end_date, date_format)
        if start > end:
            return False, "开始日期不能晚于结束日期"
        return True, None
    except ValueError as e:
        return False, f"日期格式错误: {e}"


def validate_numeric_value(value: Any, min_val: Optional[float] = None, max_val: Optional[float] = None) -> Tuple[bool, Optional[str]]:
    if not isinstance(value, (int, float)):
        return False, "值必须是数值类型"
    
    if min_val is not None and value < min_val:
        return False, f"值不能小于 {min_val}"
    
    if max_val is not None and value > max_val:
        return False, f"值不能大于 {max_val}"
    
    return True, None


def validate_algorithm_name(algorithm: str) -> bool:
    valid_algorithms = {'random_forest', 'gradient_boosting', 'xgboost', 'lstm'}
    return algorithm in valid_algorithms


def validate_output_format(fmt: str) -> bool:
    valid_formats = {'csv', 'excel', 'json', 'html'}
    return fmt.lower() in valid_formats


def validate_power_data(series: pd.Series) -> Tuple[bool, List[str]]:
    errors = []
    
    if series is None or series.empty:
        return False, ["功率数据为空"]
    
    if (series < 0).any():
        negative_count = (series < 0).sum()
        errors.append(f"存在 {negative_count} 个负功率值")
    
    if series.isnull().any():
        null_count = series.isnull().sum()
        errors.append(f"存在 {null_count} 个缺失值")
    
    if series.std() == 0 and len(series) > 1:
        errors.append("所有功率值相同，可能数据异常")
    
    return len(errors) == 0, errors
