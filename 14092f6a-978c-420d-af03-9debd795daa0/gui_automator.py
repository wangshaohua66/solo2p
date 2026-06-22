"""
gui_automator.py
================================================================================
界面自动化模块：屏幕截图、模板匹配定位元素、模拟鼠标键盘操作、文件上传。

特性：
  1. OpenCV 多尺度模板匹配，自适应不同分辨率与缩放比例
  2. 元素定位失败自动截屏保存
  3. 中文文本通过剪贴板粘贴输入（_get_pyautogui().write 不支持 Unicode）
  4. 文件上传：触发系统文件对话框并填入路径
  5. 回显值读取：截取输入框区域 OCR 比对
  6. 后台静默模式：降低焦点抢占（最佳努力）
"""

from __future__ import annotations

import logging
import os
import platform
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image

logger = logging.getLogger(__name__)

_IS_MAC = platform.system() == "Darwin"
# macOS 用 Command，Windows/Linux 用 Ctrl
_MOD_KEY = "command" if _IS_MAC else "ctrl"

# GUI 依赖惰性加载，使 validate-only 模式可在无头环境中运行
_pyautogui = None
_pyperclip = None


def _get_pyautogui():
    global _pyautogui
    if _pyautogui is None:
        import pyautogui as _p
        _pyautogui = _p
        _p.FAILSAFE = True
    return _pyautogui


def _get_pyperclip():
    global _pyperclip
    if _pyperclip is None:
        import pyperclip as _p
        _pyperclip = _p
    return _pyperclip


@dataclass
class ElementLocation:
    """定位到的元素位置。"""
    name: str
    center: Tuple[int, int]
    region: Tuple[int, int, int, int]  # x, y, w, h
    confidence: float
    scale: float


