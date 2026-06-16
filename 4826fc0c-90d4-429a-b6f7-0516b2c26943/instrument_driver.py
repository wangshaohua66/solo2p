import os
import sys
import time
import random
import threading
from typing import Optional, Tuple, Dict, Any, List
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

import cv2
import numpy as np
import pyautogui
from PIL import Image
from loguru import logger

pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.1

_HAS_WIN32 = False
if sys.platform == "win32":
    try:
        import win32gui
        import win32con
        _HAS_WIN32 = True
    except ImportError:
        logger.warning("当前为 Windows 平台但未安装 pywin32，窗口原生定位功能将不可用，将使用模板匹配和坐标回退模式")
else:
    logger.info("非 Windows 平台，win32 原生窗口操作已跳过，将使用模板匹配和坐标回退模式")


class InstrumentStatus(Enum):
    IDLE = "空闲"
    BUSY = "测量中"
    ERROR = "异常"
    OFFLINE = "离线"


@dataclass
class WindowInfo:
    left: int
    top: int
    width: int
    height: int
    handle: Optional[Any] = None


class InstrumentDriver:
    def __init__(self, instrument_id: str, config: Dict[str, Any], global_config: Dict[str, Any]):
        self.instrument_id = instrument_id
        self.config = config
        self.global_config = global_config
        self.status = InstrumentStatus.IDLE
        self.current_sample: Optional[str] = None
        self.window_info: Optional[WindowInfo] = None
        self._lock = threading.Lock()
        self._operation_jitter_min = global_config.get("operation_jitter_min", 0.3)
        self._operation_jitter_max = global_config.get("operation_jitter_max", 1.2)
        self._max_retry = global_config.get("max_retry_count", 3)
        self._backoff_base = global_config.get("retry_backoff_base", 2.0)
        self._audit_dir = Path(global_config.get("audit_log_dir", "audit_logs"))
        self._audit_dir.mkdir(parents=True, exist_ok=True)

    def _jitter(self) -> None:
        delay = random.uniform(self._operation_jitter_min, self._operation_jitter_max)
        time.sleep(delay)

    def _exponential_backoff(self, attempt: int) -> None:
        wait_time = (self._backoff_base ** attempt) + random.uniform(0, 1)
        time.sleep(wait_time)

    def _save_screenshot(self, prefix: str, sample_id: Optional[str] = None) -> str:
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        sample_part = f"_{sample_id}" if sample_id else ""
        filename = f"{prefix}_{self.instrument_id}{sample_part}_{timestamp}.png"
        filepath = self._audit_dir / filename
        screenshot = pyautogui.screenshot()
        screenshot.save(str(filepath))
        return str(filepath)

    def locate_window(self) -> bool:
        for attempt in range(self._max_retry):
            try:
                if self._try_locate_window():
                    logger.success(f"[{self.instrument_id}] 窗口定位成功: {self.window_info}")
                    return True
            except Exception as e:
                logger.warning(f"[{self.instrument_id}] 窗口定位第{attempt+1}次尝试失败: {e}")
            self._exponential_backoff(attempt)
        self._save_screenshot("window_locate_failed")
        logger.error(f"[{self.instrument_id}] 窗口定位失败，已保存截图")
        self.status = InstrumentStatus.ERROR
        return False

    def _try_locate_window(self) -> bool:
        template_path = self.config.get("window_template", "")
        window_title = self.config.get("window_title", "")

        if template_path and os.path.exists(template_path):
            result = self._template_match_fullscreen(template_path)
            if result:
                x, y, w, h = result
                self.window_info = WindowInfo(left=x, top=y, width=w, height=h)
                return True

        if _HAS_WIN32 and sys.platform == "win32":
            try:
                hwnd = win32gui.FindWindow(None, window_title)
                if hwnd:
                    left, top, right, bottom = win32gui.GetWindowRect(hwnd)
                    self.window_info = WindowInfo(
                        left=left, top=top,
                        width=right - left, height=bottom - top,
                        handle=hwnd
                    )
                    self._restore_window(hwnd)
                    return True
            except Exception as e:
                logger.warning(f"[{self.instrument_id}] win32 窗口定位异常: {e}")

        logger.warning(f"[{self.instrument_id}] 模板和标题均无法定位窗口，尝试全屏搜索")
        return False

    def _restore_window(self, hwnd: Any) -> None:
        if _HAS_WIN32 and sys.platform == "win32":
            try:
                placement = win32gui.GetWindowPlacement(hwnd)
                if placement[1] == win32con.SW_SHOWMINIMIZED:
                    win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                    time.sleep(0.5)
                win32gui.SetForegroundWindow(hwnd)
                time.sleep(0.3)
            except Exception as e:
                logger.warning(f"[{self.instrument_id}] 恢复窗口异常: {e}")

    def _template_match_fullscreen(self, template_path: str, threshold: float = 0.8) -> Optional[Tuple[int, int, int, int]]:
        try:
            screenshot = pyautogui.screenshot()
            screen = cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)
            template = cv2.imread(template_path, cv2.IMREAD_COLOR)
            if template is None:
                return None

            result = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
            min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

            if max_val >= threshold:
                h, w = template.shape[:2]
                return (max_loc[0], max_loc[1], w, h)
            return None
        except Exception as e:
            logger.warning(f"[{self.instrument_id}] 模板匹配异常: {e}")
            return None

    def _find_template_in_window(self, template_path: str, threshold: float = 0.8) -> Optional[Tuple[int, int, int, int]]:
        if not self.window_info:
            return None
        try:
            if not os.path.exists(template_path):
                return None
            screenshot = pyautogui.screenshot(region=(
                self.window_info.left, self.window_info.top,
                self.window_info.width, self.window_info.height
            ))
            screen = cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)
            template = cv2.imread(template_path, cv2.IMREAD_COLOR)
            if template is None:
                return None

            result = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
            min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

            if max_val >= threshold:
                h, w = template.shape[:2]
                abs_x = self.window_info.left + max_loc[0]
                abs_y = self.window_info.top + max_loc[1]
                return (abs_x, abs_y, w, h)
            return None
        except Exception as e:
            logger.warning(f"[{self.instrument_id}] 窗口内模板匹配异常: {e}")
            return None

    def _click(self, x: int, y: int) -> None:
        self._jitter()
        pyautogui.moveTo(x, y, duration=random.uniform(0.1, 0.3))
        pyautogui.click()
        self._jitter()

    def _click_template(self, template_cfg: Dict[str, Any], description: str) -> bool:
        template_path = template_cfg.get("template", "")
        fallback = template_cfg.get("fallback_coords")

        for attempt in range(self._max_retry):
            result = self._find_template_in_window(template_path)
            if result:
                x, y, w, h = result
                self._click(x + w // 2, y + h // 2)
                logger.debug(f"[{self.instrument_id}] {description} (模板定位)")
                return True
            elif fallback and self.window_info:
                abs_x = self.window_info.left + fallback[0]
                abs_y = self.window_info.top + fallback[1]
                self._click(abs_x, abs_y)
                logger.debug(f"[{self.instrument_id}] {description} (回退坐标)")
                return True
            self._exponential_backoff(attempt)
        return False

    def activate_window(self) -> bool:
        if not self.locate_window():
            return False
        if _HAS_WIN32 and self.window_info and self.window_info.handle and sys.platform == "win32":
            try:
                win32gui.SetForegroundWindow(self.window_info.handle)
                time.sleep(0.5)
                return True
            except Exception as e:
                logger.warning(f"[{self.instrument_id}] 激活窗口异常: {e}")
        if self.window_info:
            self._click(
                self.window_info.left + self.window_info.width // 2,
                self.window_info.top + 10
            )
            return True
        return False

    def navigate_to_measurement(self) -> bool:
        if not self.activate_window():
            return False

        nav_sequence = self.config.get("nav_sequence", [])
        for step in nav_sequence:
            action = step.get("action")
            desc = step.get("description", "")
            if action == "click":
                template_info = {
                    "template": step.get("template", ""),
                    "fallback_coords": step.get("fallback_coords")
                }
                if not self._click_template(template_info, desc):
                    logger.error(f"[{self.instrument_id}] 导航步骤失败: {desc}")
                    self._save_screenshot("navigate_failed", self.current_sample)
                    return False
        return True

    def input_sample_id(self, sample_id: str) -> bool:
        input_cfg = self.config.get("sample_id_input", {})
        template_info = {
            "template": input_cfg.get("template", ""),
            "fallback_coords": input_cfg.get("fallback_coords")
        }

        for attempt in range(self._max_retry):
            result = self._find_template_in_window(template_info["template"])
            if result:
                x, y, w, h = result
                self._click(x + w // 2, y + h // 2)
            elif template_info.get("fallback_coords") and self.window_info:
                abs_x = self.window_info.left + template_info["fallback_coords"][0]
                abs_y = self.window_info.top + template_info["fallback_coords"][1]
                self._click(abs_x, abs_y)
            else:
                self._exponential_backoff(attempt)
                continue

            time.sleep(0.2)
            pyautogui.hotkey("ctrl", "a")
            time.sleep(0.1)
            pyautogui.typewrite(sample_id, interval=random.uniform(0.05, 0.15))
            time.sleep(0.3)
            return True

        logger.error(f"[{self.instrument_id}] 输入样品编号失败: {sample_id}")
        self._save_screenshot("input_failed", sample_id)
        return False

    def start_measurement(self) -> bool:
        btn_cfg = self.config.get("measure_button", {})
        template_info = {
            "template": btn_cfg.get("template", ""),
            "fallback_coords": btn_cfg.get("fallback_coords")
        }

        for attempt in range(self._max_retry):
            if self._click_template(template_info, "触发测量"):
                logger.info(f"[{self.instrument_id}] 已触发测量: {self.current_sample}")
                return True
            self._exponential_backoff(attempt)

        logger.error(f"[{self.instrument_id}] 触发测量按钮失败")
        self._save_screenshot("measure_start_failed", self.current_sample)
        return False

    def wait_for_completion(self, timeout: Optional[int] = None) -> bool:
        timeout = timeout or self.global_config.get("measurement_timeout", 120)
        status_cfg = self.config.get("status_indicator", {})
        ready_roi = status_cfg.get("ready_roi", [])
        ready_color = status_cfg.get("ready_color", [0, 200, 0])
        color_tolerance = status_cfg.get("color_tolerance", 40)

        if not ready_roi or not self.window_info:
            logger.warning(f"[{self.instrument_id}] 无状态指示灯配置，使用固定等待")
            time.sleep(timeout * 0.8)
            return True

        abs_roi = (
            self.window_info.left + ready_roi[0],
            self.window_info.top + ready_roi[1],
            ready_roi[2],
            ready_roi[3]
        )

        start_time = time.time()
        check_count = 0
        while time.time() - start_time < timeout:
            try:
                check_count += 1
                roi_img = pyautogui.screenshot(region=abs_roi)
                roi_array = np.array(roi_img)
                avg_color = np.mean(roi_array.reshape(-1, 3), axis=0)

                distance = np.sqrt(np.sum((avg_color - np.array(ready_color)) ** 2))
                if distance <= color_tolerance:
                    elapsed = time.time() - start_time
                    logger.info(f"[{self.instrument_id}] 测量完成，耗时{elapsed:.1f}s，检测{check_count}次")
                    return True
            except Exception as e:
                logger.warning(f"[{self.instrument_id}] 状态检测异常: {e}")

            if self._detect_error_dialog():
                logger.error(f"[{self.instrument_id}] 检测到错误弹窗")
                self._save_screenshot("error_dialog", self.current_sample)
                self._dismiss_dialog()
                return False

            time.sleep(2.0)

        logger.error(f"[{self.instrument_id}] 测量超时 ({timeout}s)")
        self._save_screenshot("timeout", self.current_sample)
        return False

    def _detect_error_dialog(self) -> bool:
        try:
            dialog_templates = [
                "templates/dialog_error.png",
                "templates/dialog_warning.png",
                "templates/dialog_confirm.png",
            ]
            for tpl in dialog_templates:
                if os.path.exists(tpl) and self._find_template_in_window(tpl, threshold=0.75):
                    return True
            return False
        except Exception:
            return False

    def _dismiss_dialog(self) -> None:
        try:
            time.sleep(0.3)
            pyautogui.press("enter")
            time.sleep(0.5)
            pyautogui.press("esc")
            time.sleep(0.3)
        except Exception:
            pass

    def capture_result_region(self) -> Optional[np.ndarray]:
        result_cfg = self.config.get("result_region", {})
        roi = result_cfg.get("roi", [])
        if not roi or not self.window_info:
            logger.error(f"[{self.instrument_id}] 结果区域ROI未配置")
            return None

        abs_roi = (
            self.window_info.left + roi[0],
            self.window_info.top + roi[1],
            roi[2],
            roi[3]
        )

        for attempt in range(self._max_retry):
            try:
                screenshot = pyautogui.screenshot(region=abs_roi)
                img_array = cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)

                timestamp = time.strftime("%Y%m%d_%H%M%S")
                raw_filename = f"result_raw_{self.instrument_id}_{self.current_sample}_{timestamp}.png"
                raw_path = self._audit_dir / raw_filename
                cv2.imwrite(str(raw_path), img_array)

                logger.debug(f"[{self.instrument_id}] 结果区域截图已保存: {raw_filename}")
                return img_array
            except Exception as e:
                logger.warning(f"[{self.instrument_id}] 截取结果区域第{attempt+1}次失败: {e}")
                self._exponential_backoff(attempt)

        return None

    def run_measurement(self, sample_id: str) -> Optional[np.ndarray]:
        with self._lock:
            self.status = InstrumentStatus.BUSY
            self.current_sample = sample_id

        try:
            logger.info(f"[{self.instrument_id}] 开始测量样品: {sample_id}")

            if not self.navigate_to_measurement():
                raise Exception("导航至测量界面失败")

            if not self.input_sample_id(sample_id):
                raise Exception("输入样品编号失败")

            if not self.start_measurement():
                raise Exception("触发测量失败")

            if not self.wait_for_completion():
                raise Exception("等待测量完成失败或超时")

            result_img = self.capture_result_region()
            if result_img is None:
                raise Exception("截取结果区域失败")

            logger.success(f"[{self.instrument_id}] 样品 {sample_id} 测量完成")
            return result_img

        except Exception as e:
            logger.error(f"[{self.instrument_id}] 样品 {sample_id} 测量异常: {e}")
            self._save_screenshot("measurement_exception", sample_id)
            self.status = InstrumentStatus.ERROR
            return None
        finally:
            self.status = InstrumentStatus.IDLE if self.status != InstrumentStatus.ERROR else self.status
            self.current_sample = None

    def reset(self) -> None:
        with self._lock:
            self.status = InstrumentStatus.IDLE
            self.current_sample = None
            self.window_info = None
            logger.info(f"[{self.instrument_id}] 状态已重置")
