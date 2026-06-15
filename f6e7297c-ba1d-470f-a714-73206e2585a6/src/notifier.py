import os
import json
import time
import smtplib
import logging
import threading
from datetime import datetime
from typing import Dict, Any, List, Optional
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate

logger = logging.getLogger(__name__)

try:
    import urllib.request
    import urllib.error
    HAS_URLLIB = True
except ImportError:
    HAS_URLLIB = False


class NotificationChannel:
    def __init__(self, name: str, config: Dict[str, Any]):
        self.name = name
        self.config = config
        self.enabled = config.get("enabled", False)

    def send(self, context: Dict[str, Any]) -> bool:
        raise NotImplementedError


class WebhookChannel(NotificationChannel):
    def __init__(self, config: Dict[str, Any]):
        super().__init__("webhook", config)
        self.url = config.get("url", "")
        self.method = config.get("method", "POST").upper()
        self.timeout = config.get("timeout", 10)
        self.headers = config.get("headers", {})
        self.template = config.get("template", {})

    def _render_template(self, template: Any, context: Dict[str, Any]) -> Any:
        if isinstance(template, str):
            try:
                return template.format(**context)
            except (KeyError, ValueError, IndexError) as e:
                logger.debug(f"模板渲染回退到替换: {e}")
                result = template
                for k, v in context.items():
                    result = result.replace("{" + str(k) + "}", str(v))
                return result
        elif isinstance(template, dict):
            return {k: self._render_template(v, context) for k, v in template.items()}
        elif isinstance(template, list):
            return [self._render_template(item, context) for item in template]
        else:
            return template

    def send(self, context: Dict[str, Any]) -> bool:
        if not self.enabled or not self.url or not HAS_URLLIB:
            return False

        try:
            payload = self._render_template(self.template, context)
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")

            req = urllib.request.Request(
                self.url, data=data, method=self.method,
                headers=self.headers
            )

            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                status = resp.getcode()
                body = resp.read().decode("utf-8", errors="replace")

            if 200 <= status < 300:
                logger.info(f"Webhook 通知发送成功 (HTTP {status})")
                return True
            else:
                logger.warning(f"Webhook 通知返回非成功状态: HTTP {status}, body={body[:200]}")
                return False

        except urllib.error.URLError as e:
            logger.error(f"Webhook 通知网络错误: {e}")
        except Exception as e:
            logger.error(f"Webhook 通知发送异常: {e}", exc_info=True)
        return False


class EmailChannel(NotificationChannel):
    def __init__(self, config: Dict[str, Any]):
        super().__init__("email", config)
        self.smtp_host = config.get("smtp_host", "")
        self.smtp_port = config.get("smtp_port", 465)
        self.use_ssl = config.get("use_ssl", True)
        self.username = config.get("username", "")
        self.password = config.get("password", "")
        self.sender = config.get("sender", self.username)
        self.recipients: List[str] = config.get("recipients", [])
        self.subject_template = config.get("subject_template", "集装箱自动化系统告警")
        self.body_template = config.get("body_template", "{message}")

    def _render(self, template: str, context: Dict[str, Any]) -> str:
        try:
            return template.format(**context)
        except (KeyError, ValueError) as e:
            logger.debug(f"邮件模板渲染回退: {e}")
            result = template
            for k, v in context.items():
                result = result.replace("{" + str(k) + "}", str(v))
            return result

    def send(self, context: Dict[str, Any]) -> bool:
        if not self.enabled or not self.smtp_host or not self.recipients:
            return False

        try:
            subject = self._render(self.subject_template, context)
            body = self._render(self.body_template, context)

            msg = MIMEMultipart("alternative")
            msg["From"] = formataddr(("集装箱自动化告警", self.username))
            msg["To"] = ", ".join(self.recipients)
            msg["Subject"] = subject
            msg["Date"] = formatdate(localtime=True)

            part = MIMEText(body, "html", "utf-8")
            msg.attach(part)

            if self.use_ssl:
                server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=15)
            else:
                server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=15)
                server.starttls()

            try:
                if self.username and self.password:
                    server.login(self.username, self.password)
                server.sendmail(self.username, self.recipients, msg.as_string())
            finally:
                server.quit()

            logger.info(f"邮件告警已发送到: {', '.join(self.recipients)}")
            return True

        except Exception as e:
            logger.error(f"邮件发送失败: {e}", exc_info=True)
            return False


