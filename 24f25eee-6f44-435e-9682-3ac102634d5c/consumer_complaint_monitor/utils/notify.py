import time
import hmac
import hashlib
import base64
import urllib.parse
import threading
from typing import Optional, List
from datetime import datetime, timedelta
from collections import defaultdict
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import requests as req
from loguru import logger

from config.settings import Settings


class Notifier:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self, settings: Optional[Settings] = None):
        if self._initialized:
            return
        self._settings = settings or Settings()
        self._dingtalk_cfg = self._settings.get_notify_config().get("dingtalk", {})
        self._email_cfg = self._settings.get_notify_config().get("email", {})
        self._urgent_keywords = self._dingtalk_cfg.get("urgent_keywords", [])
        self._urgent_deadline_seconds = 300
        self._warning_aggregate_seconds = 1800
        self._warning_buffer: List[dict] = []
        self._warning_buffer_lock = threading.Lock()
        self._last_warning_flush: float = 0
        self._urgent_sent_tracker: dict = {}
        self._initialized = True

    def _sign_dingtalk_url(self) -> str:
        webhook = self._dingtalk_cfg.get("webhook", "")
        secret = self._dingtalk_cfg.get("secret", "")
        if not webhook:
            return ""
        if not secret:
            return webhook
        timestamp = str(round(time.time() * 1000))
        string_to_sign = f"{timestamp}\n{secret}"
        hmac_code = hmac.new(
            secret.encode("utf-8"),
            string_to_sign.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).digest()
        sign = urllib.parse.quote_plus(base64.b64encode(hmac_code))
        return f"{webhook}&timestamp={timestamp}&sign={sign}"

    def send_dingtalk(self, title: str, text: str, is_urgent: bool = False):
        url = self._sign_dingtalk_url()
        if not url:
            logger.warning("DingTalk webhook not configured")
            return

        payload = {
            "msgtype": "markdown",
            "markdown": {
                "title": title,
                "text": text,
            },
        }

        if is_urgent:
            payload["msgtype"] = "actionCard"
            payload["actionCard"] = {
                "title": f"🚨 {title}",
                "text": text,
                "btnOrientation": "1",
                "btns": [
                    {
                        "title": "立即处理",
                        "actionURL": "",
                    }
                ],
            }

        try:
            resp = req.post(url, json=payload, timeout=10)
            result = resp.json()
            if result.get("errcode") == 0:
                logger.info(f"DingTalk notification sent: {title}")
            else:
                logger.error(f"DingTalk send failed: {result}")
        except Exception as e:
            logger.error(f"DingTalk send error: {e}")

    def send_email(
        self,
        subject: str,
        body: str,
        receivers: Optional[list] = None,
        html: bool = False,
    ):
        if not self._email_cfg.get("smtp_host"):
            logger.warning("Email SMTP not configured")
            return

        receivers = receivers or self._email_cfg.get("receivers", [])
        if not receivers:
            logger.warning("No email receivers configured")
            return

        sender = self._email_cfg.get("sender", "")
        password = self._email_cfg.get("password", "")

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = sender
        msg["To"] = ", ".join(receivers)

        if html:
            msg.attach(MIMEText(body, "html", "utf-8"))
        else:
            msg.attach(MIMEText(body, "plain", "utf-8"))

        try:
            import smtplib

            smtp_host = self._email_cfg["smtp_host"]
            smtp_port = self._email_cfg.get("smtp_port", 465)
            with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
                server.login(sender, password)
                server.sendmail(sender, receivers, msg.as_string())
            logger.info(f"Email sent: {subject}")
        except Exception as e:
            logger.error(f"Email send error: {e}")

    def send_urgent_alert(self, item: dict):
        item_key = f"{item.get('channel_code')}:{item.get('title', '')[:100]}"
        now = time.time()

        if item_key in self._urgent_sent_tracker:
            last_sent = self._urgent_sent_tracker[item_key]
            if now - last_sent < self._urgent_deadline_seconds:
                logger.info(f"Urgent alert for '{item.get('title', '')[:50]}' already sent within 5 minutes, skipping")
                return

        self._urgent_sent_tracker[item_key] = now

        cutoff = now - 86400
        self._urgent_sent_tracker = {
            k: v for k, v in self._urgent_sent_tracker.items() if v > cutoff
        }

        title = f"紧急风险预警 - {item.get('title', '未知事件')}"
        risk_keywords = [kw for kw in self._urgent_keywords if kw in item.get("content", "")]
        deadline_time = (datetime.now() + timedelta(seconds=self._urgent_deadline_seconds)).strftime("%H:%M:%S")
        text = (
            f"### 🚨 紧急风险预警\n\n"
            f"**事件标题：** {item.get('title', '未知')}\n\n"
            f"**风险等级：** 紧急\n\n"
            f"**投诉类别：** {item.get('category', '未知')}\n\n"
            f"**来源渠道：** {item.get('source_name', '未知')} ({item.get('channel_code', '')})\n\n"
            f"**涉事企业：** {', '.join(item.get('companies', [])) or '未知'}\n\n"
            f"**涉及产品：** {', '.join(item.get('products', [])) or '未知'}\n\n"
            f"**匹配关键词：** {', '.join(risk_keywords) or '无'}\n\n"
            f"**内容摘要：** {(item.get('content', '') or '')[:500]}\n\n"
            f"**采集时间：** {item.get('collected_at', '')}\n\n"
            f"**⏰ 响应截止：** {deadline_time}（5分钟内）\n\n"
            f"> 请相关工作人员务必在5分钟内响应处理！"
        )
        self.send_dingtalk(title, text, is_urgent=True)

    def send_warning_alert(self, item: dict):
        with self._warning_buffer_lock:
            self._warning_buffer.append(item)

        now = time.time()
        if now - self._last_warning_flush >= self._warning_aggregate_seconds:
            self._flush_warning_buffer()
        else:
            logger.info(
                f"Warning event buffered ({len(self._warning_buffer)} pending), "
                f"will flush in {self._warning_aggregate_seconds - (now - self._last_warning_flush):.0f}s"
            )

    def _flush_warning_buffer(self):
        with self._warning_buffer_lock:
            if not self._warning_buffer:
                return
            items = list(self._warning_buffer)
            self._warning_buffer.clear()
            self._last_warning_flush = time.time()

        count = len(items)
        title = f"风险预警汇总（{count}条）- {datetime.now().strftime('%H:%M')}"

        detail_lines = []
        for i, item in enumerate(items[:20], 1):
            detail_lines.append(
                f"{i}. [{item.get('category', '未知')}] {item.get('title', '未知')} "
                f"- {item.get('source_name', '')}"
            )

        detail_text = "\n".join(detail_lines)
        if count > 20:
            detail_text += f"\n... 及其他 {count - 20} 条"

        text = (
            f"### ⚠️ 风险预警汇总\n\n"
            f"**预警事件数：** {count}\n\n"
            f"**汇总周期：** 最近30分钟\n\n"
            f"**事件列表：**\n{detail_text}\n\n"
            f"> 请30分钟内关注处理。"
        )
        self.send_dingtalk(title, text, is_urgent=False)

        email_body = text.replace("###", "").replace("**", "").replace("\n\n", "\n")
        self.send_email(subject=title, body=email_body)

    def check_urgent_timeout(self):
        now = time.time()
        expired_keys = []
        for key, sent_time in self._urgent_sent_tracker.items():
            if now - sent_time > self._urgent_deadline_seconds:
                channel_code = key.split(":")[0]
                expired_keys.append(key)
                logger.warning(
                    f"URGENT TIMEOUT: Alert for {key} sent at {sent_time} "
                    f"has exceeded 5-minute response deadline!"
                )
                self.send_dingtalk(
                    title="⚠️ 紧急事件超时未响应",
                    text=(
                        f"### ⚠️ 紧急事件超时未响应\n\n"
                        f"**事件：** {key.split(':', 1)[1]}\n\n"
                        f"**渠道：** {channel_code}\n\n"
                        f"**已超过：** 5分钟响应时限\n\n"
                        f"> 请立即跟进处理！"
                    ),
                )

        for key in expired_keys:
            del self._urgent_sent_tracker[key]

    def send_daily_report(self, stats: dict):
        today = datetime.now().strftime("%Y-%m-%d")
        subject = f"消费投诉监测日报 - {today}"

        total = stats.get("total", 0)
        by_risk = stats.get("by_risk", {})
        by_channel = stats.get("by_channel", {})
        channel_rates = stats.get("channel_success_rates", {})
        memory = stats.get("memory", {})

        urgent = by_risk.get("urgent", 0)
        warning = by_risk.get("warning", 0)
        attention = by_risk.get("attention", 0)
        general = by_risk.get("general", 0)

        channel_rows = ""
        for code, count in sorted(by_channel.items(), key=lambda x: -x[1]):
            rate_info = channel_rates.get(code, {})
            rate = rate_info.get("success_rate", 0)
            channel_rows += (
                f"<tr><td>{code}</td><td>{count}</td>"
                f"<td>{rate:.1%}</td></tr>"
            )

        mem_rss = memory.get("current_rss_mb", 0)
        mem_peak = memory.get("peak_rss_mb", 0)
        mem_limit = self._settings.get("global.memory_limit_mb", 2048)

        html = f"""
        <html>
        <body>
        <h2>消费投诉监测日报 - {today}</h2>
        <h3>总体概况</h3>
        <table border="1" cellpadding="5" cellspacing="0">
            <tr><th>指标</th><th>数值</th></tr>
            <tr><td>今日采集总量</td><td>{total}</td></tr>
            <tr><td>紧急事件</td><td style="color:red">{urgent}</td></tr>
            <tr><td>预警事件</td><td style="color:orange">{warning}</td></tr>
            <tr><td>关注事件</td><td style="color:blue">{attention}</td></tr>
            <tr><td>一般事件</td><td>{general}</td></tr>
        </table>
        <h3>渠道采集量与成功率</h3>
        <table border="1" cellpadding="5" cellspacing="0">
            <tr><th>渠道</th><th>采集量</th><th>成功率</th></tr>
            {channel_rows or '<tr><td colspan="3">暂无数据</td></tr>'}
        </table>
        <h3>系统状态</h3>
        <table border="1" cellpadding="5" cellspacing="0">
            <tr><th>指标</th><th>数值</th></tr>
            <tr><td>当前内存</td><td>{mem_rss:.0f}MB / {mem_limit}MB</td></tr>
            <tr><td>峰值内存</td><td>{mem_peak:.0f}MB</td></tr>
        </table>
        </body>
        </html>
        """

        self.send_email(subject=subject, body=html, html=True)

        markdown_text = (
            f"### 📊 消费投诉监测日报 - {today}\n\n"
            f"- 今日采集总量：**{total}**\n"
            f"- 紧急事件：**{urgent}**\n"
            f"- 预警事件：**{warning}**\n"
            f"- 关注事件：**{attention}**\n"
            f"- 一般事件：**{general}**\n"
            f"- 当前内存：**{mem_rss:.0f}MB / {mem_limit}MB**"
        )
        self.send_dingtalk(subject, markdown_text, is_urgent=False)

    @property
    def warning_buffer_size(self) -> int:
        return len(self._warning_buffer)
