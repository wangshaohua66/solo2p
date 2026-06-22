import logging
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select

from api.database import async_session
from api.models.risk import User, RiskAlert, RiskNotification

logger = logging.getLogger(__name__)

ALLOWED_ROLES = {"admin", "senior_reviewer"}


class WebSocketNotifier:
    def __init__(self) -> None:
        self._active_connections: dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int) -> bool:
        async with async_session() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()

        if not user:
            logger.warning(f"WS connection rejected: user {user_id} not found")
            await websocket.close(code=1008, reason="User not found")
            return False

        if user.role not in ALLOWED_ROLES:
            logger.warning(f"WS connection rejected: user {user_id} has role {user.role}, not allowed")
            await websocket.close(code=1008, reason="Permission denied")
            return False

        await websocket.accept()
        self._active_connections[user_id] = websocket
        logger.info(f"Admin WS connected: user_id={user_id}, role={user.role}, total={len(self._active_connections)}")
        return True

    def disconnect(self, user_id: int) -> None:
        if user_id in self._active_connections:
            del self._active_connections[user_id]
            logger.info(f"Admin WS disconnected: user_id={user_id}, total={len(self._active_connections)}")

    async def broadcast_alert(self, alert: RiskAlert) -> None:
        if not self._active_connections:
            return

        payload = {
            "type": "risk_alert",
            "alert": {
                "id": alert.id,
                "user_id": alert.user_id,
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "description": alert.description,
                "status": alert.status,
                "resolved_by": alert.resolved_by,
                "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
                "created_at": alert.created_at.isoformat() if alert.created_at else None,
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        message = json.dumps(payload, ensure_ascii=False)

        disconnected: list[int] = []
        for user_id, ws in list(self._active_connections.items()):
            try:
                await ws.send_text(message)
            except Exception as e:
                logger.error(f"Failed to send WS alert to user {user_id}: {e}")
                disconnected.append(user_id)

        for user_id in disconnected:
            self.disconnect(user_id)

    async def save_notification_record(self, alert: RiskAlert) -> None:
        recipient_list = ",".join(str(uid) for uid in self._active_connections.keys())
        if not recipient_list:
            return
        try:
            async with async_session() as db:
                content = json.dumps({
                    "alert_id": alert.id,
                    "broadcast_to": list(self._active_connections.keys()),
                }, ensure_ascii=False)
                notification = RiskNotification(
                    alert_id=alert.id,
                    channel="websocket",
                    recipient=recipient_list,
                    content=content,
                    sent_at=datetime.now(timezone.utc),
                    status="sent",
                )
                db.add(notification)
                await db.commit()
        except Exception as e:
            logger.error(f"Failed to save WS notification record: {e}", exc_info=True)

    @property
    def connection_count(self) -> int:
        return len(self._active_connections)


ws_notifier = WebSocketNotifier()


async def ws_notifier_handler(alert: RiskAlert) -> None:
    await ws_notifier.broadcast_alert(alert)
    await ws_notifier.save_notification_record(alert)
