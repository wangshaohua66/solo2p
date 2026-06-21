import hashlib
import json
import smtplib
import uuid
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

import requests

from config import AppConfig, load_config
from logger import get_logger
from database import DatabaseManager


logger = get_logger("notifier")


class Notifier:
    def __init__(self, config: Optional[AppConfig] = None):
        self.config = config or load_config()
        self.db = DatabaseManager()
        self._wechat_token: Optional[str] = None
        self._wechat_token_expire: float = 0

    def _log_notification(self, ntype: str, recipient: str, title: str,
                          content: str, status: str = "pending") -> str:
        nid = hashlib.md5(f"{ntype}|{recipient}|{title}|{datetime.now().isoformat()}".encode()).hexdigest()
        try:
            self.db.add_notification({
                "notification_id": nid,
                "type": ntype,
                "recipient": recipient,
                "title": title,
                "content": content,
                "status": status,
                "create_time": datetime.now().isoformat(),
                "send_time": datetime.now().isoformat() if status != "pending" else None,
            })
        except Exception as e:
            logger.error(f"记录通知日志失败: {e}")
        return nid

    def send_email(self, to_addrs: List[str], subject: str, body: str,
                   subtype: str = "plain") -> bool:
        cfg = self.config.email
        if not (cfg.smtp_host and cfg.username and cfg.password and to_addrs):
            logger.warning("邮件配置不完整，跳过邮件发送")
            self._log_notification("email", ",".join(to_addrs), subject, body, "skipped")
            return False

        try:
            msg = MIMEMultipart()
            msg["From"] = cfg.from_addr or cfg.username
            msg["To"] = ", ".join(to_addrs)
            msg["Subject"] = subject
            msg.attach(MIMEText(body, subtype, "utf-8"))

            if cfg.use_ssl:
                server = smtplib.SMTP_SSL(cfg.smtp_host, cfg.smtp_port, timeout=30)
            else:
                server = smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=30)
                server.starttls()

            server.login(cfg.username, cfg.password)
            server.sendmail(msg["From"], to_addrs, msg.as_string())
            server.quit()

            self._log_notification("email", ",".join(to_addrs), subject, body, "sent")
            logger.info(f"邮件已发送: {subject} -> {to_addrs}")
            return True
        except Exception as e:
            logger.error(f"邮件发送失败: {e}")
            self._log_notification("email", ",".join(to_addrs), subject, body, "failed")
            return False

    def _get_wechat_token(self) -> Optional[str]:
        cfg = self.config.wechat
        if not (cfg.app_id and cfg.app_secret):
            return None
        import time
        if self._wechat_token and time.time() < self._wechat_token_expire:
            return self._wechat_token
        try:
            url = (f"https://api.weixin.qq.com/cgi-bin/token"
                   f"?grant_type=client_credential&appid={cfg.app_id}&secret={cfg.app_secret}")
            r = requests.get(url, timeout=10)
            data = r.json()
            if "access_token" in data:
                self._wechat_token = data["access_token"]
                self._wechat_token_expire = time.time() + data.get("expires_in", 7200) - 60
                return self._wechat_token
        except Exception as e:
            logger.error(f"获取微信Token失败: {e}")
        return None

    def send_wechat_template(self, openids: List[str], template_id: str,
                             data: Dict[str, Any], url: str = "") -> bool:
        cfg = self.config.wechat
        token = self._get_wechat_token()
        if not token:
            logger.warning("微信Token获取失败，跳过消息推送")
            for oid in openids:
                self._log_notification("wechat", oid, template_id, json.dumps(data), "skipped")
            return False

        template_id = template_id or cfg.template_id
        success = 0
        for openid in openids:
            try:
                payload = {
                    "touser": openid,
                    "template_id": template_id,
                    "url": url,
                    "data": {k: {"value": str(v)} for k, v in data.items()},
                }
                r = requests.post(
                    f"https://api.weixin.qq.com/cgi-bin/message/template/send?access_token={token}",
                    json=payload,
                    timeout=10,
                )
                resp = r.json()
                if resp.get("errcode") == 0:
                    success += 1
                    self._log_notification("wechat", openid, template_id, json.dumps(data), "sent")
                else:
                    logger.warning(f"微信推送失败 {openid}: {resp}")
                    self._log_notification("wechat", openid, template_id, json.dumps(data), "failed")
            except Exception as e:
                logger.error(f"微信推送异常: {e}")
                self._log_notification("wechat", openid, template_id, json.dumps(data), "failed")
        logger.info(f"微信推送完成: {success}/{len(openids)}")
        return success > 0

    def send_alert(self, subject: str, body: str) -> bool:
        cfg = self.config.email
        to = cfg.to_addrs
        ok = False
        if to:
            ok = self.send_email(to, f"[告警] {subject}", body)
        wechat_cfg = self.config.wechat
        if wechat_cfg.user_openids and wechat_cfg.template_id:
            self.send_wechat_template(
                wechat_cfg.user_openids,
                wechat_cfg.template_id,
                {"first": f"告警: {subject}", "keyword1": subject, "keyword2": body[:100], "remark": ""},
            )
            ok = True
        return ok

    def notify_student(self, student_id: str, title: str, content: str) -> bool:
        rows = self.db.query_all("SELECT email, phone FROM students WHERE student_id=?", (student_id,))
        if not rows:
            logger.debug(f"未找到学生信息: {student_id}")
            return False
        row = rows[0]
        ok = False
        if row["email"]:
            ok = self.send_email([row["email"]], title, content) or ok
        return ok

    def notify_job_match(self, student_id: str, fair_title: str,
                         matched_count: int) -> bool:
        title = f"招聘会匹配通知: {fair_title}"
        content = (
            f"您好！\n\n"
            f"招聘会「{fair_title}」已有 {matched_count} 个岗位与您的求职意向匹配，"
            f"请及时登录系统查看详情并投递简历。\n\n"
            f"——省级人才交流中心"
        )
        return self.notify_student(student_id, title, content)
