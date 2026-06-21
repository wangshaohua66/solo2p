import time
import random
import hashlib
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import (
    TimeoutException,
    NoSuchElementException,
    StaleElementReferenceException,
    WebDriverException,
)

try:
    from webdriver_manager.chrome import ChromeDriverManager
    _HAS_WEBDRIVER_MANAGER = True
except ImportError:
    _HAS_WEBDRIVER_MANAGER = False

from config import load_config, AppConfig, SiteConfig, RetryConfig
from logger import get_logger


logger = get_logger("spider")


IGNORED_EXCEPTIONS = (
    NoSuchElementException,
    StaleElementReferenceException,
)


class BaseSpider(ABC):
    def __init__(self, site_config: SiteConfig, app_config: Optional[AppConfig] = None):
        self.site = site_config
        self.config = app_config or load_config()
        self.driver: Optional[WebDriver] = None
        self.wait: Optional[WebDriverWait] = None
        self._crawl_stats: Dict[str, Any] = {
            "pages_crawled": 0,
            "items_extracted": 0,
            "errors": 0,
        }

    def _build_options(self) -> Options:
        opts = Options()
        if self.config.crawler.headless:
            opts.add_argument("--headless=new")
        opts.add_argument(f"--window-size={self.config.crawler.window_size}")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--disable-gpu")
        opts.add_argument("--disable-blink-features=AutomationControlled")
        opts.add_experimental_option("excludeSwitches", ["enable-automation"])
        opts.add_experimental_option("useAutomationExtension", False)
        opts.add_argument(
            "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        return opts

    def init_driver(self) -> None:
        opts = self._build_options()
        try:
            if _HAS_WEBDRIVER_MANAGER:
                service = Service(ChromeDriverManager().install())
                self.driver = webdriver.Chrome(service=service, options=opts)
            else:
                self.driver = webdriver.Chrome(options=opts)
        except Exception:
            self.driver = webdriver.Chrome(options=opts)
        self.driver.set_page_load_timeout(self.config.crawler.page_load_timeout)
        self.driver.implicitly_wait(self.config.crawler.implicit_wait)
        self.wait = WebDriverWait(
            self.driver,
            self.config.crawler.implicit_wait,
            ignored_exceptions=IGNORED_EXCEPTIONS,
        )
        logger.info(f"[{self.site.name}] 浏览器初始化完成")

    def close_driver(self) -> None:
        if self.driver is not None:
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None
            self.wait = None
            logger.info(f"[{self.site.name}] 浏览器已关闭")

    def retry_on_failure(self, func, *args, **kwargs) -> Any:
        retry_cfg: RetryConfig = self.config.retry
        last_exception = None
        for attempt in range(retry_cfg.max_retries):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                last_exception = e
                wait_time = retry_cfg.backoff_factor ** attempt + random.uniform(0, 1)
                logger.warning(
                    f"[{self.site.name}] 操作失败 (第{attempt + 1}/{retry_cfg.max_retries}次): "
                    f"{e}, {wait_time:.1f}s后重试"
                )
                time.sleep(wait_time)
        logger.error(f"[{self.site.name}] 操作最终失败: {last_exception}")
        self._crawl_stats["errors"] += 1
        raise last_exception

    def safe_get(self, url: str) -> None:
        def _get():
            self.driver.get(url)
            self._random_pause()
        self.retry_on_failure(_get)

    def _random_pause(self, min_s: Optional[float] = None, max_s: Optional[float] = None) -> None:
        base = self.site.request_interval
        min_s = min_s if min_s is not None else base * 0.5
        max_s = max_s if max_s is not None else base * 2.0
        time.sleep(random.uniform(min_s, max_s))

    def wait_for_element(self, by: str, value: str, timeout: Optional[int] = None) -> WebElement:
        t = timeout or self.config.crawler.implicit_wait
        wait = WebDriverWait(self.driver, t, ignored_exceptions=IGNORED_EXCEPTIONS)
        return wait.until(EC.presence_of_element_located((by, value)))

    def wait_for_clickable(self, by: str, value: str, timeout: Optional[int] = None) -> WebElement:
        t = timeout or self.config.crawler.implicit_wait
        wait = WebDriverWait(self.driver, t, ignored_exceptions=IGNORED_EXCEPTIONS)
        return wait.until(EC.element_to_be_clickable((by, value)))

    def wait_for_page(self, timeout: Optional[int] = None) -> None:
        t = timeout or self.config.crawler.page_load_timeout
        WebDriverWait(self.driver, t).until(
            lambda d: d.execute_script("return document.readyState") == "complete"
        )

    def safe_find_element(self, by: str, value: str, parent: Optional[WebElement] = None) -> Optional[WebElement]:
        try:
            ctx = parent or self.driver
            return ctx.find_element(by, value)
        except (NoSuchElementException, StaleElementReferenceException):
            return None

    def safe_find_elements(self, by: str, value: str, parent: Optional[WebElement] = None) -> List[WebElement]:
        try:
            ctx = parent or self.driver
            return ctx.find_elements(by, value)
        except (NoSuchElementException, StaleElementReferenceException):
            return []

    def safe_text(self, element: Optional[WebElement]) -> str:
        if element is None:
            return ""
        try:
            return element.text.strip()
        except StaleElementReferenceException:
            return ""

    def safe_attr(self, element: Optional[WebElement], attr: str) -> str:
        if element is None:
            return ""
        try:
            val = element.get_attribute(attr)
            return val.strip() if val else ""
        except StaleElementReferenceException:
            return ""

    def get_page_source(self) -> str:
        return self.driver.page_source

    def parse_html(self, html: Optional[str] = None) -> BeautifulSoup:
        source = html or self.get_page_source()
        return BeautifulSoup(source, "lxml")

    def scroll_to_bottom(self, pause: float = 1.0) -> None:
        last_height = self.driver.execute_script("return document.body.scrollHeight")
        for _ in range(5):
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(pause)
            new_height = self.driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                break
            last_height = new_height

    @staticmethod
    def gen_id(*parts: str) -> str:
        raw = "|".join(parts)
        return hashlib.md5(raw.encode("utf-8")).hexdigest()

    @abstractmethod
    def login(self) -> bool:
        ...

    @abstractmethod
    def crawl_job_fairs(self) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def crawl_fair_detail(self, fair: Dict[str, Any]) -> Dict[str, Any]:
        ...

    def get_stats(self) -> Dict[str, Any]:
        return dict(self._crawl_stats)

    def reset_stats(self) -> None:
        self._crawl_stats = {"pages_crawled": 0, "items_extracted": 0, "errors": 0}

    def __enter__(self):
        self.init_driver()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close_driver()
