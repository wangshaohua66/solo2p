import logging
import time
import random
from typing import Optional, List, Dict, Any

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    WebDriverException,
    TimeoutException,
    NoSuchElementException,
    StaleElementReferenceException,
)
from retrying import retry

from config import settings, get_random_user_agent

logger = logging.getLogger(__name__)


def is_retryable_exception(exception: Exception) -> bool:
    return isinstance(exception, (WebDriverException, TimeoutException, ConnectionError))


class BrowserManager:
    def __init__(self, headless: Optional[bool] = None):
        self.headless = headless if headless is not None else settings.headless
        self.driver: Optional[webdriver.Chrome] = None
        self.cookies: List[Dict[str, Any]] = []

    def _build_options(self) -> Options:
        options = Options()
        if self.headless:
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
        options.add_argument(f"user-agent={get_random_user_agent()}")
        options.page_load_strategy = "eager"
        return options

    def start(self) -> webdriver.Chrome:
        logger.info("Initializing Chrome WebDriver (headless=%s)", self.headless)
        try:
            options = self._build_options()
            self.driver = webdriver.Chrome(options=options)
            self.driver.set_page_load_timeout(settings.timeout.page_load)
            self.driver.set_script_timeout(settings.timeout.page_load)
            self.driver.execute_cdp_cmd(
                "Page.addScriptToEvaluateOnNewDocument",
                {
                    "source": """
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });
                    """
                },
            )
            logger.info("Chrome WebDriver initialized successfully")
            return self.driver
        except WebDriverException as e:
            logger.error("Failed to initialize WebDriver: %s", str(e))
            raise

    def quit(self):
        if self.driver:
            logger.info("Closing Chrome WebDriver")
            try:
                self.driver.quit()
            except Exception as e:
                logger.warning("Error while quitting driver: %s", str(e))
            finally:
                self.driver = None

    @retry(
        retry_on_exception=is_retryable_exception,
        stop_max_attempt_number=3,
        wait_exponential_multiplier=1000,
        wait_exponential_max=4000,
    )
    def navigate(self, url: str) -> None:
        if not self.driver:
            raise RuntimeError("WebDriver not initialized. Call start() first.")
        logger.debug("Navigating to: %s", url)
        self._sleep_random()
        self.driver.get(url)

    @retry(
        retry_on_exception=is_retryable_exception,
        stop_max_attempt_number=3,
        wait_exponential_multiplier=1000,
        wait_exponential_max=4000,
    )
    def wait_for_element(self, by: By, value: str, timeout: Optional[int] = None) -> Any:
        wait_time = timeout or settings.timeout.element_wait
        logger.debug("Waiting for element: %s=%s (timeout=%ss)", by, value, wait_time)
        wait = WebDriverWait(self.driver, wait_time)
        return wait.until(EC.presence_of_element_located((by, value)))

    def wait_for_ajax(self, timeout: Optional[int] = None) -> bool:
        wait_time = timeout or settings.timeout.element_wait
        logger.debug("Waiting for AJAX requests to complete")
        end_time = time.time() + wait_time
        while time.time() < end_time:
            try:
                jquery_active = self.driver.execute_script(
                    "return (typeof jQuery !== 'undefined') ? jQuery.active : 0;"
                )
                js_ready = self.driver.execute_script("return document.readyState;")
                if jquery_active == 0 and js_ready == "complete":
                    return True
            except Exception:
                pass
            time.sleep(0.5)
        return True

    def scroll_infinite(self, max_attempts: Optional[int] = None) -> int:
        max_attempts = max_attempts or settings.crawler.max_scroll_attempts
        logger.info("Starting infinite scroll (max_attempts=%d)", max_attempts)
        scroll_count = 0
        last_height = 0
        for _ in range(max_attempts):
            try:
                current_height = self.driver.execute_script(
                    "return document.body.scrollHeight"
                )
                self.driver.execute_script(
                    "window.scrollTo(0, document.body.scrollHeight);"
                )
                time.sleep(settings.crawler.scroll_pause_time)
                new_height = self.driver.execute_script(
                    "return document.body.scrollHeight"
                )
                if new_height == last_height:
                    logger.debug("Reached bottom of page after %d scrolls", scroll_count)
                    break
                last_height = new_height
                scroll_count += 1
            except StaleElementReferenceException:
                time.sleep(1)
                continue
        logger.info("Infinite scroll completed, total scrolls: %d", scroll_count)
        return scroll_count

    def click_load_more(self, by: By, selector: str, max_clicks: int = 50) -> int:
        logger.info("Clicking 'load more' button (max_clicks=%d)", max_clicks)
        click_count = 0
        for _ in range(max_clicks):
            try:
                button = self.driver.find_element(by, selector)
                if not button.is_displayed() or not button.is_enabled():
                    break
                self.driver.execute_script("arguments[0].scrollIntoView(true);", button)
                time.sleep(0.5)
                button.click()
                click_count += 1
                time.sleep(settings.crawler.scroll_pause_time)
            except (NoSuchElementException, StaleElementReferenceException):
                break
        logger.info("Load more clicks completed: %d", click_count)
        return click_count

    def get_page_source(self) -> str:
        if not self.driver:
            raise RuntimeError("WebDriver not initialized")
        return self.driver.page_source

    def save_cookies(self) -> List[Dict[str, Any]]:
        if self.driver:
            self.cookies = self.driver.get_cookies()
            logger.debug("Saved %d cookies", len(self.cookies))
        return self.cookies

    def load_cookies(self, cookies: Optional[List[Dict[str, Any]]] = None) -> None:
        cookies_to_load = cookies or self.cookies
        if not self.driver or not cookies_to_load:
            return
        logger.debug("Loading %d cookies", len(cookies_to_load))
        for cookie in cookies_to_load:
            try:
                if "expiry" in cookie:
                    cookie["expiry"] = int(cookie["expiry"])
                self.driver.add_cookie(cookie)
            except Exception as e:
                logger.warning("Failed to add cookie: %s", str(e))

    def handle_captcha(self) -> bool:
        captcha_indicators = [
            (By.XPATH, "//iframe[contains(@src, 'captcha')]"),
            (By.XPATH, "//*[contains(text(), '验证码')]"),
            (By.XPATH, "//*[contains(@class, 'captcha')]"),
            (By.ID, "captcha"),
        ]
        for by, selector in captcha_indicators:
            try:
                self.driver.find_element(by, selector)
                logger.warning("CAPTCHA detected on page, pausing for manual resolution")
                return True
            except NoSuchElementException:
                continue
        return False

    def _sleep_random(self) -> None:
        interval = random.uniform(
            settings.crawler.request_interval_min,
            settings.crawler.request_interval_max,
        )
        time.sleep(interval)

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.quit()