class Notifier:
    _instance: Optional["Notifier"] = None

    def __init__(self, config: Dict[str, Any]):
        self.config = config.get("notification", {})
        self.enabled = self.config.get("enabled", False)
        self.rate_limit_seconds = self.config.get("rate_limit_seconds", 300)
        self.channels: List[NotificationChannel] = []
        self._last_sent_ts: float = 0.0
        self._send_lock = threading.Lock()
        self._init_channels()

    @classmethod
    def instance(cls, config: Optional[Dict[str, Any]] = None) -> "Notifier":
        if cls._instance is None and config is not None:
            cls._instance = Notifier(config)
        return cls._instance or Notifier({})

    def _init_channels(self) -> None:
        if not self.enabled:
            logger.info("通知模块已在配置中禁用")
            return

        webhook_cfg = self.config.get("webhook", {})
        if webhook_cfg.get("enabled", False):
            self.channels.append(WebhookChannel(webhook_cfg))
            logger.info("已加载通知渠道: Webhook")

        email_cfg = self.config.get("email", {})
        if email_cfg.get("enabled", False):
            self.channels.append(EmailChannel(email_cfg))
            logger.info(f"已加载通知渠道: Email ({len(email_cfg.get('recipients', []))}个收件人)")

        if not self.channels:
            logger.warning("通知模块已启用但没有配置任何渠道，请在config.yaml中配置webhook或email")

    def _build_context(self, level: str, message: str,
                       consecutive_failures: int = 0,
                       extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        context = {
            "level": level,
            "message": message,
            "consecutive_failures": consecutive_failures,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "timestamp_iso": datetime.now().isoformat(),
            "hostname": os.uname()[1] if hasattr(os, "uname") else "unknown",
            "last_error": message,
        }
        if extra:
            context.update(extra)
        return context

    def _check_rate_limit(self) -> bool:
        now = time.time()
        if now - self._last_sent_ts < self.rate_limit_seconds:
            remaining = int(self.rate_limit_seconds - (now - self._last_sent_ts))
            logger.info(f"通知限流中，距离下次可发送还有 {remaining}s")
            return False
        return True

    def send(self, level: str, message: str,
             consecutive_failures: int = 0,
             extra: Optional[Dict[str, Any]] = None,
             force: bool = False) -> bool:
        if not self.enabled or not self.channels:
            return False

        with self._send_lock:
            if not force and not self._check_rate_limit():
                return False

            context = self._build_context(level, message, consecutive_failures, extra)
            success_count = 0

            for channel in self.channels:
                try:
                    if channel.send(context):
                        success_count += 1
                except Exception as e:
                    logger.error(f"通知渠道 [{channel.name}] 发送异常: {e}", exc_info=True)

            if success_count > 0:
                self._last_sent_ts = time.time()
                logger.info(
                    f"通知已发送: {success_count}/{len(self.channels)} 个渠道成功 | "
                    f"级别={level} | 内容={message[:50]}"
                )
                return True
            else:
                logger.warning(f"通知发送失败: {len(self.channels)} 个渠道全部失败")
                return False

    def send_async(self, level: str, message: str,
                   consecutive_failures: int = 0,
                   extra: Optional[Dict[str, Any]] = None,
                   force: bool = False) -> threading.Thread:
        def _worker():
            try:
                self.send(level, message, consecutive_failures, extra, force)
            except Exception as e:
                logger.error(f"异步通知异常: {e}")

        t = threading.Thread(target=_worker, name="notifier_async", daemon=True)
        t.start()
        return t

    def send_critical_failure(self, message: str,
                              consecutive_failures: int,
                              extra: Optional[Dict[str, Any]] = None) -> bool:
        return self.send(
            level="CRITICAL",
            message=message,
            consecutive_failures=consecutive_failures,
            extra=extra,
            force=False
        )

    def send_warning(self, message: str,
                     consecutive_failures: int = 0,
                     extra: Optional[Dict[str, Any]] = None) -> bool:
        return self.send(
            level="WARNING",
            message=message,
            consecutive_failures=consecutive_failures,
            extra=extra,
            force=False
        )

    def send_info(self, message: str,
                  extra: Optional[Dict[str, Any]] = None) -> bool:
        return self.send(
            level="INFO",
            message=message,
            consecutive_failures=0,
            extra=extra,
            force=False
        )

    def reset_rate_limit(self) -> None:
        self._last_sent_ts = 0.0
        logger.info("通知限流计时器已重置")
