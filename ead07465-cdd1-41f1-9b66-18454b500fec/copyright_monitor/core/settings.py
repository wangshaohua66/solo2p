BOT_NAME = "copyright_monitor"
SPIDER_MODULES = ["spiders"]
NEWSPIDER_MODULE = "spiders"
ROBOTSTXT_OBEY = False
CONCURRENT_REQUESTS = 16
CONCURRENT_REQUESTS_PER_DOMAIN = 4
DOWNLOAD_DELAY = 1.5
RANDOMIZE_DOWNLOAD_DELAY = True
COOKIES_ENABLED = True
COOKIES_DEBUG = False
DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
}
DOWNLOADER_MIDDLEWARES = {
    "middleware.anti_ban.AntiBanMiddleware": 400,
    "middleware.anti_ban.CaptchaDetectMiddleware": 500,
}
ITEM_PIPELINES = {
    "pipeline.storage.StoragePipeline": 300,
    "pipeline.comparison.ComparisonPipeline": 400,
}
LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s [%(name)s] %(levelname)s: %(message)s"
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1.0
AUTOTHROTTLE_MAX_DELAY = 10.0
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0
AUTOTHROTTLE_DEBUG = False
RETRY_ENABLED = True
RETRY_TIMES = 3
RETRY_HTTP_CODES = [429, 500, 502, 503, 504]
FEED_EXPORT_ENCODING = "utf-8"
SQLITE_DB_PATH = "data/copyright_monitor.db"
FORENSICS_DIR = "data/forensics"
REPORT_DIR = "data/reports"
SCREENSHOT_DIR = "data/screenshots"
HTML_ARCHIVE_DIR = "data/html_archive"
SIMILARITY_THRESHOLD_TITLE = 1.0
SIMILARITY_THRESHOLD_PARAGRAPH = 0.75
SIMILARITY_THRESHOLD_NGRAM = 0.70
NGRAM_SIZE = 5
HIGH_SIMILARITY_ALERT = 0.90
BAN_RATE_ALERT = 0.20
MAX_CONSECUTIVE_FAILURES = 3
FULL_SCAN_INTERVAL_HOURS = 8
INCREMENTAL_SCAN_INTERVAL_HOURS = 2
NEW_WORK_DAILY_SCAN_DAYS = 7
