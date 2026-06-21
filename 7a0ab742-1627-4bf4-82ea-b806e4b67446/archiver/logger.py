import json
import logging
import os
import sys
import time
import traceback
from datetime import datetime, timedelta
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path


class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created).strftime("%Y-%m-%dT%H:%M:%S.%f"),
            "level": record.levelname,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": record.getMessage(),
        }

        if hasattr(record, "operation_type"):
            log_entry["operation_type"] = record.operation_type

        if hasattr(record, "object"):
            log_entry["object"] = record.object

        if hasattr(record, "duration_ms"):
            log_entry["duration_ms"] = record.duration_ms

        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info),
            }

        return json.dumps(log_entry, ensure_ascii=False)


class ConsoleFormatter(logging.Formatter):
    COLORS = {
        "DEBUG": "\033[36m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[35m",
    }
    RESET = "\033[0m"

    def format(self, record):
        color = self.COLORS.get(record.levelname, "")
        timestamp = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S")
        message = f"{color}[{record.levelname}]{self.RESET} {timestamp} - {record.module}: {record.getMessage()}"
        return message


class ArchiveLogger:
    _instance = None
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, log_dir="logs", log_level="INFO", retention_days=90, name="archiver"):
        if self._initialized:
            return
        self._initialized = True

        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
        self.logger.propagate = False

        self._setup_console_handler(log_level)

        if log_dir:
            self._setup_file_handler(log_dir, log_level, retention_days)

    def _setup_console_handler(self, log_level):
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(getattr(logging, log_level.upper(), logging.INFO))
        console_handler.setFormatter(ConsoleFormatter())
        self.logger.addHandler(console_handler)

    def _setup_file_handler(self, log_dir, log_level, retention_days):
        log_path = Path(log_dir)
        log_path.mkdir(parents=True, exist_ok=True)

        log_file = log_path / "archiver.log"
        file_handler = TimedRotatingFileHandler(
            str(log_file),
            when="midnight",
            interval=1,
            backupCount=retention_days,
            encoding="utf-8",
        )
        file_handler.setLevel(getattr(logging, log_level.upper(), logging.INFO))
        file_handler.setFormatter(JsonFormatter())
        file_handler.suffix = "%Y-%m-%d"
        self.logger.addHandler(file_handler)

    def _log_with_context(self, level, message, operation_type=None, obj=None, duration_ms=None, exc_info=None):
        extra = {}
        if operation_type:
            extra["operation_type"] = operation_type
        if obj:
            extra["object"] = obj
        if duration_ms is not None:
            extra["duration_ms"] = round(duration_ms, 2)

        self.logger.log(level, message, extra=extra, exc_info=exc_info)

    def debug(self, message, operation_type=None, obj=None, duration_ms=None):
        self._log_with_context(logging.DEBUG, message, operation_type, obj, duration_ms)

    def info(self, message, operation_type=None, obj=None, duration_ms=None):
        self._log_with_context(logging.INFO, message, operation_type, obj, duration_ms)

    def warning(self, message, operation_type=None, obj=None, duration_ms=None):
        self._log_with_context(logging.WARNING, message, operation_type, obj, duration_ms)

    def error(self, message, operation_type=None, obj=None, duration_ms=None, exc_info=None):
        self._log_with_context(logging.ERROR, message, operation_type, obj, duration_ms, exc_info)

    def critical(self, message, operation_type=None, obj=None, duration_ms=None, exc_info=None):
        self._log_with_context(logging.CRITICAL, message, operation_type, obj, duration_ms, exc_info)

    def log_timing(self, operation_type=None, obj=None):
        return TimingContext(self, operation_type, obj)


class TimingContext:
    def __init__(self, logger, operation_type=None, obj=None):
        self.logger = logger
        self.operation_type = operation_type
        self.obj = obj
        self.start_time = None

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = (time.time() - self.start_time) * 1000
        if exc_type:
            self.logger.error(
                f"Operation failed: {self.operation_type}",
                operation_type=self.operation_type,
                obj=self.obj,
                duration_ms=duration_ms,
                exc_info=(exc_type, exc_val, exc_tb),
            )
        else:
            self.logger.info(
                f"Operation completed: {self.operation_type}",
                operation_type=self.operation_type,
                obj=self.obj,
                duration_ms=duration_ms,
            )
        return False


def get_logger(log_dir="logs", log_level="INFO", retention_days=90):
    return ArchiveLogger(log_dir=log_dir, log_level=log_level, retention_days=retention_days)
