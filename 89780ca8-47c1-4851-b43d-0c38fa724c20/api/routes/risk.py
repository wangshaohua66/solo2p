from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime, timezone

from api.database import get_db
from api.models.risk import RiskAlert, RiskRule, User
from api.schemas.request import RiskRuleUpdateRequest
from api.schemas.response import RiskAlertResponse, RiskRuleResponse, UserRiskResponse
from api.services.risk_service import risk_service

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
