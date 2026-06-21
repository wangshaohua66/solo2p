import json
import os
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional


BASE_DIR = Path(__file__).parent.resolve()
DEFAULT_CONFIG_PATH = BASE_DIR / "config.json"


@dataclass
class SiteConfig:
    name: str
    base_url: str
    login_url: str
    list_url: str
    username: str = ""
    password: str = ""
    need_captcha: bool = False
    use_selenium: bool = True
    page_size: int = 20
    request_interval: float = 1.0


@dataclass
class RetryConfig:
    max_retries: int = 3
    backoff_factor: float = 2.0
    timeout: int = 30


@dataclass
class DatabaseConfig:
    db_path: str = ""


@dataclass
class EmailConfig:
    smtp_host: str = ""
    smtp_port: int = 465
    use_ssl: bool = True
    username: str = ""
    password: str = ""
    from_addr: str = ""
    to_addrs: List[str] = field(default_factory=list)


@dataclass
class WechatConfig:
    app_id: str = ""
    app_secret: str = ""
    template_id: str = ""
    user_openids: List[str] = field(default_factory=list)


@dataclass
class SchedulerConfig:
    crawl_interval_minutes: int = 60
    track_interval_minutes: int = 30
    timezone: str = "Asia/Shanghai"


@dataclass
class CrawlerConfig:
    headless: bool = True
    window_size: str = "1920,1080"
    page_load_timeout: int = 30
    implicit_wait: int = 10
    max_concurrent_sites: int = 3
    submit_rate_per_minute: int = 20


@dataclass
class AppConfig:
    sites: List[SiteConfig] = field(default_factory=list)
    retry: RetryConfig = field(default_factory=RetryConfig)
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    email: EmailConfig = field(default_factory=EmailConfig)
    wechat: WechatConfig = field(default_factory=WechatConfig)
    scheduler: SchedulerConfig = field(default_factory=SchedulerConfig)
    crawler: CrawlerConfig = field(default_factory=CrawlerConfig)


def get_default_sites() -> List[SiteConfig]:
    universities = [
        "省大学就业网", "理工大学就业网", "师范大学就业网", "农业大学就业网",
        "医科大学就业网", "财经大学就业网", "科技大学就业网", "交通大学就业网",
        "工业大学就业网", "民族大学就业网", "海洋大学就业网", "艺术学院就业网"
    ]
    sites = []
    for i, name in enumerate(universities, 1):
        sites.append(SiteConfig(
            name=name,
            base_url=f"https://job.university{i}.edu.cn",
            login_url=f"https://job.university{i}.edu.cn/login",
            list_url=f"https://job.university{i}.edu.cn/jobfair/list",
            need_captcha=True,
            use_selenium=True,
            page_size=20,
            request_interval=1.5
        ))
    sites.append(SiteConfig(
        name="省级人才网",
        base_url="https://www.provincial-talent.gov.cn",
        login_url="https://www.provincial-talent.gov.cn/login",
        list_url="https://www.provincial-talent.gov.cn/jobfair/list",
        need_captcha=False,
        use_selenium=True,
        page_size=30,
        request_interval=1.0
    ))
    return sites


def get_default_config() -> AppConfig:
    return AppConfig(
        sites=get_default_sites(),
        retry=RetryConfig(max_retries=3, backoff_factor=2.0, timeout=30),
        database=DatabaseConfig(db_path=str(BASE_DIR / "data" / "recruitment.db")),
        email=EmailConfig(
            smtp_host="smtp.example.com",
            smtp_port=465,
            use_ssl=True,
            username="alert@example.com",
            password="your_password",
            from_addr="alert@example.com",
            to_addrs=["admin@example.com"]
        ),
        wechat=WechatConfig(
            app_id="your_app_id",
            app_secret="your_app_secret",
            template_id="your_template_id",
            user_openids=["openid_1", "openid_2"]
        ),
        scheduler=SchedulerConfig(
            crawl_interval_minutes=60,
            track_interval_minutes=30,
            timezone="Asia/Shanghai"
        ),
        crawler=CrawlerConfig(
            headless=True,
            window_size="1920,1080",
            page_load_timeout=30,
            implicit_wait=10,
            max_concurrent_sites=3,
            submit_rate_per_minute=20
        )
    )


def _site_from_dict(d: Dict) -> SiteConfig:
    return SiteConfig(
        name=d.get("name", ""),
        base_url=d.get("base_url", ""),
        login_url=d.get("login_url", ""),
        list_url=d.get("list_url", ""),
        username=d.get("username", ""),
        password=d.get("password", ""),
        need_captcha=d.get("need_captcha", False),
        use_selenium=d.get("use_selenium", True),
        page_size=d.get("page_size", 20),
        request_interval=d.get("request_interval", 1.0)
    )


def _config_from_dict(d: Dict) -> AppConfig:
    sites = [_site_from_dict(s) for s in d.get("sites", [])]
    retry = RetryConfig(**d.get("retry", {}))
    database = DatabaseConfig(**d.get("database", {}))
    email = EmailConfig(**d.get("email", {}))
    wechat = WechatConfig(**d.get("wechat", {}))
    scheduler = SchedulerConfig(**d.get("scheduler", {}))
    crawler = CrawlerConfig(**d.get("crawler", {}))
    return AppConfig(
        sites=sites,
        retry=retry,
        database=database,
        email=email,
        wechat=wechat,
        scheduler=scheduler,
        crawler=crawler
    )


def load_config(config_path: Optional[str] = None) -> AppConfig:
    path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
    if not path.exists():
        return get_default_config()
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return _config_from_dict(data)


def save_config(config: AppConfig, config_path: Optional[str] = None) -> None:
    path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    data = asdict(config)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def init_config(config_path: Optional[str] = None) -> Path:
    config = get_default_config()
    save_config(config, config_path)
    return Path(config_path) if config_path else DEFAULT_CONFIG_PATH
