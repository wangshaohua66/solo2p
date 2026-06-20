"""
exception_handler.py
================================================================================
统一异常处理与重试机制

职责:
  1. 定义业务异常体系 (图像读取失败 / 登录超时 / 弹窗识别失败 / 字段校验失败 / GUI元素缺失等)
  2. 可配置的重试装饰器, 支持指数退避, 保证系统异常自动恢复时间 <= 30 秒
  3. 失败案件自动标记并转入人工处理队列
  4. 关键异常触发 ERROR 日志与邮件告警
"""

import functools
import json
import os
import shutil
import time
from typing import Callable, Optional

import yaml

from logger import get_logger

log = get_logger("exception_handler")


# ==============================================================================
# 业务异常体系
# ==============================================================================
class RPAException(Exception):
    """RPA 系统基础异常。"""

    def __init__(self, message: str, case_no: str = "-", scenario: str = "unknown"):
        super().__init__(message)
        self.case_no = case_no
        self.scenario = scenario

    def __str__(self):
        return f"[{self.scenario}] case={self.case_no} | {super().__str__()}"


class ImageReadFailure(RPAException):
    """图像读取/解码失败 (文件损坏、格式不支持、路径无效)。"""

    def __init__(self, message, case_no="-"):
        super().__init__(message, case_no, "image_read_failure")


class SystemLoginTimeout(RPAException):
    """理赔系统登录超时 (启动失败、网络异常、凭据错误)。"""

    def __init__(self, message, case_no="-"):
        super().__init__(message, case_no, "system_login_timeout")


class PopupRecognitionFailure(RPAException):
    """异常弹窗识别失败 (OCR 未识别到弹窗文本)。"""

    def __init__(self, message, case_no="-"):
        super().__init__(message, case_no, "popup_recognition_failure")


class FieldValidationFailure(RPAException):
    """录入字段校验失败 (格式不符、必填缺失、值越界)。"""

    def __init__(self, message, case_no="-", field_name: str = ""):
        super().__init__(message, case_no, "field_validation_failure")
        self.field_name = field_name


class GuiElementNotFound(RPAException):
    """GUI 元素未找到 (坐标点击无响应、控件位移)。"""

    def __init__(self, message, case_no="-"):
        super().__init__(message, case_no, "gui_element_not_found")


class CaseProcessingTimeout(RPAException):
    """单案件处理超时 (超过 120 秒整体预算)。"""

    def __init__(self, message, case_no="-"):
        super().__init__(message, case_no, "case_processing_timeout")


# 异常类型 -> 配置场景名 映射
EXCEPTION_SCENARIO_MAP = {
    ImageReadFailure: "image_read_failure",
    SystemLoginTimeout: "system_login_timeout",
    PopupRecognitionFailure: "popup_recognition_failure",
    FieldValidationFailure: "field_validation_failure",
    GuiElementNotFound: "gui_element_not_found",
    CaseProcessingTimeout: "case_processing_timeout",
}


# ==============================================================================
# 配置加载
# ==============================================================================
class ExceptionConfig:
    """加载并缓存异常处理配置。"""

    _cfg: Optional[dict] = None

    @classmethod
    def load(cls, config_path: str = "config.yaml") -> dict:
        if cls._cfg is None:
            with open(config_path, "r", encoding="utf-8") as f:
                full = yaml.safe_load(f)
            cls._cfg = full.get("exception_handling", {})
        return cls._cfg

    @classmethod
    def get_scenario(cls, exc: Exception) -> dict:
        """根据异常类型返回对应场景的配置 (retry/backoff/action)。"""
        cfg = cls.load()
        default = {
            "retry": cfg.get("default_retry", 3),
            "backoff": cfg.get("retry_backoff_base", 2),
            "action": "retry",
        }
        for exc_type, scenario_name in EXCEPTION_SCENARIO_MAP.items():
            if isinstance(exc, exc_type):
                return cfg.get("scenarios", {}).get(scenario_name, default)
        return default

    @classmethod
    def recovery_timeout(cls) -> float:
        """自动恢复时间上限 (秒), 来自 system.recovery_timeout。"""
        try:
            with open("config.yaml", "r", encoding="utf-8") as f:
                full = yaml.safe_load(f)
            return float(full.get("system", {}).get("recovery_timeout", 30))
        except Exception:
            return 30.0


