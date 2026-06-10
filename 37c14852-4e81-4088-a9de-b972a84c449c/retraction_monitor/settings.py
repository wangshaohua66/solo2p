BOT_NAME = "retraction_monitor"

SPIDER_MODULES = ["retraction_monitor.spiders"]
NEWSPIDER_MODULE = "retraction_monitor.spiders"

ROBOTSTXT_OBEY = True
ROBOTSTXT_PARSER = "scrapy.robotstxt.PythonRobotParser"

DOWNLOAD_DELAY = 2
RANDOMIZE_DOWNLOAD_DELAY = True
CONCURRENT_REQUESTS = 16
CONCURRENT_REQUESTS_PER_DOMAIN = 8
CONCURRENT_REQUESTS_PER_IP = 4

RETRY_ENABLED = True
RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 522, 524, 408, 429]
RETRY_PRIORITY_ADJUST = -1

DOWNLOAD_TIMEOUT = 30

DOWNLOADER_MIDDLEWARES = {
    "retraction_monitor.middlewares.rotate_proxy.RotateProxyMiddleware": 100,
    "retraction_monitor.middlewares.rotate_proxy.RotateUserAgentMiddleware": 200,
    "scrapy.downloadermiddlewares.retry.RetryMiddleware": 500,
}

ITEM_PIPELINES = {
    "retraction_monitor.pipelines.dedup_pipeline.DedupPipeline": 100,
    "retraction_monitor.pipelines.alert_pipeline.AlertPipeline": 200,
    "retraction_monitor.pipelines.storage_pipeline.StoragePipeline": 300,
}

EXTENSIONS = {
    "scrapy.extensions.logstats.LogStats": 0,
}

LOG_LEVEL = "INFO"
LOG_FILE = "logs/retraction_monitor.log"
LOG_FORMAT = "%(asctime)s [%(name)s] %(levelname)s: %(message)s"
LOG_DATEFORMAT = "%Y-%m-%d %H:%M:%S"

AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1
AUTOTHROTTLE_MAX_DELAY = 10
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0
AUTOTHROTTLE_DEBUG = False

HTTPCACHE_ENABLED = False

COOKIES_ENABLED = False
COOKIES_DEBUG = False

TELNETCONSOLE_ENABLED = False

DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
}

PROXY_LIST = []

USER_AGENT_LIST = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.1; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
]

DATABASE_PATH = "data/retraction_monitor.db"
DATABASE_WAL_MODE = True

ALERT_EMAIL_FROM = "alerts@example.com"
ALERT_EMAIL_TO = ["admin@example.com"]
ALERT_SMTP_HOST = "smtp.example.com"
ALERT_SMTP_PORT = 587
ALERT_SMTP_USER = "alerts@example.com"
ALERT_SMTP_PASSWORD = ""
ALERT_SMTP_USE_TLS = True

ALERT_SLACK_WEBHOOK = ""
ALERT_LARK_WEBHOOK = ""
ALERT_CUSTOM_WEBHOOK = ""

TEAM_BIBTEX_FILE = "data/team_references.bib"
TEAM_AUTHORS = []
TEAM_AFFILIATIONS = []

SEVERITY_THRESHOLD_HIGH = 7
SEVERITY_THRESHOLD_MEDIUM = 4

DEDUP_WINDOW_HOURS = 72
SIMHASH_THRESHOLD = 3

RETRACTION_WATCH_API_URL = "https://api.retractionwatch.com/v2"
RETRACTION_WATCH_API_KEY = ""

PUBLISHER_RSS_FEEDS = {
    "elsevier": "https://www.journals.elsevier.com/rss/corrections",
    "springer": "https://link.springer.com/search.rss?query=&facet-content-type=Correction",
    "wiley": "https://onlinelibrary.wiley.com/action/showFeed?jc=14602466&type=etoc&feed=rss",
}

CNKI_RETRACTION_BASE_URL = "https://navi.cnki.net/knavi"
CNKI_PAGE_SIZE = 50

PUBPEER_API_URL = "https://pubpeer.com/api/v2"
PUBPEER_RATE_LIMIT_DELAY = 5

SCHEDULER_HOUR = 2
SCHEDULER_MINUTE = 0
SCHEDULER_TIMEZONE = "Asia/Shanghai"

REPORT_OUTPUT_DIR = "reports"
REPORT_TEMPLATE_DIR = "templates"

SNAPSHOT_DIR = "data/snapshots"
FAILED_REQUESTS_DIR = "data/failed_requests"
