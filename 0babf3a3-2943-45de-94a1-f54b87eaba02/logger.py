import logging
import os
from logging.handlers import TimedRotatingFileHandler
from datetime import datetime
from typing import Optional


class LoggerManager:
    _instance = None
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, log_config: Optional[dict] = None):
        if self._initialized:
            return
        self._initialized = True

        self.logger = logging.getLogger("hydro_import")
        self.logger.setLevel(logging.DEBUG)
        self.logger.propagate = False

        if log_config:
            self.configure(log_config)
        else:
            self._configure_default()

    def _configure_default(self):
        log_dir = "logs"
        os.makedirs(log_dir, exist_ok=True)

        level = getattr(logging, "INFO", logging.INFO)

        file_handler = TimedRotatingFileHandler(
            filename=os.path.join(log_dir, "hydro_import.log"),
            when='midnight',
            interval=1,
            backupCount=7,
            encoding='utf-8'
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(self._get_formatter())

        console_handler = logging.StreamHandler()
        console_handler.setLevel(level)
        console_handler.setFormatter(self._get_formatter())

        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)

    def configure(self, log_config: dict):
        for handler in self.logger.handlers[:]:
            self.logger.removeHandler(handler)
            handler.close()

        log_file = log_config.get("file", "hydro_import.log")
        log_dir = os.path.dirname(log_file)
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)

        level_str = log_config.get("level", "INFO")
        level = getattr(logging, level_str.upper(), logging.INFO)
        self.logger.setLevel(logging.DEBUG)

        backup_count = log_config.get("backup_count", 7)

        file_handler = TimedRotatingFileHandler(
            filename=log_file,
            when='midnight',
            interval=1,
            backupCount=backup_count,
            encoding='utf-8'
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(self._get_formatter())

        console_handler = logging.StreamHandler()
        console_handler.setLevel(level)
        console_handler.setFormatter(self._get_formatter())

        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)

    def _get_formatter(self) -> logging.Formatter:
        return logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

    def set_level(self, level_str: str):
        level = getattr(logging, level_str.upper(), logging.INFO)
        for handler in self.logger.handlers:
            handler.setLevel(level)
        self.logger.setLevel(logging.DEBUG)

    def debug(self, message: str, **kwargs):
        self._log(logging.DEBUG, message, **kwargs)

    def info(self, message: str, **kwargs):
        self._log(logging.INFO, message, **kwargs)

    def warning(self, message: str, **kwargs):
        self._log(logging.WARNING, message, **kwargs)

    def error(self, message: str, **kwargs):
        self._log(logging.ERROR, message, **kwargs)

    def _log(self, level: int, message: str, **kwargs):
        extra_info = []
        if 'file' in kwargs:
            extra_info.append(f"文件: {kwargs['file']}")
        if 'line' in kwargs:
            extra_info.append(f"行号: {kwargs['line']}")
        if 'record' in kwargs:
            extra_info.append(f"记录: {kwargs['record']}")
        if 'reason' in kwargs:
            extra_info.append(f"原因: {kwargs['reason']}")

        if extra_info:
            message = f"{message} [{', '.join(extra_info)}]"

        self.logger.log(level, message)

    def log_file_start(self, filename: str):
        self.info(f"开始处理文件: {filename} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    def log_file_end(self, filename: str, success_count: int, fail_count: int,
                     duplicate_count: int, anomaly_count: int):
        self.info(
            f"处理完成: {filename} - "
            f"成功: {success_count}, 失败: {fail_count}, "
            f"重复: {duplicate_count}, 异常: {anomaly_count} - "
            f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        )

    def log_validation_error(self, filename: str, line_num: int, record: dict, reason: str):
        self.error(
            f"校验失败",
            file=filename,
            line=line_num,
            record=str(record),
            reason=reason
        )

    def log_duplicate(self, filename: str, station_code: str, obs_time: str, strategy: str):
        self.warning(
            f"重复记录 - 策略: {strategy}",
            file=filename,
            record=f"站点: {station_code}, 时间: {obs_time}"
        )

    def log_anomaly(self, filename: str, station_code: str, obs_time: str,
                    anomaly_type: str, value: float, prev_value: float, threshold: float):
        diff = abs(value - prev_value)
        self.warning(
            f"异常检测 - {anomaly_type}",
            file=filename,
            record=f"站点: {station_code}, 时间: {obs_time}, "
                   f"当前值: {value}, 前值: {prev_value}, "
                   f"差值: {diff:.2f}, 阈值: {threshold}"
        )

    def log_import_progress(self, filename: str, processed: int, total: int):
        self.info(f"文件进度: {filename} - {processed}/{total} ({processed/total*100:.1f}%)")
