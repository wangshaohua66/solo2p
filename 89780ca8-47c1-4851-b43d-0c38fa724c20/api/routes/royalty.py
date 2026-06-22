from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import io

from api.database import get_db
from api.models.royalty import RoyaltySettlement
from api.schemas.request import RoyaltySettleRequest
from api.schemas.response import RoyaltySettlementResponse, CreatorEarningsResponse
from api.services.royalty_service import royalty_service

router = APIRouter(prefix="/royalty", tags=["royalty"])


@router.get("/earnings/{creator_id}", response_model=CreatorEarningsResponse)
async def get_creator_earnings(
    creator_id: int,
    db: AsyncSession = Depends(get_db),
):
    data = await royalty_service.get_creator_earnings(db, creator_id)
    return CreatorEarningsResponse(
        creator_id=data["creator_id"],
        total_earnings=data["total_earnings"],
        pending_amount=data["pending_amount"],
        settled_amount=data["settled_amount"],
        settlements=[RoyaltySettlementResponse.model_validate(s) for s in data["settlements"]],
    )


@router.post("/settle", response_model=list[RoyaltySettlementResponse])
async def settle_royalties(
    req: RoyaltySettleRequest,
    db: AsyncSession = Depends(get_db),
):
    settlements = await royalty_service.settle_royalties(db, req.trade_ids)
    return [RoyaltySettlementResponse.model_validate(s) for s in settlements]


@router.get("/report")
async def export_royalty_report(
    creator_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    csv_data = await royalty_service.export_settlement_report(db, creator_id)
    return StreamingResponse(
        io.StringIO(csv_data),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=royalty_report.csv"},
    )


@router.get("/settlements", response_model=list[RoyaltySettlementResponse])
async def list_settlements(
    creator_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    query = select(RoyaltySettlement).order_by(RoyaltySettlement.created_at.desc())
    if creator_id:
        query = query.where(RoyaltySettlement.creator_id == creator_id)
    if status:
        query = query.where(RoyaltySettlement.status == status)
    query = query.limit(limit)

    result = await db.execute(query)
    settlements = result.scalars().all()
    return [RoyaltySettlementResponse.model_validate(s) for s in settlements]
