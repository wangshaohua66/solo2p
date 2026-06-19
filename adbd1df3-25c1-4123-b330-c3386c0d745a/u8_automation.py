import os
import re
import time
import logging
from typing import Optional, Dict, Tuple, Any, List
from PIL import Image

try:
    import pyautogui
except ImportError:
    pyautogui = None

from retry_handler import RetryConfig, RetryHandler, retry
from opencv_detector import ElementDetector, ElementNotFoundException, MatchResult
from invoice_captcha import CaptchaSolver, CaptchaManualFallbackRequired


logger = logging.getLogger(__name__)


class U8AutomationError(Exception):
    pass


class LoginError(U8AutomationError):
    pass


class SessionTimeoutError(U8AutomationError):
    pass


class FormFillError(U8AutomationError):
    pass


class WindowNotFoundError(U8AutomationError):
    pass


class U8WindowManager:
    def __init__(self, window_title: str, offset_x: int = 0, offset_y: int = 0):
        if pyautogui is None:
            raise ImportError("pyautogui is required for U8WindowManager")

        self.window_title = window_title
        self.offset_x = offset_x
        self.offset_y = offset_y
        self._window_region: Optional[Tuple[int, int, int, int]] = None

    def find_window(self) -> bool:
        start_time = time.time()
        try:
            windows = pyautogui.getWindowsWithTitle(self.window_title)
            if not windows:
                raise WindowNotFoundError(f"Window with title '{self.window_title}' not found")

            window = windows[0]
            window.activate()
            time.sleep(0.5)

            self._window_region = (
                window.left + self.offset_x,
                window.top + self.offset_y,
                window.width,
                window.height,
            )

            duration = time.time() - start_time
            logger.info(
                f"Window found and activated: {self.window_title}",
                extra={
                    "operation": "find_window",
                    "status": "success",
                    "duration": duration,
                    "window_title": self.window_title,
                    "region": self._window_region,
                },
            )
            return True

        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Failed to find window: {str(e)}",
                extra={
                    "operation": "find_window",
                    "status": "failed",
                    "duration": duration,
                    "error": str(e),
                },
            )
            raise WindowNotFoundError(str(e)) from e

    def get_window_region(self) -> Tuple[int, int, int, int]:
        if self._window_region is None:
            self.find_window()
        return self._window_region

    def adjust_coordinates(self, x: int, y: int) -> Tuple[int, int]:
        region = self.get_window_region()
        return region[0] + x, region[1] + y

    def maximize_window(self) -> None:
        windows = pyautogui.getWindowsWithTitle(self.window_title)
        if windows:
            windows[0].maximize()
            time.sleep(0.3)
            self.find_window()

    def is_window_active(self) -> bool:
        try:
            active_window = pyautogui.getActiveWindow()
            return active_window and self.window_title in active_window.title
        except Exception:
            return False

    @classmethod
    def from_yaml_config(cls, config: Dict) -> "U8WindowManager":
        u8_config = config.get("u8_system", {})
        return cls(
            window_title=u8_config.get("window_title", "用友U8+ - 企业应用平台"),
            offset_x=u8_config.get("window_offset_x", 0),
            offset_y=u8_config.get("window_offset_y", 0),
        )


