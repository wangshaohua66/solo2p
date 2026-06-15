import os
import time
import logging
from typing import Optional, Tuple, Dict, Any
from pathlib import Path

import cv2
import numpy as np
import pyautogui
from PIL import ImageGrab, Image

logger = logging.getLogger(__name__)


class ScreenCapture:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.calibration: Dict[str, Any] = {}
        self._load_calibration()
        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.1

    def _load_calibration(self) -> None:
        calib_file = self.config.get("calibration", {}).get("calibration_file", "calibration.json")
        if os.path.exists(calib_file):
            try:
                import json
                with open(calib_file, "r", encoding="utf-8") as f:
                    self.calibration = json.load(f)
                logger.info(f"已加载校准数据: {calib_file}")
            except Exception as e:
                logger.warning(f"加载校准数据失败: {e}")

    def _save_calibration(self) -> None:
        if not self.config.get("calibration", {}).get("save_calibration", True):
            return
        calib_file = self.config.get("calibration", {}).get("calibration_file", "calibration.json")
        try:
            import json
            with open(calib_file, "w", encoding="utf-8") as f:
                json.dump(self.calibration, f, ensure_ascii=False, indent=2)
            logger.info(f"已保存校准数据: {calib_file}")
        except Exception as e:
            logger.warning(f"保存校准数据失败: {e}")

    def auto_calibrate(self) -> bool:
        if not self.config.get("calibration", {}).get("auto_detect", True):
            return True

        logger.info("开始自动校准窗口坐标...")
        systems_config = self.config.get("systems", {})

        for sys_name, sys_cfg in systems_config.items():
            window_title = sys_cfg.get("window_title", "")
            try:
                win = self._find_window_by_title(window_title)
                if win:
                    self.calibration[sys_name] = {
                        "x": win.left,
                        "y": win.top,
                        "width": win.width,
                        "height": win.height,
                        "detected_at": time.time()
                    }
                    logger.info(f"系统 [{sys_name}] 窗口已定位: ({win.left}, {win.top}) {win.width}x{win.height}")
                else:
                    logger.warning(f"未找到系统 [{sys_name}] 窗口: {window_title}")
                    self.calibration[sys_name] = {
                        "x": 0,
                        "y": 0,
                        "width": 0,
                        "height": 0,
                        "detected_at": 0
                    }
            except Exception as e:
                logger.error(f"校准系统 [{sys_name}] 失败: {e}")

        self._save_calibration()
        return True

    def _find_window_by_title(self, title_keyword: str) -> Optional[Any]:
        try:
            for win in pyautogui.getAllWindows():
                if title_keyword and title_keyword in (win.title or ""):
                    return win
            return None
        except Exception as e:
            logger.error(f"查找窗口失败 [{title_keyword}]: {e}")
            return None

    def activate_window(self, system_name: str) -> bool:
        sys_cfg = self.config.get("systems", {}).get(system_name, {})
        window_title = sys_cfg.get("window_title", "")
        if not window_title:
            return False

        calib = self.calibration.get(system_name, {})
        try:
            win = self._find_window_by_title(window_title)
            if win:
                try:
                    win.activate()
                except Exception:
                    pass
                try:
                    win.maximize()
                except Exception:
                    pass
                time.sleep(0.3)
                pyautogui.click(
                    calib.get("x", 0) + 50,
                    calib.get("y", 0) + 50
                )
                time.sleep(0.2)
                return True
        except Exception as e:
            logger.error(f"激活窗口失败 [{system_name}]: {e}")
        return False

    def capture_region(self, region: Dict[str, int], system_name: Optional[str] = None) -> Optional[np.ndarray]:
        x, y = region.get("x", 0), region.get("y", 0)
        w, h = region.get("width", 0), region.get("height", 0)

        if system_name and system_name in self.calibration:
            calib = self.calibration[system_name]
            x += calib.get("x", 0)
            y += calib.get("y", 0)

        try:
            bbox = (x, y, x + w, y + h)
            screenshot = ImageGrab.grab(bbox=bbox)
            if screenshot is None:
                return None
            frame = cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)
            return frame
        except Exception as e:
            logger.error(f"区域截屏失败 ({x},{y},{w},{h}): {e}")
            return None

    def capture_full_screen(self) -> Optional[np.ndarray]:
        try:
            screenshot = ImageGrab.grab()
            if screenshot is None:
                return None
            frame = cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)
            return frame
        except Exception as e:
            logger.error(f"全屏截屏失败: {e}")
            return None

    def save_screenshot(self, frame: np.ndarray, prefix: str = "capture",
                        subdir: str = "") -> Optional[str]:
        if frame is None:
            return None

        screenshot_dir = self.config.get("logging", {}).get("screenshot_dir", "screenshots")
        if subdir:
            save_dir = os.path.join(screenshot_dir, subdir)
        else:
            save_dir = screenshot_dir
        Path(save_dir).mkdir(parents=True, exist_ok=True)

        timestamp = time.strftime("%Y%m%d_%H%M%S")
        filename = f"{prefix}_{timestamp}_{int(time.time() * 1000) % 1000}.png"
        filepath = os.path.join(save_dir, filename)

        try:
            cv2.imwrite(filepath, frame)
            logger.debug(f"截图已保存: {filepath}")
            return filepath
        except Exception as e:
            logger.error(f"保存截图失败: {e}")
            return None

    @staticmethod
    def preprocess_ocr(frame: np.ndarray, threshold: int = 180,
                       blur_kernel: int = 3, denoise: int = 10) -> np.ndarray:
        if frame is None or frame.size == 0:
            return frame

        if len(frame.shape) == 3:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        else:
            gray = frame.copy()

        if denoise > 0:
            gray = cv2.fastNlMeansDenoising(gray, None, float(denoise), 7, 21)

        if blur_kernel and blur_kernel > 0:
            k = blur_kernel if blur_kernel % 2 == 1 else blur_kernel + 1
            gray = cv2.GaussianBlur(gray, (k, k), 0)

        _, binary = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

        return binary

    @staticmethod
    def preprocess_template(frame: np.ndarray) -> np.ndarray:
        if frame is None or frame.size == 0:
            return frame
        if len(frame.shape) == 3:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        else:
            gray = frame.copy()
        gray = cv2.equalizeHist(gray)
        return gray

    @staticmethod
    def crop_region(frame: np.ndarray, x: int, y: int, w: int, h: int) -> Optional[np.ndarray]:
        if frame is None:
            return None
        fh, fw = frame.shape[:2]
        x1 = max(0, x)
        y1 = max(0, y)
        x2 = min(fw, x + w)
        y2 = min(fh, y + h)
        if x2 <= x1 or y2 <= y1:
            return None
        return frame[y1:y2, x1:x2].copy()

    def get_system_absolute_region(self, system_name: str,
                                   relative_region: Dict[str, int]) -> Dict[str, int]:
        calib = self.calibration.get(system_name, {})
        offset_x = calib.get("x", 0)
        offset_y = calib.get("y", 0)
        return {
            "x": relative_region.get("x", 0) + offset_x,
            "y": relative_region.get("y", 0) + offset_y,
            "width": relative_region.get("width", 0),
            "height": relative_region.get("height", 0),
        }

    def get_absolute_click_point(self, system_name: str,
                                 rel_x: int, rel_y: int) -> Tuple[int, int]:
        calib = self.calibration.get(system_name, {})
        return calib.get("x", 0) + rel_x, calib.get("y", 0) + rel_y
