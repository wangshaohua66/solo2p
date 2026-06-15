import time
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List, Callable
from dataclasses import dataclass, field
from enum import Enum

import pyautogui
import pyperclip

from .screen_capture import ScreenCapture
from .template_matcher import TemplateMatcher
from .text_extractor import TextExtractor

logger = logging.getLogger(__name__)


class ActionStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    RETRYING = "retrying"


@dataclass
class ActionResult:
    status: ActionStatus
    message: str = ""
    data: Dict[str, Any] = field(default_factory=dict)
    screenshot_path: Optional[str] = None
    attempts: int = 0

    @property
    def is_success(self) -> bool:
        return self.status == ActionStatus.SUCCESS


class RetryStrategy:
    def __init__(self, config: Dict[str, Any]):
        retry_cfg = config.get("retry", {})
        self.max_attempts = retry_cfg.get("max_attempts", 3)
        self.initial_interval = retry_cfg.get("initial_interval", 2)
        self.interval_multiplier = retry_cfg.get("interval_multiplier", 1.5)
        self.global_fail_threshold = retry_cfg.get("global_fail_threshold", 5)
        self._consecutive_failures = 0

    def get_interval(self, attempt: int) -> float:
        interval = self.initial_interval
        for _ in range(attempt - 1):
            interval *= self.interval_multiplier
        return interval

    def record_failure(self) -> bool:
        self._consecutive_failures += 1
        return self._consecutive_failures >= self.global_fail_threshold

    def record_success(self) -> None:
        self._consecutive_failures = 0

    @property
    def consecutive_failures(self) -> int:
        return self._consecutive_failures

    def reset(self) -> None:
        self._consecutive_failures = 0


