import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List
from app.config import get_settings

settings = get_settings()


class NotificationService:
    """
    通知服务：邮件 / 短信 / WebSocket
    用于异常预警、政策更新、审核结果等通知推送
    """

    def __init__(self):
        self.email_config = {
            "smtp_server": "smtp.example.com",
            "smtp_port": 587,
            "sender": "no-reply@crossborder.gov.cn",
            "password": "mock_password"
        }
        self.sms_config = {
            "provider": "aliyun",
            "access_key": "mock_key",
            "sign_name": "跨境电商综服中心"
        }
        self.websocket_connections: dict = {}

    async def send_email(
        self,
        to_emails: List[str],
        subject: str,
        content: str,
        html: bool = True
    ) -> bool:
        """
        发送邮件通知
        异常预警、政策更新、审核结果均通过邮件推送
        """
        try:
            msg = MIMEMultipart()
            msg["From"] = self.email_config["sender"]
            msg["To"] = ", ".join(to_emails)
            msg["Subject"] = subject

            body = MIMEText(content, "html" if html else "plain", "utf-8")
            msg.attach(body)

            await asyncio.sleep(0.1)
            print(f"[Email] 发送至 {to_emails}: {subject}")
            return True
        except Exception as e:
            print(f"邮件发送失败: {e}")
            return False

    async def send_sms(
        self,
        phone_numbers: List[str],
        template_code: str,
        template_params: dict
    ) -> bool:
        """
        发送短信通知
        紧急异常使用短信提醒
        """
        try:
            await asyncio.sleep(0.08)
            print(f"[SMS] 发送至 {phone_numbers}, 模板: {template_code}, 参数: {template_params}")
            return True
        except Exception as e:
            print(f"短信发送失败: {e}")
            return False

    async def notify_exception(
        self,
        declare_no: str,
        exception_type: str,
        description: str,
        user_email: Optional[str] = None,
        user_phone: Optional[str] = None
    ) -> dict:
        """通关异常通知（邮件 + 短信）"""
        results = {"email": False, "sms": False}

        subject = f"【通关异常提醒】申报单 {declare_no} {exception_type}"
        email_content = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #ff4d4f;">通关异常预警</h2>
            <p>尊敬的申报员，您好：</p>
            <p>您的申报单 <strong>{declare_no}</strong> 在海关通关过程中出现异常：</p>
            <div style="background: #fff1f0; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p><strong>异常类型：</strong>{exception_type}</p>
                <p><strong>异常描述：</strong>{description}</p>
            </div>
            <p>请您尽快登录系统查看详情并处理，以免影响通关进度。</p>
            <p style="color: #909399; font-size: 12px; margin-top: 30px;">
                此邮件由系统自动发送，请勿直接回复。
            </p>
        </div>
        """

        if user_email:
            results["email"] = await self.send_email([user_email], subject, email_content)

        if user_phone:
            results["sms"] = await self.send_sms(
                [user_phone],
                "EXCEPTION_ALERT",
                {"declare_no": declare_no, "exception_type": exception_type}
            )

        return results

    async def notify_policy_update(
        self,
        policy_title: str,
        category: str,
        user_emails: List[str]
    ) -> dict:
        """政策更新通知"""
        category_names = {"tax": "出口退税", "customs": "海关监管", "foreign_exchange": "外汇管理"}
        cat_name = category_names.get(category, category)

        subject = f"【政策更新提醒】{cat_name} - {policy_title}"
        content = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #1e6fff;">政策更新通知</h2>
            <p>您好：</p>
            <p>您订阅的 <strong>{cat_name}</strong> 分类有新政策发布：</p>
            <div style="background: #e6f4ff; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p><strong>政策标题：</strong>{policy_title}</p>
            </div>
            <p>请登录政策法规库查看全文。</p>
            <p style="color: #909399; font-size: 12px; margin-top: 30px;">
                此邮件由系统自动发送，可在系统设置中取消订阅。
            </p>
        </div>
        """

        success = await self.send_email(user_emails, subject, content)
        return {"email": success, "recipients": len(user_emails)}

    async def notify_review_result(
        self,
        declare_no: str,
        approved: bool,
        comment: Optional[str],
        user_email: Optional[str] = None
    ) -> dict:
        """审核结果通知"""
        status_text = "审核通过" if approved else "审核驳回"
        color = "#52c41a" if approved else "#ff4d4f"

        subject = f"【审核通知】申报单 {declare_no} {status_text}"
        content = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: {color};">申报单{status_text}</h2>
            <p>申报单 <strong>{declare_no}</strong> 已完成审核：</p>
            <div style="background: {'#f6ffed' if approved else '#fff1f0'}; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p><strong>审核结果：</strong><span style="color: {color};">{status_text}</span></p>
                {f'<p><strong>审核意见：</strong>{comment}</p>' if comment else ''}
            </div>
            <p>请登录系统查看详细信息。</p>
        </div>
        """

        success = False
        if user_email:
            success = await self.send_email([user_email], subject, content)

        return {"email": success, "status": status_text}

    async def push_via_websocket(self, user_id: str, message_type: str, data: dict) -> bool:
        """通过 WebSocket 实时推送消息"""
        if user_id in self.websocket_connections:
            try:
                await self.websocket_connections[user_id].send_json({
                    "type": message_type,
                    "data": data,
                    "timestamp": None
                })
                return True
            except Exception:
                del self.websocket_connections[user_id]
        return False

    def register_websocket(self, user_id: str, websocket) -> None:
        self.websocket_connections[user_id] = websocket

    def unregister_websocket(self, user_id: str) -> None:
        if user_id in self.websocket_connections:
            del self.websocket_connections[user_id]


notification_service = NotificationService()
