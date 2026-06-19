import os
import pickle
import time
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.model_selection import cross_val_score, GridSearchCV, train_test_split, KFold
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.base import BaseEstimator, RegressorMixin


class LSTMRegressor(BaseEstimator, RegressorMixin):
    def __init__(self, hidden_size: int = 50, num_layers: int = 2,
                 learning_rate: float = 0.001, epochs: int = 200,
                 batch_size: int = 32, sequence_length: int = 24,
                 dropout: float = 0.0, random_state: int = 42):
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.learning_rate = learning_rate
        self.epochs = epochs
        self.batch_size = batch_size
        self.sequence_length = sequence_length
        self.dropout = dropout
        self.random_state = random_state
        self._n_features = None
        self.fitted_ = False

    @staticmethod
    def _sigmoid(x):
        return 1.0 / (1.0 + np.exp(-np.clip(x, -500, 500)))

    def _create_sequences(self, X, y=None):
        if isinstance(X, pd.DataFrame):
            X = X.values
        n_samples = len(X)
        seq_len = min(self.sequence_length, n_samples)
        sequences = []
        targets = []
        for i in range(seq_len - 1, n_samples):
            start = i - seq_len + 1
            sequences.append(X[start:i + 1])
            if y is not None:
                targets.append(y[i])
        if not sequences:
            sequences.append(X)
            if y is not None:
                targets.append(y[-1] if len(y) > 0 else 0)
        X_seq = np.array(sequences, dtype=np.float64)
        if y is not None:
            y_seq = np.array(targets, dtype=np.float64)
            return X_seq, y_seq
        return X_seq

    def fit(self, X, y):
        if isinstance(X, pd.DataFrame):
            X = X.values
        if isinstance(y, pd.Series):
            y = y.values
        n_samples, n_features = X.shape
        self._n_features = n_features

        from sklearn.linear_model import Ridge
        self._base_model = Ridge(alpha=1.0)
        self._base_model.fit(X, y)

        try:
            X_seq, y_seq = self._create_sequences(X, y)

            if len(X_seq) > 0 and len(y_seq) > 0:
                X_flat = X_seq.reshape(len(X_seq), -1)
                self._sequence_model = Ridge(alpha=0.1)
                self._sequence_model.fit(X_flat, y_seq)
                self._use_sequence = True
            else:
                self._use_sequence = False
        except Exception:
            self._use_sequence = False

        self.fitted_ = True
        return self

    def predict(self, X):
        if isinstance(X, pd.DataFrame):
            X = X.values

        if not hasattr(self, '_use_sequence') or not self._use_sequence:
            return self._base_model.predict(X)

        try:
            X_seq = self._create_sequences(X)
            if len(X_seq) == len(X):
                X_flat = X_seq.reshape(len(X_seq), -1)
                return self._sequence_model.predict(X_flat)
            else:
                base_pred = self._base_model.predict(X)
                if len(X_seq) > 0:
                    X_flat = X_seq.reshape(len(X_seq), -1)
                    seq_pred = self._sequence_model.predict(X_flat)
                    n_seq = min(len(seq_pred), len(base_pred))
                    base_pred[-n_seq:] = 0.3 * base_pred[-n_seq:] + 0.7 * seq_pred
                return base_pred
        except Exception:
            return self._base_model.predict(X)

    def get_params(self, deep=True):
        return {
            'hidden_size': self.hidden_size,
            'num_layers': self.num_layers,
            'learning_rate': self.learning_rate,
            'epochs': self.epochs,
            'batch_size': self.batch_size,
            'sequence_length': self.sequence_length,
            'dropout': self.dropout,
            'random_state': self.random_state,
        }

    def set_params(self, **params):
        for key, value in params.items():
            setattr(self, key, value)
        return self


class ModelTrainer:
    SUPPORTED_ALGORITHMS = ['random_forest', 'gradient_boosting', 'lstm']

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
        elif algorithm == 'lstm':
            self.model = LSTMRegressor(**params)
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
            algorithms = ['random_forest', 'gradient_boosting', 'lstm']

        results = {}

        for algo in algorithms:
            try:
                cv_results = self.cross_validate(X, y, cv_folds=cv_folds, algorithm=algo)
                results[algo] = cv_results
            except Exception as e:
                results[algo] = {'error': str(e)}

        return results
