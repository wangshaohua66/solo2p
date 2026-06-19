import time
import random

from scrapy.downloadermiddlewares.retry import RetryMiddleware
from scrapy.utils.response import response_status_message

from utils.logger import CrawlLogger
from utils.config_loader import ConfigLoader


class ExponentialBackoffRetryMiddleware(RetryMiddleware):
    def __init__(self, settings):
        super().__init__(settings)
        self.config = settings.get('CONFIG_LOADER', ConfigLoader())
        self.logger = CrawlLogger().get_logger('RetryMiddleware')
        self.max_retry_times = self.config.get('crawl.max_retry_times', 3)
        self.retry_intervals = self.config.get('crawl.retry_intervals', [3, 10, 30])
        self.retry_http_codes = set(
            int(x) for x in self.config.get(
                'crawl.retry_http_codes',
                [408, 429, 500, 502, 503, 504, 522, 524]
            )
        )

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler.settings)

    def _get_retry_delay(self, retry_times: int) -> float:
        if retry_times <= len(self.retry_intervals):
            base_delay = self.retry_intervals[retry_times - 1]
        else:
            base_delay = self.retry_intervals[-1] * (2 ** (retry_times - len(self.retry_intervals)))
        jitter = random.uniform(0, base_delay * 0.3)
        return base_delay + jitter

    def process_response(self, request, response, spider):
        if request.meta.get('dont_retry', False):
            return response

        if response.status in self.retry_http_codes:
            reason = response_status_message(response.status)
            return self._retry(request, reason, spider) or response

        if response.status == 429:
            retry_after = response.headers.get('Retry-After')
            if retry_after:
                try:
                    delay = int(retry_after)
                    self.logger.info(f'Retry-After header: waiting {delay}s for {request.url}')
                    time.sleep(min(delay, 60))
                except (ValueError, TypeError):
                    pass

        return response

    def process_exception(self, request, exception, spider):
        if (
            isinstance(exception, self.EXCEPTIONS_TO_RETRY)
            and not request.meta.get('dont_retry', False)
        ):
            return self._retry(request, exception, spider)
        self.logger.error(
            f'Non-retryable exception for {request.url}: {type(exception).__name__}: {exception}'
        )
        raise exception

    def _retry(self, request, reason, spider):
        retry_times = request.meta.get('retry_times', 0) + 1

        if retry_times <= self.max_retry_times:
            delay = self._get_retry_delay(retry_times)
            self.logger.warning(
                f'Retrying {request.url} (attempt {retry_times}/{self.max_retry_times}) '
                f'after {delay:.1f}s, reason: {reason}'
            )
            time.sleep(delay)

            retry_req = request.copy()
            retry_req.meta['retry_times'] = retry_times
            retry_req.dont_filter = True
            retry_req.priority = request.priority - 1

            source = getattr(spider, 'name', '')
            proxy_manager = request.meta.get('proxy_manager')
            if proxy_manager and retry_times >= 2:
                new_proxy = proxy_manager.get_proxy('random')
                if new_proxy:
                    retry_req.meta['proxy'] = random.choice(list(new_proxy.values()))
                    self.logger.debug(f'Switched proxy for retry: {retry_req.meta.get("proxy")}')

            return retry_req
        else:
            self.logger.error(
                f'Giving up on {request.url} after {self.max_retry_times} retries, '
                f'last reason: {reason}'
            )
            self._record_failed_request(request, reason, spider)

    def _record_failed_request(self, request, reason, spider):
        spider.failed_requests = getattr(spider, 'failed_requests', [])
        spider.failed_requests.append({
            'url': request.url,
            'reason': str(reason),
            'timestamp': time.time(),
            'source': getattr(spider, 'name', ''),
            'meta': {k: str(v) for k, v in request.meta.items() if k in
                     ['issn', 'journal_name', 'retry_times']}
        })
