import logging
import json
from typing import Optional
from datetime import datetime, timezone

from api.database import async_session
from api.models.risk import RiskAlert, RiskNotification

logger = logging.getLogger(__name__)

DEFAULT_ADMIN_EMAILS = ["admin@platform.com", "ops@platform.com"]


class MockMailer:
    async def send_alert_notification(
        self,
        alert: RiskAlert,
        admin_emails: Optional[list[str]] = None,
    ) -> None:
        if admin_emails is None:
            admin_emails = DEFAULT_ADMIN_EMAILS

        content = json.dumps({
            "alert_id": alert.id,
            "user_id": alert.user_id,
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "description": alert.description,
            "status": alert.status,
            "created_at": alert.created_at.isoformat() if alert.created_at else None,
        }, ensure_ascii=False)

        for email in admin_emails:
            logger.info(
                f"[MockMailer] Sending risk alert notification to {email}: "
                f"alert_id={alert.id}, type={alert.alert_type}, severity={alert.severity}"
            )
            try:
                async with async_session() as db:
                    notification = RiskNotification(
                        alert_id=alert.id,
                        channel="email",
                        recipient=email,
                        content=content,
                        sent_at=datetime.now(timezone.utc),
                        status="sent",
                    )
                    db.add(notification)
                    await db.commit()
            except Exception as e:
                logger.error(f"Failed to save email notification for {email}: {e}", exc_info=True)


mock_mailer = MockMailer()


async def mailer_handler(alert: RiskAlert) -> None:
    await mock_mailer.send_alert_notification(alert)
