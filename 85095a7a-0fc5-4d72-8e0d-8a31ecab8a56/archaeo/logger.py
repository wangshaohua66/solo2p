import logging
import os
from datetime import datetime, timedelta
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path

from rich.console import Console
from rich.logging import RichHandler

from .config import load_config, get_config_dir

_console = Console()
_logger_initialized = False


def get_log_dir() -> Path:
    config = load_config()
    log_dir = Path(os.path.expanduser(config.log.directory))
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


class ColoredFormatter(logging.Formatter):
    LEVEL_COLORS = {
        "DEBUG": "dim",
        "INFO": "green",
        "WARNING": "yellow",
        "ERROR": "red",
        "CRITICAL": "bold red",
    }

    def format(self, record: logging.LogRecord) -> str:
        level_name = record.levelname
        color = self.LEVEL_COLORS.get(level_name, "white")
        message = super().format(record)
        return f"[{color}]{message}[/{color}]"


def cleanup_old_logs(log_dir: Path, retention_days: int) -> None:
    cutoff = datetime.now() - timedelta(days=retention_days)
    for log_file in log_dir.glob("*.log*"):
        try:
            mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
            if mtime < cutoff:
                log_file.unlink()
        except OSError:
            pass


def setup_logger(name: str = "archaeo") -> logging.Logger:
    global _logger_initialized
    logger = logging.getLogger(name)

    if _logger_initialized:
        return logger

    config = load_config()
    log_dir = get_log_dir()
    log_level = getattr(logging, config.log.level.upper(), logging.INFO)

    logger.setLevel(log_level)

    log_file = log_dir / "archaeo.log"
    file_handler = TimedRotatingFileHandler(
        log_file,
        when="midnight",
        interval=1,
        backupCount=config.log.retention_days,
        encoding="utf-8",
    )
    file_formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)

    rich_handler = RichHandler(
        console=_console,
        show_time=True,
        show_level=True,
        show_path=False,
        rich_tracebacks=True,
        markup=True,
    )
    rich_handler.setLevel(log_level)
    logger.addHandler(rich_handler)

    cleanup_old_logs(log_dir, config.log.retention_days)

    _logger_initialized = True
    return logger


def get_logger(name: str = "archaeo") -> logging.Logger:
    return setup_logger(name)
