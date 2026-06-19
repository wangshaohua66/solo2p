import os
import io
import re
import time
import logging
from typing import Optional, Dict, Tuple, Any, List
from PIL import Image

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.common.action_chains import ActionChains
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import (
        NoSuchElementException,
        TimeoutException,
        ElementClickInterceptedException,
        ElementNotInteractableException,
        StaleElementReferenceException,
        WebDriverException,
    )
    selenium_available = True
except ImportError:
    webdriver = None
    selenium_available = False

    class By:
        ID = "id"
        NAME = "name"
        XPATH = "xpath"
        LINK_TEXT = "link text"
        PARTIAL_LINK_TEXT = "partial link text"
        TAG_NAME = "tag name"
        CLASS_NAME = "class name"
        CSS_SELECTOR = "css selector"

    class Keys:
        ENTER = "\ue007"
        RETURN = "\ue006"
        TAB = "\ue004"
        ESCAPE = "\ue00c"
        BACKSPACE = "\ue003"
        DELETE = "\ue017"
        ARROW_UP = "\ue013"
        ARROW_DOWN = "\ue015"
        ARROW_LEFT = "\ue012"
        ARROW_RIGHT = "\ue014"
        HOME = "\ue011"
        END = "\ue010"
        PAGE_UP = "\ue00e"
        PAGE_DOWN = "\ue00f"
        CONTROL = "\ue009"
        SHIFT = "\ue008"
        ALT = "\ue00a"
        COMMAND = "\ue00d"
        SPACE = "\ue00d"

    NoSuchElementException = Exception
    TimeoutException = Exception
    ElementClickInterceptedException = Exception
    ElementNotInteractableException = Exception
    StaleElementReferenceException = Exception
    WebDriverException = Exception

from retry_handler import RetryConfig, RetryHandler
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


class ElementNotFoundException(U8AutomationError):
    pass


