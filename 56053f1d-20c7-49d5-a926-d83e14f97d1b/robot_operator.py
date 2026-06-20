"""
robot_operator.py
================================================================================
PyAutoGUI 操作理赔系统封装模块

职责:
  1. 封装理赔系统 GUI 操作: 登录 / 案件查询 / 定损信息填写 /
     照片上传 / 提交审核 全流程
  2. 异常弹窗自动处理 (基于 OCR 文本识别 + 坐标点击)
  3. 字段校验失败重试
  4. 关键步骤截图留存

理赔系统为 15 年前 C/S 客户端, 无 API, 仅支持 GUI 操作, 本模块以
PyAutoGUI 模拟鼠标键盘完成 30+ 次点击与 15 字段填写。
"""

import os
import time
from typing import Optional

import yaml

try:
    import pyautogui
    pyautogui.FAILSAFE = True          # 鼠标移到左上角即触发异常, 紧急停止
    pyautogui.PAUSE = 0.3              # 每个 pyautogui 调用后停顿, 提升稳定性
    _PYAUTOGUI_AVAILABLE = True
except Exception:                       # 无显示环境导入失败时降级
    _PYAUTOGUI_AVAILABLE = False

# pytesseract 仅用于 OCR 弹窗识别, 采用惰性导入, 缺失时降级为无 OCR 模式
_PYTESSERACT_AVAILABLE = False
try:
    import pytesseract
    _PYTESSERACT_AVAILABLE = True
except Exception:
    pass

from PIL import Image

from exception_handler import (
    FieldValidationFailure,
    GuiElementNotFound,
    PopupRecognitionFailure,
    SystemLoginTimeout,
    retry_on_exception,
)
from logger import AppLogger, get_logger

log = get_logger("robot_operator")


