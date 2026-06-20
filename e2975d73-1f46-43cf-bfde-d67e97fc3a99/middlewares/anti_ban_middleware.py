import random
import time
import re
import threading
from collections import defaultdict
from scrapy import signals
from scrapy.http import HtmlResponse
from scrapy.downloadermiddlewares.useragent import UserAgentMiddleware as BaseUserAgentMiddleware
from config.settings import (
    USER_AGENTS, PROXY_POOL, ENABLE_PROXY,
    DOWNLOAD_DELAY, RANDOMIZE_DOWNLOAD_DELAY,
    PROXY_CHECK_URL, PROXY_TIMEOUT, PROXY_HEALTH_CHECK_INTERVAL
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
        self.raw_proxy_pool = PROXY_POOL
        self.enable_proxy = ENABLE_PROXY
        self.proxy_index = 0
        self.request_count = 0
        self.success_count = 0

        self.proxy_stats = defaultdict(lambda: {
            'success': 0,
            'fail': 0,
            'total_time': 0,
            'last_used': 0,
            'last_success': 0,
            'last_fail': 0,
            'consecutive_fail': 0,
            'weight': 1.0,
            'enabled': True,
            'cooling_until': 0,
        })

        for proxy in self.raw_proxy_pool:
            self.proxy_stats[proxy] = self.proxy_stats[proxy]

        self.max_consecutive_fail = 5
        self.cooldown_time = 300
        self.reset_interval = 1800
        self.last_reset = time.time()

        self._lock = threading.Lock()
        self._health_check_running = False

    @classmethod
    def from_crawler(cls, crawler):
        middleware = cls()
        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(middleware.spider_closed, signal=signals.spider_closed)
        return middleware

    def process_request(self, request, spider):
        if not self.enable_proxy:
            return

        if 'proxy' in request.meta and request.meta.get('force_proxy'):
            return

        if self.raw_proxy_pool:
            proxy = self._select_proxy()
            if proxy:
                request.meta['proxy'] = proxy
                self._update_proxy_used(proxy)
                self.request_count += 1
                logger.debug(f"[{self.request_count}] Using proxy: {proxy[:30]}... for {request.url[:50]}")

    def process_response(self, request, response, spider):
        proxy = request.meta.get('proxy')

        if proxy and proxy in self.proxy_stats:
            response_time = response.meta.get('download_latency', 0)

            if response.status in [200, 301, 302]:
                self._mark_success(proxy, response_time)
                self.success_count += 1
            elif response.status in [403, 429, 503, 502, 504, 408]:
                logger.warning(f"Proxy {proxy[:30]}... returned status {response.status}")
                self._mark_failure(proxy)

                retry_req = self._build_retry_request(request)
                if retry_req:
                    return retry_req
            else:
                self._mark_success(proxy, response_time)
                self.success_count += 1

        return response

    def process_exception(self, request, exception, spider):
        proxy = request.meta.get('proxy')

        if proxy and proxy in self.proxy_stats:
            logger.warning(f"Proxy {proxy[:30]}... exception: {type(exception).__name__}: {str(exception)[:100]}")
            self._mark_failure(proxy)

            retry_req = self._build_retry_request(request)
            if retry_req:
                return retry_req

        return None

    def _build_retry_request(self, request):
        retry_count = request.meta.get('proxy_retry_count', 0)
        if retry_count >= len(self.raw_proxy_pool) * 2:
            logger.error(f"Max proxy retries exceeded for: {request.url[:60]}")
            return None

        new_proxy = self._select_proxy(exclude=request.meta.get('proxy'))
        if not new_proxy:
            return None

        retry_req = request.copy()
        retry_req.meta['proxy'] = new_proxy
        retry_req.meta['proxy_retry_count'] = retry_count + 1
        retry_req.dont_filter = True
        retry_req.priority = max(request.priority + 1, 0)

        self._update_proxy_used(new_proxy)
        logger.info(f"Retrying with new proxy {new_proxy[:30]}... (attempt {retry_count + 1})")
        return retry_req

    def _select_proxy(self, exclude=None):
        now = time.time()

        if now - self.last_reset > self.reset_interval:
            self._reset_failed_proxies()
            self.last_reset = now

        with self._lock:
            available = []
            weights = []

            for proxy, stats in self.proxy_stats.items():
                if exclude and proxy == exclude:
                    continue

                if not stats['enabled']:
                    continue

                if stats['cooling_until'] > now:
                    continue

                if stats['consecutive_fail'] >= self.max_consecutive_fail:
                    if now - stats['last_fail'] < self.cooldown_time:
                        continue
                    else:
                        stats['consecutive_fail'] = 0
                        stats['enabled'] = True

                total_requests = stats['success'] + stats['fail']
                if total_requests == 0:
                    weight = stats['weight'] * 1.0
                else:
                    success_rate = stats['success'] / total_requests
                    weight = stats['weight'] * (0.3 + 0.7 * success_rate)

                    avg_time = stats['total_time'] / max(1, stats['success'])
                    if avg_time > 0:
                        time_factor = min(2.0, 5.0 / avg_time)
                        weight *= time_factor

                available.append(proxy)
                weights.append(weight)

            if not available:
                logger.warning("No available proxies, resetting all")
                self._hard_reset()
                for proxy in self.raw_proxy_pool:
                    if exclude and proxy == exclude:
                        continue
                    available.append(proxy)
                    weights.append(1.0)

            if available:
                if sum(weights) > 0:
                    proxy = random.choices(available, weights=weights, k=1)[0]
                else:
                    proxy = random.choice(available)
                return proxy

            return None

    def _get_next_proxy(self):
        return self._select_proxy()

    def _mark_success(self, proxy, response_time=0):
        with self._lock:
            stats = self.proxy_stats[proxy]
            stats['success'] += 1
            stats['last_success'] = time.time()
            stats['last_used'] = time.time()
            stats['consecutive_fail'] = 0
            stats['total_time'] += response_time
            stats['enabled'] = True
            stats['cooling_until'] = 0

            if stats['weight'] < 2.0:
                stats['weight'] = min(2.0, stats['weight'] * 1.02)

    def _mark_failure(self, proxy):
        with self._lock:
            stats = self.proxy_stats[proxy]
            stats['fail'] += 1
            stats['last_fail'] = time.time()
            stats['last_used'] = time.time()
            stats['consecutive_fail'] += 1

            stats['weight'] = max(0.1, stats['weight'] * 0.95)

            if stats['consecutive_fail'] >= self.max_consecutive_fail:
                stats['enabled'] = False
                stats['cooling_until'] = time.time() + self.cooldown_time
                logger.warning(f"Proxy {proxy[:30]}... disabled after {stats['consecutive_fail']} consecutive failures")

    def _update_proxy_used(self, proxy):
        if proxy in self.proxy_stats:
            self.proxy_stats[proxy]['last_used'] = time.time()

    def _reset_failed_proxies(self):
        reset_count = 0
        with self._lock:
            for proxy, stats in self.proxy_stats.items():
                if stats['consecutive_fail'] >= self.max_consecutive_fail:
                    stats['consecutive_fail'] = 0
                    stats['enabled'] = True
                    stats['cooling_until'] = 0
                    stats['weight'] = 0.8
                    reset_count += 1
        if reset_count > 0:
            logger.info(f"Reset {reset_count} failed proxies after cooldown")

    def _hard_reset(self):
        with self._lock:
            for proxy in self.proxy_stats:
                stats = self.proxy_stats[proxy]
                stats['success'] = 0
                stats['fail'] = 0
                stats['total_time'] = 0
                stats['consecutive_fail'] = 0
                stats['enabled'] = True
                stats['cooling_until'] = 0
                stats['weight'] = 1.0

    def _start_health_check(self):
        if self._health_check_running:
            return
        self._health_check_running = True

        def health_check_loop():
            while self._health_check_running:
                try:
                    self._run_health_check()
                except Exception as e:
                    log_error_with_context(logger, e, "Proxy health check failed")
                time.sleep(PROXY_HEALTH_CHECK_INTERVAL)

        thread = threading.Thread(target=health_check_loop, daemon=True)
        thread.start()
        logger.info("Proxy health check thread started")

    def _run_health_check(self):
        import requests as req
        import warnings
        warnings.filterwarnings('ignore')

        healthy = 0
        for proxy in list(self.proxy_stats.keys()):
            try:
                proxies = {
                    'http': proxy,
                    'https': proxy,
                }
                resp = req.get(
                    PROXY_CHECK_URL,
                    proxies=proxies,
                    timeout=PROXY_TIMEOUT,
                    verify=False
                )
                if resp.status_code == 200:
                    self._mark_success(proxy, resp.elapsed.total_seconds())
                    healthy += 1
                else:
                    self._mark_failure(proxy)
            except Exception:
                self._mark_failure(proxy)

        logger.info(f"Proxy health check completed: {healthy}/{len(self.proxy_stats)} healthy")

    def _stop_health_check(self):
        self._health_check_running = False

    def spider_opened(self, spider):
        if self.enable_proxy:
            logger.info(f"Proxy middleware initialized with {len(self.raw_proxy_pool)} proxies")
            logger.info(f"Proxy rotation: weighted random with success rate adjustment")
            logger.info(f"Max consecutive failures: {self.max_consecutive_fail}, Cooldown: {self.cooldown_time}s")

            if PROXY_HEALTH_CHECK_INTERVAL > 0:
                self._start_health_check()
        else:
            logger.info("Proxy middleware disabled (set ENABLE_PROXY=True to enable)")

    def spider_closed(self, spider):
        self._stop_health_check()

        if self.enable_proxy and self.request_count > 0:
            total = self.success_count + sum(s['fail'] for s in self.proxy_stats.values())
            logger.info("=" * 50)
            logger.info("PROXY USAGE STATISTICS")
            logger.info("=" * 50)
            for proxy, stats in sorted(self.proxy_stats.items(), key=lambda x: x[1]['success'], reverse=True):
                total_req = stats['success'] + stats['fail']
                if total_req > 0:
                    rate = stats['success'] / total_req * 100
                    avg_time = stats['total_time'] / max(1, stats['success'])
                    logger.info(f"{proxy[:40]:<40s}: {stats['success']:4d} OK / {stats['fail']:3d} fail "
                               f"({rate:5.1f}%) avg={avg_time:.2f}s w={stats['weight']:.2f}")
            logger.info(f"Total proxy requests: {self.request_count}, Successful: {self.success_count}")
            if self.request_count > 0:
                logger.info(f"Overall success rate: {self.success_count / self.request_count * 100:.1f}%")
            logger.info("=" * 50)


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
