import random
import time
import re
from scrapy import signals
from scrapy.http import HtmlResponse
from scrapy.downloadermiddlewares.useragent import UserAgentMiddleware as BaseUserAgentMiddleware
from config.settings import (
    USER_AGENTS, PROXY_POOL, ENABLE_PROXY,
    DOWNLOAD_DELAY, RANDOMIZE_DOWNLOAD_DELAY
)
from utils.logger import logger, log_error_with_context


class UserAgentMiddleware(BaseUserAgentMiddleware):
    def __init__(self, user_agent='Scrapy'):
        super().__init__(user_agent)
        self.user_agents = USER_AGENTS
        self.ua_count = len(self.user_agents)
        self._request_count = 0

    @classmethod
    def from_crawler(cls, crawler):
        middleware = cls()
        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        return middleware

    def process_request(self, request, spider):
        if 'User-Agent' not in request.headers:
            self._request_count += 1
            ua = self._get_user_agent()
            request.headers.setdefault(b'User-Agent', ua)

            if self._request_count % 100 == 0:
                logger.info(f"User-Agent rotated {self._request_count} times")

    def _get_user_agent(self):
        return random.choice(self.user_agents)

    def spider_opened(self, spider):
        logger.info(f"User-Agent middleware initialized with {self.ua_count} agents")


class ProxyMiddleware:
    def __init__(self):
        self.proxy_pool = PROXY_POOL
        self.enable_proxy = ENABLE_PROXY
        self.proxy_index = 0
        self.failed_proxies = set()
        self.request_count = 0
        self.success_count = 0

    @classmethod
    def from_crawler(cls, crawler):
        middleware = cls()
        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        return middleware

    def process_request(self, request, spider):
        if not self.enable_proxy:
            return

        if self.proxy_pool and 'proxy' not in request.meta:
            proxy = self._get_proxy()
            if proxy:
                request.meta['proxy'] = proxy
                logger.debug(f"Using proxy: {proxy} for {request.url}")

    def process_response(self, request, response, spider):
        if response.status in [403, 429, 503]:
            proxy = request.meta.get('proxy')
            if proxy:
                logger.warning(f"Proxy {proxy} returned status {response.status}, marking as failed")
                self.failed_proxies.add(proxy)
                retry_req = request.copy()
                retry_req.meta['proxy'] = self._get_next_proxy()
                retry_req.dont_filter = True
                return retry_req

        self.success_count += 1
        return response

    def process_exception(self, request, exception, spider):
        proxy = request.meta.get('proxy')
        if proxy:
            logger.warning(f"Proxy {proxy} failed with exception: {exception}")
            self.failed_proxies.add(proxy)

            retry_req = request.copy()
            retry_req.meta['proxy'] = self._get_next_proxy()
            retry_req.dont_filter = True
            return retry_req

        return None

    def _get_proxy(self):
        available_proxies = [p for p in self.proxy_pool if p not in self.failed_proxies]
        if not available_proxies:
            logger.warning("All proxies failed, resetting failure list")
            self.failed_proxies.clear()
            available_proxies = self.proxy_pool

        if available_proxies:
            proxy = random.choice(available_proxies)
            return proxy

        return None

    def _get_next_proxy(self):
        available_proxies = [p for p in self.proxy_pool if p not in self.failed_proxies]
        if not available_proxies:
            self.failed_proxies.clear()
            available_proxies = self.proxy_pool

        if available_proxies:
            self.proxy_index = (self.proxy_index + 1) % len(available_proxies)
            return available_proxies[self.proxy_index]

        return None

    def spider_opened(self, spider):
        if self.enable_proxy:
            logger.info(f"Proxy middleware initialized with {len(self.proxy_pool)} proxies")
        else:
            logger.info("Proxy middleware disabled")