class U8WebDriver:
    def __init__(self, config: Optional[Dict] = None):
        if webdriver is None:
            raise ImportError("selenium is required for U8WebDriver. Install with: pip install selenium")

        self.config = config or {}
        selenium_config = self.config.get("selenium", {})

        self.browser = selenium_config.get("browser", "chrome").lower()
        self.headless = selenium_config.get("headless", False)
        self.window_width = selenium_config.get("window_width", 1920)
        self.window_height = selenium_config.get("window_height", 1080)
        self.implicit_wait = selenium_config.get("implicit_wait", 10)
        self.page_load_timeout = selenium_config.get("page_load_timeout", 30)
        self.script_timeout = selenium_config.get("script_timeout", 10)
        self.use_webdriver_manager = selenium_config.get("use_webdriver_manager", True)
        self.driver_path = selenium_config.get("driver_path", "")
        self.arguments = selenium_config.get("arguments", [])
        self.experimental_options = selenium_config.get("experimental_options", {})
        self.user_agent = selenium_config.get("user_agent", "")

        self._driver = None
        self._wait = None
        self._actions = None

    @property
    def driver(self):
        if self._driver is None:
            raise U8AutomationError("WebDriver not initialized. Call start() first.")
        return self._driver

    @property
    def wait(self):
        if self._wait is None:
            raise U8AutomationError("WebDriver not initialized. Call start() first.")
        return self._wait

    def start(self) -> None:
        start_time = time.time()
        try:
            if self.browser == "chrome":
                self._init_chrome()
            elif self.browser == "firefox":
                self._init_firefox()
            elif self.browser == "edge":
                self._init_edge()
            else:
                raise U8AutomationError(f"Unsupported browser: {self.browser}")

            self._driver.set_window_size(self.window_width, self.window_height)
            self._driver.implicitly_wait(self.implicit_wait)
            self._driver.set_page_load_timeout(self.page_load_timeout)
            self._driver.set_script_timeout(self.script_timeout)

            self._wait = WebDriverWait(self._driver, self.implicit_wait)
            self._actions = ActionChains(self._driver)

            duration = time.time() - start_time
            logger.info(
                f"WebDriver started: {self.browser} (headless={self.headless})",
                extra={
                    "operation": "webdriver_start",
                    "status": "success",
                    "duration": duration,
                    "browser": self.browser,
                    "headless": self.headless,
                },
            )

        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Failed to start WebDriver: {str(e)}",
                extra={
                    "operation": "webdriver_start",
                    "status": "failed",
                    "duration": duration,
                    "error": str(e),
                },
            )
            raise U8AutomationError(f"Failed to start WebDriver: {str(e)}") from e

    def _init_chrome(self) -> None:
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service

        options = Options()

        if self.headless:
            options.add_argument("--headless=new")

        for arg in self.arguments:
            options.add_argument(arg)

        if self.user_agent:
            options.add_argument(f"--user-agent={self.user_agent}")

        for key, value in self.experimental_options.items():
            options.add_experimental_option(key, value)

        if self.use_webdriver_manager:
            from webdriver_manager.chrome import ChromeDriverManager
            service = Service(ChromeDriverManager().install())
        elif self.driver_path:
            service = Service(self.driver_path)
        else:
            service = Service()

        self._driver = webdriver.Chrome(service=service, options=options)

    def _init_firefox(self) -> None:
        from selenium.webdriver.firefox.options import Options
        from selenium.webdriver.firefox.service import Service

        options = Options()
        if self.headless:
            options.add_argument("--headless")

        for arg in self.arguments:
            options.add_argument(arg)

        if self.use_webdriver_manager:
            from webdriver_manager.firefox import GeckoDriverManager
            service = Service(GeckoDriverManager().install())
        elif self.driver_path:
            service = Service(self.driver_path)
        else:
            service = Service()

        self._driver = webdriver.Firefox(service=service, options=options)

    def _init_edge(self) -> None:
        from selenium.webdriver.edge.options import Options
        from selenium.webdriver.edge.service import Service

        options = Options()
        if self.headless:
            options.add_argument("--headless=new")

        for arg in self.arguments:
            options.add_argument(arg)

        if self.use_webdriver_manager:
            from webdriver_manager.microsoft import EdgeChromiumDriverManager
            service = Service(EdgeChromiumDriverManager().install())
        elif self.driver_path:
            service = Service(self.driver_path)
        else:
            service = Service()

        self._driver = webdriver.Edge(service=service, options=options)

    def stop(self) -> None:
        if self._driver is not None:
            try:
                self._driver.quit()
                logger.info("WebDriver stopped", extra={
                    "operation": "webdriver_stop",
                    "status": "success",
                    "duration": 0.0,
                })
            except Exception as e:
                logger.warning(f"Error stopping WebDriver: {str(e)}")
            finally:
                self._driver = None
                self._wait = None
                self._actions = None

    def navigate(self, url: str) -> None:
        start_time = time.time()
        try:
            self.driver.get(url)
            duration = time.time() - start_time
            logger.info(
                f"Navigated to: {url}",
                extra={
                    "operation": "navigate",
                    "status": "success",
                    "duration": duration,
                    "url": url,
                },
            )
        except TimeoutException as e:
            duration = time.time() - start_time
            logger.warning(
                f"Page load timeout for {url}: {str(e)}",
                extra={
                    "operation": "navigate",
                    "status": "timeout",
                    "duration": duration,
                    "url": url,
                },
            )
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Failed to navigate to {url}: {str(e)}",
                extra={
                    "operation": "navigate",
                    "status": "failed",
                    "duration": duration,
                    "url": url,
                    "error": str(e),
                },
            )
            raise U8AutomationError(f"Navigation failed: {str(e)}") from e

    def find_element(self, selector: str, by: str = By.CSS_SELECTOR, timeout: Optional[int] = None):
        timeout = timeout or self.implicit_wait
        try:
            wait = WebDriverWait(self.driver, timeout)
            element = wait.until(EC.presence_of_element_located((by, selector)))
            return element
        except TimeoutException as e:
            raise ElementNotFoundException(f"Element not found: {selector}") from e

    def find_clickable_element(self, selector: str, by: str = By.CSS_SELECTOR, timeout: Optional[int] = None):
        timeout = timeout or self.implicit_wait
        try:
            wait = WebDriverWait(self.driver, timeout)
            element = wait.until(EC.element_to_be_clickable((by, selector)))
            return element
        except TimeoutException as e:
            raise ElementNotFoundException(f"Element not clickable: {selector}") from e

    def find_visible_element(self, selector: str, by: str = By.CSS_SELECTOR, timeout: Optional[int] = None):
        timeout = timeout or self.implicit_wait
        try:
            wait = WebDriverWait(self.driver, timeout)
            element = wait.until(EC.visibility_of_element_located((by, selector)))
            return element
        except TimeoutException as e:
            raise ElementNotFoundException(f"Element not visible: {selector}") from e

    def is_element_present(self, selector: str, by: str = By.CSS_SELECTOR) -> bool:
        try:
            self.driver.find_element(by, selector)
            return True
        except NoSuchElementException:
            return False

    def click(self, selector: str, by: str = By.CSS_SELECTOR, timeout: Optional[int] = None) -> None:
        start_time = time.time()
        handler = RetryHandler(
            RetryConfig(max_attempts=3, base_delay=0.5, retry_on=[
                "ElementClickInterceptedException",
                "ElementNotInteractableException",
                "StaleElementReferenceException",
            ]),
            f"click_{selector}",
        )

        def try_click():
            element = self.find_clickable_element(selector, by, timeout)
            try:
                element.click()
            except ElementClickInterceptedException:
                self.driver.execute_script("arguments[0].click();", element)

        try:
            handler.execute(try_click)
            duration = time.time() - start_time
            logger.debug(
                f"Clicked: {selector}",
                extra={
                    "operation": f"click_{selector}",
                    "status": "success",
                    "duration": duration,
                    "selector": selector,
                },
            )
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Failed to click {selector}: {str(e)}",
                extra={
                    "operation": f"click_{selector}",
                    "status": "failed",
                    "duration": duration,
                    "error": str(e),
                },
            )
            raise

    def type_text(self, selector: str, text: str, by: str = By.CSS_SELECTOR, clear: bool = True) -> None:
        start_time = time.time()
        try:
            element = self.find_clickable_element(selector, by)
            if clear:
                element.clear()
                time.sleep(0.1)
            element.send_keys(text)

            duration = time.time() - start_time
            logger.debug(
                f"Typed text into {selector}: {text[:30]}...",
                extra={
                    "operation": f"type_{selector}",
                    "status": "success",
                    "duration": duration,
                    "text_length": len(text),
                },
            )
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Failed to type into {selector}: {str(e)}",
                extra={
                    "operation": f"type_{selector}",
                    "status": "failed",
                    "duration": duration,
                    "error": str(e),
                },
            )
            raise FormFillError(f"Failed to type into {selector}: {str(e)}") from e

    def get_text(self, selector: str, by: str = By.CSS_SELECTOR) -> str:
        try:
            element = self.find_visible_element(selector, by)
            return element.text.strip()
        except ElementNotFoundException:
            return ""

    def get_attribute(self, selector: str, attribute: str, by: str = By.CSS_SELECTOR) -> Optional[str]:
        try:
            element = self.find_element(selector, by)
            return element.get_attribute(attribute)
        except ElementNotFoundException:
            return None

    def scroll_to_element(self, selector: str, by: str = By.CSS_SELECTOR) -> None:
        element = self.find_element(selector, by)
        self.driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", element)
        time.sleep(0.3)

    def execute_script(self, script: str, *args) -> Any:
        return self.driver.execute_script(script, *args)

    def wait_for_element(self, selector: str, by: str = By.CSS_SELECTOR, timeout: Optional[int] = None) -> bool:
        timeout = timeout or self.implicit_wait
        try:
            wait = WebDriverWait(self.driver, timeout)
            wait.until(EC.presence_of_element_located((by, selector)))
            return True
        except TimeoutException:
            return False

    def wait_for_element_invisible(self, selector: str, by: str = By.CSS_SELECTOR, timeout: Optional[int] = None) -> bool:
        timeout = timeout or self.implicit_wait
        try:
            wait = WebDriverWait(self.driver, timeout)
            wait.until(EC.invisibility_of_element_located((by, selector)))
            return True
        except TimeoutException:
            return False

    def take_screenshot(self) -> Image.Image:
        screenshot_bytes = self.driver.get_screenshot_as_png()
        return Image.open(io.BytesIO(screenshot_bytes))

    def take_element_screenshot(self, selector: str, by: str = By.CSS_SELECTOR) -> Image.Image:
        element = self.find_element(selector, by)
        element_png = element.screenshot_as_png
        return Image.open(io.BytesIO(element_png))

    def get_current_url(self) -> str:
        return self.driver.current_url

    def get_title(self) -> str:
        return self.driver.title

    def switch_to_frame(self, frame_reference: Any) -> None:
        self.driver.switch_to.frame(frame_reference)

    def switch_to_default_content(self) -> None:
        self.driver.switch_to.default_content()

    def accept_alert(self) -> None:
        self.driver.switch_to.alert.accept()

    def dismiss_alert(self) -> None:
        self.driver.switch_to.alert.dismiss()

    def get_cookies(self) -> List[Dict]:
        return self.driver.get_cookies()

    def add_cookie(self, cookie: Dict) -> None:
        self.driver.add_cookie(cookie)

    @classmethod
    def from_yaml_config(cls, config: Dict) -> "U8WebDriver":
        return cls(config=config)


