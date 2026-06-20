"""
logger.py
================================================================================
分级日志与告警通知模块

职责:
  1. 配置 DEBUG / INFO / WARNING / ERROR 四级日志
  2. 按天滚动 + 单日 100MB 上限, 保留 90 天
  3. 关键操作全程留痕, 结构化日志 (时间戳/案件号/处理阶段/耗时/错误信息)
  4. 关键步骤截图留存, 便于问题追溯
  5. 异常告警邮件通知值班人员
"""

import logging
import logging.handlers
import os
import smtplib
import time
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from typing import Optional

import yaml

# 级别阈值常量, 用于判断是否触发邮件告警
_LEVEL_THRESHOLD = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
}


class CaseContextFilter(logging.Filter):
    """为日志记录注入案件号 / 处理阶段 / 耗时等结构化字段。"""

    def __init__(self):
        super().__init__()
        self.case_no = "-"
        self.stage = "-"
        self.duration = "-"

    def filter(self, record):
        record.case_no = getattr(record, "case_no", self.case_no)
        record.stage = getattr(record, "stage", self.stage)
        record.duration = getattr(record, "duration", self.duration)
        return True


class StructuredFormatter(logging.Formatter):
    """结构化日志格式: 时间戳 | 级别 | 模块 | 案件号 | 阶段 | 耗时 | 消息。"""

    DEFAULT_FMT = (
        "%(asctime)s | %(levelname)-8s | %(name)s | "
        "case=%(case_no)s | stage=%(stage)s | dur=%(duration)s | %(message)s"
    )

    def __init__(self, fmt: Optional[str] = None, datefmt: Optional[str] = None):
        super().__init__(fmt or self.DEFAULT_FMT, datefmt=datefmt)


class DailySizeRotatingHandler(logging.handlers.TimedRotatingFileHandler):
    """
    按天滚动 + 当天文件大小上限的复合处理器。
    当单日日志达到 max_bytes 时, 自动切分为带序号的备份文件,
    满足 "单日日志不超过 100MB" 的性能约束。
    """

    def __init__(self, filename, max_bytes: int, backup_count: int,
                 when: str = "midnight", encoding: str = "utf-8"):
        super().__init__(filename, when=when, interval=1,
                         backupCount=backup_count, encoding=encoding)
        self.max_bytes = max_bytes
        self._current_stream_size = 0
        if os.path.exists(self.baseFilename):
            self._current_stream_size = os.path.getsize(self.baseFilename)

    def shouldRollover(self, record):
        # 先判断按天滚动
        if super().shouldRollover(record):
            return True
        # 再判断按大小滚动
        msg = "%s\n" % self.format(record)
        self._current_stream_size += len(msg.encode(self.encoding or "utf-8"))
        if self._current_stream_size >= self.max_bytes:
            return True
        return False

    def doRollover(self):
        super().doRollover()
        # 滚动后重置当日大小计数
        self._current_stream_size = 0


class EmailAlertHandler(logging.Handler):
    """ERROR 及以上日志触发邮件告警, 通知值班人员。"""

    def __init__(self, email_cfg: dict, subject_prefix: str = "[车险理赔RPA告警]"):
        super().__init__(level=logging.ERROR)
        self.email_cfg = email_cfg
        self.subject_prefix = subject_prefix
        self._last_sent = 0.0
        # 告警去抖: 同一内容 60 秒内不重复发送
        self._debounce_seconds = 60

    def emit(self, record):
        try:
            if not self.email_cfg.get("enabled", False):
                return
            now = time.time()
            if now - self._last_sent < self._debounce_seconds:
                return
            self._last_sent = now
            subject = f"{self.subject_prefix} {record.levelname} - {record.name}"
            body = self.format(record)
            self._send_email(subject, body)
        except Exception as exc:  # 告警失败不应影响主流程
            print(f"[EmailAlertHandler] 告警发送失败: {exc}")

    def _send_email(self, subject: str, body: str, attachments: Optional[list] = None):
        cfg = self.email_cfg
        msg = MIMEMultipart("mixed")
        msg["Subject"] = subject
        msg["From"] = cfg["from_addr"]
        msg["To"] = ", ".join(cfg["to_addrs"])
        msg.attach(MIMEText(body, "plain", "utf-8"))

        for path in attachments or []:
            if os.path.exists(path):
                with open(path, "rb") as f:
                    img = MIMEImage(f.read())
                img.add_header("Content-Disposition",
                               "attachment", filename=os.path.basename(path))
                msg.attach(img)

        if cfg.get("smtp_ssl"):
            server = smtplib.SMTP_SSL(cfg["smtp_host"], cfg["smtp_port"], timeout=15)
        else:
            server = smtplib.SMTP(cfg["smtp_host"], cfg["smtp_port"], timeout=15)
        try:
            server.login(cfg["smtp_user"], cfg["smtp_password"])
            server.sendmail(cfg["from_addr"], cfg["to_addrs"], msg.as_string())
        finally:
            server.quit()