class ActionExecutor:
    def __init__(self, config: Dict[str, Any],
                 screen_capture: ScreenCapture,
                 template_matcher: TemplateMatcher,
                 text_extractor: TextExtractor):
        self.config = config
        self.screen_capture = screen_capture
        self.template_matcher = template_matcher
        self.text_extractor = text_extractor
        self.retry = RetryStrategy(config)

        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.05
        self._default_type_interval = 0.02
        self._click_pause = 0.15

    def execute_with_retry(self, action_fn: Callable[..., ActionResult],
                           *args, **kwargs) -> ActionResult:
        last_result = ActionResult(status=ActionStatus.FAILED, message="未执行")
        task_name = kwargs.pop("task_name", action_fn.__name__)
        save_screenshots = kwargs.pop("save_screenshots", True)

        for attempt in range(1, self.retry.max_attempts + 1):
            try:
                logger.info(f"执行任务 [{task_name}] 第 {attempt}/{self.retry.max_attempts} 次尝试")
                self._dismiss_popups()

                result = action_fn(*args, **kwargs)
                result.attempts = attempt

                if result.is_success:
                    self.retry.record_success()
                    return result

                last_result = result
                last_result.status = ActionStatus.RETRYING
                logger.warning(f"任务 [{task_name}] 第 {attempt} 次失败: {result.message}")

                if save_screenshots:
                    frame = self.screen_capture.capture_full_screen()
                    if frame is not None:
                        path = self.screen_capture.save_screenshot(
                            frame, prefix=f"fail_{task_name}_attempt{attempt}", subdir="failures"
                        )
                        last_result.screenshot_path = path

                if attempt < self.retry.max_attempts:
                    wait_time = self.retry.get_interval(attempt)
                    logger.info(f"等待 {wait_time:.1f}s 后重试...")
                    time.sleep(wait_time)

            except Exception as e:
                logger.error(f"任务 [{task_name}] 第 {attempt} 次异常: {e}", exc_info=True)
                last_result = ActionResult(
                    status=ActionStatus.FAILED,
                    message=f"执行异常: {str(e)}",
                    attempts=attempt
                )

                if save_screenshots:
                    frame = self.screen_capture.capture_full_screen()
                    if frame is not None:
                        path = self.screen_capture.save_screenshot(
                            frame, prefix=f"error_{task_name}_attempt{attempt}", subdir="errors"
                        )
                        last_result.screenshot_path = path

                if attempt < self.retry.max_attempts:
                    wait_time = self.retry.get_interval(attempt)
                    time.sleep(wait_time)

        last_result.status = ActionStatus.FAILED
        should_pause = self.retry.record_failure()
        if should_pause:
            logger.critical(
                f"连续失败达到阈值 {self.retry.global_fail_threshold} 次，建议暂停任务检查环境！"
            )
            last_result.data["should_pause"] = True

        return last_result

    def _dismiss_popups(self) -> bool:
        popups = self.template_matcher.detect_popups()
        if not popups:
            return False

        for popup in popups:
            popup_type = popup["type"]
            cx, cy = popup["center"]

            try:
                if popup_type in ("popup_ok", "popup_confirm"):
                    pyautogui.click(cx, cy)
                    logger.info(f"已点击确认弹窗 @ ({cx},{cy})")
                elif popup_type == "popup_cancel":
                    pyautogui.click(cx, cy)
                    logger.info(f"已点击取消弹窗 @ ({cx},{cy})")
                elif popup_type == "popup_error":
                    pyautogui.click(cx, cy)
                    logger.warning(f"检测并关闭错误弹窗 @ ({cx},{cy})")
                    return False
                time.sleep(0.3)
            except Exception as e:
                logger.error(f"关闭弹窗失败: {e}")

        return True

    def fill_text_field(self, system_name: str, field_cfg: Dict[str, int],
                        value: str, verify: bool = True) -> ActionResult:
        rel_x = field_cfg.get("x", 0) + field_cfg.get("width", 200) // 2
        rel_y = field_cfg.get("y", 0) + field_cfg.get("height", 30) // 2
        abs_x, abs_y = self.screen_capture.get_absolute_click_point(system_name, rel_x, rel_y)

        try:
            pyautogui.click(abs_x, abs_y, pause=self._click_pause)
            time.sleep(0.1)

            pyautogui.hotkey("ctrl", "a")
            time.sleep(0.05)
            pyautogui.press("delete")
            time.sleep(0.05)

            pyperclip.copy(value)
            pyautogui.hotkey("ctrl", "v")
            time.sleep(0.2)

            if verify:
                read_back = self.text_extractor.read_field_value(
                    field_cfg, system_name, field_type="text"
                )
                if value and value not in read_back:
                    logger.warning(f"字段回读不匹配: 预期='{value}' 回读='{read_back}'")
                    return ActionResult(
                        status=ActionStatus.FAILED,
                        message=f"字段回读不匹配，回读值='{read_back}'"
                    )

            return ActionResult(
                status=ActionStatus.SUCCESS,
                message=f"文本字段填充成功: '{value}'",
                data={"field_value": value, "read_back": read_back if verify else ""}
            )

        except Exception as e:
            return ActionResult(status=ActionStatus.FAILED, message=f"填充文本字段异常: {e}")

    def select_dropdown(self, system_name: str, field_cfg: Dict[str, Any],
                        target_option: str) -> ActionResult:
        options = field_cfg.get("options", [])
        if not options:
            return ActionResult(status=ActionStatus.FAILED, message="下拉框无可用选项")

        if target_option not in options:
            return ActionResult(
                status=ActionStatus.FAILED,
                message=f"选项 '{target_option}' 不在可选列表: {options}"
            )

        rel_x = field_cfg.get("x", 0) + field_cfg.get("width", 150) // 2
        rel_y = field_cfg.get("y", 0) + field_cfg.get("height", 30) // 2
        abs_x, abs_y = self.screen_capture.get_absolute_click_point(system_name, rel_x, rel_y)

        try:
            pyautogui.click(abs_x, abs_y, pause=self._click_pause)
            time.sleep(0.3)

            option_idx = options.index(target_option)
            for _ in range(option_idx):
                pyautogui.press("down")
                time.sleep(0.08)

            pyautogui.press("enter")
            time.sleep(0.2)

            return ActionResult(
                status=ActionStatus.SUCCESS,
                message=f"下拉框选择: '{target_option}' (索引={option_idx})",
                data={"selected": target_option, "index": option_idx}
            )

        except Exception as e:
            return ActionResult(status=ActionStatus.FAILED, message=f"下拉选择异常: {e}")

    def fill_date_field(self, system_name: str, field_cfg: Dict[str, int],
                        date_value: Optional[datetime] = None) -> ActionResult:
        if date_value is None:
            date_value = datetime.now()
        date_str = date_value.strftime("%Y-%m-%d")

        return self.fill_text_field(system_name, field_cfg, date_str, verify=False)

    def click_button(self, system_name: str, button_cfg: Dict[str, int],
                     wait_after: float = 1.0) -> ActionResult:
        rel_x = button_cfg.get("x", 0) + button_cfg.get("width", 100) // 2
        rel_y = button_cfg.get("y", 0) + button_cfg.get("height", 40) // 2
        abs_x, abs_y = self.screen_capture.get_absolute_click_point(system_name, rel_x, rel_y)

        try:
            pyautogui.click(abs_x, abs_y, pause=self._click_pause)
            time.sleep(wait_after)
            return ActionResult(
                status=ActionStatus.SUCCESS,
                message=f"按钮点击成功 @ ({abs_x},{abs_y})"
            )
        except Exception as e:
            return ActionResult(status=ActionStatus.FAILED, message=f"按钮点击异常: {e}")

    def fill_dispatch_form(self, container_number: str,
                           location_from: str, location_to: str,
                           operation_type: str) -> ActionResult:
        sys_name = "dispatch"
        if not self.screen_capture.activate_window(sys_name):
            return ActionResult(status=ActionStatus.FAILED, message="无法激活调度系统窗口")

        time.sleep(0.3)
        fields_cfg = self.config.get("systems", {}).get(sys_name, {}).get("input_fields", {})

        results = []

        r1 = self.fill_text_field(sys_name, fields_cfg["container_number"], container_number)
        results.append(("container_number", r1))
        if not r1.is_success:
            return ActionResult(
                status=ActionStatus.FAILED,
                message=f"箱号字段失败: {r1.message}",
                data={"steps": results}
            )

        r2 = self.select_dropdown(sys_name, fields_cfg["location_from"], location_from)
        results.append(("location_from", r2))

        r3 = self.select_dropdown(sys_name, fields_cfg["location_to"], location_to)
        results.append(("location_to", r3))

        r4 = self.select_dropdown(sys_name, fields_cfg["operation_type"], operation_type)
        results.append(("operation_type", r4))

        r5 = self.click_button(sys_name, fields_cfg["submit_button"], wait_after=1.5)
        results.append(("submit", r5))
        if not r5.is_success:
            return ActionResult(
                status=ActionStatus.FAILED,
                message=f"提交失败: {r5.message}",
                data={"steps": results}
            )

        time.sleep(1.0)
        success = self.template_matcher.detect_success_marker(sys_name)

        frame = self.screen_capture.capture_full_screen()
        shot_path = None
        if frame is not None:
            shot_path = self.screen_capture.save_screenshot(
                frame, prefix=f"dispatch_{container_number}", subdir="dispatch"
            )

        if success:
            return ActionResult(
                status=ActionStatus.SUCCESS,
                message=f"调度系统录入成功: {container_number}",
                data={"steps": results, "operation": operation_type},
                screenshot_path=shot_path
            )
        else:
            return ActionResult(
                status=ActionStatus.FAILED,
                message="调度系统提交后未检测到成功标志",
                data={"steps": results},
                screenshot_path=shot_path
            )

    def fill_customs_form(self, container_number: str,
                          customs_code: str = "",
                          inspection_type: str = "机检") -> ActionResult:
        sys_name = "customs"
        if not self.screen_capture.activate_window(sys_name):
            return ActionResult(status=ActionStatus.FAILED, message="无法激活海关系统窗口")

        time.sleep(0.3)
        fields_cfg = self.config.get("systems", {}).get(sys_name, {}).get("input_fields", {})

        results = []

        r1 = self.fill_text_field(sys_name, fields_cfg["container_number"], container_number)
        results.append(("container_number", r1))
        if not r1.is_success:
            return ActionResult(
                status=ActionStatus.FAILED,
                message=f"箱号字段失败: {r1.message}",
                data={"steps": results}
            )

        if customs_code:
            r2 = self.fill_text_field(sys_name, fields_cfg["customs_code"], customs_code, verify=False)
            results.append(("customs_code", r2))

        r3 = self.fill_date_field(sys_name, fields_cfg["declare_date"])
        results.append(("declare_date", r3))

        r4 = self.select_dropdown(sys_name, fields_cfg["inspection_type"], inspection_type)
        results.append(("inspection_type", r4))

        r5 = self.click_button(sys_name, fields_cfg["submit_button"], wait_after=1.5)
        results.append(("submit", r5))
        if not r5.is_success:
            return ActionResult(
                status=ActionStatus.FAILED,
                message=f"提交失败: {r5.message}",
                data={"steps": results}
            )

        time.sleep(1.0)
        success = self.template_matcher.detect_success_marker(sys_name)

        frame = self.screen_capture.capture_full_screen()
        shot_path = None
        if frame is not None:
            shot_path = self.screen_capture.save_screenshot(
                frame, prefix=f"customs_{container_number}", subdir="customs"
            )

        if success:
            return ActionResult(
                status=ActionStatus.SUCCESS,
                message=f"海关系统录入成功: {container_number}",
                data={"steps": results, "inspection": inspection_type},
                screenshot_path=shot_path
            )
        else:
            return ActionResult(
                status=ActionStatus.FAILED,
                message="海关系统提交后未检测到成功标志",
                data={"steps": results},
                screenshot_path=shot_path
            )

    def determine_operation_type(self, container_status: str) -> Dict[str, str]:
        mapping = {
            "empty": {"operation": "移箱", "from": "空箱区", "to": "作业区", "inspection": "放行"},
            "loaded": {"operation": "出场", "from": "重箱区", "to": "装车区", "inspection": "机检"},
            "pending": {"operation": "查验", "from": "待验区", "to": "查验区", "inspection": "人工查验"},
            "frozen": {"operation": "出场", "from": "冻结区", "to": "待处理", "inspection": "机检"},
        }
        return mapping.get(container_status, {
            "operation": "移箱", "from": "A区", "to": "B区", "inspection": "机检"
        })

    @property
    def consecutive_failures(self) -> int:
        return self.retry.consecutive_failures

    def reset_failures(self) -> None:
        self.retry.reset()
