import os
import random
from dataclasses import dataclass, field
from typing import List


@dataclass
class DatabaseConfig:
    path: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "jobs.db")
    table_name: str = "jobs"
    batch_size: int = 50


@dataclass
class RetryConfig:
    max_attempts: int = 3
    wait_exponential_multiplier: int = 1000
    wait_exponential_max: int = 4000


@dataclass
class TimeoutConfig:
    request: int = 15
    page_load: int = 60
    element_wait: int = 20


@dataclass
class CrawlerConfig:
    base_url: str = "https://example-job-site.gov.cn"
    list_url: str = "https://example-job-site.gov.cn/job/list"
    search_url: str = "https://example-job-site.gov.cn/job/search"
    concurrency: int = 3
    request_interval_min: float = 1.0
    request_interval_max: float = 3.0
    scroll_pause_time: float = 2.0
    max_scroll_attempts: int = 50
    output_format: str = "json"


@dataclass
class LoggingConfig:
    level: str = "INFO"
    log_dir: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
    file_prefix: str = "job_crawler"
    retention_days: int = 30
    console_colors: bool = True


USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]


def get_random_user_agent() -> str:
    return random.choice(USER_AGENTS)


DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
}


@dataclass
class Settings:
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    retry: RetryConfig = field(default_factory=RetryConfig)
    timeout: TimeoutConfig = field(default_factory=TimeoutConfig)
    crawler: CrawlerConfig = field(default_factory=CrawlerConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    user_agents: List[str] = field(default_factory=lambda: USER_AGENTS.copy())
    request_headers: dict = field(default_factory=lambda: DEFAULT_REQUEST_HEADERS.copy())
    headless: bool = True

    def get_headers(self) -> dict:
        headers = self.request_headers.copy()
        headers["User-Agent"] = get_random_user_agent()
        return headers


settings = Settings()