class DelayMiddleware:
    def __init__(self):
        self.base_delay = DOWNLOAD_DELAY
        self.randomize = RANDOMIZE_DOWNLOAD_DELAY
        self.domain_last_request = {}
        self.request_count = 0
        self.min_delay = max(0.5, self.base_delay * 0.5)
        self.max_delay = self.base_delay * 2

    @classmethod
    def from_crawler(cls, crawler):
        middleware = cls()
        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        return middleware

    def process_request(self, request, spider):
        if request.meta.get('dont_delay', False):
            return

        domain = self._get_domain(request.url)
        if domain:
            delay = self._calculate_delay(domain, request)
            if delay > 0:
                last_request = self.domain_last_request.get(domain, 0)
                elapsed = time.time() - last_request
                if elapsed < delay:
                    sleep_time = delay - elapsed
                    time.sleep(sleep_time)
                    logger.debug(f"Delayed {sleep_time:.2f}s for domain {domain}")

            self.domain_last_request[domain] = time.time()
            self.request_count += 1

    def process_response(self, request, response, spider):
        if response.status == 429:
            domain = self._get_domain(request.url)
            if domain:
                retry_after = response.headers.get('Retry-After')
                if retry_after:
                    try:
                        delay = int(retry_after)
                        logger.warning(f"Rate limited by {domain}, waiting {delay}s")
                        time.sleep(delay)
                    except (ValueError, TypeError):
                        time.sleep(self.max_delay * 2)

        return response

    def _calculate_delay(self, domain, request):
        if self.randomize:
            delay = random.uniform(self.min_delay, self.max_delay)
        else:
            delay = self.base_delay

        priority = request.priority if hasattr(request, 'priority') else 0
        if priority < 0:
            delay *= 1.5
        elif priority > 0:
            delay *= 0.7

        return delay

    def _get_domain(self, url):
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc
        except Exception:
            return None

    def spider_opened(self, spider):
        logger.info(f"Delay middleware initialized, base delay: {self.base_delay}s")


class CaptchaMiddleware:
    def __init__(self):
        self.captcha_patterns = [
            r'验证码',
            r'captcha',
            r'请输入验证',
            r'人机验证',
            r'security check',
            r'access denied',
            r'blocked',
            r'您的访问过于频繁',
        ]
        self.captcha_count = 0
        self.max_captcha_retries = 3

    @classmethod
    def from_crawler(cls, crawler):
        middleware = cls()
        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        return middleware

    def process_response(self, request, response, spider):
        if self._detect_captcha(response):
            self.captcha_count += 1
            domain = self._get_domain(request.url)

            logger.warning(f"Captcha detected on {domain} (count: {self.captcha_count})")

            retry_count = request.meta.get('captcha_retry', 0)
            if retry_count < self.max_captcha_retries:
                time.sleep(10 * (retry_count + 1))

                new_request = request.copy()
                new_request.meta['captcha_retry'] = retry_count + 1
                new_request.meta['change_ua'] = True
                new_request.dont_filter = True

                logger.info(f"Retrying with new UA, attempt {retry_count + 1}/{self.max_captcha_retries}")
                return new_request
            else:
                logger.error(f"Max captcha retries exceeded for {request.url}")
                return HtmlResponse(url=request.url, status=503, request=request)

        return response

    def _detect_captcha(self, response):
        if response.status in [403, 503]:
            return True

        try:
            body = response.text.lower()
            for pattern in self.captcha_patterns:
                if re.search(pattern, body, re.IGNORECASE):
                    return True
        except Exception:
            pass

        return False

    def _get_domain(self, url):
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc
        except Exception:
            return None

    def spider_opened(self, spider):
        logger.info("Captcha detection middleware initialized")


class CookieMiddleware:
    def __init__(self):
        self.domain_cookies = {}
        self.max_cookies_per_domain = 10

    @classmethod
    def from_crawler(cls, crawler):
        middleware = cls()
        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        return middleware

    def process_response(self, request, response, spider):
        domain = self._get_domain(request.url)
        if domain:
            if 'Set-Cookie' in response.headers:
                cookies = response.headers.getlist('Set-Cookie')
                if domain not in self.domain_cookies:
                    self.domain_cookies[domain] = []

                for cookie in cookies:
                    try:
                        cookie_str = cookie.decode('utf-8', errors='ignore')
                        self.domain_cookies[domain].append(cookie_str)
                        if len(self.domain_cookies[domain]) > self.max_cookies_per_domain:
                            self.domain_cookies[domain].pop(0)
                    except Exception:
                        pass

        return response

    def process_request(self, request, spider):
        domain = self._get_domain(request.url)
        if domain and domain in self.domain_cookies:
            cookies = self._parse_cookies(self.domain_cookies[domain])
            if cookies:
                request.cookies.update(cookies)
                logger.debug(f"Applied {len(cookies)} cookies for {domain}")

    def _parse_cookies(self, cookie_list):
        cookies = {}
        for cookie_str in cookie_list:
            parts = cookie_str.split(';')
            if parts:
                kv = parts[0].split('=', 1)
                if len(kv) == 2:
                    cookies[kv[0].strip()] = kv[1].strip()
        return cookies

    def _get_domain(self, url):
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc
        except Exception:
            return None

    def spider_opened(self, spider):
        logger.info("Cookie management middleware initialized")
