import os
import pickle
import time
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import cross_val_score, GridSearchCV, train_test_split, KFold
from sklearn.metrics import mean_absolute_error, mean_squared_error

try:
    from xgboost import XGBRegressor
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False


class ModelTrainer:
    SUPPORTED_ALGORITHMS = ['random_forest', 'gradient_boosting', 'xgboost']

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.model_config = self.config.get('model', {})
        self.model = None
        self.model_name = None
        self.best_params = None
        self.cv_results = None
        self.training_info = {}

    def create_model(self, algorithm: Optional[str] = None, params: Optional[Dict[str, Any]] = None) -> Any:
        if algorithm is None:
            algorithm = self.model_config.get('default_algorithm', 'random_forest')

        self.model_name = algorithm

        if params is None:
            params = self._get_algorithm_params(algorithm)

        if algorithm == 'random_forest':
            self.model = RandomForestRegressor(**params)
        elif algorithm == 'gradient_boosting':
            self.model = GradientBoostingRegressor(**params)
        elif algorithm == 'xgboost':
            if not XGB_AVAILABLE:
                raise ImportError("XGBoost 未安装，请安装 xgboost 包")
            self.model = XGBRegressor(**params)
        else:
            raise ValueError(f"不支持的算法: {algorithm}")

        return self.model

    def _get_algorithm_params(self, algorithm: str) -> Dict[str, Any]:
        algorithms_cfg = self.model_config.get('algorithms', {})
        return algorithms_cfg.get(algorithm, {})

    def train(self, X: pd.DataFrame, y: pd.Series, algorithm: Optional[str] = None) -> Dict[str, Any]:
        start_time = time.time()

        self.create_model(algorithm)

        self.model.fit(X, y)

        train_pred = self.model.predict(X)
        train_mae = mean_absolute_error(y, train_pred)
        train_rmse = np.sqrt(mean_squared_error(y, train_pred))

        elapsed = time.time() - start_time

        self.training_info = {
            'algorithm': self.model_name,
            'n_samples': len(X),
            'n_features': X.shape[1],
            'training_time': elapsed,
            'train_mae': train_mae,
            'train_rmse': train_rmse,
            'timestamp': datetime.now().isoformat(),
        }

        return self.training_info

    def cross_validate(self, X: pd.DataFrame, y: pd.Series, 
                       cv_folds: Optional[int] = None,
                       algorithm: Optional[str] = None) -> Dict[str, Any]:
        if cv_folds is None:
            cv_folds = self.model_config.get('hyperparameter_tuning', {}).get('cv_folds', 5)

        use_existing_model = (
            self.model is not None 
            and (algorithm is None or algorithm == self.model_name)
        )

        if use_existing_model:
            cv_model = self._clone_model()
        else:
            cv_model = self.create_model(algorithm)

        cv = KFold(n_splits=cv_folds, shuffle=True, random_state=42)

        mae_scores = -cross_val_score(cv_model, X, y, cv=cv, scoring='neg_mean_absolute_error')
        rmse_scores = np.sqrt(-cross_val_score(cv_model, X, y, cv=cv, scoring='neg_mean_squared_error'))

        mape_scores = []
        try:
            for train_idx, val_idx in cv.split(X):
                X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
                y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]
                model = self._clone_model() if use_existing_model else self.create_model(algorithm)
                model.fit(X_train, y_train)
                y_pred = model.predict(X_val)
                mape = np.mean(np.abs((y_val - y_pred) / y_val)) * 100
                mape_scores.append(mape)
            mape_scores = np.array(mape_scores)
        except Exception:
            mape_scores = np.array([])

        results = {
            'cv_folds': cv_folds,
            'mae_mean': float(mae_scores.mean()),
            'mae_std': float(mae_scores.std()),
            'rmse_mean': float(rmse_scores.mean()),
            'rmse_std': float(rmse_scores.std()),
            'mape_mean': float(mape_scores.mean()) if len(mape_scores) > 0 else None,
            'mape_std': float(mape_scores.std()) if len(mape_scores) > 0 else None,
            'algorithm': self.model_name,
        }

        self.cv_results = results
        return results

    def hyperparameter_tuning(self, X: pd.DataFrame, y: pd.Series,
                              algorithm: Optional[str] = None,
                              param_grid: Optional[Dict[str, List]] = None,
                              cv_folds: Optional[int] = None) -> Dict[str, Any]:
        if algorithm is None:
            algorithm = self.model_config.get('default_algorithm', 'random_forest')

        if param_grid is None:
            param_grid = self._get_param_grid(algorithm)

        if cv_folds is None:
            cv_folds = self.model_config.get('hyperparameter_tuning', {}).get('cv_folds', 5)

        self.create_model(algorithm)

        if not param_grid:
            raise ValueError("没有指定超参数搜索网格")

        grid_search = GridSearchCV(
            self.model,
            param_grid,
            cv=cv_folds,
            scoring='neg_mean_squared_error',
            n_jobs=-1,
            verbose=0,
            refit=True
        )

        grid_search.fit(X, y)

        self.model = grid_search.best_estimator_
        self.best_params = grid_search.best_params_

        results = {
            'best_params': grid_search.best_params_,
            'best_score': float(-grid_search.best_score_),
            'cv_folds': cv_folds,
            'all_results': {
                'params': grid_search.cv_results_['params'],
                'mean_test_score': (-grid_search.cv_results_['mean_test_score']).tolist(),
                'std_test_score': grid_search.cv_results_['std_test_score'].tolist(),
            },
            'algorithm': algorithm,
        }

        self.cv_results = results
        return results

    def _get_param_grid(self, algorithm: str) -> Dict[str, List]:
        tuning_cfg = self.model_config.get('hyperparameter_tuning', {})
        param_grids = tuning_cfg.get('param_grid', {})
        return param_grids.get(algorithm, {})

    def _clone_model(self):
        import copy
        from sklearn.base import clone
        if hasattr(self.model, 'get_params'):
            return clone(self.model)
        return copy.deepcopy(self.model)

    def save_model(self, filepath: str) -> bool:
        if self.model is None:
            raise ValueError("没有已训练的模型")

        try:
            os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else '.', exist_ok=True)

            model_data = {
                'model': self.model,
                'model_name': self.model_name,
                'best_params': self.best_params,
                'training_info': self.training_info,
                'cv_results': self.cv_results,
                'saved_at': datetime.now().isoformat(),
            }

            with open(filepath, 'wb') as f:
                pickle.dump(model_data, f)

            return True
        except Exception:
            return False

    def load_model(self, filepath: str) -> bool:
        try:
            with open(filepath, 'rb') as f:
                model_data = pickle.load(f)

            self.model = model_data.get('model')
            self.model_name = model_data.get('model_name')
            self.best_params = model_data.get('best_params')
            self.training_info = model_data.get('training_info', {})
            self.cv_results = model_data.get('cv_results')

            return self.model is not None
        except Exception:
            return False

    def get_feature_importance(self) -> Optional[Dict[str, float]]:
        if self.model is None:
            return None

        if hasattr(self.model, 'feature_importances_'):
            importances = self.model.feature_importances_
            return {f'importance_{i}': float(imp) for i, imp in enumerate(importances)}

        return None

    def train_test_split_evaluate(self, X: pd.DataFrame, y: pd.Series,
                                  test_size: float = 0.2,
                                  algorithm: Optional[str] = None) -> Dict[str, Any]:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, shuffle=False
        )

        self.train(X_train, y_train, algorithm)

        y_pred = self.model.predict(X_test)

        from .evaluator import ModelEvaluator
        evaluator = ModelEvaluator()
        metrics = evaluator.calculate_metrics(y_test, y_pred)

        return {
            'train_size': len(X_train),
            'test_size': len(X_test),
            'metrics': metrics,
            'predictions': y_pred.tolist(),
            'actual': y_test.tolist(),
            'algorithm': self.model_name,
        }

    def compare_algorithms(self, X: pd.DataFrame, y: pd.Series,
                           algorithms: Optional[List[str]] = None,
                           cv_folds: Optional[int] = None) -> Dict[str, Dict[str, Any]]:
        if algorithms is None:
            algorithms = ['random_forest', 'gradient_boosting']
            if XGB_AVAILABLE:
                algorithms.append('xgboost')

        results = {}

        for algo in algorithms:
            try:
                cv_results = self.cross_validate(X, y, cv_folds=cv_folds, algorithm=algo)
                results[algo] = cv_results
            except Exception as e:
                results[algo] = {'error': str(e)}

        return results