class U8InputController:
    def __init__(self, window_manager: U8WindowManager, config: Optional[Dict] = None):
        if pyautogui is None:
            raise ImportError("pyautogui is required for U8InputController")

        self.window_manager = window_manager
        self.config = config or {}
        self.click_delay = self.config.get("click_delay", 0.3)
        self.type_delay = self.config.get("type_delay", 0.05)
        self.scroll_delay = self.config.get("scroll_delay", 0.2)

        pyautogui.FAILSAFE = self.config.get("failsafe", True)
        pyautogui.PAUSE = self.config.get("pause", 0.1)

    def click(self, x: int, y: int, clicks: int = 1, interval: float = 0.2, button: str = "left") -> None:
        start_time = time.time()
        try:
            screen_x, screen_y = self.window_manager.adjust_coordinates(x, y)
            pyautogui.click(screen_x, screen_y, clicks=clicks, interval=interval, button=button)
            time.sleep(self.click_delay)

            duration = time.time() - start_time
            logger.debug(
                f"Clicked at ({x}, {y}) -> screen ({screen_x}, {screen_y})",
                extra={
                    "operation": "click",
                    "status": "success",
                    "duration": duration,
                    "position": (x, y),
                    "screen_position": (screen_x, screen_y),
                },
            )
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Click failed at ({x}, {y}): {str(e)}",
                extra={
                    "operation": "click",
                    "status": "failed",
                    "duration": duration,
                    "position": (x, y),
                    "error": str(e),
                },
            )
            raise U8AutomationError(f"Click failed: {str(e)}") from e

    def click_center(self, match_result: MatchResult) -> None:
        self.click(match_result.center[0], match_result.center[1])

    def type(self, text: str, interval: Optional[float] = None) -> None:
        start_time = time.time()
        interval = interval or self.type_delay
        try:
            pyautogui.typewrite(text, interval=interval)
            duration = time.time() - start_time
            logger.debug(
                f"Typed text: {text[:50]}",
                extra={
                    "operation": "type",
                    "status": "success",
                    "duration": duration,
                    "text_length": len(text),
                },
            )
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Type failed: {str(e)}",
                extra={
                    "operation": "type",
                    "status": "failed",
                    "duration": duration,
                    "error": str(e),
                },
            )
            raise U8AutomationError(f"Type failed: {str(e)}") from e

    def clear_and_type(self, text: str) -> None:
        pyautogui.hotkey("ctrl", "a")
        time.sleep(0.1)
        pyautogui.press("delete")
        time.sleep(0.1)
        self.type(text)

    def press(self, key: str, presses: int = 1, interval: float = 0.1) -> None:
        pyautogui.press(key, presses=presses, interval=interval)

    def hotkey(self, *keys) -> None:
        pyautogui.hotkey(*keys)
        time.sleep(0.1)

    def scroll(self, clicks: int, x: Optional[int] = None, y: Optional[int] = None) -> None:
        if x is not None and y is not None:
            screen_x, screen_y = self.window_manager.adjust_coordinates(x, y)
            pyautogui.scroll(clicks, x=screen_x, y=screen_y)
        else:
            pyautogui.scroll(clicks)
        time.sleep(self.scroll_delay)

    def move_to(self, x: int, y: int, duration: float = 0.2) -> None:
        screen_x, screen_y = self.window_manager.adjust_coordinates(x, y)
        pyautogui.moveTo(screen_x, screen_y, duration=duration)

    def screenshot(self, region: Optional[Tuple[int, int, int, int]] = None) -> Image.Image:
        if region is not None:
            x, y, w, h = region
            screen_x, screen_y = self.window_manager.adjust_coordinates(x, y)
            return pyautogui.screenshot(region=(screen_x, screen_y, w, h))
        return pyautogui.screenshot()


