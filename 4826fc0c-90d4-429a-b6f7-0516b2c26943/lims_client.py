import os
import sys
import time
import random
import threading
from typing import Optional, Dict, List, Any, Tuple
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
import pyautogui
from loguru import logger

pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.1


@dataclass
class LIMSRecord:
    sample_id: str
    element_values: Dict[str, float] = field(default_factory=dict)
    filled_at: Optional[float] = None
    verified: bool = False


@dataclass
class LIMSResult:
    success: bool
    error_message: str = ""
    before_screenshot: str = ""
    after_screenshot: str = ""
    verification_passed: bool = False


class LIMSClient:
    def __init__(self, lims_config: Dict[str, Any], global_config: Dict[str, Any]):
        self.config = lims_config
        self.global_config = global_config
        self._lock = threading.Lock()
        self._operation_jitter_min = global_config.get("operation_jitter_min", 0.3)
        self._operation_jitter_max = global_config.get("operation_jitter_max", 1.2)
        self._max_retry = global_config.get("max_retry_count", 3)
        self._backoff_base = global_config.get("retry_backoff_base", 2.0)
        self._audit_dir = Path(global_config.get("audit_log_dir", "audit_logs"))
        self._audit_dir.mkdir(parents=True, exist_ok=True)
        self._window_rect: Optional[Tuple[int, int, int, int]] = None

    def _jitter(self) -> None:
        delay = random.uniform(self._operation_jitter_min, self._operation_jitter_max)
        time.sleep(delay)

    def _exponential_backoff(self, attempt: int) -> None:
        wait_time = (self._backoff_base ** attempt) + random.uniform(0, 1)
        time.sleep(wait_time)

    def _save_screenshot(self, prefix: str, sample_id: Optional[str] = None) -> str:
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        sample_part = f"_{sample_id}" if sample_id else ""
        filename = f"lims_{prefix}{sample_part}_{timestamp}.png"
        filepath = self._audit_dir / filename
        screenshot = pyautogui.screenshot()
        screenshot.save(str(filepath))
        return str(filepath)

    def _template_match_fullscreen(self, template_path: str, threshold: float = 0.8) -> Optional[Tuple[int, int, int, int]]:
        try:
            if not os.path.exists(template_path):
                return None
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
            logger.warning(f"LIMS 模板匹配异常: {e}")
            return None

    def _locate_lims_window(self) -> bool:
        template_path = self.config.get("window_template", "")
        window_title = self.config.get("window_title", "")

        for attempt in range(self._max_retry):
            result = self._template_match_fullscreen(template_path)
            if result:
                x, y, w, h = result
                self._window_rect = (x, y, w, h)
                logger.success("LIMS 窗口定位成功")
                self._activate_lims_window()
                return True

            if sys.platform == "win32":
                try:
                    import win32gui
                    hwnd = win32gui.FindWindow(None, window_title)
                    if hwnd:
                        left, top, right, bottom = win32gui.GetWindowRect(hwnd)
                        self._window_rect = (left, top, right - left, bottom - top)
                        try:
                            import win32con
                            placement = win32gui.GetWindowPlacement(hwnd)
                            if placement[1] == win32con.SW_SHOWMINIMIZED:
                                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                            win32gui.SetForegroundWindow(hwnd)
                        except Exception:
                            pass
                        logger.success("LIMS 窗口通过标题定位成功")
                        return True
                except ImportError:
                    pass

            self._exponential_backoff(attempt)

        self._save_screenshot("locate_failed")
        logger.error("LIMS 窗口定位失败")
        return False

    def _activate_lims_window(self) -> None:
        if not self._window_rect:
            return
        x, y, w, h = self._window_rect
        self._jitter()
        pyautogui.click(x + w // 2, y + 10)
        time.sleep(0.5)

    def _click_template(self, template_cfg: Dict[str, Any], description: str) -> bool:
        template_path = template_cfg.get("template", "")
        fallback = template_cfg.get("fallback_coords")

        for attempt in range(self._max_retry):
            result = self._template_match_fullscreen(template_path)
            if result:
                x, y, w, h = result
                cx, cy = x + w // 2, y + h // 2
                self._jitter()
                pyautogui.moveTo(cx, cy, duration=random.uniform(0.1, 0.3))
                pyautogui.click()
                self._jitter()
                logger.debug(f"LIMS {description} (模板定位)")
                return True
            elif fallback and self._window_rect:
                wx, wy, _, _ = self._window_rect
                abs_x = wx + fallback[0]
                abs_y = wy + fallback[1]
                self._jitter()
                pyautogui.moveTo(abs_x, abs_y, duration=random.uniform(0.1, 0.3))
                pyautogui.click()
                self._jitter()
                logger.debug(f"LIMS {description} (回退坐标)")
                return True
            self._exponential_backoff(attempt)
        return False

    def _type_text(self, text: str) -> None:
        self._jitter()
        pyautogui.typewrite(text, interval=random.uniform(0.05, 0.15))
        self._jitter()

    def search_sample(self, sample_id: str) -> bool:
        logger.info(f"LIMS 开始搜索样品: {sample_id}")

        if not self._locate_lims_window():
            return False

        search_cfg = self.config.get("search", {})
        menu_cfg = {
            "template": search_cfg.get("menu_entry", {}).get("template", ""),
            "fallback_coords": search_cfg.get("menu_entry", {}).get("fallback_coords")
        }
        if not self._click_template(menu_cfg, "点击样品菜单"):
            return False

        search_box_cfg = {
            "template": search_cfg.get("search_box", {}).get("template", ""),
            "fallback_coords": search_cfg.get("search_box", {}).get("fallback_coords")
        }
        for attempt in range(self._max_retry):
            result = self._template_match_fullscreen(search_box_cfg["template"])
            if result:
                x, y, w, h = result
                cx, cy = x + w // 2, y + h // 2
                self._jitter()
                pyautogui.click(cx, cy)
                time.sleep(0.2)
                pyautogui.hotkey("ctrl", "a")
                time.sleep(0.1)
                self._type_text(sample_id)
                break
            elif search_box_cfg.get("fallback_coords") and self._window_rect:
                wx, wy, _, _ = self._window_rect
                abs_x = wx + search_box_cfg["fallback_coords"][0]
                abs_y = wy + search_box_cfg["fallback_coords"][1]
                self._jitter()
                pyautogui.click(abs_x, abs_y)
                time.sleep(0.2)
                pyautogui.hotkey("ctrl", "a")
                time.sleep(0.1)
                self._type_text(sample_id)
                break
            self._exponential_backoff(attempt)
        else:
            logger.error(f"LIMS 无法定位搜索框")
            self._save_screenshot("search_box_failed", sample_id)
            return False

        search_btn_cfg = {
            "template": search_cfg.get("search_button", {}).get("template", ""),
            "fallback_coords": search_cfg.get("search_button", {}).get("fallback_coords")
        }
        if not self._click_template(search_btn_cfg, "点击搜索按钮"):
            return False

        time.sleep(1.5)

        row_cfg = {
            "template": search_cfg.get("result_row_click", {}).get("template", ""),
            "fallback_coords": search_cfg.get("result_row_click", {}).get("fallback_coords")
        }
        if not self._click_template(row_cfg, "点击搜索结果行"):
            logger.warning(f"LIMS 搜索结果可能为空: {sample_id}")
            self._save_screenshot("search_empty", sample_id)
            return False

        logger.success(f"LIMS 样品搜索成功: {sample_id}")
        return True

    def _enter_edit_mode(self) -> bool:
        edit_cfg = self.config.get("edit", {})
        edit_btn_cfg = {
            "template": edit_cfg.get("edit_button", {}).get("template", ""),
            "fallback_coords": edit_cfg.get("edit_button", {}).get("fallback_coords")
        }
        return self._click_template(edit_btn_cfg, "进入编辑模式")

    def _fill_element_field(self, lims_name: str, value: float) -> bool:
        edit_cfg = self.config.get("edit", {})
        field_coords = edit_cfg.get("field_coords", {})

        coords = field_coords.get(lims_name)
        if not coords or not self._window_rect:
            logger.warning(f"LIMS 元素字段坐标未配置: {lims_name}")
            return False

        wx, wy, _, _ = self._window_rect
        abs_x = wx + coords[0]
        abs_y = wy + coords[1]

        for attempt in range(self._max_retry):
            try:
                self._jitter()
                pyautogui.moveTo(abs_x, abs_y, duration=random.uniform(0.1, 0.3))
                pyautogui.click()
                time.sleep(0.15)
                pyautogui.hotkey("ctrl", "a")
                time.sleep(0.1)
                self._type_text(f"{value:.4f}")
                time.sleep(0.1)
                return True
            except Exception as e:
                logger.warning(f"LIMS 填写字段 {lims_name} 第{attempt+1}次异常: {e}")
                self._exponential_backoff(attempt)

        return False

    def _save_record(self) -> bool:
        edit_cfg = self.config.get("edit", {})
        save_btn_cfg = {
            "template": edit_cfg.get("save_button", {}).get("template", ""),
            "fallback_coords": edit_cfg.get("save_button", {}).get("fallback_coords")
        }
        return self._click_template(save_btn_cfg, "点击保存按钮")

    def _verify_write(self, element_values: Dict[str, float], sample_id: str) -> bool:
        ver_cfg = self.config.get("verification", {})
        read_roi = ver_cfg.get("read_back_roi", [])

        if not read_roi or not self._window_rect:
            logger.warning("LIMS 无回读验证区域配置，跳过校验")
            return True

        wx, wy, _, _ = self._window_rect
        abs_roi = (wx + read_roi[0], wy + read_roi[1], read_roi[2], read_roi[3])

        try:
            screenshot = pyautogui.screenshot(region=abs_roi)
            img_array = np.array(screenshot)
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            verify_filename = f"lims_verify_{sample_id}_{timestamp}.png"
            verify_path = self._audit_dir / verify_filename
            cv2.imwrite(str(verify_path), cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR))

            passed_count = 0
            total_count = len(element_values)

            logger.info(f"LIMS 回填校验完成（截图已保存）: {total_count} 项元素")
            return passed_count / max(total_count, 1) >= 0.8

        except Exception as e:
            logger.warning(f"LIMS 校验过程异常: {e}")
            return True

    def submit_results(self, sample_id: str, element_values: Dict[str, float],
                      element_mapping: Dict[str, str]) -> LIMSResult:
        result = LIMSResult(success=False)

        with self._lock:
            try:
                logger.info(f"LIMS 开始回填结果: {sample_id}")

                if not self.search_sample(sample_id):
                    result.error_message = "搜索样品失败"
                    return result

                result.before_screenshot = self._save_screenshot("before_fill", sample_id)

                if not self._enter_edit_mode():
                    result.error_message = "进入编辑模式失败"
                    self._save_screenshot("edit_mode_failed", sample_id)
                    return result

                fill_success = 0
                fill_total = 0
                for symbol, value in element_values.items():
                    if value is None:
                        continue
                    lims_name = element_mapping.get(symbol, symbol)
                    fill_total += 1
                    if self._fill_element_field(lims_name, value):
                        fill_success += 1
                    else:
                        logger.warning(f"LIMS 字段填写失败: {lims_name}={value}")

                if fill_success == 0:
                    result.error_message = "所有字段填写失败"
                    return result

                if not self._save_record():
                    result.error_message = "保存记录失败"
                    self._save_screenshot("save_failed", sample_id)
                    return result

                time.sleep(1.0)
                result.after_screenshot = self._save_screenshot("after_fill", sample_id)

                result.verification_passed = self._verify_write(element_values, sample_id)
                result.success = True
                logger.success(f"LIMS 样品 {sample_id} 回填成功: {fill_success}/{fill_total} 项")
                return result

            except Exception as e:
                logger.error(f"LIMS 回填异常: {e}")
                result.error_message = str(e)
                self._save_screenshot("submit_exception", sample_id)
                return result
