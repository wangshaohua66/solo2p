import logging
import os
import re
from datetime import datetime, timedelta
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path

from rich.console import Console
from rich.logging import RichHandler


class _AnsiColorStripper(logging.Filter):
    _ANSI_ESCAPE = re.compile(r'\x1B\[[0-?]*[ -/]*[@-~]')

    def filter(self, record):
        if isinstance(record.msg, str):
            record.msg = self._ANSI_ESCAPE.sub('', record.msg)
        return True


class _DailyRotatingFileHandler(TimedRotatingFileHandler):
    def __init__(self, filename, when='midnight', interval=1, backupCount=90,
                 encoding='utf-8', delay=False, utc=False, atTime=None):
        super().__init__(filename, when=when, interval=interval,
                         backupCount=backupCount, encoding=encoding,
                         delay=delay, utc=utc, atTime=atTime)
        self.addFilter(_AnsiColorStripper())

    def getFilesToDelete(self):
        dirName, baseName = os.path.split(self.baseFilename)
        fileNames = os.listdir(dirName)
        result = []
        prefix = baseName + "."
        plen = len(prefix)
        for fileName in fileNames:
            if fileName[:plen] == prefix:
                suffix = fileName[plen:]
                try:
                    datetime.strptime(suffix, self.suffix)
                    result.append(os.path.join(dirName, fileName))
                except ValueError:
                    continue
        if len(result) < self.backupCount:
            result = []
        else:
            result.sort()
            result = result[:len(result) - self.backupCount]
        return result


class SeedworkLogger:
    _instance = None
    _console = Console(highlight=False)
    _log_dir: Path = None
    _log_level: str = "INFO"
    _retention_days: int = 90

    def __new__(cls, log_dir: str = "./logs", log_level: str = "INFO",
                retention_days: int = 90):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._log_dir = Path(log_dir)
            cls._log_level = log_level
            cls._retention_days = retention_days
            cls._instance._setup_logger()
        return cls._instance

    def _setup_logger(self):
        self._log_dir.mkdir(parents=True, exist_ok=True)
        log_file = self._log_dir / "seedwork.log"

        self.logger = logging.getLogger("seedwork")
        self.logger.setLevel(getattr(logging, self._log_level.upper()))
        self.logger.propagate = False

        if self.logger.handlers:
            return

        console_handler = RichHandler(
            console=self._console,
            rich_tracebacks=True,
            show_time=True,
            show_path=False,
            markup=True,
            log_time_format="%Y-%m-%d %H:%M:%S"
        )
        console_handler.setLevel(getattr(logging, self._log_level.upper()))
        console_format = logging.Formatter("%(message)s")
        console_handler.setFormatter(console_format)
        self.logger.addHandler(console_handler)

        file_handler = _DailyRotatingFileHandler(
            str(log_file),
            when="midnight",
            interval=1,
            backupCount=self._retention_days,
            encoding="utf-8"
        )
        file_handler.setLevel(getattr(logging, self._log_level.upper()))
        file_format = logging.Formatter(
            "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        file_handler.setFormatter(file_format)
        self.logger.addHandler(file_handler)

    @classmethod
    def get_logger(cls) -> logging.Logger:
        if cls._instance is None:
            cls()
        return cls._instance.logger

    @classmethod
    def get_console(cls) -> Console:
        if cls._instance is None:
            cls()
        return cls._instance._console

    @classmethod
    def cleanup_old_logs(cls):
        if cls._log_dir is None:
            return
        cutoff = datetime.now() - timedelta(days=cls._retention_days)
        for log_file in cls._log_dir.glob("*.log*"):
            try:
                mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
                if mtime < cutoff:
                    log_file.unlink()
            except (OSError, ValueError):
                continue


def get_logger() -> logging.Logger:
    return SeedworkLogger.get_logger()


def get_console() -> Console:
    return SeedworkLogger.get_console()
