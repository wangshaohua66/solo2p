import time
import functools
import requests
from typing import Callable, Any, Tuple, Optional, List, Type
from datetime import datetime


class RetryExhaustedError(Exception):
    def __init__(self, operation: str, attempts: int, last_error: str):
        self.operation = operation
        self.attempts = attempts
        self.last_error = last_error
        super().__init__(
            f"操作 '{operation}' 在 {attempts} 次重试后仍失败: {last_error}"
        )


class RetryHandler:
    def __init__(
        self,
        max_retries: int = 3,
        backoff_factor: float = 2.0,
        initial_delay: float = 1.0,
        max_delay: float = 60.0,
        log_manager=None,
        retry_exceptions: Optional[List[Type[Exception]]] = None,
    ):
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.log_manager = log_manager
        self.retry_exceptions = retry_exceptions or [
            requests.exceptions.ConnectionError,
            requests.exceptions.Timeout,
            requests.exceptions.RequestException,
            TimeoutError,
            ConnectionError,
            OSError,
        ]

    def _calc_delay(self, attempt: int) -> float:
        delay = self.initial_delay * (self.backoff_factor ** (attempt - 1))
        return min(delay, self.max_delay)

    def _is_retryable(self, exc: Exception) -> bool:
        for exc_type in self.retry_exceptions:
            if isinstance(exc, exc_type):
                return True
        return False

    def execute(
        self,
        func: Callable,
        operation_name: str,
        task_id: str = None,
        supplier_id: str = None,
        *args,
        **kwargs,
    ) -> Tuple[bool, Any, Optional[Exception]]:
        last_exc = None
        for attempt in range(1, self.max_retries + 1):
            try:
                result = func(*args, **kwargs)
                return True, result, None
            except Exception as e:
                last_exc = e
                if not self._is_retryable(e) and attempt < self.max_retries:
                    if self.log_manager and task_id:
                        self.log_manager.log_exception(
                            task_id, supplier_id or "",
                            operation_name, e
                        )
                    break
                if attempt < self.max_retries:
                    delay = self._calc_delay(attempt)
                    if self.log_manager and task_id:
                        self.log_manager.log_retry(
                            task_id, supplier_id or "",
                            operation_name,
                            attempt, self.max_retries,
                            delay, str(e)
                        )
                    time.sleep(delay)
                else:
                    if self.log_manager and task_id:
                        self.log_manager.log_exception(
                            task_id, supplier_id or "",
                            f"{operation_name}_最终失败", e
                        )
        return False, None, last_exc

    def with_retry(self, operation_name: str):
        def decorator(func):
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                task_id = kwargs.get("task_id")
                supplier_id = kwargs.get("supplier_id")
                success, result, exc = self.execute(
                    func, operation_name, task_id, supplier_id,
                    *args, **kwargs
                )
                if not success:
                    raise RetryExhaustedError(
                        operation_name, self.max_retries, str(exc)
                    )
                return result
            return wrapper
        return decorator


class NetworkRetryHandler(RetryHandler):
    def __init__(self, log_manager=None, timeout: int = 30):
        super().__init__(
            max_retries=3,
            backoff_factor=2.0,
            initial_delay=2.0,
            max_delay=30.0,
            log_manager=log_manager,
            retry_exceptions=[
                requests.exceptions.ConnectionError,
                requests.exceptions.Timeout,
                requests.exceptions.TooManyRedirects,
                requests.exceptions.ChunkedEncodingError,
                requests.exceptions.RequestException,
                ConnectionError,
                TimeoutError,
                OSError,
            ],
        )
        self.timeout = timeout

    def http_get(
        self,
        url: str,
        task_id: str = None,
        supplier_id: str = None,
        **kwargs,
    ) -> Tuple[bool, Optional[requests.Response], Optional[Exception]]:
        kwargs.setdefault("timeout", self.timeout)
        success, resp, exc = self.execute(
            lambda: requests.get(url, **kwargs),
            f"HTTP GET {url}",
            task_id, supplier_id,
        )
        if success and resp is not None:
            try:
                resp.raise_for_status()
            except requests.exceptions.HTTPError as he:
                if resp.status_code in (429, 500, 502, 503, 504):
                    return False, None, he
                return True, resp, None
        return success, resp, exc

    def http_post(
        self,
        url: str,
        task_id: str = None,
        supplier_id: str = None,
        **kwargs,
    ) -> Tuple[bool, Optional[requests.Response], Optional[Exception]]:
        kwargs.setdefault("timeout", self.timeout)
        success, resp, exc = self.execute(
            lambda: requests.post(url, **kwargs),
            f"HTTP POST {url}",
            task_id, supplier_id,
        )
        return success, resp, exc


class UIRetryHandler(RetryHandler):
    def __init__(self, log_manager=None, timeout_ui: int = 10):
        super().__init__(
            max_retries=3,
            backoff_factor=1.5,
            initial_delay=1.0,
            max_delay=10.0,
            log_manager=log_manager,
            retry_exceptions=[
                TimeoutError,
                RuntimeError,
                Exception,
            ],
        )
        self.timeout_ui = timeout_ui

    def find_element_with_alternatives(
        self,
        find_funcs: List[Callable],
        operation_name: str,
        task_id: str = None,
        supplier_id: str = None,
    ) -> Tuple[bool, Any, Optional[Exception]]:
        last_exc = None
        for attempt in range(1, self.max_retries + 1):
            for idx, find_func in enumerate(find_funcs):
                try:
                    result = find_func()
                    if result is not None:
                        if self.log_manager and task_id and idx > 0:
                            self.log_manager.log_step(
                                task_id, supplier_id or "",
                                operation_name,
                                f"使用备选模板 #{idx} 定位成功",
                            )
                        return True, result, None
                except Exception as e:
                    last_exc = e
                    continue
            if attempt < self.max_retries:
                delay = self._calc_delay(attempt)
                if self.log_manager and task_id:
                    self.log_manager.log_retry(
                        task_id, supplier_id or "",
                        operation_name,
                        attempt, self.max_retries,
                        delay,
                        f"所有模板匹配失败，尝试第{attempt + 1}轮",
                    )
                time.sleep(delay)
        return False, None, last_exc
