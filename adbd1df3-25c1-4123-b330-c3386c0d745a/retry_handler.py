import time
import random
import logging
import functools
from typing import Callable, Any, Tuple, Optional, Type, List, Union


logger = logging.getLogger(__name__)


class RetryError(Exception):
    def __init__(self, message: str, last_exception: Optional[Exception] = None, attempts: int = 0):
        super().__init__(message)
        self.last_exception = last_exception
        self.attempts = attempts


class RetryConfig:
    def __init__(
        self,
        max_attempts: int = 3,
        base_delay: float = 2.0,
        max_delay: float = 30.0,
        backoff_factor: float = 2.0,
        jitter: float = 0.1,
        retry_on: Optional[List[Union[str, Type[Exception]]]] = None,
    ):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.backoff_factor = backoff_factor
        self.jitter = jitter
        self.retry_on = retry_on or []

    def _should_retry(self, exception: Exception) -> bool:
        if not self.retry_on:
            return True
        exc_type = type(exception).__name__
        for retry_type in self.retry_on:
            if isinstance(retry_type, str):
                if exc_type == retry_type:
                    return True
            elif isinstance(exception, retry_type):
                return True
        return False

    def _calculate_delay(self, attempt: int) -> float:
        delay = self.base_delay * (self.backoff_factor ** (attempt - 1))
        delay = min(delay, self.max_delay)
        if self.jitter > 0:
            jitter_amount = delay * self.jitter * (random.random() * 2 - 1)
            delay += jitter_amount
        return max(0, delay)

    @classmethod
    def from_yaml_config(cls, config: dict) -> "RetryConfig":
        return cls(
            max_attempts=config.get("max_attempts", 3),
            base_delay=config.get("base_delay", 2.0),
            max_delay=config.get("max_delay", 30.0),
            backoff_factor=config.get("backoff_factor", 2.0),
            jitter=config.get("jitter", 0.1),
            retry_on=config.get("retry_on", []),
        )


class RetryHandler:
    def __init__(self, config: RetryConfig, operation_name: str = "operation"):
        self.config = config
        self.operation_name = operation_name
        self.attempts = 0
        self.total_duration = 0.0

    def execute(self, func: Callable, *args, **kwargs) -> Any:
        last_exception = None
        start_time = time.time()

        for attempt in range(1, self.config.max_attempts + 1):
            self.attempts = attempt
            attempt_start = time.time()
            try:
                result = func(*args, **kwargs)
                attempt_duration = time.time() - attempt_start
                self.total_duration = time.time() - start_time
                self._log_success(attempt, attempt_duration)
                return result
            except Exception as e:
                attempt_duration = time.time() - attempt_start
                last_exception = e

                if not self.config._should_retry(e):
                    self._log_no_retry(attempt, attempt_duration, e)
                    break

                if attempt >= self.config.max_attempts:
                    self._log_max_attempts(attempt, attempt_duration, e)
                    break

                delay = self.config._calculate_delay(attempt)
                self._log_retry(attempt, attempt_duration, e, delay)
                time.sleep(delay)

        self.total_duration = time.time() - start_time
        raise RetryError(
            f"{self.operation_name} failed after {self.attempts} attempts",
            last_exception=last_exception,
            attempts=self.attempts,
        )

    def _log_success(self, attempt: int, duration: float):
        logger.info(
            f"{self.operation_name} succeeded on attempt {attempt}",
            extra={
                "operation": self.operation_name,
                "status": "success",
                "duration": duration,
                "attempt": attempt,
            },
        )

    def _log_retry(self, attempt: int, duration: float, exception: Exception, delay: float):
        logger.warning(
            f"{self.operation_name} failed on attempt {attempt}: {str(exception)[:100]}. "
            f"Retrying in {delay:.2f}s...",
            extra={
                "operation": self.operation_name,
                "status": "retry",
                "duration": duration,
                "attempt": attempt,
                "error": str(exception),
                "next_delay": delay,
            },
        )

    def _log_no_retry(self, attempt: int, duration: float, exception: Exception):
        logger.error(
            f"{self.operation_name} failed on attempt {attempt}: {str(exception)[:100]}. "
            f"Exception type not configured for retry.",
            extra={
                "operation": self.operation_name,
                "status": "failed_no_retry",
                "duration": duration,
                "attempt": attempt,
                "error": str(exception),
            },
        )

    def _log_max_attempts(self, attempt: int, duration: float, exception: Exception):
        logger.error(
            f"{self.operation_name} failed after {attempt} attempts: {str(exception)[:100]}",
            extra={
                "operation": self.operation_name,
                "status": "failed_max_attempts",
                "duration": duration,
                "attempt": attempt,
                "error": str(exception),
            },
        )


def retry(
    max_attempts: int = 3,
    base_delay: float = 2.0,
    max_delay: float = 30.0,
    backoff_factor: float = 2.0,
    jitter: float = 0.1,
    retry_on: Optional[List[Union[str, Type[Exception]]]] = None,
    operation_name: Optional[str] = None,
):
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            config = RetryConfig(
                max_attempts=max_attempts,
                base_delay=base_delay,
                max_delay=max_delay,
                backoff_factor=backoff_factor,
                jitter=jitter,
                retry_on=retry_on,
            )
            op_name = operation_name or func.__name__
            handler = RetryHandler(config, op_name)
            return handler.execute(func, *args, **kwargs)

        return wrapper

    return decorator


def with_retry_config(config: RetryConfig, operation_name: Optional[str] = None):
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            op_name = operation_name or func.__name__
            handler = RetryHandler(config, op_name)
            return handler.execute(func, *args, **kwargs)

        return wrapper

    return decorator


class RetryStats:
    def __init__(self):
        self.total_operations = 0
        self.successful_operations = 0
        self.failed_operations = 0
        self.total_attempts = 0
        self.total_retry_delay = 0.0
        self.operation_stats: dict = {}

    def record(self, operation_name: str, success: bool, attempts: int, retry_delay: float = 0.0):
        self.total_operations += 1
        self.total_attempts += attempts
        self.total_retry_delay += retry_delay

        if success:
            self.successful_operations += 1
        else:
            self.failed_operations += 1

        if operation_name not in self.operation_stats:
            self.operation_stats[operation_name] = {
                "total": 0,
                "success": 0,
                "failed": 0,
                "total_attempts": 0,
            }
        stats = self.operation_stats[operation_name]
        stats["total"] += 1
        stats["success"] += 1 if success else 0
        stats["failed"] += 0 if success else 1
        stats["total_attempts"] += attempts

    @property
    def success_rate(self) -> float:
        if self.total_operations == 0:
            return 0.0
        return self.successful_operations / self.total_operations

    @property
    def avg_attempts_per_operation(self) -> float:
        if self.total_operations == 0:
            return 0.0
        return self.total_attempts / self.total_operations

    def get_summary(self) -> dict:
        return {
            "total_operations": self.total_operations,
            "successful_operations": self.successful_operations,
            "failed_operations": self.failed_operations,
            "success_rate": self.success_rate,
            "total_attempts": self.total_attempts,
            "avg_attempts_per_operation": self.avg_attempts_per_operation,
            "total_retry_delay": self.total_retry_delay,
            "operation_stats": self.operation_stats,
        }
