import logging
import sys
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path
from typing import Optional

try:
    import colorlog
    _HAS_COLORLOG = True
except ImportError:
    _HAS_COLORLOG = False

from config import BASE_DIR


_LOG_DIR = BASE_DIR / "logs"
_LOGGER_CACHE: dict = {}


def _ensure_log_dir() -> Path:
    _LOG_DIR.mkdir(parents=True, exist_ok=True)
    return _LOG_DIR


def _get_console_formatter() -> logging.Formatter:
    if _HAS_COLORLOG:
        log_colors = {
            "DEBUG": "cyan",
            "INFO": "green",
            "WARNING": "yellow",
            "ERROR": "red",
            "CRITICAL": "bold_red",
        }
        return colorlog.ColoredFormatter(
            "%(log_color)s[%(asctime)s] [%(levelname)-7s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
            log_colors=log_colors,
            secondary_log_colors={},
            style="%"
        )
    return logging.Formatter(
        "[%(asctime)s] [%(levelname)-7s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )


def _get_file_formatter() -> logging.Formatter:
    return logging.Formatter(
        "[%(asctime)s] [%(levelname)-7s] [%(name)s] [%(filename)s:%(lineno)d] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )


def get_logger(name: str = "recruitment", level: int = logging.INFO) -> logging.Logger:
    if name in _LOGGER_CACHE:
        return _LOGGER_CACHE[name]

    logger = logging.getLogger(name)
    logger.setLevel(level)
    logger.propagate = False

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(_get_console_formatter())
    logger.addHandler(console_handler)

    log_dir = _ensure_log_dir()
    file_handler = TimedRotatingFileHandler(
        filename=str(log_dir / f"{name}.log"),
        when="midnight",
        interval=1,
        backupCount=30,
        encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(_get_file_formatter())
    logger.addHandler(file_handler)

    _LOGGER_CACHE[name] = logger
    return logger


def set_log_level(logger: logging.Logger, level: int) -> None:
    logger.setLevel(level)
    for handler in logger.handlers:
        if isinstance(handler, logging.StreamHandler):
            handler.setLevel(level)