class U8Authenticator:
    def __init__(
        self,
        username: str,
        password: str,
        input_controller: U8InputController,
        element_detector: ElementDetector,
        captcha_solver: Optional[CaptchaSolver] = None,
        retry_config: Optional[RetryConfig] = None,
    ):
        self.username = username
        self.password = password
        self.input = input_controller
        self.detector = element_detector
        self.captcha_solver = captcha_solver
        self.retry_config = retry_config or RetryConfig(
            max_attempts=3,
            base_delay=2.0,
            retry_on=["LoginError"],
        )
        self._last_login_time: Optional[float] = None
        self._session_timeout = 1800

    def login(self) -> bool:
        start_time = time.time()
        handler = RetryHandler(self.retry_config, "u8_login")

        def try_login():
            return self._perform_login()

        try:
            result = handler.execute(try_login)
            self._last_login_time = time.time()
            duration = time.time() - start_time
            logger.info(
                "U8 system login successful",
                extra={
                    "operation": "u8_login",
                    "status": "success",
                    "duration": duration,
                    "attempts": handler.attempts,
                },
            )
            return result
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"U8 system login failed after {handler.attempts} attempts: {str(e)}",
                extra={
                    "operation": "u8_login",
                    "status": "failed",
                    "duration": duration,
                    "attempts": handler.attempts,
                    "error": str(e),
                },
            )
            raise LoginError(str(e)) from e

    def _perform_login(self) -> bool:
        screenshot = self.input.screenshot()

        try:
            username_field = self.detector.detect(screenshot, "username_field", use_multiscale=True)
            self.input.click_center(username_field)
            self.input.clear_and_type(self.username)
        except ElementNotFoundException:
            logger.warning("Username field not found by template, trying default position")
            self.input.click(300, 200)
            self.input.clear_and_type(self.username)

        try:
            password_field = self.detector.detect(screenshot, "password_field", use_multiscale=True)
            self.input.click_center(password_field)
            self.input.clear_and_type(self.password)
        except ElementNotFoundException:
            self.input.click(300, 250)
            self.input.clear_and_type(self.password)

        if self.captcha_solver:
            try:
                captcha_field = self.detector.detect(screenshot, "captcha_field", use_multiscale=True)
                captcha_img = self.input.screenshot(region=(
                    captcha_field.position[0] + 200, captcha_field.position[1], 120, 40
                ))
                captcha_text = self.captcha_solver.solve(captcha_img)

                self.input.click_center(captcha_field)
                self.input.clear_and_type(captcha_text)
            except ElementNotFoundException:
                logger.info("No captcha field detected, skipping captcha")
            except CaptchaManualFallbackRequired:
                logger.warning("Captcha requires manual input, please enter captcha code")
                self._wait_for_manual_captcha()

        try:
            login_button = self.detector.detect(self.input.screenshot(), "login_button", use_multiscale=True)
            self.input.click_center(login_button)
        except ElementNotFoundException:
            self.input.press("enter")

        time.sleep(3)
        return self._verify_login()

    def _wait_for_manual_captcha(self, timeout: int = 60) -> None:
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self._verify_login():
                return
            time.sleep(2)
        raise LoginError("Manual captcha input timeout")

    def _verify_login(self) -> bool:
        try:
            screenshot = self.input.screenshot()
            return self.detector.verify_element(screenshot, "expense_module")
        except Exception:
            return False

    def is_session_valid(self) -> bool:
        if self._last_login_time is None:
            return False
        return (time.time() - self._last_login_time) < self._session_timeout

    def refresh_session(self) -> None:
        if not self.is_session_valid():
            logger.info("Session expired, refreshing login...", extra={
                "operation": "refresh_session",
                "status": "start",
                "duration": 0.0,
            })
            self.login()

    @classmethod
    def from_yaml_config(
        cls,
        config: Dict,
        input_controller: U8InputController,
        element_detector: ElementDetector,
        captcha_solver: Optional[CaptchaSolver] = None,
    ) -> "U8Authenticator":
        u8_config = config.get("u8_system", {})
        retry_config = RetryConfig.from_yaml_config(config.get("retry", {}))
        authenticator = cls(
            username=u8_config.get("username", ""),
            password=u8_config.get("password", ""),
            input_controller=input_controller,
            element_detector=element_detector,
            captcha_solver=captcha_solver,
            retry_config=retry_config,
        )
        authenticator._session_timeout = u8_config.get("session_timeout", 1800)
        return authenticator