class U8Authenticator:
    def __init__(
        self,
        username: str,
        password: str,
        web_driver: U8WebDriver,
        selectors: Dict,
        captcha_solver: Optional[CaptchaSolver] = None,
        retry_config: Optional[RetryConfig] = None,
    ):
        self.username = username
        self.password = password
        self.web_driver = web_driver
        self.selectors = selectors
        self.captcha_solver = captcha_solver
        self.retry_config = retry_config or RetryConfig(
            max_attempts=3,
            base_delay=2.0,
            retry_on=["LoginError"],
        )
        self._last_login_time: Optional[float] = None
        self._session_timeout = 1800
        self._login_url = ""

    def login(self, login_url: str) -> bool:
        self._login_url = login_url
        start_time = time.time()
        handler = RetryHandler(self.retry_config, "u8_login")

        def try_login():
            return self._perform_login(login_url)

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

    def _perform_login(self, login_url: str) -> bool:
        login_selectors = self.selectors.get("login", {})

        self.web_driver.navigate(login_url)
        time.sleep(1)

        username_selector = login_selectors.get("username_input", "#username")
        password_selector = login_selectors.get("password_input", "#password")
        captcha_input_selector = login_selectors.get("captcha_input", "#captcha")
        captcha_image_selector = login_selectors.get("captcha_image", "#captcha-img")
        login_button_selector = login_selectors.get("login_button", "#btn-login")
        error_selector = login_selectors.get("error_message", ".login-error")
        success_selector = login_selectors.get("success_indicator", ".user-info")

        self.web_driver.type_text(username_selector, self.username)
        self.web_driver.type_text(password_selector, self.password)

        if self.captcha_solver and self.web_driver.is_element_present(captcha_image_selector):
            try:
                captcha_image = self.web_driver.take_element_screenshot(captcha_image_selector)
                captcha_text = self.captcha_solver.solve(captcha_image)
                self.web_driver.type_text(captcha_input_selector, captcha_text)
            except ElementNotFoundException:
                logger.info("No captcha image found, skipping captcha")
            except CaptchaManualFallbackRequired:
                logger.warning("Captcha requires manual input")
                self._wait_for_manual_captcha(success_selector)
                return True

        self.web_driver.click(login_button_selector)
        time.sleep(2)

        return self._verify_login(success_selector, error_selector)

    def _wait_for_manual_captcha(self, success_selector: str, timeout: int = 120) -> None:
        logger.info(
            f"Waiting for manual login (timeout={timeout}s)...",
            extra={
                "operation": "manual_captcha_wait",
                "status": "waiting",
                "duration": 0.0,
            },
        )
        if self.web_driver.wait_for_element(success_selector, timeout=timeout):
            logger.info("Manual login detected")
            return
        raise LoginError("Manual login timeout")

    def _verify_login(self, success_selector: str, error_selector: str) -> bool:
        if self.web_driver.is_element_present(error_selector):
            error_text = self.web_driver.get_text(error_selector)
            raise LoginError(f"Login error: {error_text}")

        if self.web_driver.wait_for_element(success_selector, timeout=10):
            return True

        raise LoginError("Login verification failed: success indicator not found")

    def is_session_valid(self) -> bool:
        if self._last_login_time is None:
            return False
        return (time.time() - self._last_login_time) < self._session_timeout

    def refresh_session(self, login_url: str = "") -> None:
        if not self.is_session_valid():
            logger.info("Session expired, refreshing login...", extra={
                "operation": "refresh_session",
                "status": "start",
                "duration": 0.0,
            })
            self.login(login_url or self._login_url)

    def set_session_timeout(self, timeout: int) -> None:
        self._session_timeout = timeout

    @classmethod
    def from_yaml_config(
        cls,
        config: Dict,
        web_driver: U8WebDriver,
        captcha_solver: Optional[CaptchaSolver] = None,
    ) -> "U8Authenticator":
        u8_config = config.get("u8_system", {})
        selectors = config.get("element_selectors", {})
        retry_config = RetryConfig.from_yaml_config(config.get("retry", {}))

        authenticator = cls(
            username=u8_config.get("username", ""),
            password=u8_config.get("password", ""),
            web_driver=web_driver,
            selectors=selectors,
            captcha_solver=captcha_solver,
            retry_config=retry_config,
        )
        authenticator.set_session_timeout(u8_config.get("session_timeout", 1800))
        return authenticator


