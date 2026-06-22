"""
error_handler.py
================================================================================
异常处理模块：异常捕获、失败截图、重试机制、人工介入提示。

特性：
  1. 可配置的重试机制（指数退避）
  2. 异常自动截图归档
  3. 介入关键字检测（验证码/系统维护/会话超时等）
  4. 声音告警 + 命令行人工确认提示
  5. 与 GUI 自动化器解耦，通过回调注入截图能力
"""

from __future__ import annotations

import functools
import logging
import os
import platform
import sys
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Type

logger = logging.getLogger(__name__)


@dataclass
class ErrorRecord:
    """单条异常记录。"""
    step: str
    exception_type: str
    message: str
    screenshot_path: Optional[str] = None
    timestamp: str = field(default_factory=lambda: time.strftime("%Y-%m-%d %H:%M:%S"))
    retry_count: int = 0
    context: Dict[str, Any] = field(default_factory=dict)


class InterventionRequired(Exception):
    """需要人工介入的异常（如验证码、系统维护）。"""


class MaxRetriesExceeded(Exception):
    """重试次数耗尽异常。"""


class ErrorHandler:
    """统一异常处理器。"""

    def __init__(self, config: Dict[str, Any],
                 screenshot_callback: Optional[Callable[[str], str]] = None,
                 input_fn: Callable[[str], str] = input) -> None:
        self.config = config
        retry_cfg: Dict[str, Any] = config.get("retry", {})
        self.max_attempts = int(retry_cfg.get("max_attempts", 3))
        self.retry_interval = float(retry_cfg.get("retry_interval", 2))
        self.backoff_multiplier = float(retry_cfg.get("backoff_multiplier", 2.0))
        self.intervention_keywords: List[str] = retry_cfg.get(
            "intervention_keywords", ["验证码", "系统维护", "会话超时"])
        self.sound_alert_enabled = bool(retry_cfg.get("sound_alert", True))
        self.screenshot_callback = screenshot_callback
        self.input_fn = input_fn
        self.records: List[ErrorRecord] = []
        # 是否处于人工暂停状态
        self.paused = False

    # ---------------------------- 重试机制 ----------------------------

    def retry(self, func: Optional[Callable[..., Any]] = None, *,
              attempts: Optional[int] = None, interval: Optional[float] = None,
              step: Optional[str] = None,
              exceptions: tuple = (Exception,)) -> Callable[..., Any]:
        """重试装饰器（支持指数退避）。

        用法：
            @error_handler.retry
            def do_something(): ...

            @error_handler.retry(attempts=5, step="填报工资基数")
            def do_something(): ...
        """
        max_att = attempts if attempts is not None else self.max_attempts
        wait = interval if interval is not None else self.retry_interval

        def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
            step_name = step or fn.__name__

            @functools.wraps(fn)
            def wrapper(*args: Any, **kwargs: Any) -> Any:
                last_exc: Optional[Exception] = None
                backoff = wait
                for attempt in range(1, max_att + 1):
                    try:
                        return fn(*args, **kwargs)
                    except exceptions as exc:  # noqa: BLE001
                        last_exc = exc
                        msg = str(exc)
                        # 介入关键字 → 直接抛出人工介入
                        if self.needs_intervention(msg):
                            self._capture(step_name, exc, attempt)
                            raise InterventionRequired(
                                f"检测到需人工介入的异常：{msg}") from exc
                        self._capture(step_name, exc, attempt)
                        if attempt < max_att:
                            logger.warning("[%s] 第 %d/%d 次失败：%s，%.1fs 后重试",
                                           step_name, attempt, max_att, msg, backoff)
                            time.sleep(backoff)
                            backoff *= self.backoff_multiplier
                        else:
                            logger.error("[%s] 重试 %d 次仍失败：%s",
                                         step_name, max_att, msg)
                raise MaxRetriesExceeded(
                    f"{step_name} 重试 {max_att} 次后仍失败：{last_exc}") from last_exc
            return wrapper

        if func is not None and callable(func):
            return decorator(func)
        return decorator

    # ---------------------------- 上下文管理 ----------------------------

    def guard(self, step: str, exceptions: tuple = (Exception,)) -> "_ErrorGuard":
        """以 with 语句保护一段操作，自动捕获异常并截图。

        用法：
            with error_handler.guard("登录"):
                automator.click_element("login_button")
        """
        return _ErrorGuard(self, step, exceptions)

    # ---------------------------- 人工介入 ----------------------------

    def needs_intervention(self, message: str) -> bool:
        """判断异常消息是否包含需人工介入的关键字。"""
        if not message:
            return False
        return any(kw in message for kw in self.intervention_keywords)

    def prompt_intervention(self, message: str, step: str = "") -> None:
        """发出声音告警并暂停等待人工处理。

        人工处理完毕后在命令行输入回车继续。
        """
        self.paused = True
        if self.sound_alert_enabled:
            self._beep()
        self._capture(step or "intervention", InterventionRequired(message), 0)
        banner = "=" * 60
        prompt = (
            f"\n{banner}\n"
            f"  需人工介入 | 步骤: {step or '未指定'}\n"
            f"  原因: {message}\n"
            f"  请在浏览器中完成相关操作后，回到此处按回车继续...\n"
            f"{banner}\n"
        )
        print(prompt, flush=True)
        logger.warning("人工介入请求：%s（步骤=%s）", message, step)
        try:
            self.input_fn("按回车继续 > ")
        except (EOFError, KeyboardInterrupt):
            logger.warning("人工介入被中断，终止流程")
            raise
        self.paused = False
        logger.info("人工介入完成，继续执行")

    # ---------------------------- 异常记录 ----------------------------

    def _capture(self, step: str, exc: BaseException, attempt: int) -> ErrorRecord:
        """记录异常并截图。"""
        screenshot_path: Optional[str] = None
        if self.screenshot_callback is not None:
            try:
                screenshot_path = self.screenshot_callback(step)
            except Exception as shot_exc:  # noqa: BLE001
                logger.debug("失败截图异常: %s", shot_exc)
        record = ErrorRecord(
            step=step,
            exception_type=type(exc).__name__,
            message=str(exc),
            screenshot_path=screenshot_path,
            retry_count=attempt,
        )
        self.records.append(record)
        logger.error("异常捕获 [step=%s, attempt=%d] %s: %s%s",
                     step, attempt, record.exception_type, record.message,
                     f" (截图: {screenshot_path})" if screenshot_path else "")
        return record

    def handle_exception(self, exc: BaseException, step: str = "unknown",
                         reraise: bool = True) -> ErrorRecord:
        """显式处理一个已发生的异常。"""
        record = self._capture(step, exc, 0)
        if self.needs_intervention(str(exc)):
            self.prompt_intervention(str(exc), step=step)
        if reraise:
            raise exc
        return record

    # ---------------------------- 报告 ----------------------------

    def summarize(self) -> Dict[str, Any]:
        """汇总本次运行的所有异常记录。"""
        by_type: Dict[str, int] = {}
        by_step: Dict[str, int] = {}
        for r in self.records:
            by_type[r.exception_type] = by_type.get(r.exception_type, 0) + 1
            by_step[r.step] = by_step.get(r.step, 0) + 1
        return {
            "total_errors": len(self.records),
            "by_type": by_type,
            "by_step": by_step,
            "records": [
                {
                    "step": r.step,
                    "type": r.exception_type,
                    "message": r.message,
                    "screenshot": r.screenshot_path,
                    "timestamp": r.timestamp,
                    "retry": r.retry_count,
                }
                for r in self.records
            ],
        }

    # ---------------------------- 内部 ----------------------------

    def _beep(self) -> None:
        """跨平台声音告警。"""
        try:
            if platform.system() == "Darwin":
                # macOS 使用 say 语音 + 系统铃声
                os.system("afplay /System/Library/Sounds/Glass.aiff &>/dev/null &")
            elif platform.system() == "Windows":
                import winsound  # type: ignore
                winsound.Beep(880, 600)
            else:
                sys.stdout.write("\a")
                sys.stdout.flush()
        except Exception as exc:  # noqa: BLE001
            logger.debug("声音告警失败: %s", exc)


