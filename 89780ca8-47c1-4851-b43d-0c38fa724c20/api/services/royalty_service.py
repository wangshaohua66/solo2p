import csv
import io
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from api.models.royalty import RoyaltySettlement
from api.models.order import Trade
from api.models.collection import Collection


class RoyaltyService:
    async def calculate_royalty(
        self,
        trade_price: float,
        royalty_rate: float,
    ) -> float:
        return round(trade_price * royalty_rate, 6)

    async def settle_royalties(
        self,
        db: AsyncSession,
        trade_ids: list[int],
    ) -> list[RoyaltySettlement]:
        settlements = []
        for trade_id in trade_ids:
            result = await db.execute(select(Trade).where(Trade.id == trade_id))
            trade = result.scalar_one_or_none()
            if not trade:
                continue

            col_result = await db.execute(
                select(Collection).where(Collection.id == trade.collection_id)
            )
            collection = col_result.scalar_one_or_none()
            if not collection:
                continue

            royalty_amount = await self.calculate_royalty(
                trade.price * trade.quantity, collection.royalty_rate
            )

            settlement = RoyaltySettlement(
                trade_id=trade.id,
                creator_id=collection.creator_id,
                collection_id=collection.id,
                trade_price=trade.price * trade.quantity,
                royalty_rate=collection.royalty_rate,
                royalty_amount=royalty_amount,
                status="settled",
                settled_at=datetime.now(timezone.utc),
            )
            db.add(settlement)
            settlements.append(settlement)

        await db.commit()
        for s in settlements:
            await db.refresh(s)
        return settlements

    async def get_creator_earnings(
        self,
        db: AsyncSession,
        creator_id: int,
    ) -> dict:
        total_result = await db.execute(
            select(func.coalesce(func.sum(RoyaltySettlement.royalty_amount), 0))
            .where(RoyaltySettlement.creator_id == creator_id)
        )
        total_earnings = float(total_result.scalar())

        pending_result = await db.execute(
            select(func.coalesce(func.sum(RoyaltySettlement.royalty_amount), 0))
            .where(
                RoyaltySettlement.creator_id == creator_id,
                RoyaltySettlement.status == "pending",
            )
        )
        pending_amount = float(pending_result.scalar())

        settled_result = await db.execute(
            select(func.coalesce(func.sum(RoyaltySettlement.royalty_amount), 0))
            .where(
                RoyaltySettlement.creator_id == creator_id,
                RoyaltySettlement.status == "settled",
            )
        )
        settled_amount = float(settled_result.scalar())

        settlements_result = await db.execute(
            select(RoyaltySettlement)
            .where(RoyaltySettlement.creator_id == creator_id)
            .order_by(RoyaltySettlement.created_at.desc())
            .limit(50)
        )
        settlements = settlements_result.scalars().all()

        return {
            "creator_id": creator_id,
            "total_earnings": total_earnings,
            "pending_amount": pending_amount,
            "settled_amount": settled_amount,
            "settlements": settlements,
        }

    async def export_settlement_report(
        self,
        db: AsyncSession,
        creator_id: Optional[int] = None,
    ) -> str:
        query = select(RoyaltySettlement).order_by(RoyaltySettlement.created_at.desc())
        if creator_id:
            query = query.where(RoyaltySettlement.creator_id == creator_id)

        result = await db.execute(query)
        settlements = result.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "id", "trade_id", "creator_id", "collection_id",
            "trade_price", "royalty_rate", "royalty_amount",
            "status", "settled_at", "created_at",
        ])
        for s in settlements:
            writer.writerow([
                s.id, s.trade_id, s.creator_id, s.collection_id,
                s.trade_price, s.royalty_rate, s.royalty_amount,
                s.status,
                s.settled_at.isoformat() if s.settled_at else "",
                s.created_at.isoformat() if s.created_at else "",
            ])
        return output.getvalue()


royalty_service = RoyaltyService()
