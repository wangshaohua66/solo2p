import time
import random
import json
from typing import Generator, Optional
from urllib.parse import urljoin

from loguru import logger

from spiders.base_spider import BaseSpider
from utils.cookie_pool import CookiePool
from utils.captcha import CaptchaSolver
from utils.memory_monitor import MemoryMonitor


class DynamicSeleniumSpider(BaseSpider):
    name = "dynamic_selenium"
    strategy = "dynamic"

    def __init__(self, channel_config: dict, settings=None):
        super().__init__(channel_config, settings)
        self._cookie_pool = CookiePool(channel_config.get("code", "unknown"), settings)
        self._captcha_solver = CaptchaSolver(settings)
        self._driver = None
        self._mem_monitor = MemoryMonitor(settings)

    def _init_driver(self):
        if self._driver:
            return
        try:
            from seleniumwire import webdriver
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.chrome.service import Service

            options = Options()
            options.add_argument("--headless=new")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            options.add_argument("--window-size=1920,1080")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option("useAutomationExtension", False)

            from fake_useragent import UserAgent
            ua = UserAgent()
            options.add_argument(f"--user-agent={ua.random}")

            self._driver = webdriver.Chrome(options=options)
            self._driver.execute_cdp_cmd(
                "Page.addScriptToEvaluateOnNewDocument",
                {"source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"},
            )
            logger.info(f"Selenium driver initialized for {self._channel_code}")
        except Exception as e:
            logger.error(f"Failed to init selenium driver: {e}")
            raise

    def _close_driver(self):
        if self._driver:
            try:
                self._driver.quit()
            except Exception:
                pass
            self._driver = None

    def start(self, mode: str = "incremental") -> Generator[dict, None, None]:
        try:
            self._init_driver()
            self._load_cookies()

            if self._parser == "json_api":
                yield from self._crawl_dynamic_json(mode)
            else:
                yield from self._crawl_dynamic_html(mode)
        except Exception as e:
            logger.error(f"Dynamic spider error for {self._channel_code}: {e}")
        finally:
            self._save_cookies()
            self._close_driver()

    def _load_cookies(self):
        cookies = self._cookie_pool.get_selenium_cookies()
        if not cookies:
            return
        self._driver.get(self._base_url)
        time.sleep(2)
        for cookie in cookies:
            try:
                self._driver.add_cookie(cookie)
            except Exception as e:
                logger.debug(f"Failed to add cookie: {e}")
        logger.info(f"Loaded {len(cookies)} cookies for {self._channel_code}")

    def _save_cookies(self):
        if not self._driver:
            return
        try:
            selenium_cookies = self._driver.get_cookies()
            self._cookie_pool.save_selenium_cookies(selenium_cookies)
            logger.info(f"Saved {len(selenium_cookies)} cookies for {self._channel_code}")
        except Exception as e:
            logger.error(f"Failed to save cookies: {e}")

    def _crawl_dynamic_html(self, mode: str = "incremental") -> Generator[dict, None, None]:
        selectors = self._channel.get("selectors", {})
        list_url = urljoin(self._base_url, selectors.get("list_url", "/"))
        max_pages = 3 if mode == "incremental" else 30

        for page in range(1, max_pages + 1):
            page_url = f"{list_url}?page={page}" if page > 1 else list_url
            self._mem_monitor.check_and_gc()

            try:
                self._driver.get(page_url)
                time.sleep(random.uniform(2, 5))

                self._scroll_to_bottom()

                if self._check_captcha():
                    solved = self._solve_captcha()
                    if not solved:
                        logger.warning(f"Captcha unsolvable on {page_url}")
                        break

                items = self._parse_dynamic_html(selectors)
                if not items:
                    break

                for item in items:
                    if item.get("detail_url"):
                        detail = self._crawl_detail(item["detail_url"], selectors)
                        if detail:
                            item.update(detail)
                    yield item

            except Exception as e:
                logger.error(f"Dynamic crawl error on {page_url}: {e}")
                self._stats["failed"] += 1
                self._stats["total_count"] += 1

            time.sleep(random.uniform(1, 3))

    def _crawl_dynamic_json(self, mode: str = "incremental") -> Generator[dict, None, None]:
        selectors = self._channel.get("selectors", {})
        api_url = urljoin(self._base_url, selectors.get("api_url", "/api/list"))
        max_pages = 3 if mode == "incremental" else 100

        self._driver.get(self._base_url)
        time.sleep(3)

        for page in range(1, max_pages + 1):
            self._mem_monitor.check_and_gc()
            params = {"page": page, "page_size": 20}
            api_full_url = f"{api_url}?{'&'.join(f'{k}={v}' for k, v in params.items())}"

            try:
                self._driver.get(api_full_url)
                time.sleep(random.uniform(1, 3))

                intercepted = self._get_intercepted_responses(api_url)
                if intercepted:
                    for resp_data in intercepted:
                        yield from self._parse_json_response(resp_data, selectors)
                else:
                    body = self._driver.find_element("tag name", "pre").text
                    data = json.loads(body)
                    yield from self._parse_json_response(data, selectors)

            except Exception as e:
                logger.error(f"Dynamic JSON crawl error on page {page}: {e}")
                break

            time.sleep(random.uniform(0.5, 2))

    def _get_intercepted_responses(self, url_pattern: str) -> list:
        results = []
        try:
            for request in self._driver.requests:
                if request.response and url_pattern in request.url:
                    try:
                        body = request.response.body
                        if isinstance(body, bytes):
                            data = json.loads(body.decode("utf-8"))
                        else:
                            data = json.loads(body)
                        results.append(data)
                    except Exception:
                        continue
        except Exception as e:
            logger.debug(f"Failed to get intercepted responses: {e}")
        return results

    def _scroll_to_bottom(self):
        try:
            from selenium.webdriver.common.by import By

            last_height = self._driver.execute_script("return document.body.scrollHeight")
            for _ in range(3):
                self._driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(random.uniform(1, 2))
                new_height = self._driver.execute_script("return document.body.scrollHeight")
                if new_height == last_height:
                    break
                last_height = new_height
        except Exception as e:
            logger.debug(f"Scroll error: {e}")

    def _check_captcha(self) -> bool:
        try:
            from selenium.webdriver.common.by import By

            captcha_elements = self._driver.find_elements(By.CSS_SELECTOR,
                "input[name*='captcha'], img[src*='captcha'], #captcha, .captcha-img"
            )
            if captcha_elements:
                return True
            page_source = self._driver.page_source.lower()
            return "验证码" in page_source or "captcha" in page_source
        except Exception:
            return False

    def _solve_captcha(self) -> bool:
        try:
            from selenium.webdriver.common.by import By

            captcha_img = self._driver.find_elements(By.CSS_SELECTOR,
                "img[src*='captcha'], img[src*='verify']"
            )
            if not captcha_img:
                return False

            img_element = captcha_img[0]
            screenshot = img_element.screenshot_as_png
            code = self._captcha_solver.solve(screenshot)
            if not code:
                return False

            input_el = self._driver.find_elements(By.CSS_SELECTOR,
                "input[name*='captcha'], input[name*='verify']"
            )
            if input_el:
                input_el[0].clear()
                input_el[0].send_keys(code)
                submit = self._driver.find_elements(By.CSS_SELECTOR,
                    "button[type='submit'], input[type='submit']"
                )
                if submit:
                    submit[0].click()
                time.sleep(2)
                logger.info(f"Captcha solved: {code}")
                return True
        except Exception as e:
            logger.error(f"Captcha solve error: {e}")
        return False

    def _parse_dynamic_html(self, selectors: dict) -> list:
        from selenium.webdriver.common.by import By

        results = []
        try:
            item_sel = selectors.get("item_link", "div.complaint-item a")
            elements = self._driver.find_elements(By.CSS_SELECTOR, item_sel)
            for el in elements:
                try:
                    href = el.get_attribute("href") or ""
                    title_el = el.find_elements(By.CSS_SELECTOR, selectors.get("title", "h3"))
                    title = title_el[0].text.strip() if title_el else el.text.strip()
                    if not title:
                        continue
                    detail_url = href if href.startswith("http") else urljoin(self._base_url, href)
                    results.append({
                        "title": title,
                        "detail_url": detail_url,
                        "channel_code": self._channel_code,
                        "channel_type": self._channel_type,
                        "source_name": self._channel.get("name", ""),
                    })
                except Exception:
                    continue
        except Exception as e:
            logger.error(f"Dynamic HTML parse error: {e}")
        return results

    def _crawl_detail(self, url: str, selectors: dict) -> Optional[dict]:
        try:
            self._driver.get(url)
            time.sleep(random.uniform(1, 3))

            from selenium.webdriver.common.by import By

            content_el = self._driver.find_elements(By.CSS_SELECTOR,
                selectors.get("content", "div.complaint-detail")
            )
            content = content_el[0].text.strip() if content_el else ""

            date_el = self._driver.find_elements(By.CSS_SELECTOR,
                selectors.get("date", "span.time")
            )
            date_str = date_el[0].text.strip() if date_el else ""

            return {
                "content": content,
                "publish_date": date_str,
                "collected_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
        except Exception as e:
            logger.error(f"Detail crawl error for {url}: {e}")
            return None

    def _parse_json_response(self, data: dict, selectors: dict) -> Generator[dict, None, None]:
        list_key = selectors.get("list_key", "data.list")
        items = self._resolve_key_path(data, list_key)
        if not isinstance(items, list):
            return
        for entry in items:
            title = str(entry.get(selectors.get("title_key", "title"), ""))
            content = str(entry.get(selectors.get("content_key", "content"), ""))
            date_str = str(entry.get(selectors.get("date_key", "created"), ""))
            if not title and not content:
                continue
            yield {
                "title": title,
                "content": content,
                "publish_date": date_str,
                "detail_url": self._base_url,
                "channel_code": self._channel_code,
                "channel_type": self._channel_type,
                "source_name": self._channel.get("name", ""),
                "collected_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            }

    @staticmethod
    def _resolve_key_path(data, key_path: str):
        keys = key_path.split(".")
        current = data
        for k in keys:
            if isinstance(current, dict) and k in current:
                current = current[k]
            elif isinstance(current, list) and k.isdigit():
                idx = int(k)
                if idx < len(current):
                    current = current[idx]
                else:
                    return None
            else:
                return None
        return current
