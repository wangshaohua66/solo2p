import logging
import logging.handlers
import sys
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from config import LOG_DIR, PERFORMANCE


class ColoredFormatter(logging.Formatter):
    COLORS = {
        "DEBUG": "\033[90m",
        "INFO": "\033[92m",
        "WARNING": "\033[93m",
        "ERROR": "\033[91m",
        "CRITICAL": "\033[95m",
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        colored = self.COLORS.get(record.levelname, self.RESET)
        levelname = f"{colored}{record.levelname}{self.RESET}"
        message = super().format(record)
        return message.replace(record.levelname, levelname)


class ReviewLogger:
    _instance: Optional["ReviewLogger"] = None
    _initialized = False

    def __new__(cls) -> "ReviewLogger":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized = True
        self._logger = logging.getLogger("CTDReview")
        self._logger.setLevel(logging.DEBUG)
        self._logger.handlers.clear()
        self._setup_handlers()
        self._cleanup_old_logs()

    def _setup_handlers(self) -> None:
        log_format = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
        date_format = "%Y-%m-%d %H:%M:%S"

        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(ColoredFormatter(log_format, datefmt=date_format))
        self._logger.addHandler(console_handler)

        today = datetime.now().strftime("%Y-%m-%d")
        file_handler = logging.handlers.TimedRotatingFileHandler(
            LOG_DIR / f"review_{today}.log",
            when="midnight",
            interval=1,
            backupCount=PERFORMANCE["log_retention_days"],
            encoding="utf-8",
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(logging.Formatter(log_format, datefmt=date_format))
        self._logger.addHandler(file_handler)

        error_handler = logging.handlers.TimedRotatingFileHandler(
            LOG_DIR / f"error_{today}.log",
            when="midnight",
            interval=1,
            backupCount=PERFORMANCE["log_retention_days"],
            encoding="utf-8",
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(logging.Formatter(
            "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s\n%(stack_trace)s",
            datefmt=date_format,
        ))
        self._logger.addHandler(error_handler)

    def _cleanup_old_logs(self) -> None:
        try:
            cutoff = datetime.now() - timedelta(days=PERFORMANCE["log_retention_days"])
            for log_file in LOG_DIR.glob("*.log*"):
                if log_file.is_file():
                    mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
                    if mtime < cutoff:
                        log_file.unlink()
        except Exception as e:
            self._logger.warning(f"清理旧日志失败: {e}")

    def debug(self, msg: str, *args, **kwargs) -> None:
        self._logger.debug(msg, *args, **kwargs)

    def info(self, msg: str, *args, **kwargs) -> None:
        self._logger.info(msg, *args, **kwargs)

    def warning(self, msg: str, *args, **kwargs) -> None:
        self._logger.warning(msg, *args, **kwargs)

    def error(self, msg: str, exception: Optional[Exception] = None, *args, **kwargs) -> None:
        extra = kwargs.pop("extra", {})
        if exception:
            extra["stack_trace"] = "".join(
                traceback.format_exception(type(exception), exception, exception.__traceback__)
            )
        else:
            extra["stack_trace"] = "".join(traceback.format_stack()[:-1])
        self._logger.error(msg, *args, extra=extra, **kwargs)

    def critical(self, msg: str, exception: Optional[Exception] = None, *args, **kwargs) -> None:
        extra = kwargs.pop("extra", {})
        if exception:
            extra["stack_trace"] = "".join(
                traceback.format_exception(type(exception), exception, exception.__traceback__)
            )
        else:
            extra["stack_trace"] = "".join(traceback.format_stack()[:-1])
        self._logger.critical(msg, *args, extra=extra, **kwargs)

    def step(self, step_name: str, start_time: datetime) -> None:
        duration = (datetime.now() - start_time).total_seconds()
        self._logger.info(f"步骤完成: {step_name} | 耗时: {duration:.2f}秒")

    def get_logger(self) -> logging.Logger:
        return self._logger


logger = ReviewLogger()