# ==============================================================================
# 重试装饰器
# ==============================================================================
def retry_on_exception(
    exceptions: tuple = (Exception,),
    max_retries: Optional[int] = None,
    backoff_base: Optional[float] = None,
    recovery_action: Optional[Callable] = None,
    case_no_arg: str = "case_no",
):
    """
    带指数退避的重试装饰器。

    参数:
      exceptions: 需要重试的异常元组
      max_retries: 最大重试次数, None 则从配置读取
      backoff_base: 退避基数(秒), None 则从配置读取
      recovery_action: 每次重试前执行的恢复动作 (如重启登录)
      case_no_arg: 被装饰函数中代表案件号的参数名, 用于日志
    """

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            case_no = kwargs.get(case_no_arg, "-")
            cfg = ExceptionConfig.load()
            local_max = max_retries if max_retries is not None \
                else cfg.get("default_retry", 3)
            local_backoff = backoff_base if backoff_base is not None \
                else cfg.get("retry_backoff_base", 2)
            recovery_deadline = time.time() + ExceptionConfig.recovery_timeout()

            attempt = 0
            last_exc = None
            while attempt <= local_max:
                try:
                    return func(*args, **kwargs)
                except exceptions as exc:
                    last_exc = exc
                    attempt += 1
                    scenario = ExceptionConfig.get_scenario(exc)
                    # 若重试次数超过场景配置, 提前放弃
                    if attempt > scenario.get("retry", local_max):
                        log.error(
                            "重试耗尽 | func=%s case=%s scenario=%s attempt=%d err=%s",
                            func.__name__, case_no, scenario, attempt, exc)
                        break
                    # 计算退避时间: base^attempt, 但确保整体恢复 <= recovery_timeout
                    wait = scenario.get("backoff", local_backoff) ** attempt
                    if time.time() + wait > recovery_deadline:
                        wait = max(0.0, recovery_deadline - time.time())
                    log.warning(
                        "发生异常将重试 | func=%s case=%s scenario=%s attempt=%d "
                        "wait=%.1fs err=%s",
                        func.__name__, case_no, scenario, attempt, wait, exc)
                    # 执行恢复动作 (如重启登录)
                    if recovery_action is not None:
                        try:
                            recovery_action(case_no=case_no)
                        except Exception as ra_exc:
                            log.warning("恢复动作失败 | case=%s err=%s",
                                        case_no, ra_exc)
                    if wait > 0:
                        time.sleep(wait)
            # 全部重试失败, 抛出最后异常
            raise last_exc

        return wrapper

    return decorator


# ==============================================================================
# 失败案件转入人工队列
# ==============================================================================
class ManualQueueRouter:
    """失败案件自动标记并转入人工处理队列目录。"""

    def __init__(self, config_path: str = "config.yaml"):
        with open(config_path, "r", encoding="utf-8") as f:
            full = yaml.safe_load(f)
        sys_cfg = full.get("system", {})
        self.manual_dir = sys_cfg.get("manual_queue_dir", "./data/manual_queue")
        self.output_dir = sys_cfg.get("output_dir", "./data/output")
        os.makedirs(self.manual_dir, exist_ok=True)

    def route_to_manual(self, case_no: str, reason: str,
                        case_dir: Optional[str] = None,
                        result: Optional[dict] = None) -> str:
        """
        将失败案件写入人工队列:
          1. 复制原始案件目录 (如有) 到人工队列
          2. 写入 failure_record.json 记录失败原因/阶段/结果
        返回人工队列中的案件目录路径。
        """
        ts = time.strftime("%Y%m%d_%H%M%S")
        target_dir = os.path.join(self.manual_dir, f"{case_no}_{ts}")
        os.makedirs(target_dir, exist_ok=True)

        if case_dir and os.path.isdir(case_dir):
            try:
                for item in os.listdir(case_dir):
                    src = os.path.join(case_dir, item)
                    dst = os.path.join(target_dir, item)
                    if os.path.isfile(src):
                        shutil.copy2(src, dst)
            except Exception as exc:
                log.warning("复制案件目录到人工队列失败 | case=%s err=%s",
                            case_no, exc)

        record = {
            "case_no": case_no,
            "failure_time": ts,
            "reason": reason,
            "source_dir": case_dir,
            "partial_result": result or {},
            "status": "pending_manual",
        }
        record_path = os.path.join(target_dir, "failure_record.json")
        try:
            with open(record_path, "w", encoding="utf-8") as f:
                json.dump(record, f, ensure_ascii=False, indent=2)
            log.warning("案件已转入人工队列 | case=%s reason=%s path=%s",
                        case_no, reason, target_dir)
        except Exception as exc:
            log.error("写入人工队列记录失败 | case=%s err=%s", case_no, exc)
        return target_dir

    def mark_case_failed(self, case_no: str, reason: str,
                         result: Optional[dict] = None) -> str:
        """仅记录失败状态 (无需复制文件时使用)。"""
        return self.route_to_manual(case_no, reason, None, result)


# ==============================================================================
# 安全执行包装
# ==============================================================================
def safe_execute(func: Callable, *args, case_no: str = "-",
                 on_failure: Optional[Callable] = None,
                 reraise: bool = True, **kwargs):
    """
    安全执行包装: 捕获异常 -> 记录 ERROR -> 触发告警 -> 可选转入人工队列。
    返回 (success: bool, result_or_error)。
    """
    try:
        result = func(*args, **kwargs)
        return True, result
    except RPAException as exc:
        log.error("业务异常 | case=%s scenario=%s err=%s",
                  case_no, exc.scenario, exc)
        if on_failure is not None:
            try:
                on_failure(case_no=case_no, reason=str(exc))
            except Exception as of_exc:
                log.error("on_failure 回调异常 | case=%s err=%s",
                          case_no, of_exc)
        if reraise:
            raise
        return False, exc
    except Exception as exc:
        log.error("未知异常 | case=%s err=%s", case_no, exc, exc_info=True)
        if on_failure is not None:
            try:
                on_failure(case_no=case_no, reason=str(exc))
            except Exception as of_exc:
                log.error("on_failure 回调异常 | case=%s err=%s",
                          case_no, of_exc)
        if reraise:
            raise
        return False, exc
