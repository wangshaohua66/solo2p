from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime, timezone, timedelta

from api.database import get_db
from api.models.risk import RiskAlert, RiskRule, User
from api.schemas.request import RiskRuleUpdateRequest
from api.schemas.response import RiskAlertResponse, RiskRuleResponse, UserRiskResponse
from api.services.risk_service import risk_service
from api.services.scheduler_service import scheduler_service
from api.services.ws_notifier import ws_notifier

router = APIRouter(prefix="/risk", tags=["risk"])


@router.get("/alerts", response_model=list[RiskAlertResponse])
async def list_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    query = select(RiskAlert).order_by(RiskAlert.created_at.desc())
    if status:
        query = query.where(RiskAlert.status == status)
    if severity:
        query = query.where(RiskAlert.severity == severity)
    query = query.limit(limit)

    result = await db.execute(query)
    alerts = result.scalars().all()
    return [RiskAlertResponse.model_validate(a) for a in alerts]


@router.put("/alerts/{alert_id}/resolve", response_model=RiskAlertResponse)
async def resolve_alert(
    alert_id: int,
    resolver_id: int = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RiskAlert).where(RiskAlert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = "resolved"
    alert.resolved_by = resolver_id
    alert.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(alert)
    return RiskAlertResponse.model_validate(alert)


@router.post("/freeze/{user_id}", response_model=UserRiskResponse)
async def freeze_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await risk_service.freeze_account(db, user_id)
        return UserRiskResponse.model_validate(user)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/unfreeze/{user_id}", response_model=UserRiskResponse)
async def unfreeze_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await risk_service.unfreeze_account(db, user_id)
        return UserRiskResponse.model_validate(user)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/rules", response_model=list[RiskRuleResponse])
async def list_risk_rules(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RiskRule).order_by(RiskRule.created_at.desc()))
    rules = result.scalars().all()
    return [RiskRuleResponse.model_validate(r) for r in rules]


@router.put("/rules/{rule_id}", response_model=RiskRuleResponse)
async def update_risk_rule(
    rule_id: int,
    req: RiskRuleUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RiskRule).where(RiskRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Risk rule not found")

    if req.name is not None:
        rule.name = req.name
    if req.threshold is not None:
        rule.threshold = req.threshold
    if req.description is not None:
        rule.description = req.description
    if req.enabled is not None:
        rule.enabled = 1 if req.enabled else 0

    rule.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(rule)
    return RiskRuleResponse.model_validate(rule)


@router.get("/alerts/recent")
async def get_recent_alerts(
    minutes: int = Query(30, ge=1, le=1440),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    result = await db.execute(
        select(RiskAlert)
        .where(RiskAlert.created_at >= since)
        .order_by(RiskAlert.created_at.desc())
    )
    alerts = result.scalars().all()
    return {
        "minutes": minutes,
        "count": len(alerts),
        "items": [RiskAlertResponse.model_validate(a) for a in alerts],
    }


@router.get("/status")
async def get_risk_status(
    db: AsyncSession = Depends(get_db),
):
    status = scheduler_service.get_status()

    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    summary_result = await db.execute(
        select(
            RiskAlert.severity,
            func.count(RiskAlert.id),
        )
        .where(RiskAlert.created_at >= since_24h)
        .group_by(RiskAlert.severity)
    )
    severity_summary = {row[0]: row[1] for row in summary_result.all()}

    alerts_24h_result = await db.execute(
        select(func.count(RiskAlert.id)).where(RiskAlert.created_at >= since_24h)
    )
    alerts_24h_count = int(alerts_24h_result.scalar() or 0)

    return {
        "scheduler_running": status["scheduler_running"],
        "last_scan_time": status["last_scan_time"],
        "alerts_last_24h_count": alerts_24h_count,
        "severity_summary_24h": severity_summary,
        "ws_connected_admins": ws_notifier.connection_count,
    }


@router.websocket("/ws/risk")
async def websocket_risk(websocket: WebSocket, user_id: int = Query(..., description="User ID for role verification")):
    connected = await ws_notifier.connect(websocket, user_id)
    if not connected:
        return

    try:
        while True:
            data = await websocket.receive_text()
            _ = data
    except WebSocketDisconnect:
        ws_notifier.disconnect(user_id)
    except Exception:
        ws_notifier.disconnect(user_id)
        try:
            await websocket.close()
        except Exception:
            pass