class RobotOperator:
    def __init__(self, config_path: str = "config.yaml", dry_run: bool = False):
        with open(config_path, "r", encoding="utf-8") as f:
            self.cfg = yaml.safe_load(f)
        self.sys_cfg = self.cfg.get("claims_system", {})
        self.gui_delay = float(self.cfg.get("system", {}).get(
            "gui_action_delay", 0.5))
        self.dry_run = dry_run or not _PYAUTOGUI_AVAILABLE
        if not _PYAUTOGUI_AVAILABLE:
            log.warning("PyAutoGUI 不可用, 进入 dry_run 模拟模式 (不会真实操作 GUI)")
        self._logged_in = False
        # 字段中文 -> 录入界面字段配置, 便于按字段名查找坐标
        self._field_map = {f["name"]: f
                          for f in self.sys_cfg.get("entry_fields", [])}

    # --------------------------------------------------------------------------
    # 底层操作原语
    # --------------------------------------------------------------------------
    def _click(self, x: int, y: int, desc: str = ""):
        """点击指定坐标 (dry_run 模式仅记录)。"""
        if self.dry_run:
            log.info("[dry_run] 点击 (%d,%d) %s", x, y, desc)
            return
        try:
            pyautogui.click(x, y)
            time.sleep(self.gui_delay)
        except Exception as exc:
            raise GuiElementNotFound(f"点击失败 ({x},{y}) {desc}: {exc}")

    def _type(self, text: str, desc: str = ""):
        """输入文本 (dry_run 模式仅记录)。"""
        if self.dry_run:
            log.info("[dry_run] 输入 '%s' %s", text, desc)
            return
        try:
            pyautogui.typewrite(str(text), interval=0.05) if str(text).isascii() \
                else self._type_unicode(text)
            time.sleep(self.gui_delay)
        except Exception as exc:
            raise GuiElementNotFound(f"输入失败 '{text}' {desc}: {exc}")

    def _type_unicode(self, text: str):
        """中文等非 ASCII 文本: 复制到剪贴板后粘贴 (pyautogui 原生不支持中文)。"""
        import subprocess
        try:
            subprocess.run(["pbcopy"], input=text.encode("utf-8"),
                           check=True) if os.name != "nt" else None
        except Exception:
            pass
        # 退化为 typewrite ASCII 段; 中文部分用 hotkey 粘贴
        try:
            with pyautogui.hold("ctrl") if os.name == "nt" else pyautogui.hold("command"):
                pyautogui.press("v")
        except Exception:
            pyautogui.press("v")

    def _press(self, key: str):
        if self.dry_run:
            log.info("[dry_run] 按键 %s", key)
            return
        pyautogui.press(key)
        time.sleep(self.gui_delay)

    def _screenshot(self, case_no: str, stage: str):
        """关键步骤截图留存。"""
        try:
            if self.dry_run:
                return None
            img = pyautogui.screenshot()
            return AppLogger.save_screenshot(img, case_no, stage)
        except Exception as exc:
            log.warning("截图失败 | case=%s stage=%s err=%s", case_no, stage, exc)
            return None

    def _wait(self, seconds: float):
        time.sleep(seconds)

    # --------------------------------------------------------------------------
    # OCR 弹窗识别
    # --------------------------------------------------------------------------
    def _ocr_screen(self, region: Optional[tuple] = None) -> str:
        """截屏并 OCR 识别文本, 用于弹窗文本识别。"""
        if self.dry_run or not _PYTESSERACT_AVAILABLE:
            return ""
        try:
            import numpy as _np
            shot = pyautogui.screenshot(region=region)
            text = pytesseract.image_to_string(
                Image.fromarray(_np.array(shot)), lang="chi_sim+eng")
            return text
        except Exception as exc:
            log.warning("OCR 识别失败: %s", exc)
            return ""

    # --------------------------------------------------------------------------
    # 1. 系统启动与登录
    # --------------------------------------------------------------------------
    @retry_on_exception(exceptions=(SystemLoginTimeout, GuiElementNotFound, Exception),
                         max_retries=3, backoff_base=5, case_no_arg="case_no")
    def login(self, case_no: str = "-") -> bool:
        """启动理赔系统并完成登录。"""
        log.info("开始登录理赔系统 | case=%s", case_no)
        if not self.dry_run:
            exe = self.sys_cfg.get("executable_path", "")
            if exe and os.path.exists(exe):
                try:
                    import subprocess
                    subprocess.Popen(exe)
                except Exception as exc:
                    raise SystemLoginTimeout(
                        f"理赔系统启动失败: {exc}", case_no)
            self._wait(float(self.sys_cfg.get("startup_wait", 8)))

        login_cfg = self.sys_cfg.get("login", {})
        # 用户名
        self._click(login_cfg["username_x"], login_cfg["username_y"], "用户名输入框")
        self._type(login_cfg.get("username", ""), "用户名")
        # 密码
        self._click(login_cfg["password_x"], login_cfg["password_y"], "密码输入框")
        self._type(_decrypt(login_cfg.get("password", "")), "密码")
        # 提交
        self._click(login_cfg["submit_x"], login_cfg["submit_y"], "登录按钮")

        # 等待并校验是否登录成功 (检查是否出现异常弹窗)
        self._wait(2)
        self.handle_popups(case_no=case_no)
        self._screenshot(case_no, "login")
        self._logged_in = True
        log.info("理赔系统登录成功 | case=%s", case_no)
        return True

    # --------------------------------------------------------------------------
    # 2. 案件查询
    # --------------------------------------------------------------------------
    @retry_on_exception(exceptions=(GuiElementNotFound, Exception),
                         max_retries=3, case_no_arg="case_no")
    def search_case(self, case_no: str) -> bool:
        """进入案件查询界面并定位指定案件。"""
        if not self._logged_in and not self.dry_run:
            self.login(case_no=case_no)
        log.info("查询案件 | case=%s", case_no)
        search = self.sys_cfg.get("case_search", {})
        # 进入案件查询菜单
        self._click(search["menu_x"], search["menu_y"], "案件查询菜单")
        self._wait(1)
        # 输入案件号
        self._click(search["case_no_input_x"], search["case_no_input_y"], "案件号输入框")
        self._type(case_no, "案件号")
        self._click(search["search_button_x"], search["search_button_y"], "查询按钮")
        self._wait(1.5)
        # 点击查询结果第一行
        self._click(search["result_first_row_x"], search["result_first_row_y"],
                    "查询结果第一行")
        self._wait(1)
        self.handle_popups(case_no=case_no)
        self._screenshot(case_no, "case_search")
        return True

    # --------------------------------------------------------------------------
    # 3. 定损信息录入 (15 字段)
    # --------------------------------------------------------------------------
    def enter_damage_info(self, fields: dict, case_no: str = "-") -> bool:
        """填写定损信息 15 个字段。"""
        if not self._logged_in and not self.dry_run:
            self.login(case_no=case_no)
        log.info("录入定损信息 | case=%s 字段数=%d", case_no, len(fields))

        entry_fields = self.sys_cfg.get("entry_fields", [])
        retry_limit = int(self.sys_cfg.get("entry_retry_limit", 2))

        for field_def in entry_fields:
            name = field_def["name"]
            value = fields.get(name)
            if value is None or value == "":
                log.debug("字段跳过(空值) | case=%s field=%s", case_no, name)
                continue
            x, y = field_def["x"], field_def["y"]
            ftype = field_def.get("type", "text")
            success = False
            for attempt in range(1, retry_limit + 1):
                try:
                    self._fill_field(x, y, ftype, value, name, case_no)
                    success = True
                    break
                except FieldValidationFailure as exc:
                    log.warning("字段校验失败重试 | case=%s field=%s attempt=%d err=%s",
                                case_no, name, attempt, exc)
                    self.handle_popups(case_no=case_no)
                    if attempt >= retry_limit:
                        raise
            if success:
                log.debug("字段录入成功 | case=%s field=%s", case_no, name)

        self._screenshot(case_no, "entry_complete")
        log.info("定损信息录入完成 | case=%s", case_no)
        return True

    def _fill_field(self, x: int, y: int, ftype: str, value: str,
                    name: str, case_no: str):
        """填写单个字段, select 类型先点击下拉再选择。"""
        self._click(x, y, f"字段-{name}")
        self._wait(0.2)
        if ftype == "select":
            # 下拉选择: 清空后输入, 回车确认 (理赔系统 C/S 常见交互)
            self._press("backspace")
            self._type(value, f"字段值-{name}")
            self._press("enter")
        else:
            # 文本: 全选清空后输入
            self._press("ctrl" if os.name == "nt" else "command")
            self._press("a")
            self._type(value, f"字段值-{name}")
        # 校验: 重新聚焦后读取 (简化为弹窗检测, 若有"校验失败"弹窗则抛异常)
        if self._detect_popup_text("校验失败"):
            raise FieldValidationFailure(
                f"字段校验失败: {name}={value}", case_no, name)

    # --------------------------------------------------------------------------
    # 4. 照片上传
    # --------------------------------------------------------------------------
    @retry_on_exception(exceptions=(GuiElementNotFound, Exception),
                         max_retries=2, case_no_arg="case_no")
    def upload_photos(self, photo_paths: list, case_no: str = "-") -> bool:
        """逐张上传事故现场照片。"""
        log.info("上传照片 | case=%s 数量=%d", case_no, len(photo_paths))
        upload = self.sys_cfg.get("photo_upload", {})
        for idx, path in enumerate(photo_paths):
            if not os.path.exists(path):
                log.warning("照片文件不存在, 跳过 | case=%s path=%s",
                            case_no, path)
                continue
            self._click(upload["upload_button_x"], upload["upload_button_y"],
                        f"上传按钮-{idx + 1}")
            self._wait(1)
            # 文件对话框输入路径
            self._click(upload["file_dialog_path_x"], upload["file_dialog_path_y"],
                        "文件路径输入框")
            self._type(path, "照片路径")
            self._press("enter")
            self._wait(0.5)
            self._click(upload["file_dialog_confirm_x"],
                        upload["file_dialog_confirm_y"], "确认上传")
            self._wait(1)
            self.handle_popups(case_no=case_no)
        self._screenshot(case_no, "photo_upload")
        log.info("照片上传完成 | case=%s", case_no)
        return True

    # --------------------------------------------------------------------------
    # 5. 提交审核
    # --------------------------------------------------------------------------
    @retry_on_exception(exceptions=(GuiElementNotFound, Exception),
                         max_retries=2, case_no_arg="case_no")
    def submit_for_review(self, case_no: str = "-") -> bool:
        """点击提交审核按钮并处理后续弹窗。"""
        log.info("提交审核 | case=%s", case_no)
        submit = self.sys_cfg.get("submit", {})
        self._click(submit["submit_button_x"], submit["submit_button_y"],
                    "提交审核按钮")
        self._wait(2)
        # 处理提交后的确认弹窗
        self.handle_popups(case_no=case_no)
        self._screenshot(case_no, "submit")
        log.info("提交审核完成 | case=%s", case_no)
        return True

    # --------------------------------------------------------------------------
    # 6. 异常弹窗自动处理
    # --------------------------------------------------------------------------
    def handle_popups(self, case_no: str = "-"):
        """检测并处理异常弹窗, 支持确认/重试/重启登录/终止案件。"""
        popup_handlers = self.sys_cfg.get("popup_handlers", [])
        if not popup_handlers:
            return
        detected = self._detect_popup_text(None)
        if not detected:
            return
        for handler in popup_handlers:
            if handler["text"] in detected:
                action = handler.get("action", "click_ok")
                log.warning("检测到弹窗 | case=%s text='%s' action=%s",
                            case_no, handler["text"], action)
                self._screenshot(case_no, f"popup_{action}")
                self._click(handler["button_x"], handler["button_y"],
                            f"弹窗按钮-{action}")
                self._wait(1)
                if action == "restart_login":
                    self._logged_in = False
                    raise SystemLoginTimeout(
                        f"弹窗触发重新登录: {handler['text']}", case_no)
                if action == "abort_case":
                    raise FieldValidationFailure(
                        f"弹窗要求终止案件: {handler['text']}", case_no)
                if action == "click_retry":
                    raise GuiElementNotFound(
                        f"弹窗要求重试: {handler['text']}", case_no)
                # click_ok: 继续处理
                return

    def _detect_popup_text(self, target_text: Optional[str]) -> str:
        """OCR 检测屏幕弹窗文本。target_text=None 时返回全部识别文本。"""
        text = self._ocr_screen()
        if target_text is None:
            return text
        if target_text in text:
            return text
        return ""

    # --------------------------------------------------------------------------
    # 7. 案件状态查询 (审核结果识别)
    # --------------------------------------------------------------------------
    def query_case_status(self, case_no: str) -> str:
        """
        查询案件审核状态, 返回 approved/rejected/supplement/unknown。
        """
        log.info("查询案件状态 | case=%s", case_no)
        self.search_case(case_no=case_no)
        # 截屏 OCR 识别状态文本
        screen_text = self._ocr_screen()
        keywords = self.cfg.get("case_tracking", {}).get("status_keywords", {})
        if not screen_text:
            return "unknown"
        for status, words in keywords.items():
            if any(w in screen_text for w in words):
                log.info("案件状态识别 | case=%s status=%s", case_no, status)
                return status
        return "unknown"

    # --------------------------------------------------------------------------
    # 8. 全流程编排 (供 case_processor 调用)
    # --------------------------------------------------------------------------
    def perform_full_entry(self, fields: dict, photo_paths: list,
                           case_no: str = "-") -> dict:
        """
        完整录入流程: 登录 -> 查询 -> 录入 -> 上传 -> 提交。
        返回操作结果字典 (含各阶段耗时与截图路径)。
        """
        result = {"stages": {}, "screenshots": [], "success": False}
        stages = result["stages"]

        t0 = time.time()
        self.login(case_no=case_no)
        stages["login"] = round(time.time() - t0, 2)

        t1 = time.time()
        self.search_case(case_no)
        stages["search_case"] = round(time.time() - t1, 2)

        t2 = time.time()
        self.enter_damage_info(fields, case_no=case_no)
        stages["entry"] = round(time.time() - t2, 2)

        t3 = time.time()
        self.upload_photos(photo_paths, case_no=case_no)
        stages["upload"] = round(time.time() - t3, 2)

        t4 = time.time()
        self.submit_for_review(case_no=case_no)
        stages["submit"] = round(time.time() - t4, 2)

        result["success"] = True
        result["total_duration"] = round(time.time() - t0, 2)
        log.info("理赔系统录入全流程完成 | case=%s 耗时=%.2fs",
                 case_no, result["total_duration"])
        return result

    def logout(self):
        """退出登录 (简化: 关闭窗口)。"""
        if not self._logged_in:
            return
        log.info("退出理赔系统")
        if not self.dry_run:
            try:
                self._press("ctrl" if os.name == "nt" else "command")
                self._press("q" if os.name != "nt" else "f4")
            except Exception:
                pass
        self._logged_in = False


# ==============================================================================
# 辅助函数
# ==============================================================================
def _decrypt(text: str) -> str:
    """
    解密配置中的密码 (ENC: 前缀)。
    生产环境应替换为正式的密钥管理/解密实现; 此处为占位, 直接返回原文。
    """
    if text.startswith("ENC:"):
        return text[4:]
    return text
