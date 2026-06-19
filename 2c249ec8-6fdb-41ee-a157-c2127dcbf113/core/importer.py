import os
import json
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime

import pandas as pd
import numpy as np

from utils.validators import validate_file_path


class DataImporter:
    SUPPORTED_FORMATS = ['csv', 'excel', 'json']

    TIMESTAMP_CANDIDATES = ['timestamp', 'time', 'date', 'datetime', '时间', '日期', '时间戳']
    POWER_CANDIDATES = ['power', 'output', 'generation', '功率', '出力', '发电功率']
    WEATHER_CANDIDATES = {
        'temperature': ['temperature', 'temp', '气温', '温度'],
        'humidity': ['humidity', 'hum', '湿度'],
        'wind_speed': ['wind_speed', 'wind', 'windspeed', '风速', '风力'],
        'solar_radiation': ['solar_radiation', 'radiation', 'irradiance', '辐射', '辐照度', '太阳辐射'],
        'pressure': ['pressure', '气压', '压强'],
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.data_config = self.config.get('data', {})
        self.quality_report = {}

    def import_data(self, file_path: str, file_format: Optional[str] = None) -> pd.DataFrame:
        valid, error_msg = validate_file_path(file_path, must_exist=True)
        if not valid:
            raise ValueError(error_msg)

        if file_format is None:
            file_format = self._detect_format(file_path)

        if file_format not in self.SUPPORTED_FORMATS:
            raise ValueError(f"不支持的文件格式: {file_format}")

        df = self._read_file(file_path, file_format)
        df = self._auto_identify_columns(df)
        df = self._clean_data(df)

        self._generate_quality_report(df)

        return df

    def _detect_format(self, file_path: str) -> str:
        ext = os.path.splitext(file_path)[1].lower()
        format_map = {
            '.csv': 'csv',
            '.xlsx': 'excel',
            '.xls': 'excel',
            '.json': 'json',
        }
        fmt = format_map.get(ext)
        if not fmt:
            raise ValueError(f"无法识别的文件格式: {ext}")
        return fmt

    def _read_file(self, file_path: str, file_format: str) -> pd.DataFrame:
        if file_format == 'csv':
            return pd.read_csv(file_path, encoding='utf-8-sig')
        elif file_format == 'excel':
            return pd.read_excel(file_path, engine='openpyxl')
        elif file_format == 'json':
            return pd.read_json(file_path, encoding='utf-8')
        else:
            raise ValueError(f"不支持的格式: {file_format}")

    def _auto_identify_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        column_mapping = {}
        lower_columns = {col.lower(): col for col in df.columns}

        timestamp_col = self.data_config.get('timestamp_column', 'timestamp')
        if timestamp_col in df.columns:
            column_mapping['timestamp'] = timestamp_col
        else:
            for candidate in self.TIMESTAMP_CANDIDATES:
                if candidate.lower() in lower_columns:
                    column_mapping['timestamp'] = lower_columns[candidate.lower()]
                    break

        power_col = self.data_config.get('power_column', 'power')
        if power_col in df.columns:
            column_mapping['power'] = power_col
        else:
            for candidate in self.POWER_CANDIDATES:
                if candidate.lower() in lower_columns:
                    column_mapping['power'] = lower_columns[candidate.lower()]
                    break

        weather_columns_config = self.data_config.get('weather_columns', [])
        weather_cols = []
        for std_name, candidates in self.WEATHER_CANDIDATES.items():
            if std_name in weather_columns_config and std_name in df.columns:
                weather_cols.append(std_name)
                continue
            for candidate in candidates:
                if candidate.lower() in lower_columns:
                    original_col = lower_columns[candidate.lower()]
                    column_mapping[std_name] = original_col
                    weather_cols.append(std_name)
                    break

        rename_dict = {v: k for k, v in column_mapping.items()}
        df = df.rename(columns=rename_dict)

        return df

    def _clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
            df = df.dropna(subset=['timestamp'])
            df = df.sort_values('timestamp')
            df = df.set_index('timestamp')

            resample_freq = self.data_config.get('resample_freq', '1h')
            if resample_freq:
                df = df.resample(resample_freq).mean()

            df = df.reset_index()

        if 'power' in df.columns:
            df['power'] = pd.to_numeric(df['power'], errors='coerce')
            df = self._handle_missing_values(df, 'power')
            df = self._detect_and_handle_outliers(df, 'power')

        for col in df.columns:
            if col != 'timestamp' and df[col].dtype == 'object':
                df[col] = pd.to_numeric(df[col], errors='coerce')

        return df

    def _handle_missing_values(self, df: pd.DataFrame, column: str) -> pd.DataFrame:
        strategy = self.data_config.get('missing_value_strategy', 'interpolate')

        if strategy == 'interpolate':
            has_time_index = isinstance(df.index, pd.DatetimeIndex)
            has_time_col = 'timestamp' in df.columns and pd.api.types.is_datetime64_any_dtype(df['timestamp'])

            if has_time_index:
                df[column] = df[column].interpolate(method='time')
            elif has_time_col:
                temp_df = df.set_index('timestamp')
                temp_df[column] = temp_df[column].interpolate(method='time')
                df[column] = temp_df[column].values
            else:
                df[column] = df[column].interpolate(method='linear')

            df[column] = df[column].ffill().bfill()
        elif strategy == 'mean':
            df[column] = df[column].fillna(df[column].mean())
        elif strategy == 'median':
            df[column] = df[column].fillna(df[column].median())
        elif strategy == 'drop':
            df = df.dropna(subset=[column])
        elif strategy == 'zero':
            df[column] = df[column].fillna(0)

        return df

    def _detect_and_handle_outliers(self, df: pd.DataFrame, column: str) -> pd.DataFrame:
        threshold = self.data_config.get('outlier_threshold', 3.0)
        if threshold <= 0:
            return df

        values = df[column].dropna()
        if len(values) == 0:
            return df

        q1 = values.quantile(0.25)
        q3 = values.quantile(0.75)
        iqr = q3 - q1
        lower_bound = q1 - threshold * iqr
        upper_bound = q3 + threshold * iqr

        outlier_mask = (df[column] < lower_bound) | (df[column] > upper_bound)
        outlier_count = outlier_mask.sum()

        if outlier_count > 0:
            df.loc[outlier_mask, column] = np.nan
            df = self._handle_missing_values(df, column)

        self.quality_report['outliers'] = int(outlier_count)
        self.quality_report['outlier_lower_bound'] = float(lower_bound)
        self.quality_report['outlier_upper_bound'] = float(upper_bound)

        return df

    def _generate_quality_report(self, df: pd.DataFrame) -> Dict[str, Any]:
        report = {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'columns': list(df.columns),
            'missing_values': int(df.isnull().sum().sum()),
            'missing_per_column': df.isnull().sum().to_dict(),
            'outliers': self.quality_report.get('outliers', 0),
            'data_types': df.dtypes.astype(str).to_dict(),
        }

        if 'timestamp' in df.columns and len(df) > 0:
            report['time_range'] = f"{df['timestamp'].min()} ~ {df['timestamp'].max()}"
            report['time_span_hours'] = float((df['timestamp'].max() - df['timestamp'].min()).total_seconds() / 3600)

        if 'power' in df.columns:
            power_data = df['power'].dropna()
            if len(power_data) > 0:
                report['power_stats'] = {
                    'mean': float(power_data.mean()),
                    'std': float(power_data.std()),
                    'min': float(power_data.min()),
                    'max': float(power_data.max()),
                    'median': float(power_data.median()),
                }

        total_cells = len(df) * len(df.columns)
        missing_total = df.isnull().sum().sum()
        quality_score = 1.0 - (missing_total / total_cells if total_cells > 0 else 0)

        outlier_count = self.quality_report.get('outliers', 0)
        if len(df) > 0:
            quality_score -= 0.1 * (outlier_count / len(df))

        report['quality_score'] = max(0.0, min(1.0, float(quality_score)))

        self.quality_report = report
        return report

    def get_quality_report(self) -> Dict[str, Any]:
        return self.quality_report

    def import_multiple(self, file_paths: List[str]) -> Dict[str, pd.DataFrame]:
        results = {}
        for file_path in file_paths:
            try:
                station_id = self._extract_station_id(file_path)
                df = self.import_data(file_path)
                results[station_id] = df
            except Exception as e:
                results[file_path] = pd.DataFrame()
        return results

    def _extract_station_id(self, file_path: str) -> str:
        basename = os.path.basename(file_path)
        name_without_ext = os.path.splitext(basename)[0]
        return name_without_ext

    def prepare_features(self, df: pd.DataFrame, target_col: str = 'power', 
                         include_weather: bool = True) -> Tuple[pd.DataFrame, pd.Series]:
        df = df.copy()

        if 'timestamp' in df.columns:
            df = df.set_index('timestamp')

        if target_col not in df.columns:
            raise ValueError(f"目标列 {target_col} 不存在")

        feature_cols = []

        if include_weather:
            weather_cols = [col for col in df.columns if col in self.WEATHER_CANDIDATES.keys()]
            feature_cols.extend(weather_cols)

        if df.index.name == 'timestamp' or 'timestamp' in df.columns:
            idx = df.index if df.index.name == 'timestamp' else pd.DatetimeIndex(df['timestamp'])
            hour = idx.hour
            dayofyear = idx.dayofyear
            month = idx.month
            dayofweek = idx.dayofweek

            df['hour_sin'] = np.sin(2 * np.pi * hour / 24)
            df['hour_cos'] = np.cos(2 * np.pi * hour / 24)
            df['dayofyear_sin'] = np.sin(2 * np.pi * dayofyear / 365)
            df['dayofyear_cos'] = np.cos(2 * np.pi * dayofyear / 365)
            df['month_sin'] = np.sin(2 * np.pi * month / 12)
            df['month_cos'] = np.cos(2 * np.pi * month / 12)
            df['dayofweek_sin'] = np.sin(2 * np.pi * dayofweek / 7)
            df['dayofweek_cos'] = np.cos(2 * np.pi * dayofweek / 7)

            feature_cols.extend(['hour_sin', 'hour_cos', 'dayofyear_sin', 'dayofyear_cos',
                                'month_sin', 'month_cos', 'dayofweek_sin', 'dayofweek_cos'])

        if not feature_cols:
            raise ValueError("没有可用的特征列")

        X = df[feature_cols].copy()
        y = df[target_col].copy()

        valid_mask = ~X.isnull().any(axis=1) & ~y.isnull()
        X = X[valid_mask]
        y = y[valid_mask]

        return X, y