class _ErrorGuard:
    """配合 with 语句的异常守卫。"""

    def __init__(self, handler: ErrorHandler, step: str,
                 exceptions: tuple = (Exception,)) -> None:
        self.handler = handler
        self.step = step
        self.exceptions = exceptions
        self.record: Optional[ErrorRecord] = None

    def __enter__(self) -> "_ErrorGuard":
        return self

    def __exit__(self, exc_type: Optional[Type[BaseException]],
                 exc_val: Optional[BaseException],
                 exc_tb: Any) -> bool:
        if exc_val is None:
            return False
        if not issubclass(exc_type, self.exceptions):
            return False
        self.record = self.handler._capture(self.step, exc_val, 0)
        if self.handler.needs_intervention(str(exc_val)):
            try:
                self.handler.prompt_intervention(str(exc_val), step=self.step)
                return True  # 介入后继续
            except InterventionRequired:
                return False  # 仍交给上层
        return False  # 不吞异常，向上传播


def safe_call(func: Callable[..., Any], *args: Any,
              default: Any = None, step: str = "",
              logger_: Optional[logging.Logger] = None,
              **kwargs: Any) -> Any:
    """安全调用：捕获异常返回默认值，不抛出。"""
    log = logger_ or logger
    try:
        return func(*args, **kwargs)
    except Exception as exc:  # noqa: BLE001
        log.warning("[safe_call:%s] %s: %s", step or func.__name__,
                    type(exc).__name__, exc)
        return default
