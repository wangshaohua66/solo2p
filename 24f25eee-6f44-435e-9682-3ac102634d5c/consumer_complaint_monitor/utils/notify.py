import time
import hmac
import hashlib
import base64
import urllib.parse
from typing import Optional
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import requests as req
from loguru import logger

from config.settings import Settings


class Notifier:
    def __init__(self, settings: Optional[Settings] = None):
        self._settings = settings or Settings()
        self._dingtalk_cfg = self._settings.get_notify_config().get("dingtalk", {})
        self._email_cfg = self._settings.get_notify_config().get("email", {})
        self._urgent_keywords = self._dingtalk_cfg.get("urgent_keywords", [])

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
        title = f"紧急风险预警 - {item.get('title', '未知事件')}"
        risk_keywords = [kw for kw in self._urgent_keywords if kw in item.get("content", "")]
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
            f"> 请相关工作人员5分钟内响应处理！"
        )
        self.send_dingtalk(title, text, is_urgent=True)

    def send_warning_alert(self, item: dict):
        title = f"风险预警 - {item.get('title', '未知事件')}"
        text = (
            f"### ⚠️ 风险预警\n\n"
            f"**事件标题：** {item.get('title', '未知')}\n\n"
            f"**风险等级：** 预警\n\n"
            f"**投诉类别：** {item.get('category', '未知')}\n\n"
            f"**来源渠道：** {item.get('source_name', '未知')} ({item.get('channel_code', '')})\n\n"
            f"**涉事企业：** {', '.join(item.get('companies', [])) or '未知'}\n\n"
            f"**内容摘要：** {(item.get('content', '') or '')[:500]}\n\n"
            f"> 请30分钟内关注处理。"
        )
        self.send_dingtalk(title, text, is_urgent=False)
        email_body = text.replace("###", "").replace("**", "").replace("\n\n", "\n")
        self.send_email(
            subject=title,
            body=email_body,
        )

    def send_daily_report(self, stats: dict):
        today = datetime.now().strftime("%Y-%m-%d")
        subject = f"消费投诉监测日报 - {today}"

        total = stats.get("total", 0)
        by_risk = stats.get("by_risk", {})
        by_channel = stats.get("by_channel", {})

        urgent = by_risk.get("urgent", 0)
        warning = by_risk.get("warning", 0)
        attention = by_risk.get("attention", 0)
        general = by_risk.get("general", 0)

        channel_rows = ""
        for code, count in sorted(by_channel.items(), key=lambda x: -x[1]):
            channel_rows += f"<tr><td>{code}</td><td>{count}</td></tr>"

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
        <h3>渠道采集量</h3>
        <table border="1" cellpadding="5" cellspacing="0">
            <tr><th>渠道</th><th>采集量</th></tr>
            {channel_rows or '<tr><td colspan="2">暂无数据</td></tr>'}
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
            f"- 一般事件：**{general}**"
        )
        self.send_dingtalk(subject, markdown_text, is_urgent=False)
