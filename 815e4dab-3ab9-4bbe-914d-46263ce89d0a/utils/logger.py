import logging
import logging.handlers
import os
from datetime import datetime, timedelta


class CrawlLogger:
    _instance = None
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, log_dir='logs', log_level='INFO', verbose=False, quiet=False):
        if CrawlLogger._initialized:
            return
        CrawlLogger._initialized = True

        self.log_dir = log_dir
        self.verbose = verbose
        self.quiet = quiet
        self.log_level = getattr(logging, log_level.upper(), logging.INFO)

        if verbose:
            self.log_level = logging.DEBUG
        if quiet:
            self.log_level = logging.ERROR

        self._setup_logger()
        self._cleanup_old_logs()

    def _setup_logger(self):
        os.makedirs(self.log_dir, exist_ok=True)

        self.logger = logging.getLogger('JournalCrawler')
        self.logger.setLevel(self.log_level)
        self.logger.handlers.clear()
        self.logger.propagate = False

        log_format = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

        date_str = datetime.now().strftime('%Y-%m-%d')
        file_handler = logging.handlers.RotatingFileHandler(
            os.path.join(self.log_dir, f'crawl_{date_str}.log'),
            maxBytes=50 * 1024 * 1024,
            backupCount=20,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(log_format)
        self.logger.addHandler(file_handler)

        error_handler = logging.handlers.RotatingFileHandler(
            os.path.join(self.log_dir, f'error_{date_str}.log'),
            maxBytes=50 * 1024 * 1024,
            backupCount=10,
            encoding='utf-8'
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(log_format)
        self.logger.addHandler(error_handler)

        if not self.quiet:
            console_handler = logging.StreamHandler()
            console_handler.setLevel(self.log_level)
            console_handler.setFormatter(log_format)
            self.logger.addHandler(console_handler)

    def _cleanup_old_logs(self, retention_days=90):
        try:
            cutoff = datetime.now() - timedelta(days=retention_days)
            for filename in os.listdir(self.log_dir):
                filepath = os.path.join(self.log_dir, filename)
                if os.path.isfile(filepath) and filename.endswith('.log'):
                    file_mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
                    if file_mtime < cutoff:
                        os.remove(filepath)
                        self.logger.info(f'Cleaned up old log file: {filename}')
        except Exception as e:
            self.logger.warning(f'Failed to clean up old logs: {e}')

    def get_logger(self, name=None):
        if name:
            child_logger = self.logger.getChild(name)
            child_logger.setLevel(self.log_level)
            return child_logger
        return self.logger

    def log_progress(self, processed, total, spider_name=''):
        if processed > 0 and processed % 100 == 0:
            percentage = (processed / total * 100) if total > 0 else 0
            self.logger.info(
                f'[{spider_name}] Progress: {processed}/{total} '
                f'({percentage:.1f}%) completed'
            )

    def log_crawl_start(self, spider_name, target_count=0):
        self.logger.info(f'========== {spider_name} Crawl Started ==========')
        self.logger.info(f'Target journals count: {target_count}')

    def log_crawl_end(self, spider_name, success_count, fail_count, duration):
        self.logger.info(f'========== {spider_name} Crawl Completed ==========')
        self.logger.info(f'Success: {success_count}, Failed: {fail_count}')
        self.logger.info(f'Total duration: {duration:.2f} seconds')
        if success_count + fail_count > 0:
            rate = success_count / (success_count + fail_count) * 100
            self.logger.info(f'Success rate: {rate:.2f}%')