class U8FormFiller:
    def __init__(
        self,
        input_controller: U8InputController,
        element_detector: ElementDetector,
        retry_config: Optional[RetryConfig] = None,
    ):
        self.input = input_controller
        self.detector = element_detector
        self.retry_config = retry_config or RetryConfig(
            max_attempts=3,
            base_delay=1.0,
            retry_on=["FormFillError", "ElementNotFoundException"],
        )
        self.field_templates = {
            "invoice_code": "invoice_code_field",
            "invoice_number": "invoice_number_field",
            "tax_id": "tax_id_field",
            "amount": "amount_field",
            "invoice_date": "date_field",
            "seller": "seller_field",
        }

    def fill_field(self, field_name: str, value: str, verify: bool = True) -> bool:
        start_time = time.time()
        handler = RetryHandler(self.retry_config, f"fill_{field_name}")

        def try_fill():
            return self._fill_field_internal(field_name, value, verify)

        try:
            result = handler.execute(try_fill)
            duration = time.time() - start_time
            logger.info(
                f"Field {field_name} filled successfully",
                extra={
                    "operation": f"fill_{field_name}",
                    "status": "success",
                    "duration": duration,
                    "field": field_name,
                    "value": value,
                    "attempts": handler.attempts,
                },
            )
            return result
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Failed to fill field {field_name} after {handler.attempts} attempts",
                extra={
                    "operation": f"fill_{field_name}",
                    "status": "failed",
                    "duration": duration,
                    "field": field_name,
                    "value": value,
                    "attempts": handler.attempts,
                    "error": str(e),
                },
            )
            raise FormFillError(f"Failed to fill {field_name}: {str(e)}") from e

    def _fill_field_internal(self, field_name: str, value: str, verify: bool) -> bool:
        template_name = self.field_templates.get(field_name)
        if not template_name:
            raise FormFillError(f"Unknown field: {field_name}")

        screenshot = self.input.screenshot()
        field_match = self.detector.detect(screenshot, template_name, use_multiscale=True)

        input_x = field_match.center[0] + 100
        input_y = field_match.center[1]

        self.input.click(input_x, input_y)
        time.sleep(0.2)
        self.input.clear_and_type(value)
        time.sleep(0.3)

        if verify:
            return self._verify_field_value(field_name, value)

        return True

    def _verify_field_value(self, field_name: str, expected_value: str) -> bool:
        self.input.hotkey("ctrl", "a")
        time.sleep(0.1)
        self.input.hotkey("ctrl", "c")
        time.sleep(0.1)

        try:
            import tkinter as tk
            root = tk.Tk()
            root.withdraw()
            actual_value = root.clipboard_get()
            root.destroy()

            normalized_expected = re.sub(r'[\s,\-]', '', expected_value)
            normalized_actual = re.sub(r'[\s,\-]', '', actual_value)

            if normalized_expected in normalized_actual or normalized_actual in normalized_expected:
                return True

            logger.warning(
                f"Field verification failed for {field_name}: expected '{expected_value}', got '{actual_value}'",
                extra={
                    "operation": f"verify_{field_name}",
                    "status": "mismatch",
                    "duration": 0.0,
                    "expected": expected_value,
                    "actual": actual_value,
                },
            )
            return False
        except Exception as e:
            logger.warning(
                f"Field verification skipped for {field_name}: {str(e)}",
                extra={
                    "operation": f"verify_{field_name}",
                    "status": "skipped",
                    "duration": 0.0,
                    "error": str(e),
                },
            )
            return True

    def fill_form(self, data: Dict[str, str], required_fields: Optional[List[str]] = None) -> Dict[str, bool]:
        start_time = time.time()
        results = {}

        if required_fields is None:
            required_fields = list(data.keys())

        for field_name in required_fields:
            if field_name not in data:
                logger.warning(
                    f"Required field {field_name} missing from data",
                    extra={
                        "operation": "fill_form",
                        "status": "warning",
                        "duration": 0.0,
                        "field": field_name,
                    },
                )
                results[field_name] = False
                continue

            try:
                results[field_name] = self.fill_field(field_name, data[field_name])
            except FormFillError:
                results[field_name] = False

        all_success = all(results.values())
        duration = time.time() - start_time

        logger.info(
            f"Form fill completed: {sum(results.values())}/{len(results)} fields successful",
            extra={
                "operation": "fill_form",
                "status": "success" if all_success else "partial",
                "duration": duration,
                "success_count": sum(results.values()),
                "total_fields": len(results),
            },
        )

        return results

    def submit_form(self) -> bool:
        start_time = time.time()
        try:
            screenshot = self.input.screenshot()
            submit_button = self.detector.detect(screenshot, "submit_button", use_multiscale=True)
            self.input.click_center(submit_button)
            time.sleep(1)

            duration = time.time() - start_time
            logger.info(
                "Form submitted successfully",
                extra={
                    "operation": "submit_form",
                    "status": "success",
                    "duration": duration,
                },
            )
            return True
        except ElementNotFoundException as e:
            self.input.hotkey("ctrl", "s")
            time.sleep(1)
            duration = time.time() - start_time
            logger.warning(
                "Submit button not found, used Ctrl+S as fallback",
                extra={
                    "operation": "submit_form",
                    "status": "fallback",
                    "duration": duration,
                    "error": str(e),
                },
            )
            return True

    def save_form(self) -> bool:
        start_time = time.time()
        try:
            screenshot = self.input.screenshot()
            save_button = self.detector.detect(screenshot, "save_button", use_multiscale=True)
            self.input.click_center(save_button)
            time.sleep(0.5)

            duration = time.time() - start_time
            logger.info(
                "Form saved successfully",
                extra={
                    "operation": "save_form",
                    "status": "success",
                    "duration": duration,
                },
            )
            return True
        except ElementNotFoundException as e:
            self.input.hotkey("ctrl", "s")
            time.sleep(0.5)
            duration = time.time() - start_time
            logger.warning(
                "Save button not found, used Ctrl+S as fallback",
                extra={
                    "operation": "save_form",
                    "status": "fallback",
                    "duration": duration,
                    "error": str(e),
                },
            )
            return True

    def new_form(self) -> bool:
        start_time = time.time()
        try:
            self.input.hotkey("ctrl", "n")
            time.sleep(0.5)

            duration = time.time() - start_time
            logger.info(
                "New form created",
                extra={
                    "operation": "new_form",
                    "status": "success",
                    "duration": duration,
                },
            )
            return True
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Failed to create new form: {str(e)}",
                extra={
                    "operation": "new_form",
                    "status": "failed",
                    "duration": duration,
                    "error": str(e),
                },
            )
            raise FormFillError(str(e)) from e

    def navigate_to_expense_module(self, module_path: str) -> bool:
        start_time = time.time()
        handler = RetryHandler(self.retry_config, "navigate_to_expense_module")

        def try_navigate():
            parts = module_path.split(">")
            for part in parts:
                screenshot = self.input.screenshot()
                matches = self.detector.template_matcher.find_all_matches(
                    screenshot, part.strip(), threshold=0.7, max_matches=5
                )
                if matches:
                    self.input.click_center(matches[0])
                    time.sleep(0.5)
                else:
                    raise ElementNotFoundException(f"Menu item '{part}' not found")
            return True

        try:
            result = handler.execute(try_navigate)
            duration = time.time() - start_time
            logger.info(
                f"Navigated to expense module: {module_path}",
                extra={
                    "operation": "navigate_to_expense_module",
                    "status": "success",
                    "duration": duration,
                    "module_path": module_path,
                    "attempts": handler.attempts,
                },
            )
            return result
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Failed to navigate to expense module after {handler.attempts} attempts: {str(e)}",
                extra={
                    "operation": "navigate_to_expense_module",
                    "status": "failed",
                    "duration": duration,
                    "attempts": handler.attempts,
                    "error": str(e),
                },
            )
            raise U8AutomationError(str(e)) from e