class U8FormFiller:
    def __init__(
        self,
        web_driver: U8WebDriver,
        selectors: Dict,
        retry_config: Optional[RetryConfig] = None,
    ):
        self.web_driver = web_driver
        self.selectors = selectors
        self.retry_config = retry_config or RetryConfig(
            max_attempts=3,
            base_delay=1.0,
            retry_on=["FormFillError", "ElementNotFoundException"],
        )
        self.field_selector_map = {
            "invoice_code": "invoice_code_input",
            "invoice_number": "invoice_number_input",
            "tax_id": "tax_id_input",
            "amount": "amount_input",
            "invoice_date": "date_input",
            "seller": "seller_input",
        }

    def _get_field_selector(self, field_name: str) -> str:
        form_selectors = self.selectors.get("expense_form", {})
        selector_key = self.field_selector_map.get(field_name)
        if not selector_key:
            raise FormFillError(f"Unknown field: {field_name}")
        selector = form_selectors.get(selector_key)
        if not selector:
            raise FormFillError(f"Selector not configured for field: {field_name}")
        return selector

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
                    "value_length": len(value),
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
                    "value_length": len(value),
                    "attempts": handler.attempts,
                    "error": str(e),
                },
            )
            raise FormFillError(f"Failed to fill {field_name}: {str(e)}") from e

    def _fill_field_internal(self, field_name: str, value: str, verify: bool) -> bool:
        selector = self._get_field_selector(field_name)

        self.web_driver.scroll_to_element(selector)
        time.sleep(0.2)
        self.web_driver.type_text(selector, value)
        time.sleep(0.3)

        if verify:
            return self._verify_field_value(field_name, value)

        return True

    def _verify_field_value(self, field_name: str, expected_value: str) -> bool:
        try:
            selector = self._get_field_selector(field_name)
            actual_value = self.web_driver.get_attribute(selector, "value") or ""

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
        form_selectors = self.selectors.get("expense_form", {})
        submit_selector = form_selectors.get("submit_button", "#btn-submit")
        success_selector = form_selectors.get("success_toast", ".el-message--success")

        try:
            self.web_driver.scroll_to_element(submit_selector)
            self.web_driver.click(submit_selector)

            if self.web_driver.wait_for_element(success_selector, timeout=10):
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
            else:
                raise FormFillError("Submit success indicator not found")

        except ElementNotFoundException as e:
            duration = time.time() - start_time
            logger.error(
                f"Submit button not found: {str(e)}",
                extra={
                    "operation": "submit_form",
                    "status": "failed",
                    "duration": duration,
                    "error": str(e),
                },
            )
            raise

    def save_form(self) -> bool:
        start_time = time.time()
        form_selectors = self.selectors.get("expense_form", {})
        save_selector = form_selectors.get("save_button", "#btn-save")
        success_selector = form_selectors.get("success_toast", ".el-message--success")

        try:
            self.web_driver.scroll_to_element(save_selector)
            self.web_driver.click(save_selector)

            if self.web_driver.wait_for_element(success_selector, timeout=10):
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
            else:
                raise FormFillError("Save success indicator not found")

        except ElementNotFoundException as e:
            duration = time.time() - start_time
            logger.error(
                f"Save button not found: {str(e)}",
                extra={
                    "operation": "save_form",
                    "status": "failed",
                    "duration": duration,
                    "error": str(e),
                },
            )
            raise

    def new_form(self, new_button_selector: Optional[str] = None) -> bool:
        start_time = time.time()
        form_selectors = self.selectors.get("expense_form", {})
        new_selector = new_button_selector or form_selectors.get("new_button", "#btn-new")

        try:
            self.web_driver.click(new_selector)
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

    def navigate_to_expense_module(self, expense_url: str) -> bool:
        start_time = time.time()
        form_selectors = self.selectors.get("expense_form", {})
        form_container = form_selectors.get("form_container", ".expense-form")

        handler = RetryHandler(self.retry_config, "navigate_to_expense_module")

        def try_navigate():
            self.web_driver.navigate(expense_url)
            if not self.web_driver.wait_for_element(form_container, timeout=10):
                raise U8AutomationError("Expense form page not loaded")
            return True

        try:
            result = handler.execute(try_navigate)
            duration = time.time() - start_time
            logger.info(
                f"Navigated to expense module: {expense_url}",
                extra={
                    "operation": "navigate_to_expense_module",
                    "status": "success",
                    "duration": duration,
                    "url": expense_url,
                },
            )
            return result
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Failed to navigate to expense module: {str(e)}",
                extra={
                    "operation": "navigate_to_expense_module",
                    "status": "failed",
                    "duration": duration,
                    "error": str(e),
                },
            )
            raise U8AutomationError(str(e)) from e

    def is_error_dialog_present(self) -> bool:
        form_selectors = self.selectors.get("expense_form", {})
        error_dialog = form_selectors.get("error_dialog", ".el-dialog--error")
        return self.web_driver.is_element_present(error_dialog)

    def close_error_dialog(self) -> bool:
        form_selectors = self.selectors.get("expense_form", {})
        error_dialog = form_selectors.get("error_dialog", ".el-dialog--error")
        try:
            close_btn = f"{error_dialog} .el-dialog__close"
            self.web_driver.click(close_btn)
            return self.web_driver.wait_for_element_invisible(error_dialog, timeout=5)
        except Exception:
            return False


