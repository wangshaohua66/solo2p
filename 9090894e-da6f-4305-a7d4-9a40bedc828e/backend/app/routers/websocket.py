import asyncio
import json
from typing import Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from datetime import datetime

from app.services.notification_service import notification_service
from app.services.customs_service import CustomsApiService
from app.database import get_db
from sqlalchemy.orm import Session

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        notification_service.register_websocket(user_id, websocket)

    def disconnect(self, user_id: str):
        self.active_connections.pop(user_id, None)
        notification_service.unregister_websocket(user_id)

    async def send_personal_message(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            await connection.send_json(message)


manager = ConnectionManager()


@router.websocket("/ws/notifications")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    WebSocket 通知推送接口
    推送类型：
    - exception_alert: 通关异常预警
    - review_result: 审核结果
    - policy_update: 政策更新
    - customs_status: 通关状态变更
    """
    await manager.connect(user_id, websocket)

    try:
        await websocket.send_json({
            "type": "connected",
            "data": {"user_id": user_id, "timestamp": datetime.utcnow().isoformat()},
            "message": "连接成功"
        })

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type")

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong", "timestamp": datetime.utcnow().isoformat()})

                elif msg_type == "sync_status":
                    declare_nos = msg.get("declare_nos", [])
                    service = CustomsApiService(db)
                    result = await service.sync_batch_status(declare_nos)

                    await websocket.send_json({
                        "type": "sync_result",
                        "data": result.get("data"),
                        "timestamp": datetime.utcnow().isoformat()
                    })

                elif msg_type == "subscribe":
                    topics = msg.get("topics", [])
                    await websocket.send_json({
                        "type": "subscribed",
                        "data": {"topics": topics},
                        "message": f"已订阅 {len(topics)} 个主题"
                    })

            except json.JSONDecodeError:
                continue

    except WebSocketDisconnect:
        manager.disconnect(user_id)

    except Exception as e:
        manager.disconnect(user_id)
        print(f"WebSocket error for user {user_id}: {e}")


async def periodic_status_sync():
    """
    定时轮询任务（每5分钟）
    同步所有处理中申报单的海关状态
    """
    while True:
        try:
            from app.database import SessionLocal
            from app.models.declaration import Declaration, DeclarationStatus

            db = SessionLocal()
            try:
                processing_decls = db.query(Declaration).filter(
                    Declaration.status.in_([
                        DeclarationStatus.APPROVED,
                        DeclarationStatus.CUSTOMS_PROCESSING,
                        DeclarationStatus.CUSTOMS_PASSED
                    ])
                ).all()

                if processing_decls:
                    service = CustomsApiService(db)
                    declare_nos = [d.declare_no for d in processing_decls]
                    result = await service.sync_batch_status(declare_nos)

                    for item in (result.get("data") or []):
                        if item and item.get("status") == "customs_exception":
                            for user_id, ws in manager.active_connections.items():
                                await ws.send_json({
                                    "type": "exception_alert",
                                    "data": item,
                                    "timestamp": datetime.utcnow().isoformat()
                                })
            finally:
                db.close()
        except Exception as e:
            print(f"定时同步任务异常: {e}")

        await asyncio.sleep(300)
