from __future__ import annotations

import subprocess
import time
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np
import pyautogui
from loguru import logger
from PIL import Image

pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.05


@dataclass
class CaptureRegion:
    x: int
    y: int
    width: int
    height: int


class ScreenCapture:
    def __init__(self, template_cache: Optional[dict] = None):
        self._window_cache: dict[str, dict] = {}
        self._template_cache: dict[str, np.ndarray] = template_cache or {}

    def _load_template(self, template_path: str) -> Optional[np.ndarray]:
        if template_path in self._template_cache:
            return self._template_cache[template_path]
        try:
            template = cv2.imread(template_path, cv2.IMREAD_COLOR)
            if template is not None:
                self._template_cache[template_path] = template
                logger.debug(f"Template loaded: {template_path}")
            else:
                logger.warning(f"Template image not found: {template_path}")
            return template
        except Exception as e:
            logger.error(f"Failed to load template {template_path}: {e}")
            return None

    def _find_window_by_template(
        self, template_path: str, monitor_index: int = 0
    ) -> Optional[dict]:
        template = self._load_template(template_path)
        if template is None:
            return None

        monitors = self._get_monitors()
        if monitor_index >= len(monitors):
            logger.error(f"Monitor index {monitor_index} out of range")
            return None

        monitor = monitors[monitor_index]
        screenshot = pyautogui.screenshot(region=(
            monitor["left"], monitor["top"],
            monitor["width"], monitor["height"],
        ))
        screenshot_np = cv2.cvtColor(
            np.array(screenshot), cv2.COLOR_RGB2BGR
        )

        result = cv2.matchTemplate(
            screenshot_np, template, cv2.TM_CCOEFF_NORMED
        )
        _, max_val, _, max_loc = cv2.minMaxLoc(result)

        if max_val < 0.7:
            logger.warning(
                f"Template match confidence too low: {max_val:.2f}"
            )
            return None

        th, tw = template.shape[:2]
        abs_x = monitor["left"] + max_loc[0]
        abs_y = monitor["top"] + max_loc[1]

        window_info = {
            "left": abs_x,
            "top": abs_y,
            "width": tw,
            "height": th,
            "confidence": max_val,
        }
        logger.debug(
            f"Window found at ({abs_x}, {abs_y}) confidence={max_val:.2f}"
        )
        return window_info

    def _get_monitors(self) -> list[dict]:
        import screeninfo
        monitors = []
        for m in screeninfo.get_monitors():
            monitors.append({
                "left": m.x,
                "top": m.y,
                "width": m.width,
                "height": m.height,
            })
        if not monitors:
            monitors.append({
                "left": 0, "top": 0,
                "width": pyautogui.size().width,
                "height": pyautogui.size().height,
            })
        return monitors

    def focus_window(self, window_title: str) -> bool:
        try:
            script = f'''
            tell application "System Events"
                set frontmost of every process whose name contains "{window_title}" to true
            end tell
            '''
            subprocess.run(
                ["osascript", "-e", script],
                capture_output=True, timeout=5,
            )
            time.sleep(0.3)
            logger.debug(f"Focused window: {window_title}")
            return True
        except Exception as e:
            logger.warning(f"Failed to focus window '{window_title}': {e}")
            try:
                self._focus_window_pyaudio(window_title)
                return True
            except Exception:
                return False

    def _focus_window_pyaudio(self, window_title: str) -> bool:
        try:
            windows = pyautogui.getWindowsWithTitle(window_title)
            if windows:
                windows[0].activate()
                time.sleep(0.3)
                return True
        except Exception as e:
            logger.warning(f"pyautogui focus failed for '{window_title}': {e}")
        return False

    def capture_region(
        self,
        region: CaptureRegion,
        window_title: Optional[str] = None,
        template_path: Optional[str] = None,
        monitor_index: int = 0,
    ) -> Optional[np.ndarray]:
        offset_x, offset_y = 0, 0

        if window_title:
            self.focus_window(window_title)

        if template_path:
            window_info = self._find_window_by_template(
                template_path, monitor_index
            )
            if window_info is not None:
                offset_x = window_info["left"]
                offset_y = window_info["top"]
                self._window_cache[window_title or template_path] = window_info
            else:
                cached = self._window_cache.get(window_title or template_path)
                if cached:
                    offset_x = cached["left"]
                    offset_y = cached["top"]
                    logger.info("Using cached window position")
                else:
                    logger.error("Cannot locate window, falling back to absolute coords")

        abs_x = offset_x + region.x
        abs_y = offset_y + region.y

        try:
            screenshot = pyautogui.screenshot(region=(
                abs_x, abs_y, region.width, region.height,
            ))
            img_np = cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)
            logger.debug(
                f"Captured region ({abs_x},{abs_y}) "
                f"{region.width}x{region.height}"
            )
            return img_np
        except Exception as e:
            logger.error(f"Screenshot capture failed: {e}")
            return None

    def capture_full_monitor(self, monitor_index: int = 0) -> Optional[np.ndarray]:
        monitors = self._get_monitors()
        if monitor_index >= len(monitors):
            return None
        m = monitors[monitor_index]
        try:
            screenshot = pyautogui.screenshot(region=(
                m["left"], m["top"], m["width"], m["height"],
            ))
            return cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)
        except Exception as e:
            logger.error(f"Full monitor capture failed: {e}")
            return None

    def save_capture(self, image: np.ndarray, filepath: str) -> bool:
        try:
            cv2.imwrite(filepath, image)
            return True
        except Exception as e:
            logger.error(f"Failed to save capture: {e}")
            return False