class AppLogger:
    """
    应用日志管理器: 单例式封装, 全局共享同一组 handler。
    各业务模块通过 get_logger(__name__) 获取 logger。
    """

    _initialized = False
    _email_handler: Optional[EmailAlertHandler] = None
    _screenshot_dir: str = "./data/screenshots"

    @classmethod
    def setup(cls, config_path: str = "config.yaml") -> logging.Logger:
        """读取配置并初始化根 logger, 返回根 logger 实例。"""
        if cls._initialized:
            return logging.getLogger("rpa")

        with open(config_path, "r", encoding="utf-8") as f:
            full_cfg = yaml.safe_load(f)
        log_cfg = full_cfg.get("logging", {})
        email_cfg = full_cfg.get("email_alert", {})
        sys_cfg = full_cfg.get("system", {})

        log_dir = log_cfg.get("log_dir", "./logs")
        os.makedirs(log_dir, exist_ok=True)
        cls._screenshot_dir = sys_cfg.get("screenshot_dir", "./data/screenshots")
        os.makedirs(cls._screenshot_dir, exist_ok=True)

        level_name = log_cfg.get("level", "INFO").upper()
        level = _LEVEL_THRESHOLD.get(level_name, logging.INFO)

        root = logging.getLogger("rpa")
        root.setLevel(level)
        # 清理可能存在的旧 handler, 避免重复输出
        root.handlers.clear()

        ctx_filter = CaseContextFilter()

        # 1. 控制台输出 (实时进度显示)
        console = logging.StreamHandler()
        console.setLevel(level)
        console.setFormatter(StructuredFormatter(
            datefmt=log_cfg.get("date_format", "%Y-%m-%d %H:%M:%S")))
        console.addFilter(ctx_filter)
        root.addHandler(console)

        # 2. 按天 + 按大小滚动文件 (100MB/天, 保留 90 天)
        log_file = os.path.join(log_dir, "rpa.log")
        retention_days = int(log_cfg.get("retention_days", 90))
        max_bytes = int(log_cfg.get("max_daily_size_mb", 100)) * 1024 * 1024
        file_handler = DailySizeRotatingHandler(
            log_file, max_bytes=max_bytes, backup_count=retention_days)
        file_handler.setLevel(level)
        file_handler.setFormatter(StructuredFormatter(
            datefmt=log_cfg.get("date_format", "%Y-%m-%d %H:%M:%S")))
        file_handler.addFilter(ctx_filter)
        root.addHandler(file_handler)

        # 3. 邮件告警 handler (ERROR 及以上)
        if email_cfg.get("enabled", False):
            cls._email_handler = EmailAlertHandler(
                email_cfg, subject_prefix=email_cfg.get("subject_prefix", ""))
            cls._email_handler.setLevel(
                _LEVEL_THRESHOLD.get(email_cfg.get("alert_level", "ERROR").upper(),
                                     logging.ERROR))
            cls._email_handler.setFormatter(StructuredFormatter(
                datefmt=log_cfg.get("date_format", "%Y-%m-%d %H:%M:%S")))
            cls._email_handler.addFilter(ctx_filter)
            root.addHandler(cls._email_handler)

        cls._initialized = True
        root.info("日志系统初始化完成 | level=%s | dir=%s | retention=%dd",
                  level_name, log_dir, retention_days)
        return root

    @classmethod
    def get_logger(cls, name: str) -> logging.Logger:
        """业务模块获取 logger (自动挂到 rpa 命名空间下)。"""
        return logging.getLogger(f"rpa.{name}")

    @classmethod
    def save_screenshot(cls, image, case_no: str, stage: str) -> Optional[str]:
        """
        保存关键步骤截图, 便于问题追溯。
        image: numpy 数组(OpenCV BGR) 或 PIL.Image。
        返回保存路径, 失败返回 None。
        """
        try:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            safe_case = "".join(c for c in str(case_no) if c.isalnum())
            filename = f"{ts}_{safe_case}_{stage}.png"
            path = os.path.join(cls._screenshot_dir, filename)
            os.makedirs(os.path.dirname(path), exist_ok=True)

            if hasattr(image, "save"):
                # PIL.Image
                image.save(path)
            else:
                # OpenCV BGR numpy array
                import cv2
                cv2.imwrite(path, image)
            return path
        except Exception as exc:
            logging.getLogger("rpa.logger").warning(
                "截图保存失败 | case=%s stage=%s err=%s", case_no, stage, exc)
            return None

    @classmethod
    def send_alert(cls, subject: str, body: str,
                  attachments: Optional[list] = None) -> bool:
        """主动发送一封告警邮件 (非 ERROR 日志路径, 如夜间处理完成通知)。"""
        if cls._email_handler is None:
            return False
        try:
            cls._email_handler._send_email(subject, body, attachments)
            return True
        except Exception as exc:
            logging.getLogger("rpa.logger").warning("主动告警发送失败: %s", exc)
            return False


def get_logger(name: str) -> logging.Logger:
    """模块级便捷函数, 业务代码直接 from logger import get_logger。"""
    return AppLogger.get_logger(name)


def with_context(case_no: str = "-", stage: str = "-"):
    """
    上下文管理器: 在 with 块内自动为日志注入案件号/阶段,
    并在退出时记录该阶段耗时。
    """
    return _LogContext(case_no, stage)


class _LogContext:
    def __init__(self, case_no: str, stage: str):
        self.case_no = case_no
        self.stage = stage
        self._start = 0.0
        self._filter = None
        self._root = None

    def __enter__(self):
        self._start = time.time()
        self._root = logging.getLogger("rpa")
        # 为所有 handler 的 CaseContextFilter 设置上下文
        for h in self._root.handlers:
            for flt in h.filters:
                if isinstance(flt, CaseContextFilter):
                    flt.case_no = self.case_no
                    flt.stage = self.stage
                    self._filter = flt
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = f"{time.time() - self._start:.2f}s"
        if self._filter is not None:
            self._filter.duration = duration
        if exc_type is None:
            logging.getLogger("rpa").info(
                "阶段完成 | stage=%s dur=%s", self.stage, duration)
        else:
            logging.getLogger("rpa").error(
                "阶段异常 | stage=%s dur=%s err=%s",
                self.stage, duration, exc_val)
        # 退出后重置上下文
        if self._filter is not None:
            self._filter.case_no = "-"
            self._filter.stage = "-"
            self._filter.duration = "-"
        return False
