import random
import time
import json
import re
from urllib.parse import urlparse
from loguru import logger
from core.constants import USER_AGENTS, PROXY_POOL, CAPTCHA_KEYWORDS


class AntiBanMiddleware:
    def __init__(self):
        self.ua_pool = USER_AGENTS[:]
        self.proxy_pool = PROXY_POOL[:]
        self.cookie_jar = {}
        self.request_timestamps = {}
        self.failure_counts = {}
        self.ban_counts = {}
        self.total_requests = {}

    @classmethod
    def from_crawler(cls, crawler):
        return cls()

    def process_request(self, request, spider):
        domain = urlparse(request.url).netloc

        request.headers["User-Agent"] = random.choice(self.ua_pool)

        if self.proxy_pool:
            proxy = random.choice(self.proxy_pool)
            if proxy:
                request.meta["proxy"] = proxy

        if domain in self.cookie_jar and self.cookie_jar[domain]:
            cookies = random.choice(self.cookie_jar[domain])
            if isinstance(cookies, dict):
                for k, v in cookies.items():
                    request.headers.add_cookie(k, str(v))

        self._apply_rate_limit(domain, spider)

        referer = self._generate_referer(request.url, domain)
        if referer:
            request.headers["Referer"] = referer

        request.headers["DNT"] = "1"
        request.headers["Connection"] = "keep-alive"
        request.headers["Upgrade-Insecure-Requests"] = "1"

        self.total_requests[domain] = self.total_requests.get(domain, 0) + 1

        return None

    def process_response(self, request, response, spider):
        domain = urlparse(request.url).netloc

        if response.status == 429:
            logger.warning(f"Rate limited on {domain}, backing off")
            self._record_failure(domain)
            retry_after = int(response.headers.get("Retry-After", random.randint(30, 120)))
            time.sleep(retry_after)
            return request.replace(dont_filter=True)

        if response.status == 403:
            self.ban_counts[domain] = self.ban_counts.get(domain, 0) + 1
            ban_rate = self.ban_counts[domain] / max(1, self.total_requests.get(domain, 1))
            if ban_rate > 0.2:
                logger.error(f"Ban rate for {domain} exceeds 20%: {ban_rate:.1%}")
                spider.crawler.stats.set_value(f"ban_alert/{domain}", True)
            self._record_failure(domain)
            return response

        if response.status in [200, 304]:
            self.failure_counts[domain] = 0
            self.ban_counts[domain] = self.ban_counts.get(domain, 0)

            set_cookie = response.headers.getlist("Set-Cookie")
            if set_cookie:
                self._store_cookies(domain, set_cookie)

        return response

    def process_exception(self, request, exception, spider):
        domain = urlparse(request.url).netloc
        logger.warning(f"Exception on {domain}: {type(exception).__name__}: {exception}")
        self._record_failure(domain)

        failures = self.failure_counts.get(domain, 0)
        if failures >= 3:
            logger.error(f"Skipping {domain}: {failures} consecutive failures")
            spider.crawler.stats.set_value(f"skipped/{domain}", True)
            return None

        return request.replace(dont_filter=True)

    def _apply_rate_limit(self, domain, spider):
        now = time.time()
        last_time = self.request_timestamps.get(domain, 0)
        delay = self._gaussian_delay(domain)
        elapsed = now - last_time

        if elapsed < delay:
            sleep_time = delay - elapsed
            time.sleep(sleep_time)

        self.request_timestamps[domain] = time.time()

    def _gaussian_delay(self, domain):
        base_delay = 2.0
        mean = base_delay
        std_dev = base_delay * 0.4
        delay = random.gauss(mean, std_dev)
        return max(0.5, min(8.0, delay))

    def _record_failure(self, domain):
        self.failure_counts[domain] = self.failure_counts.get(domain, 0) + 1

    def _generate_referer(self, url, domain):
        return f"https://{domain}/"

    def _store_cookies(self, domain, set_cookie_headers):
        if domain not in self.cookie_jar:
            self.cookie_jar[domain] = []
        cookies = {}
        for header in set_cookie_headers:
            parts = header.decode("utf-8").split(";")[0]
            if "=" in parts:
                k, v = parts.split("=", 1)
                cookies[k.strip()] = v.strip()
        if cookies:
            self.cookie_jar[domain].append(cookies)
            if len(self.cookie_jar[domain]) > 10:
                self.cookie_jar[domain] = self.cookie_jar[domain][-10:]


class CaptchaDetectMiddleware:
    @classmethod
    def from_crawler(cls, crawler):
        return cls()

    def process_response(self, request, response, spider):
        if response.status != 200:
            return response

        page_text = ""
        if hasattr(response, "text"):
            page_text = response.text[:5000].lower()

        detected_captcha = False
        for keyword in CAPTCHA_KEYWORDS:
            if keyword.lower() in page_text:
                detected_captcha = True
                break

        captcha_indicators = [
            'id="captcha"', 'class="captcha"', 'class="verify"',
            'class="slider-verify"', 'id="nc_1_wrapper"',
        ]
        for indicator in captcha_indicators:
            if indicator in page_text:
                detected_captcha = True
                break

        if detected_captcha:
            domain = urlparse(request.url).netloc
            logger.warning(f"CAPTCHA detected on {domain}: {request.url}")
            spider.crawler.stats.inc_value(f"captcha/{domain}")
            spider.crawler.stats.set_value(f"captcha_alert/{domain}", True)
            request.meta["captcha_detected"] = True
            request.meta["captcha_url"] = request.url

            return response

        return response
