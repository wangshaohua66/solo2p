import os
import time
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from .trainer import ModelTrainer
from .importer import DataImporter


class PowerPredictor:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.pred_config = self.config.get('prediction', {})
        self.data_config = self.config.get('data', {})
        self.models: Dict[str, Any] = {}
        self.model_trainer = ModelTrainer(self.config)
        self.importer = DataImporter(self.config)

    def load_model(self, station_id: str, model_path: str) -> bool:
        success = self.model_trainer.load_model(model_path)
        if success:
            self.models[station_id] = self.model_trainer.model
        return success

    def load_models_from_dir(self, model_dir: str) -> Dict[str, bool]:
        results = {}
        if not os.path.isdir(model_dir):
            return results

        for filename in os.listdir(model_dir):
            if filename.endswith('.pkl') or filename.endswith('.model'):
                station_id = os.path.splitext(filename)[0]
                filepath = os.path.join(model_dir, filename)
                success = self.load_model(station_id, filepath)
                results[station_id] = success

        return results

    def predict_single(self, station_id: str, features: pd.DataFrame,
                       include_confidence: bool = True) -> Dict[str, Any]:
        if station_id not in self.models:
            raise ValueError(f"未找到电站 {station_id} 的模型")

        model = self.models[station_id]

        start_time = time.time()
        predictions = model.predict(features)
        elapsed = time.time() - start_time

        result = {
            'station_id': station_id,
            'predictions': predictions.tolist(),
            'prediction_time': elapsed,
            'n_samples': len(features),
        }

        if include_confidence:
            lower_bound, upper_bound = self._calculate_confidence_interval(model, features)
            result['lower_bound'] = lower_bound.tolist()
            result['upper_bound'] = upper_bound.tolist()
            result['confidence_level'] = self.pred_config.get('confidence_level', 0.9)

        return result

    def predict_single_station(self, station_id: str, input_data: pd.DataFrame,
                               horizon_hours: Optional[int] = None,
                               include_confidence: bool = True) -> Dict[str, Any]:
        if horizon_hours is None:
            horizon_hours = self.pred_config.get('horizon_hours', 24)

        if station_id not in self.models:
            raise ValueError(f"未找到电站 {station_id} 的模型")

        model = self.models[station_id]

        if 'timestamp' in input_data.columns:
            input_data = input_data.set_index('timestamp')

        last_time = input_data.index[-1]
        future_times = pd.date_range(start=last_time + timedelta(hours=1),
                                     periods=horizon_hours, freq='h')

        future_features = self._generate_future_features(input_data, future_times)

        start_time = time.time()
        predictions = model.predict(future_features)
        elapsed = time.time() - start_time

        prediction_list = []
        for i, ts in enumerate(future_times):
            pred_item = {
                'timestamp': ts.strftime('%Y-%m-%d %H:%M:%S'),
                'power': float(predictions[i]),
            }
            prediction_list.append(pred_item)

        result = {
            'station_id': station_id,
            'predictions': prediction_list,
            'horizon_hours': horizon_hours,
            'prediction_time': elapsed,
            'model_algorithm': self._get_model_algorithm(station_id),
        }

        if include_confidence:
            lower_bound, upper_bound = self._calculate_confidence_interval(model, future_features)
            for i, pred_item in enumerate(prediction_list):
                pred_item['lower_bound'] = float(lower_bound[i])
                pred_item['upper_bound'] = float(upper_bound[i])
            result['confidence_level'] = self.pred_config.get('confidence_level', 0.9)

        return result

    def predict_batch(self, stations_data: Dict[str, pd.DataFrame],
                      horizon_hours: Optional[int] = None,
                      include_confidence: bool = True) -> Dict[str, Any]:
        if horizon_hours is None:
            horizon_hours = self.pred_config.get('horizon_hours', 24)

        start_time = time.time()
        results = {}

        for station_id, data in stations_data.items():
            try:
                result = self.predict_single_station(
                    station_id, data, horizon_hours, include_confidence
                )
                results[station_id] = result
            except Exception as e:
                results[station_id] = {'error': str(e)}

        total_time = time.time() - start_time

        return {
            'results': results,
            'total_stations': len(stations_data),
            'successful_stations': sum(1 for r in results.values() if 'error' not in r),
            'total_time': total_time,
        }

    def _generate_future_features(self, historical_data: pd.DataFrame,
                                  future_times: pd.DatetimeIndex) -> pd.DataFrame:
        weather_cols = [col for col in historical_data.columns 
                        if col in self.importer.WEATHER_CANDIDATES.keys()]

        future_data = pd.DataFrame(index=future_times)

        if weather_cols:
            for col in weather_cols:
                if col in historical_data.columns:
                    historical_series = historical_data[col]
                    daily_pattern = historical_series.groupby(historical_series.index.hour).mean()
                    future_data[col] = [daily_pattern.get(t.hour, historical_series.mean()) 
                                        for t in future_times]
                else:
                    future_data[col] = historical_data[col].mean() if col in historical_data.columns else 0

        combined_index = historical_data.index.append(future_times)
        combined_df = pd.DataFrame(index=combined_index)

        for col in weather_cols:
            if col in historical_data.columns:
                combined_df[col] = historical_data[col].reindex(combined_index)
                combined_df.loc[future_times, col] = future_data[col].values

        combined_df['hour_sin'] = np.sin(2 * np.pi * combined_index.hour / 24)
        combined_df['hour_cos'] = np.cos(2 * np.pi * combined_index.hour / 24)
        combined_df['dayofyear_sin'] = np.sin(2 * np.pi * combined_index.dayofyear / 365)
        combined_df['dayofyear_cos'] = np.cos(2 * np.pi * combined_index.dayofyear / 365)
        combined_df['month_sin'] = np.sin(2 * np.pi * combined_index.month / 12)
        combined_df['month_cos'] = np.cos(2 * np.pi * combined_index.month / 12)
        combined_df['dayofweek_sin'] = np.sin(2 * np.pi * combined_index.dayofweek / 7)
        combined_df['dayofweek_cos'] = np.cos(2 * np.pi * combined_index.dayofweek / 7)

        feature_cols = weather_cols + [
            'hour_sin', 'hour_cos', 'dayofyear_sin', 'dayofyear_cos',
            'month_sin', 'month_cos', 'dayofweek_sin', 'dayofweek_cos'
        ]

        future_features = combined_df.loc[future_times, feature_cols]

        return future_features

    def _calculate_confidence_interval(self, model, features: pd.DataFrame,
                                       confidence_level: Optional[float] = None) -> Tuple[np.ndarray, np.ndarray]:
        if confidence_level is None:
            confidence_level = self.pred_config.get('confidence_level', 0.9)

        point_predictions = model.predict(features)

        if hasattr(model, 'estimators_'):
            all_predictions = []
            for estimator in model.estimators_:
                pred = estimator.predict(features)
                all_predictions.append(pred)

            all_predictions = np.array(all_predictions)

            alpha = 1 - confidence_level
            lower_percentile = alpha / 2 * 100
            upper_percentile = (1 - alpha / 2) * 100

            lower_bound = np.percentile(all_predictions, lower_percentile, axis=0)
            upper_bound = np.percentile(all_predictions, upper_percentile, axis=0)

            return lower_bound, upper_bound
        else:
            residual_std = np.std(point_predictions) * 0.1
            z_score = 1.645 if confidence_level == 0.9 else 1.96
            lower_bound = point_predictions - z_score * residual_std
            upper_bound = point_predictions + z_score * residual_std

            return lower_bound, upper_bound

    def _get_model_algorithm(self, station_id: str) -> str:
        model = self.models.get(station_id)
        if model is None:
            return 'unknown'

        model_name = type(model).__name__
        name_map = {
            'RandomForestRegressor': 'random_forest',
            'GradientBoostingRegressor': 'gradient_boosting',
            'LSTMRegressor': 'lstm',
        }
        return name_map.get(model_name, model_name)

    def train_and_predict(self, station_id: str, training_data: pd.DataFrame,
                          horizon_hours: Optional[int] = None,
                          algorithm: Optional[str] = None,
                          include_confidence: bool = True) -> Dict[str, Any]:
        X, y = self.importer.prepare_features(training_data)

        trainer = ModelTrainer(self.config)
        trainer.train(X, y, algorithm)

        self.models[station_id] = trainer.model

        return self.predict_single_station(station_id, training_data, horizon_hours, include_confidence)

    def rolling_predict(self, station_id: str, historical_data: pd.DataFrame,
                        window_size: Optional[int] = None,
                        horizon_hours: Optional[int] = None) -> Dict[str, Any]:
        if window_size is None:
            window_size = self.pred_config.get('sliding_window_size', 168)

        if horizon_hours is None:
            horizon_hours = self.pred_config.get('horizon_hours', 24)

        if station_id not in self.models:
            raise ValueError(f"未找到电站 {station_id} 的模型")

        model = self.models[station_id]

        all_predictions = []
        all_actuals = []
        all_timestamps = []

        data = historical_data.copy()
        if 'timestamp' in data.columns:
            data = data.set_index('timestamp')

        total_windows = max(0, len(data) - window_size - horizon_hours + 1)

        if total_windows <= 0:
            return {
                'station_id': station_id,
                'window_size': window_size,
                'horizon_hours': horizon_hours,
                'predictions': [],
                'actuals': [],
                'error': '数据不足以进行滚动预测',
            }

        for i in range(total_windows):
            train_end = window_size + i
            predict_start = train_end
            predict_end = predict_start + horizon_hours

            if predict_end > len(data):
                break

            window_data = data.iloc[i:train_end]
            actual_future = data.iloc[predict_start:predict_end]

            future_times = actual_future.index
            future_features = self._generate_future_features(window_data, future_times)
            predictions = model.predict(future_features)

            all_predictions.extend(predictions.tolist())
            all_actuals.extend(actual_future['power'].tolist())
            all_timestamps.extend([t.strftime('%Y-%m-%d %H:%M:%S') for t in future_times])

        return {
            'station_id': station_id,
            'window_size': window_size,
            'horizon_hours': horizon_hours,
            'n_predictions': len(all_predictions),
            'predictions': all_predictions,
            'actuals': all_actuals,
            'timestamps': all_timestamps,
        }
