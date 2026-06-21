import logging
import time
import json
import random
import sys
from collections import deque
from typing import Optional, List, Dict, Any, Deque
from pathlib import Path

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


class CookiePool:
    def __init__(
        self,
        storage_path: Optional[str] = None,
        strategy: str = "round_robin",
        max_size: int = 5,
    ):
        self.storage_path = Path(storage_path or settings.cookie_pool.storage_path)
        self.strategy = strategy or settings.cookie_pool.rotation_strategy
        self.max_size = max_size or settings.cookie_pool.pool_size
        self._pool: Deque[List[Dict[str, Any]]] = deque(maxlen=self.max_size)
        self._cursor: int = 0
        self._load_from_file()

    def _load_from_file(self):
        if self.storage_path.exists():
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for cookies in data:
                        if cookies:
                            self._pool.append(cookies)
                logger.info(
                    "Cookie pool loaded from %s, %d cookie sets",
                    self.storage_path, len(self._pool),
                )
            except (json.JSONDecodeError, IOError) as e:
                logger.warning("Failed to load cookie pool: %s", str(e))

    def _persist_to_file(self):
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(list(self._pool), f, ensure_ascii=False, indent=2)
        except IOError as e:
            logger.warning("Failed to persist cookie pool: %s", str(e))

    def add_cookies(self, cookies: List[Dict[str, Any]]):
        if not cookies:
            return
        self._pool.append(cookies)
        self._persist_to_file()
        logger.info("Added %d cookies to pool (total=%d)", len(cookies), len(self._pool))

    def add_from_driver(self, driver: webdriver.Chrome):
        if not driver:
            return
        cookies = driver.get_cookies()
        if cookies:
            self.add_cookies(cookies)
        return cookies

    def apply_next(self, driver: webdriver.Chrome) -> bool:
        if not driver or not self._pool:
            return False
        if self.strategy == "random":
            cookies = random.choice(list(self._pool))
        else:
            cookies = self._pool[self._cursor % len(self._pool)]
            self._cursor += 1

        for cookie in cookies:
            try:
                c = dict(cookie)
                if "expiry" in c:
                    c["expiry"] = int(c["expiry"])
                driver.add_cookie(c)
            except Exception as e:
                logger.debug("Skipping cookie %s: %s", cookie.get("name"), str(e))

        logger.debug(
            "Applied cookie set #%d (%d cookies) using strategy=%s",
            self._cursor, len(cookies), self.strategy,
        )
        return True

    def size(self) -> int:
        return len(self._pool)

    def clear(self):
        self._pool.clear()
        self._cursor = 0
        self._persist_to_file()
        logger.info("Cookie pool cleared")

    def __len__(self) -> int:
        return len(self._pool)


_global_cookie_pool: Optional[CookiePool] = None


def get_cookie_pool() -> CookiePool:
    global _global_cookie_pool
    if _global_cookie_pool is None:
        _global_cookie_pool = CookiePool()
    return _global_cookie_pool


