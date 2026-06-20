import logging
import logging.handlers
import os
from datetime import datetime
from config.settings import (
    APP_LOG_FILE, APP_LOG_LEVEL, APP_LOG_MAX_BYTES, APP_LOG_BACKUP_COUNT
)
from colorama import init, Fore, Style

init(autoreset=True)


class ColorFormatter(logging.Formatter):
    COLORS = {
        'DEBUG': Fore.CYAN,
        'INFO': Fore.GREEN,
        'WARNING': Fore.YELLOW,
        'ERROR': Fore.RED,
        'CRITICAL': Fore.RED + Style.BRIGHT,
    }

    def format(self, record):
        color = self.COLORS.get(record.levelname, Fore.WHITE)
        message = super().format(record)
        return f"{color}{message}{Style.RESET_ALL}"


def get_logger(name='policy_crawler'):
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(getattr(logging, APP_LOG_LEVEL, logging.INFO))

    file_handler = logging.handlers.RotatingFileHandler(
        APP_LOG_FILE,
        maxBytes=APP_LOG_MAX_BYTES,
        backupCount=APP_LOG_BACKUP_COUNT,
        encoding='utf-8'
    )
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    file_handler.setLevel(logging.DEBUG)

    console_handler = logging.StreamHandler()
    console_formatter = ColorFormatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    console_handler.setLevel(logging.INFO)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    logger.propagate = False

    return logger


def log_crawl_event(logger, site_name, url, status, message=None):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_msg = f"[{site_name}] {status} - {url}"
    if message:
        log_msg += f" - {message}"
    if status == 'success':
        logger.info(log_msg)
    elif status == 'error':
        logger.error(log_msg)
    elif status == 'warning':
        logger.warning(log_msg)
    else:
        logger.debug(log_msg)


def log_performance(logger, operation, duration, items_count=None):
    msg = f"Performance: {operation} completed in {duration:.2f}s"
    if items_count:
        rate = items_count / duration if duration > 0 else 0
        msg += f" - {items_count} items, {rate:.2f} items/s"
    logger.info(msg)


def log_error_with_context(logger, error, context=None):
    error_msg = f"Error: {type(error).__name__}: {str(error)}"
    if context:
        error_msg += f" | Context: {context}"
    logger.error(error_msg, exc_info=True)


logger = get_logger()