class GuiAutomator:
    """屏幕自动化操作器。"""

    def __init__(self, config: Dict[str, Any], screenshot_dir: str = "./screenshots",
                 template_dir: str = "./templates",
                 metrics_callback: Optional[Callable[[str, bool, Dict[str, Any]], None]] = None) -> None:
        self.config = config
        gui_cfg: Dict[str, Any] = config.get("gui", {})
        self.confidence_threshold = float(gui_cfg.get("confidence_threshold", 0.8))
        self.locate_max_retry = int(gui_cfg.get("locate_max_retry", 3))
        self.locate_timeout = float(gui_cfg.get("locate_timeout", 10))
        self.mouse_move_duration = float(gui_cfg.get("mouse_move_duration", 0.3))
        self.key_interval = float(gui_cfg.get("key_interval", 0.05))
        self.screenshot_scale = float(gui_cfg.get("screenshot_scale", 1.0))
        self.silent_mode = bool(gui_cfg.get("silent_mode", True))
        self.upload_size_limit_mb = float(gui_cfg.get("upload_size_limit_mb", 10))
        self.upload_wait_timeout = float(gui_cfg.get("upload_wait_timeout", 60))
        self.screenshot_dir = screenshot_dir
        self.template_dir = template_dir
        # 模板图片缓存
        self._template_cache: Dict[str, "Image.Image"] = {}
        # 性能指标回调
        self._metrics_callback = metrics_callback
        # PyAutoGUI 全局安全设置（惰性初始化时设置）
        pg = _get_pyautogui()
        pg.FAILSAFE = True
        pg.PAUSE = self.key_interval
        os.makedirs(self.screenshot_dir, exist_ok=True)
        # OCR 配置（用于回显读取）
        ocr_cfg: Dict[str, Any] = config.get("ocr", {})
        self.ocr_language = ocr_cfg.get("language", "chi_sim+eng")
        self.ocr_psm = str(ocr_cfg.get("psm", 6))
        self.ocr_cmd = ocr_cfg.get("tesseract_cmd", "")

    # ---------------------------- 元素定位 ----------------------------

    def locate(self, template_name: str, confidence: Optional[float] = None,
               multi_scale: bool = True) -> Optional[ElementLocation]:
        """定位界面元素。

        Args:
            template_name: config.templates 中的键名或模板图片文件名
            confidence: 置信度阈值，None 使用默认
            multi_scale: 是否启用多尺度匹配（分辨率自适应）
        """
        threshold = confidence if confidence is not None else self.confidence_threshold
        template_path = self._resolve_template_path(template_name)
        if template_path is None:
            logger.error("模板图片未找到：%s", template_name)
            self.save_failure_screenshot(f"no_template_{template_name}")
            return None
        template = self._load_template(template_path)
        if template is None:
            return None

        scales = [1.0]
        if multi_scale:
            # 常见缩放比例探测
            scales = [0.75, 0.9, 1.0, 1.1, 1.25, 1.5]
        best: Optional[ElementLocation] = None
        screen = self._grab_screen()
        for scale in scales:
            loc = self._match_at_scale(screen, template, template_name, scale, threshold)
            if loc is not None:
                if best is None or loc.confidence > best.confidence:
                    best = loc
                # 高置信度直接命中，跳过其余尺度
                if loc.confidence >= max(threshold + 0.1, 0.95):
                    break
        if best is None:
            logger.warning("元素定位失败：%s（置信度阈值 %.2f）", template_name, threshold)
            self.save_failure_screenshot(f"locate_fail_{template_name}")
            self._track_metrics("element_locate", False,
                                {"template": template_name, "threshold": threshold})
        else:
            logger.debug("定位 %s 成功：中心=%s 置信=%.2f 尺度=%.2f",
                         template_name, best.center, best.confidence, best.scale)
            self._track_metrics("element_locate", True,
                                {"template": template_name, "confidence": best.confidence,
                                 "scale": best.scale})
        return best

    def locate_or_raise(self, template_name: str,
                        confidence: Optional[float] = None) -> ElementLocation:
        """定位元素，失败抛出 ElementNotFoundError。"""
        loc = self.locate(template_name, confidence=confidence)
        if loc is None:
            raise ElementNotFoundError(f"无法定位元素：{template_name}")
        return loc

    def wait_for_element(self, template_name: str, timeout: Optional[float] = None
                         ) -> Optional[ElementLocation]:
        """轮询等待元素出现。"""
        timeout = timeout if timeout is not None else self.locate_timeout
        deadline = time.time() + timeout
        attempt = 0
        while time.time() < deadline:
            attempt += 1
            loc = self.locate(template_name)
            if loc is not None:
                return loc
            time.sleep(0.5)
        logger.warning("等待元素超时：%s（尝试 %d 次）", template_name, attempt)
        return None

    # ---------------------------- 鼠标键盘操作 ----------------------------

    def click_element(self, template_name: str, confidence: Optional[float] = None,
                       clicks: int = 1, button: str = "left",
                       wait_after: float = 0.3) -> bool:
        """定位并点击元素。"""
        loc = self.locate(template_name, confidence=confidence)
        if loc is None:
            return False
        self.click_point(loc.center, clicks=clicks, button=button, wait_after=wait_after)
        return True

    def click_point(self, point: Tuple[int, int], clicks: int = 1,
                     button: str = "left", wait_after: float = 0.3) -> None:
        """点击指定坐标。"""
        self._move_to(point)
        _get_pyautogui().click(clicks=clicks, button=button,
                        _pause=False)
        time.sleep(wait_after)

    def double_click_element(self, template_name: str,
                              confidence: Optional[float] = None) -> bool:
        loc = self.locate(template_name, confidence=confidence)
        if loc is None:
            return False
        self.click_point(loc.center, clicks=2)
        return True

    def move_to_element(self, template_name: str) -> bool:
        loc = self.locate(template_name)
        if loc is None:
            return False
        self._move_to(loc.center)
        return True

    def type_text(self, text: str, clear_first: bool = True,
                  use_clipboard: bool = True) -> None:
        """输入文本。中文/特殊字符使用剪贴板粘贴。"""
        if not text:
            return
        if clear_first:
            self.clear_field()
        if use_clipboard and not text.isascii():
            _get_pyperclip().copy(str(text))
            time.sleep(0.05)
            self._paste()
        else:
            # ASCII 文本直接键入
            safe = str(text)
            _get_pyautogui().write(safe, interval=self.key_interval)

    def press_key(self, key: str) -> None:
        _get_pyautogui().press(key)

    def press_hotkey(self, *keys: str) -> None:
        _get_pyautogui().hotkey(*keys)

    def clear_field(self) -> None:
        """清空当前输入框内容。"""
        self.press_hotkey(_MOD_KEY, "a")
        time.sleep(0.02)
        _get_pyautogui().press("delete")

    def select_dropdown(self, template_name: str, option_text: str) -> bool:
        """选择下拉菜单选项：点击下拉框→输入选项文本→回车。"""
        if not self.click_element(template_name):
            return False
        time.sleep(0.3)
        self.type_text(option_text, clear_first=False)
        time.sleep(0.2)
        _get_pyautogui().press("enter")
        return True

    # ---------------------------- 文件上传 ----------------------------

    def upload_file(self, template_name: str, file_path: str,
                     wait_for_confirm: Optional[str] = None,
                     use_drag_drop: bool = True) -> bool:
        """上传文件：支持拖拽上传与对话框上传两种模式。

        拖拽上传模式（use_drag_drop=True，默认）：
          1. 在文件管理器中打开文件所在目录
          2. 定位并选中目标文件
          3. 按住鼠标左键拖拽至浏览器上传区域
          4. 释放鼠标完成拖拽，等待上传完成

        对话框上传模式（use_drag_drop=False）：
          点击上传按钮→在系统文件对话框中粘贴路径→回车确认

        Args:
            template_name: 浏览器中的上传区域模板名
            file_path: 本地文件绝对路径
            wait_for_confirm: 上传完成后等待出现的确认元素模板
            use_drag_drop: 是否使用拖拽上传模式
        """
        if not os.path.isfile(file_path):
            logger.error("待上传文件不存在：%s", file_path)
            return False
        size_mb = os.path.getsize(file_path) / (1024 * 1024)
        if size_mb > self.upload_size_limit_mb:
            logger.error("文件 %.2fMB 超过上传限制 %.0fMB：%s",
                         size_mb, self.upload_size_limit_mb, file_path)
            return False

        if use_drag_drop:
            ok = self._drag_drop_upload(template_name, file_path)
        else:
            ok = self._dialog_upload(template_name, file_path)

        if not ok:
            logger.warning("上传操作失败：%s", file_path)
            return False

        if wait_for_confirm:
            loc = self.wait_for_element(wait_for_confirm, timeout=self.upload_wait_timeout)
            if loc is None:
                logger.warning("上传完成确认元素未出现：%s", wait_for_confirm)
                return False
        logger.info("文件上传完成：%s", file_path)
        return True

    def _dialog_upload(self, template_name: str, file_path: str) -> bool:
        """对话框上传：点击浏览按钮→填入路径→回车。"""
        if not self.click_element(template_name, wait_after=0.8):
            return False
        time.sleep(0.5)
        _get_pyperclip().copy(file_path)
        time.sleep(0.1)
        self._paste()
        time.sleep(0.3)
        _get_pyautogui().press("enter")
        return True

    def _drag_drop_upload(self, template_name: str, file_path: str) -> bool:
        """真正的拖拽上传：从文件管理器拖拽至浏览器上传区域。

        流程：
          1. 定位浏览器上传区域坐标
          2. 打开文件管理器并导航到文件所在目录
          3. 在文件管理器中搜索并选中目标文件
          4. 按住鼠标左键，拖拽至浏览器上传区域
          5. 释放鼠标完成拖拽
        """
        pg = _get_pyautogui()

        # 步骤 1：先定位浏览器中的上传区域
        upload_loc = self.locate(template_name)
        if upload_loc is None:
            logger.error("无法定位上传区域：%s", template_name)
            return False
        browser_upload_pos = upload_loc.center
        logger.debug("上传区域坐标：%s", browser_upload_pos)

        # 步骤 2：最小化当前窗口，聚焦文件管理器
        folder_path = os.path.dirname(os.path.abspath(file_path))
        file_name = os.path.basename(file_path)
        self._open_file_manager(folder_path)
        time.sleep(1.5)  # 等待文件管理器打开

        try:
            # 步骤 3：在文件管理器中搜索并定位文件
            file_pos = self._locate_file_in_manager(file_name)
            if file_pos is None:
                logger.warning("无法在文件管理器中定位文件，回退到对话框上传")
                # 关闭文件管理器窗口
                self._close_active_window()
                time.sleep(0.5)
                return self._dialog_upload(template_name, file_path)

            logger.debug("文件在文件管理器中的坐标：%s", file_pos)

            # 步骤 4：拖拽到浏览器上传区域
            # 先移动到文件位置
            pg.moveTo(file_pos[0], file_pos[1], duration=self.mouse_move_duration)
            time.sleep(0.2)

            # 按住左键
            pg.mouseDown(button='left')
            time.sleep(0.1)

            # 拖拽到上传区域（使用 dragTo 确保平滑移动）
            pg.dragTo(browser_upload_pos[0], browser_upload_pos[1],
                      duration=self.mouse_move_duration * 1.5,
                      button='left')
            time.sleep(0.2)

            # 释放鼠标
            pg.mouseUp(button='left')
            time.sleep(0.5)

            logger.info("拖拽上传完成：%s", file_name)
            return True

        except Exception as exc:  # noqa: BLE001
            logger.error("拖拽上传异常：%s，回退到对话框上传", exc)
            # 确保鼠标键已释放
            try:
                pg.mouseUp(button='left')
            except Exception:  # noqa: BLE001
                pass
            self._close_active_window()
            time.sleep(0.5)
            return self._dialog_upload(template_name, file_path)

    def _open_file_manager(self, folder_path: str) -> None:
        """跨平台打开文件管理器并导航到指定目录。"""
        import subprocess
        try:
            if _IS_MAC:
                # macOS: open Finder
                subprocess.Popen(["open", folder_path],
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL)
            elif os.name == 'nt':
                # Windows: explorer
                subprocess.Popen(["explorer", folder_path.replace("/", "\\")],
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL)
            else:
                # Linux: try xdg-open
                subprocess.Popen(["xdg-open", folder_path],
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL)
            logger.debug("已打开文件管理器：%s", folder_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("打开文件管理器失败：%s", exc)

    def _locate_file_in_manager(self, file_name: str) -> Optional[Tuple[int, int]]:
        """在当前活动的文件管理器窗口中搜索并定位文件图标中心坐标。

        策略：
          1. 使用搜索快捷键（Cmd+F / Ctrl+F）定位到搜索框
          2. 键入文件名自动筛选
          3. 按 Tab/Down 选中第一个搜索结果
          4. 返回当前鼠标位置作为文件图标位置
        """
        pg = _get_pyautogui()

        # 搜索框快捷键
        search_hotkey = [_MOD_KEY, "f"]

        # 聚焦搜索
        pg.hotkey(*search_hotkey)
        time.sleep(0.3)

        # 清空搜索框并输入文件名
        pg.hotkey(_MOD_KEY, "a")
        time.sleep(0.1)
        pg.press("delete")
        time.sleep(0.1)

        # 粘贴文件名（支持中文）
        _get_pyperclip().copy(file_name)
        time.sleep(0.05)
        self._paste()
        time.sleep(0.5)  # 等待搜索结果

        # 选中第一个结果
        pg.press("tab")
        time.sleep(0.1)
        pg.press("down")
        time.sleep(0.2)

        # 返回当前鼠标位置（假设焦点在文件图标上）
        pos = pg.position()
        return (pos.x, pos.y)

    def _close_active_window(self) -> None:
        """关闭当前活动窗口（文件管理器）。"""
        pg = _get_pyautogui()
        if _IS_MAC:
            pg.hotkey("command", "w")
        else:
            pg.hotkey("alt", "f4")
        time.sleep(0.3)

    def upload_files_batch(self, template_name: str, file_paths: List[str],
                            wait_for_confirm: Optional[str] = None,
                            max_files: int = 8) -> Tuple[int, List[str]]:
        """批量上传文件，返回 (成功数, 失败文件列表)。"""
        success = 0
        failed: List[str] = []
        for idx, fp in enumerate(file_paths[:max_files]):
            try:
                ok = self.upload_file(template_name, fp, wait_for_confirm)
                if ok:
                    success += 1
                else:
                    failed.append(fp)
            except Exception as exc:  # noqa: BLE001
                logger.error("上传第 %d 个文件失败 %s: %s", idx + 1, fp, exc)
                failed.append(fp)
        return success, failed

    # ---------------------------- 回显读取与校验 ----------------------------

    def read_echo_value(self, template_name: str, region_pad: int = 40,
                         confidence: Optional[float] = None) -> Optional[str]:
        """读取输入框回显值：定位元素→截取周边区域→OCR 识别。

        用于填报后回读值与源数据比对。
        """
        loc = self.locate(template_name, confidence=confidence)
        if loc is None:
            return None
        x, y, w, h = loc.region
        left = max(0, x - region_pad)
        top = max(0, y - region_pad)
        right = min(_get_pyautogui().size().width, x + w + region_pad)
        bottom = min(_get_pyautogui().size().height, y + h + region_pad)
        region = (left, top, right - left, bottom - top)
        img = _get_pyautogui().screenshot(region=region)
        return self._ocr_image(img)

    def compare_echo(self, template_name: str, expected: str,
                      tolerance: float = 0.0) -> bool:
        """比对回显值与期望值，返回是否一致。"""
        echo = self.read_echo_value(template_name)
        if echo is None:
            logger.warning("无法读取回显值：%s", template_name)
            return False
        echo_clean = echo.strip().replace(" ", "").replace("\n", "")
        expected_clean = str(expected).strip().replace(" ", "")
        if tolerance > 0:
            try:
                diff = abs(float(echo_clean) - float(expected_clean))
                match = diff <= tolerance
            except ValueError:
                match = echo_clean == expected_clean
        else:
            match = echo_clean == expected_clean
        # 记录 OCR 准确率指标（ground truth = expected_clean, recognition = echo_clean）
        self._track_metrics("ocr_recognize", match,
                            {"template": template_name,
                             "expected": expected_clean,
                             "actual": echo_clean})
        if not match:
            logger.warning("回显不一致：%s（期望=%r，实际=%r）",
                           template_name, expected_clean, echo_clean)
        return match

    # ---------------------------- 截图与诊断 ----------------------------

    def grab_screen(self) -> Image.Image:
        return self._grab_screen()

    def save_failure_screenshot(self, tag: str = "failure") -> str:
        """保存失败截图，返回文件路径。"""
        ts = time.strftime("%Y%m%d_%H%M%S")
        filename = f"fail_{tag}_{ts}.png"
        path = os.path.join(self.screenshot_dir, filename)
        try:
            img = _get_pyautogui().screenshot()
            img.save(path)
            logger.info("失败截图已保存：%s", path)
        except Exception as exc:  # noqa: BLE001
            logger.error("截图保存失败：%s", exc)
        return path

    # ---------------------------- 内部实现 ----------------------------

    def _grab_screen(self) -> Image.Image:
        img = _get_pyautogui().screenshot()
        if self.screenshot_scale and self.screenshot_scale != 1.0:
            new_size = (int(img.width * self.screenshot_scale),
                        int(img.height * self.screenshot_scale))
            img = img.resize(new_size, Image.BILINEAR)
        return img.convert("RGB")

    def _match_at_scale(self, screen: Image.Image, template: Image.Image,
                        name: str, scale: float, threshold: float
                        ) -> Optional[ElementLocation]:
        try:
            import cv2
            import numpy as np
        except ImportError:
            logger.error("OpenCV/numpy 未安装，无法进行模板匹配")
            return None
        screen_arr = np.array(screen)
        if screen_arr.ndim == 3:
            screen_gray = cv2.cvtColor(screen_arr, cv2.COLOR_RGB2GRAY)
        else:
            screen_gray = screen_arr
        # 缩放模板
        if abs(scale - 1.0) < 1e-3:
            tmpl = template.convert("L")
            tmpl_arr = np.array(tmpl)
        else:
            new_w = max(1, int(template.width * scale))
            new_h = max(1, int(template.height * scale))
            tmpl = template.resize((new_w, new_h), Image.BILINEAR).convert("L")
            tmpl_arr = np.array(tmpl)
        if tmpl_arr.shape[0] > screen_gray.shape[0] or tmpl_arr.shape[1] > screen_gray.shape[1]:
            return None
        result = cv2.matchTemplate(screen_gray, tmpl_arr, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(result)
        if max_val >= threshold:
            cx = int(max_loc[0] + tmpl_arr.shape[1] / 2)
            cy = int(max_loc[1] + tmpl_arr.shape[0] / 2)
            # 还原到原始屏幕坐标（若截图被缩放）
            if self.screenshot_scale and self.screenshot_scale != 1.0:
                cx = int(cx / self.screenshot_scale)
                cy = int(cy / self.screenshot_scale)
            region = (max_loc[0], max_loc[1], tmpl_arr.shape[1], tmpl_arr.shape[0])
            return ElementLocation(name=name, center=(cx, cy),
                                    region=region, confidence=float(max_val),
                                    scale=scale)
        return None

    def _resolve_template_path(self, template_name: str) -> Optional[str]:
        templates_cfg: Dict[str, Any] = self.config.get("templates", {})
        filename = templates_cfg.get(template_name, template_name)
        # 优先匹配 config 中的映射，其次当作文件名
        candidate = os.path.join(self.template_dir, filename)
        if os.path.isfile(candidate):
            return candidate
        if os.path.isfile(template_name):
            return template_name
        return None

    def _load_template(self, path: str) -> Optional[Image.Image]:
        if path in self._template_cache:
            return self._template_cache[path]
        try:
            img = Image.open(path).convert("RGB")
            self._template_cache[path] = img
            return img
        except Exception as exc:  # noqa: BLE001
            logger.error("加载模板图片失败 %s: %s", path, exc)
            return None

    def _move_to(self, point: Tuple[int, int]) -> None:
        duration = self.mouse_move_duration if not self.silent_mode else max(0.1, self.mouse_move_duration)
        _get_pyautogui().moveTo(point[0], point[1], duration=duration)

    def _paste(self) -> None:
        """通过快捷键粘贴剪贴板内容。"""
        _get_pyautogui().hotkey(_MOD_KEY, "v")
        time.sleep(0.1)

    # ---------------------------- 性能指标统计 ----------------------------

    def _track_metrics(self, metric_type: str, success: bool,
                       details: Optional[Dict[str, Any]] = None) -> None:
        """累计性能指标：OCR 识别准确率和界面元素定位成功率。

        Args:
            metric_type: "ocr_recognize" 或 "element_locate"
            success: 本次操作是否成功
            details: 附加详细信息
        """
        # 初始化计数器（懒加载，确保只创建一次）
        if not hasattr(self, "_metrics_total"):
            self._metrics_total: Dict[str, int] = {}
            self._metrics_success: Dict[str, int] = {}
        self._metrics_total[metric_type] = self._metrics_total.get(metric_type, 0) + 1
        if success:
            self._metrics_success[metric_type] = self._metrics_success.get(metric_type, 0) + 1
        # 调用外部回调（如 main.py 的统计聚合器）
        if self._metrics_callback is not None:
            try:
                self._metrics_callback(metric_type, success, details or {})
            except Exception as exc:  # noqa: BLE001
                logger.debug("metrics callback 异常：%s", exc)

    def get_metrics(self) -> Dict[str, Any]:
        """获取当前累计的性能指标统计。

        返回：
            {
                "element_locate": {"total": N, "success": M, "rate": 0.98},
                "ocr_recognize": {"total": N, "success": M, "rate": 0.95},
            }
        """
        if not hasattr(self, "_metrics_total"):
            return {}
        result: Dict[str, Any] = {}
        for metric, total in self._metrics_total.items():
            success = self._metrics_success.get(metric, 0)
            rate = success / total if total > 0 else 0.0
            result[metric] = {
                "total": total,
                "success": success,
                "rate": round(rate, 4),
            }
        return result

    def _ocr_image(self, img: Image.Image) -> Optional[str]:
        """对图像区域进行 OCR，返回识别文本。"""
        try:
            import pytesseract
            if self.ocr_cmd:
                pytesseract.pytesseract.tesseract_cmd = self.ocr_cmd
            text = pytesseract.image_to_string(
                img, lang=self.ocr_language,
                config=f"--psm {self.ocr_psm}")
            return text.strip()
        except Exception as exc:  # noqa: BLE001
            logger.debug("回显 OCR 失败: %s", exc)
            return None


class ElementNotFoundError(Exception):
    """元素定位失败异常。"""