class U8Automation:
    def __init__(
        self,
        web_driver: U8WebDriver,
        authenticator: U8Authenticator,
        form_filler: U8FormFiller,
        config: Optional[Dict] = None,
    ):
        self.web_driver = web_driver
        self.authenticator = authenticator
        self.form_filler = form_filler
        self.config = config or {}
        self._is_initialized = False
        self._login_url = ""
        self._expense_url = ""

    def initialize(self) -> None:
        if self._is_initialized:
            return

        u8_config = self.config.get("u8_system", {})
        self._login_url = u8_config.get("login_url", "")
        self._expense_url = u8_config.get("expense_url", "")

        self.web_driver.start()
        self.authenticator.login(self._login_url)
        self.form_filler.navigate_to_expense_module(self._expense_url)

        self._is_initialized = True
        logger.info("U8 Automation initialized successfully", extra={
            "operation": "initialize",
            "status": "success",
            "duration": 0.0,
        })

    def process_invoice(self, invoice_data: Dict[str, str], required_fields: Optional[List[str]] = None) -> bool:
        start_time = time.time()
        try:
            self.authenticator.refresh_session(self._login_url)

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

    def cleanup(self) -> None:
        if self.web_driver is not None:
            self.web_driver.stop()
        self._is_initialized = False
        logger.info("U8 Automation cleaned up", extra={
            "operation": "cleanup",
            "status": "success",
            "duration": 0.0,
        })

    @classmethod
    def from_yaml_config(
        cls,
        config: Dict,
        captcha_solver: Optional[CaptchaSolver] = None,
    ) -> "U8Automation":
        web_driver = U8WebDriver.from_yaml_config(config)
        authenticator = U8Authenticator.from_yaml_config(config, web_driver, captcha_solver)
        selectors = config.get("element_selectors", {})
        retry_config = RetryConfig.from_yaml_config(config.get("retry", {}))
        form_filler = U8FormFiller(web_driver, selectors, retry_config)

        return cls(
            web_driver=web_driver,
            authenticator=authenticator,
            form_filler=form_filler,
            config=config,
        )
