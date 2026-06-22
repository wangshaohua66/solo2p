import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path
from colorama import Fore, Style, init

init(autoreset=True)

from utils.config import config


class ColorFormatter(logging.Formatter):
    COLORS = {
        'DEBUG': Fore.CYAN,
        'INFO': Fore.GREEN,
        'WARNING': Fore.YELLOW,
        'ERROR': Fore.RED,
        'CRITICAL': Fore.MAGENTA + Style.BRIGHT,
    }

    def format(self, record):
        log_color = self.COLORS.get(record.levelname, '')
        message = super().format(record)
        return f"{log_color}{message}{Style.RESET_ALL}"


def get_logger(name: str = 'copyright') -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(getattr(logging, config.get('logging.level', 'INFO')))

    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    date_format = '%Y-%m-%d %H:%M:%S'

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(ColorFormatter(log_format, datefmt=date_format))
    logger.addHandler(console_handler)

    log_file = config.get('logging.file', 'data/logs/copyright.log')
    log_dir = Path(log_file).parent
    log_dir.mkdir(parents=True, exist_ok=True)

    if not os.access(log_dir, os.W_OK):
        raise PermissionError(f"No write permission for log directory: {log_dir}")

    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=config.get('logging.max_bytes', 10 * 1024 * 1024),
        backupCount=config.get('logging.backup_count', 5),
        encoding='utf-8'
    )
    file_handler.setFormatter(logging.Formatter(log_format, datefmt=date_format))
    logger.addHandler(file_handler)

    return logger
