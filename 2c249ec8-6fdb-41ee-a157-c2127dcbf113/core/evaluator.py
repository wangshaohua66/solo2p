import os
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


class ModelEvaluator:
    SUPPORTED_METRICS = ['mae', 'rmse', 'mape', 'nrmse', 'r2']

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.eval_config = self.config.get('evaluation', {})

    def calculate_metrics(self, y_true: np.ndarray, y_pred: np.ndarray,
                           metrics: Optional[List[str]] = None) -> Dict[str, float]:
        y_true = np.asarray(y_true, dtype=float)
        y_pred = np.asarray(y_pred, dtype=float)

        if len(y_true) != len(y_pred):
            raise ValueError("真实值和预测值长度不一致")

        if len(y_true) == 0:
            return {}

        if metrics is None:
            metrics = self.eval_config.get('metrics', ['mae', 'rmse', 'mape', 'nrmse'])

        results = {}

        for metric in metrics:
            metric_lower = metric.lower()
            if metric_lower == 'mae':
                results['mae'] = self._calculate_mae(y_true, y_pred)
            elif metric_lower == 'rmse':
                results['rmse'] = self._calculate_rmse(y_true, y_pred)
            elif metric_lower == 'mape':
                results['mape'] = self._calculate_mape(y_true, y_pred)
            elif metric_lower == 'nrmse':
                results['nrmse'] = self._calculate_nrmse(y_true, y_pred)
            elif metric_lower == 'r2':
                results['r2'] = self._calculate_r2(y_true, y_pred)

        return results

    def _calculate_mae(self, y_true: np.ndarray, y_pred: np.ndarray) -> float:
        return float(mean_absolute_error(y_true, y_pred))

    def _calculate_rmse(self, y_true: np.ndarray, y_pred: np.ndarray) -> float:
        return float(np.sqrt(mean_squared_error(y_true, y_pred)))

    def _calculate_mape(self, y_true: np.ndarray, y_pred: np.ndarray) -> float:
        mask = y_true != 0
        if np.sum(mask) == 0:
            return float('inf')
        mape = np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100
        return float(mape)

    def _calculate_nrmse(self, y_true: np.ndarray, y_pred: np.ndarray) -> float:
        rmse = self._calculate_rmse(y_true, y_pred)
        y_range = np.max(y_true) - np.min(y_true)
        if y_range == 0:
            return float('inf')
        return float(rmse / y_range * 100)

    def _calculate_r2(self, y_true: np.ndarray, y_pred: np.ndarray) -> float:
        return float(r2_score(y_true, y_pred))

    def evaluate_predictions(self, predictions: List[Dict[str, Any]],
                             actuals: Optional[np.ndarray] = None) -> Dict[str, Any]:
        pred_values = np.array([p.get('power', 0) for p in predictions])

        if actuals is None:
            actuals = np.array([p.get('actual', 0) for p in predictions])

        metrics = self.calculate_metrics(actuals, pred_values)

        result = {
            'metrics': metrics,
            'n_samples': len(predictions),
            'timestamp': datetime.now().isoformat(),
        }

        errors = np.abs(actuals - pred_values)
        error_stats = {
            'min_error': float(np.min(errors)),
            'max_error': float(np.max(errors)),
            'mean_error': float(np.mean(errors)),
            'std_error': float(np.std(errors)),
        }
        result['error_statistics'] = error_stats

        return result

    def sliding_window_evaluation(self, actuals: np.ndarray, predictions: np.ndarray,
                                   window_size: Optional[int] = None) -> Dict[str, Any]:
        if window_size is None:
            window_size = self.eval_config.get('window_size', 168)

        actuals = np.asarray(actuals)
        predictions = np.asarray(predictions)

        if len(actuals) != len(predictions):
            raise ValueError("真实值和预测值长度不一致")

        if len(actuals) < window_size:
            return {
                'window_size': window_size,
                'error': '数据量不足，无法进行滑动窗口评估',
            }

        window_metrics = []
        n_windows = len(actuals) - window_size + 1

        for i in range(n_windows):
            window_actual = actuals[i:i + window_size]
            window_pred = predictions[i:i + window_size]
            metrics = self.calculate_metrics(window_actual, window_pred)
            metrics['window_start'] = i
            metrics['window_end'] = i + window_size
            window_metrics.append(metrics)

        df_metrics = pd.DataFrame(window_metrics)

        result = {
            'window_size': window_size,
            'n_windows': n_windows,
            'window_metrics': window_metrics,
            'trend': {
                'mae_trend': 'increasing' if df_metrics['mae'].is_monotonic_increasing else 
                             'decreasing' if df_metrics['mae'].is_monotonic_decreasing else 'stable',
                'mae_start': float(df_metrics['mae'].iloc[0]),
                'mae_end': float(df_metrics['mae'].iloc[-1]),
                'mae_change_pct': float((df_metrics['mae'].iloc[-1] - df_metrics['mae'].iloc[0]) / 
                                          df_metrics['mae'].iloc[0] * 100) if df_metrics['mae'].iloc[0] != 0 else 0,
            }
        }

        return result

    def compare_models(self, results: Dict[str, Dict[str, float]], 
                       sort_by: str = 'rmse') -> List[Dict[str, Any]]:
        comparison = []
        for model_name, metrics in results.items():
            item = {'model': model_name}
            item.update(metrics)
            comparison.append(item)

        if sort_by in comparison[0]:
            comparison.sort(key=lambda x: x.get(sort_by, float('inf')))

        return comparison

    def generate_comparison_report(self, results: Dict[str, Dict[str, float]],
                                     output_path: Optional[str] = None) -> Dict[str, Any]:
        comparison = self.compare_models(results)

        best_model = comparison[0] if comparison else None
        worst_model = comparison[-1] if comparison else None

        report = {
            'comparison': comparison,
            'best_model': best_model['model'] if best_model else None,
            'worst_model': worst_model['model'] if worst_model else None,
            'n_models': len(results),
            'generated_at': datetime.now().isoformat(),
        }

        if output_path:
            df = pd.DataFrame(comparison)
            os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
            df.to_csv(output_path, index=False, encoding='utf-8-sig')
            report['output_file'] = output_path

        return report

    def calculate_horizon_evaluation(self, actuals: np.ndarray, predictions: np.ndarray,
                                     horizons: List[int]) -> Dict[str, Dict[str, float]]:
        actuals = np.asarray(actuals)
        predictions = np.asarray(predictions)

        horizon_metrics = {}
        for h in horizons:
            if h <= len(predictions):
                h_actual = actuals[:h]
                h_pred = predictions[:h]
                metrics = self.calculate_metrics(h_actual, h_pred)
                horizon_metrics[f'{h}h'] = metrics

        return horizon_metrics

    def error_distribution(self, y_true: np.ndarray, y_pred: np.ndarray,
                             bins: int = 10) -> Dict[str, Any]:
        y_true = np.asarray(y_true)
        y_pred = np.asarray(y_pred)

        errors = y_true - y_pred
        abs_errors = np.abs(errors)

        hist, bin_edges = np.histogram(abs_errors, bins=bins)

        distribution = []
        for i in range(len(hist)):
            distribution.append({
                'bin_start': float(bin_edges[i]),
                'bin_end': float(bin_edges[i + 1]),
                'count': int(hist[i]),
                'percentage': float(hist[i] / len(abs_errors) * 100),
            })

        percentiles = [10, 25, 50, 75, 90, 95, 99]
        percentile_values = {}
        for p in percentiles:
            percentile_values[f'p{p}'] = float(np.percentile(abs_errors, p))

        result = {
            'distribution': distribution,
            'percentiles': percentile_values,
            'mean_error': float(np.mean(errors)),
            'mean_abs_error': float(np.mean(abs_errors)),
            'std_error': float(np.std(errors)),
        }

        return result

    def evaluate_by_station(self, station_results: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        all_metrics = {}
        all_mae_list = []
        all_rmse_list = []
        all_mape_list = []

        for station_id, result in station_results.items():
            metrics = result.get('metrics', {})
            all_metrics[station_id] = metrics

            if 'mae' in metrics:
                all_mae_list.append(metrics['mae'])
            if 'rmse' in metrics:
                all_rmse_list.append(metrics['rmse'])
            if 'mape' in metrics:
                all_mape_list.append(metrics['mape'])

        summary = {
            'total_stations': len(station_results),
            'station_metrics': all_metrics,
            'overall': {
                'avg_mae': float(np.mean(all_mae_list)) if all_mae_list else 0,
                'avg_rmse': float(np.mean(all_rmse_list)) if all_rmse_list else 0,
                'avg_mape': float(np.mean(all_mape_list)) if all_mape_list else 0,
                'max_mae': float(np.max(all_mae_list)) if all_mae_list else 0,
                'min_mae': float(np.min(all_mae_list)) if all_mape_list else 0,
            }
        }

        return summary