class BrowserManager:
    def __init__(self, headless: Optional[bool] = None, use_cookie_pool: Optional[bool] = None):
        self.headless = headless if headless is not None else settings.headless
        self.use_cookie_pool = (
            use_cookie_pool if use_cookie_pool is not None else settings.cookie_pool.enabled
        )
        self.driver: Optional[webdriver.Chrome] = None
        self.cookies: List[Dict[str, Any]] = []
        self.cookie_pool: Optional[CookiePool] = get_cookie_pool() if self.use_cookie_pool else None
        self._captcha_resolved = False

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
        logger.info(
            "Initializing Chrome WebDriver (headless=%s, cookie_pool=%s)",
            self.headless, self.use_cookie_pool,
        )
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
                if self.use_cookie_pool and self.cookie_pool:
                    self.cookie_pool.add_from_driver(self.driver)
                else:
                    self.cookies = self.driver.get_cookies()
            except Exception:
                pass
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
    def navigate(self, url: str, apply_cookies: bool = True) -> None:
        if not self.driver:
            raise RuntimeError("WebDriver not initialized. Call start() first.")
        logger.debug("Navigating to: %s", url)
        self._sleep_random()
        self.driver.get(url)
        if apply_cookies and self.use_cookie_pool and self.cookie_pool and len(self.cookie_pool) > 0:
            self.cookie_pool.apply_next(self.driver)
            self.driver.refresh()
            logger.debug("Cookie pool applied and page refreshed")

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
                if self._check_and_handle_captcha():
                    if self._captcha_resolved is False:
                        logger.warning("Captcha unresolved, stopping infinite scroll")
                        break
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
                if self._check_and_handle_captcha():
                    if self._captcha_resolved is False:
                        logger.warning("Captcha unresolved, stopping load more clicks")
                        break
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
        if not self.driver:
            return self.cookies
        self.cookies = self.driver.get_cookies()
        logger.debug("Saved %d cookies", len(self.cookies))
        if self.use_cookie_pool and self.cookie_pool:
            self.cookie_pool.add_cookies(self.cookies)
        return self.cookies

    def load_cookies(self, cookies: Optional[List[Dict[str, Any]]] = None) -> None:
        cookies_to_load = cookies or self.cookies
        if not self.driver or not cookies_to_load:
            return
        logger.debug("Loading %d cookies", len(cookies_to_load))
        for cookie in cookies_to_load:
            try:
                c = dict(cookie)
                if "expiry" in c:
                    c["expiry"] = int(c["expiry"])
                self.driver.add_cookie(c)
            except Exception as e:
                logger.warning("Failed to add cookie: %s", str(e))

    def _is_captcha_present(self) -> bool:
        captcha_indicators = [
            (By.XPATH, "//iframe[contains(@src, 'captcha')]"),
            (By.XPATH, "//*[contains(text(), '验证码')]"),
            (By.XPATH, "//*[contains(@class, 'captcha')]"),
            (By.ID, "captcha"),
            (By.CSS_SELECTOR, ".captcha-container"),
            (By.CSS_SELECTOR, "#nc_1_wrapper"),
        ]
        for by, selector in captcha_indicators:
            try:
                elements = self.driver.find_elements(by, selector)
                visible = [e for e in elements if e.is_displayed()]
                if visible:
                    return True
            except (NoSuchElementException, StaleElementReferenceException):
                continue
        return False

    def _check_and_handle_captcha(self) -> bool:
        if self._is_captcha_present():
            logger.warning("CAPTCHA detected, triggering handling flow")
            self.handle_captcha()
            return True
        self._captcha_resolved = False
        return False

    def handle_captcha(self, block: bool = True) -> bool:
        if not self._is_captcha_present():
            return False

        timeout = settings.cookie_pool.captcha_wait_timeout
        poll_interval = settings.cookie_pool.captcha_poll_interval
        current_url = self.driver.current_url if self.driver else "unknown"

        logger.critical(
            "=" * 60 + "\n"
            "⚠️  验证码检测到！URL: %s\n"
            "%s\n"
            "=" * 60,
            current_url,
            (
                "请在打开的浏览器窗口中手动完成验证码验证，"
                f"系统将在 {timeout} 秒内每 {poll_interval} 秒轮询检测。"
                if not self.headless
                else "当前处于无头模式，无法自动处理验证码。"
                     "建议以 --no-headless 模式运行，或配置 cookies 避免触发验证码。"
            )
        )

        if not block:
            return True

        if self.headless:
            logger.error("Headless mode cannot handle captcha interactively. Aborting wait.")
            time.sleep(3)
            self._captcha_resolved = False
            return True

        try:
            print(
                "\n⚠️  请在浏览器中完成验证码验证。"
                "完成后按回车键继续（或系统将自动检测消失）...\n"
            )
            sys.stdout.flush()
        except Exception:
            pass

        start_time = time.time()
        user_confirm = {"done": False}

        def _wait_for_enter():
            try:
                sys.stdin.readline()
                user_confirm["done"] = True
            except Exception:
                pass

        import threading
        t = threading.Thread(target=_wait_for_enter, daemon=True)
        t.start()

        while time.time() - start_time < timeout:
            if user_confirm["done"]:
                logger.info("User confirmed captcha resolution")
                self._captcha_resolved = True
                return True
            if not self._is_captcha_present():
                logger.info("Captcha automatically detected as resolved")
                self._captcha_resolved = True
                return True
            time.sleep(poll_interval)

        if self._is_captcha_present():
            logger.error("Captcha timed out after %ds", timeout)
            self._captcha_resolved = False
            return True

        self._captcha_resolved = True
        return True

    def capture_screenshot(self, filepath: Optional[str] = None) -> Optional[str]:
        if not self.driver:
            return None
        if filepath is None:
            filepath = os.path.join(
                settings.logging.log_dir,
                f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png",
            )
        try:
            Path(filepath).parent.mkdir(parents=True, exist_ok=True)
            self.driver.save_screenshot(filepath)
            logger.info("Screenshot saved: %s", filepath)
            return filepath
        except Exception as e:
            logger.warning("Failed to capture screenshot: %s", str(e))
            return None

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


from datetime import datetime
import os
