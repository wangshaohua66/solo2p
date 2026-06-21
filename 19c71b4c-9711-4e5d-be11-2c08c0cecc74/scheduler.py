import logging
import smtplib
import time
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Callable, Optional, Dict, Any

logger = logging.getLogger(__name__)


class AlertNotifier:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.enabled = self.config.get("enabled", False)

    def send_alert(self, subject: str, message: str, level: str = "WARNING") -> bool:
        if not self.enabled:
            logger.info("[ALERT_DISABLED] %s: %s", level, subject)
            return False
        logger.error("[ALERT_%s] %s: %s", level.upper(), subject, message)

        email_config = self.config.get("email")
        if email_config:
            return self._send_email(subject, message, email_config)

        webhook_url = self.config.get("webhook_url")
        if webhook_url:
            return self._send_webhook(subject, message, webhook_url)

        return False

    def _send_email(self, subject: str, message: str, email_config: Dict[str, Any]) -> bool:
        try:
            msg = MIMEMultipart()
            msg["From"] = email_config.get("sender", "")
            msg["To"] = email_config.get("recipients", "")
            msg["Subject"] = f"[爬虫告警] {subject}"

            body = f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n{message}"
            msg.attach(MIMEText(body, "plain", "utf-8"))

            with smtplib.SMTP_SSL(email_config.get("smtp_host", ""), email_config.get("smtp_port", 465)) as server:
                server.login(email_config.get("username", ""), email_config.get("password", ""))
                server.send_message(msg)
            logger.info("Alert email sent to %s", email_config.get("recipients"))
            return True
        except Exception as e:
            logger.error("Failed to send alert email: %s", str(e))
            return False

    def _send_webhook(self, subject: str, message: str, url: str) -> bool:
        try:
            import requests

            payload = {
                "msgtype": "text",
                "text": {"content": f"[爬虫告警] {subject}\n\n{message}"},
            }
            resp = requests.post(url, json=payload, timeout=10)
            return resp.status_code == 200
        except Exception as e:
            logger.error("Failed to send alert webhook: %s", str(e))
            return False


class Scheduler:
    def __init__(self, notifier: Optional[AlertNotifier] = None):
        self.notifier = notifier or AlertNotifier()
        self.last_crawl_time: Optional[datetime] = None
        self.crawl_history: list = []

    def run_once(self, crawl_func: Callable, *args, **kwargs) -> Dict[str, Any]:
        logger.info("=" * 60)
        logger.info("Starting scheduled crawl at %s", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        start_time = time.time()

        result = {
            "start_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "success": False,
            "error": None,
            "duration_seconds": 0,
            "stats": {},
        }

        try:
            stats = crawl_func(*args, **kwargs)
            result["success"] = True
            result["stats"] = stats or {}
        except Exception as e:
            logger.exception("Crawl task failed: %s", str(e))
            result["error"] = str(e)
            self.notifier.send_alert(
                subject="爬虫任务执行失败",
                message=f"错误类型: {type(e).__name__}\n错误详情: {str(e)}",
                level="ERROR",
            )

        duration = time.time() - start_time
        result["duration_seconds"] = round(duration, 2)
        result["end_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.last_crawl_time = datetime.now()
        self.crawl_history.append(result)

        logger.info(
            "Crawl finished: success=%s, duration=%.2fs, stats=%s",
            result["success"],
            duration,
            result.get("stats", {}),
        )

        if not result["success"]:
            self.notifier.send_alert(
                subject="爬虫任务执行异常",
                message=f"任务耗时: {duration:.2f}秒\n错误: {result['error']}",
                level="ERROR",
            )
        elif duration > 1800:
            self.notifier.send_alert(
                subject="爬虫任务执行超时预警",
                message=f"任务耗时超过30分钟: {duration:.2f}秒",
                level="WARNING",
            )

        return result

    def run_daily(self, crawl_func: Callable, hour: int = 2, minute: int = 0, *args, **kwargs):
        logger.info("Daily scheduler started, will run at %02d:%02d every day", hour, minute)
        while True:
            now = datetime.now()
            target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if now >= target:
                target = target.replace(day=target.day + 1)

            wait_seconds = (target - now).total_seconds()
            logger.info("Next crawl scheduled at %s (waiting %.0f seconds)", target, wait_seconds)

            try:
                time.sleep(wait_seconds)
            except KeyboardInterrupt:
                logger.info("Scheduler stopped by user")
                break

            self.run_once(crawl_func, *args, **kwargs)

    def run_hourly(self, crawl_func: Callable, interval_minutes: int = 60, *args, **kwargs):
        logger.info("Hourly scheduler started, interval=%d minutes", interval_minutes)
        while True:
            self.run_once(crawl_func, *args, **kwargs)
            try:
                time.sleep(interval_minutes * 60)
            except KeyboardInterrupt:
                logger.info("Scheduler stopped by user")
                break

    def get_status(self) -> Dict[str, Any]:
        return {
            "last_crawl_time": self.last_crawl_time.strftime("%Y-%m-%d %H:%M:%S") if self.last_crawl_time else None,
            "total_runs": len(self.crawl_history),
            "recent_runs": self.crawl_history[-10:],
        }
