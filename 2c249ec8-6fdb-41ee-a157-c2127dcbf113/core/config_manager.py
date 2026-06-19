import os
import copy
from typing import Dict, Any, Optional, List

import yaml

from utils.validators import validate_config


class ConfigManager:
    _instance = None
    _config = None
    _config_path = None
    _last_modified = None

    def __new__(cls, config_path: Optional[str] = None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, config_path: Optional[str] = None):
        if self._initialized:
            return
        self._initialized = True
        self._config_path = config_path or self._get_default_config_path()
        self.load_config()

    def _get_default_config_path(self) -> str:
        current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(current_dir, 'config', 'config.yaml')

    def load_config(self) -> Dict[str, Any]:
        if not os.path.exists(self._config_path):
            self._config = self._get_default_config()
            self._last_modified = 0
            return self._config

        self._last_modified = os.path.getmtime(self._config_path)
        with open(self._config_path, 'r', encoding='utf-8') as f:
            self._config = yaml.safe_load(f)

        if not self._config:
            self._config = self._get_default_config()

        return self._config

    def reload_if_changed(self) -> bool:
        if not os.path.exists(self._config_path):
            return False

        current_mtime = os.path.getmtime(self._config_path)
        if current_mtime != self._last_modified:
            self.load_config()
            return True
        return False

    def get_config(self, section: Optional[str] = None) -> Any:
        if self._config is None:
            self.load_config()

        if section is None:
            return copy.deepcopy(self._config)

        keys = section.split('.')
        value = self._config
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return None
        return copy.deepcopy(value)

    def set_config(self, key: str, value: Any) -> bool:
        if self._config is None:
            self.load_config()

        keys = key.split('.')
        config_ref = self._config
        for i, k in enumerate(keys[:-1]):
            if k not in config_ref:
                config_ref[k] = {}
            config_ref = config_ref[k]

        config_ref[keys[-1]] = value
        return True

    def save_config(self, output_path: Optional[str] = None) -> bool:
        save_path = output_path or self._config_path
        try:
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            with open(save_path, 'w', encoding='utf-8') as f:
                yaml.dump(self._config, f, default_flow_style=False, allow_unicode=True)
            self._last_modified = os.path.getmtime(save_path)
            return True
        except Exception:
            return False

    def validate(self) -> tuple[bool, List[str]]:
        if self._config is None:
            self.load_config()
        return validate_config(self._config)

    def _get_default_config(self) -> Dict[str, Any]:
        return {
            'model': {
                'default_algorithm': 'random_forest',
                'algorithms': {
                    'random_forest': {
                        'n_estimators': 100,
                        'max_depth': 20,
                        'min_samples_split': 2,
                        'min_samples_leaf': 1,
                        'random_state': 42
                    },
                    'gradient_boosting': {
                        'n_estimators': 100,
                        'learning_rate': 0.1,
                        'max_depth': 5,
                        'random_state': 42
                    },
                    'lstm': {
                        'hidden_size': 50,
                        'num_layers': 2,
                        'learning_rate': 0.001,
                        'epochs': 200,
                        'sequence_length': 24,
                        'random_state': 42
                    }
                },
                'hyperparameter_tuning': {
                    'enabled': False,
                    'cv_folds': 5,
                    'param_grid': {
                        'random_forest': {
                            'n_estimators': [50, 100, 200],
                            'max_depth': [10, 20, 30]
                        }
                    }
                }
            },
            'paths': {
                'data_dir': './data',
                'model_dir': './models',
                'output_dir': './output',
                'config_file': './config/config.yaml'
            },
            'prediction': {
                'horizon_hours': 24,
                'confidence_level': 0.9,
                'time_step': 1,
                'sliding_window_size': 168
            },
            'data': {
                'timestamp_column': 'timestamp',
                'power_column': 'power',
                'weather_columns': [
                    'temperature',
                    'humidity',
                    'wind_speed',
                    'solar_radiation',
                    'pressure'
                ],
                'missing_value_strategy': 'interpolate',
                'outlier_threshold': 3.0,
                'resample_freq': '1h',
                'min_data_points': 100
            },
            'evaluation': {
                'metrics': ['mae', 'rmse', 'mape', 'nrmse'],
                'sliding_window_evaluation': False,
                'window_size': 168,
                'baseline_comparison': False
            },
            'output': {
                'format': 'csv',
                'decimal_places': 2,
                'include_confidence_interval': True,
                'generate_charts': True,
                'chart_format': 'html'
            },
            'thresholds': {
                'max_prediction_error': 0.2,
                'data_quality_min_score': 0.8,
                'model_performance_min_score': 0.7
            },
            'logging': {
                'level': 'INFO',
                'verbose': False,
                'quiet': False,
                'progress_bar': True
            }
        }

    def get_model_params(self, algorithm: Optional[str] = None) -> Dict[str, Any]:
        if algorithm is None:
            algorithm = self.get_config('model.default_algorithm')

        return self.get_config(f'model.algorithms.{algorithm}') or {}

    def get_data_path(self, filename: str = '') -> str:
        data_dir = self.get_config('paths.data_dir')
        return os.path.join(data_dir, filename)

    def get_model_path(self, filename: str = '') -> str:
        model_dir = self.get_config('paths.model_dir')
        return os.path.join(model_dir, filename)

    def get_output_path(self, filename: str = '') -> str:
        output_dir = self.get_config('paths.output_dir')
        return os.path.join(output_dir, filename)