class U8Automation:
    def __init__(
        self,
        window_manager: U8WindowManager,
        input_controller: U8InputController,
        authenticator: U8Authenticator,
        form_filler: U8FormFiller,
        config: Optional[Dict] = None,
    ):
        self.window_manager = window_manager
        self.input = input_controller
        self.authenticator = authenticator
        self.form_filler = form_filler
        self.config = config or {}
        self._is_initialized = False

    def initialize(self) -> None:
        if self._is_initialized:
            return

        self.window_manager.find_window()
        self.window_manager.maximize_window()
        self.authenticator.login()

        u8_config = self.config.get("u8_system", {})
        module_path = u8_config.get("expense_module_path", "财务会计>报销管理>费用报销")
        self.form_filler.navigate_to_expense_module(module_path)

        self._is_initialized = True
        logger.info("U8 Automation initialized successfully", extra={
            "operation": "initialize",
            "status": "success",
            "duration": 0.0,
        })

    def process_invoice(self, invoice_data: Dict[str, str], required_fields: Optional[List[str]] = None) -> bool:
        start_time = time.time()
        try:
            self.authenticator.refresh_session()

            self.form_filler.new_form()
            fill_results = self.form_filler.fill_form(invoice_data, required_fields)

            if not all(fill_results.values()):
                failed_fields = [k for k, v in fill_results.items() if not v]
                raise FormFillError(f"Failed to fill fields: {failed_fields}")

            self.form_filler.save_form()
            self.form_filler.submit_form()

            duration = time.time() - start_time
            logger.info(
                "Invoice processed successfully",
                extra={
                    "operation": "process_invoice",
                    "status": "success",
                    "duration": duration,
                    "invoice_code": invoice_data.get("invoice_code", ""),
                },
            )
            return True

        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Failed to process invoice: {str(e)}",
                extra={
                    "operation": "process_invoice",
                    "status": "failed",
                    "duration": duration,
                    "invoice_code": invoice_data.get("invoice_code", ""),
                    "error": str(e),
                },
            )
            raise

    @classmethod
    def from_yaml_config(
        cls,
        config: Dict,
        element_detector: ElementDetector,
        captcha_solver: Optional[CaptchaSolver] = None,
    ) -> "U8Automation":
        window_manager = U8WindowManager.from_yaml_config(config)
        input_controller = U8InputController(window_manager, config.get("u8_automation", {}))
        authenticator = U8Authenticator.from_yaml_config(config, input_controller, element_detector, captcha_solver)
        retry_config = RetryConfig.from_yaml_config(config.get("retry", {}))
        form_filler = U8FormFiller(input_controller, element_detector, retry_config)

        return cls(
            window_manager=window_manager,
            input_controller=input_controller,
            authenticator=authenticator,
            form_filler=form_filler,
            config=config,
        )
