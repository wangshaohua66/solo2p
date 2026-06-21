import os
import sys
import logging
import traceback
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from datetime import datetime
from typing import Optional, Dict, Any
from enum import Enum


class LogLevel(Enum):
    DEBUG = logging.DEBUG
    INFO = logging.INFO
    WARNING = logging.WARNING
    ERROR = logging.ERROR
    CRITICAL = logging.CRITICAL


class SyncStatus(Enum):
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"
    SKIPPED = "SKIPPED"


class LogManager:
    _instance: Optional["LogManager"] = None
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, log_dir: str = "logs", db_log_handler=None):
        if LogManager._initialized:
            return
        LogManager._initialized = True
        self.log_dir = log_dir
        self._ensure_dir()
        self.db_log_handler = db_log_handler
        self._setup_root_logger()
        self._task_loggers: Dict[str, logging.Logger] = {}

    def _ensure_dir(self):
        if not os.path.exists(self.log_dir):
            os.makedirs(self.log_dir, exist_ok=True)
        if not os.path.exists(os.path.join(self.log_dir, "archive")):
            os.makedirs(os.path.join(self.log_dir, "archive"), exist_ok=True)

    def _setup_root_logger(self):
        self.root_logger = logging.getLogger("inventory_sync")
        self.root_logger.setLevel(logging.DEBUG)
        self.root_logger.handlers.clear()

        fmt = logging.Formatter(
            "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )

        file_handler = TimedRotatingFileHandler(
            os.path.join(self.log_dir, "sync_engine.log"),
            when="midnight",
            interval=1,
            backupCount=30,
            encoding="utf-8"
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(fmt)
        file_handler.suffix = "%Y%m"
        self.root_logger.addHandler(file_handler)

        error_handler = RotatingFileHandler(
            os.path.join(self.log_dir, "error.log"),
            maxBytes=50 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8"
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(fmt)
        self.root_logger.addHandler(error_handler)

        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_fmt = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(message)s",
            datefmt="%H:%M:%S"
        )
        console_handler.setFormatter(console_fmt)
        self.root_logger.addHandler(console_handler)

    def get_task_logger(self, task_id: str, supplier_id: str = None) -> logging.Logger:
        key = task_id
        if key in self._task_loggers:
            return self._task_loggers[key]

        logger = logging.getLogger(f"task.{task_id}")
        logger.setLevel(logging.DEBUG)
        logger.handlers.clear()
        logger.propagate = True

        task_file = os.path.join(
            self.log_dir,
            f"task_{task_id}_{datetime.now().strftime('%Y%m%d')}.log"
        )
        handler = logging.FileHandler(task_file, encoding="utf-8")
        fmt = logging.Formatter(
            "%(asctime)s | %(levelname)-8s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(fmt)
        handler.setLevel(logging.DEBUG)
        logger.addHandler(handler)

        self._task_loggers[key] = logger
        return logger

    def log_task_start(self, task_id: str, supplier_id: str, supplier_name: str,
                       sync_type: str) -> Dict[str, Any]:
        start_time = datetime.now()
        logger = self.get_task_logger(task_id, supplier_id)
        logger.info("=" * 60)
        logger.info(f"TASK START | ID: {task_id}")
        logger.info(f"供应商: {supplier_id} - {supplier_name}")
        logger.info(f"同步类型: {sync_type}")
        logger.info(f"开始时间: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("=" * 60)

        task_meta = {
            "task_id": task_id,
            "supplier_id": supplier_id,
            "supplier_name": supplier_name,
            "sync_type": sync_type,
            "start_time": start_time,
            "status": SyncStatus.RUNNING.value,
            "records_fetched": 0,
            "records_inserted": 0,
            "records_failed": 0,
            "error_message": None,
        }
        self._db_log("task_start", task_meta)
        return task_meta

    def log_task_end(self, task_meta: Dict[str, Any],
                     status: SyncStatus = SyncStatus.SUCCESS,
                     error_message: str = None,
                     records_fetched: int = 0,
                     records_inserted: int = 0,
                     records_failed: int = 0) -> Dict[str, Any]:
        end_time = datetime.now()
        start_time = task_meta["start_time"]
        duration = (end_time - start_time).total_seconds()
        task_meta.update({
            "end_time": end_time,
            "duration_seconds": round(duration, 2),
            "status": status.value,
            "records_fetched": records_fetched,
            "records_inserted": records_inserted,
            "records_failed": records_failed,
            "error_message": error_message,
        })

        task_id = task_meta["task_id"]
        supplier_id = task_meta["supplier_id"]
        logger = self.get_task_logger(task_id, supplier_id)

        logger.info("-" * 60)
        logger.info(f"TASK END   | ID: {task_id}")
        logger.info(f"状态: {status.value}")
        logger.info(f"抓取记录: {records_fetched} | 写入: {records_inserted} | 失败: {records_failed}")
        logger.info(f"耗时: {round(duration, 2)}秒")
        if error_message:
            logger.error(f"错误信息: {error_message}")
        logger.info("=" * 60 + "\n")

        self._db_log("task_end", task_meta)
        return task_meta

    def log_step(self, task_id: str, supplier_id: str, step: str,
                 detail: str = "", level: LogLevel = LogLevel.INFO):
        logger = self.get_task_logger(task_id, supplier_id)
        msg = f"[步骤:{step}] {detail}"
        if level == LogLevel.DEBUG:
            logger.debug(msg)
        elif level == LogLevel.INFO:
            logger.info(msg)
        elif level == LogLevel.WARNING:
            logger.warning(msg)
        elif level == LogLevel.ERROR:
            logger.error(msg)
        elif level == LogLevel.CRITICAL:
            logger.critical(msg)

    def log_exception(self, task_id: str, supplier_id: str, step: str,
                      exc: Exception, context: Dict[str, Any] = None):
        logger = self.get_task_logger(task_id, supplier_id)
        tb_str = traceback.format_exc()
        logger.error("!" * 60)
        logger.error(f"[异常:{step}] {type(exc).__name__}: {str(exc)}")
        if context:
            logger.error(f"上下文: {context}")
        logger.error(f"堆栈:\n{tb_str}")
        logger.error("!" * 60)

    def log_retry(self, task_id: str, supplier_id: str, operation: str,
                  attempt: int, max_attempts: int, wait_seconds: float,
                  error: str):
        logger = self.get_task_logger(task_id, supplier_id)
        logger.warning(
            f"[重试] {operation} | 第{attempt}/{max_attempts}次 | "
            f"等待{wait_seconds}s | 原因: {error}"
        )

    def log_manual_intervention_needed(self, task_id: str, supplier_id: str,
                                       reason: str):
        logger = self.get_task_logger(task_id, supplier_id)
        logger.critical("=" * 60)
        logger.critical(f"[需要人工介入] 供应商: {supplier_id}")
        logger.critical(f"原因: {reason}")
        logger.critical("=" * 60)
        self._db_log("manual_intervention", {
            "task_id": task_id,
            "supplier_id": supplier_id,
            "reason": reason,
            "timestamp": datetime.now().isoformat(),
        })

    def _db_log(self, event_type: str, payload: Dict[str, Any]):
        if self.db_log_handler:
            try:
                self.db_log_handler.insert_sync_log({
                    "event_type": event_type,
                    "timestamp": datetime.now().isoformat(),
                    "payload": payload,
                })
            except Exception:
                pass

    def info(self, msg: str):
        self.root_logger.info(msg)

    def warning(self, msg: str):
        self.root_logger.warning(msg)

    def error(self, msg: str):
        self.root_logger.error(msg)

    def debug(self, msg: str):
        self.root_logger.debug(msg)

    def critical(self, msg: str):
        self.root_logger.critical(msg)
