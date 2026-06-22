import csv
import io
import uuid
from typing import Optional
from datetime import datetime, timezone
from collections import defaultdict
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from api.models.royalty import RoyaltySettlement, PayoutTransaction
from api.models.order import Trade
from api.models.collection import Collection, Creator


PAYOUT_THRESHOLD = 100.0


class RoyaltyService:
    async def calculate_royalty(
        self,
        trade_price: float,
        royalty_rate: float,
    ) -> float:
        return round(trade_price * royalty_rate, 6)

    async def _generate_tx_hash(self) -> str:
        return "0x" + uuid.uuid4().hex

    async def _generate_batch_id(self) -> str:
        return "BATCH-" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S") + "-" + uuid.uuid4().hex[:8].upper()

    async def _get_creator_wallet(self, db: AsyncSession, creator_id: int) -> str:
        result = await db.execute(select(Creator).where(Creator.id == creator_id))
        creator = result.scalar_one_or_none()
        return creator.wallet_address if creator else ""

    async def _get_creator_pending_total(self, db: AsyncSession, creator_id: int) -> float:
        result = await db.execute(
            select(func.coalesce(func.sum(RoyaltySettlement.royalty_amount), 0))
            .where(
                RoyaltySettlement.creator_id == creator_id,
                RoyaltySettlement.status == "pending",
            )
        )
        return float(result.scalar())

    async def _settle_creator_pending(
        self,
        db: AsyncSession,
        creator_id: int,
        batch_id: str,
    ) -> Optional[PayoutTransaction]:
        pending_result = await db.execute(
            select(RoyaltySettlement)
            .where(
                RoyaltySettlement.creator_id == creator_id,
                RoyaltySettlement.status == "pending",
            )
        )
        pending_settlements = pending_result.scalars().all()
        if not pending_settlements:
            return None

        total_amount = sum(s.royalty_amount for s in pending_settlements)
        if total_amount < PAYOUT_THRESHOLD:
            return None

        wallet_address = await self._get_creator_wallet(db, creator_id)
        tx_hash = await self._generate_tx_hash()
        now = datetime.now(timezone.utc)

        tx = PayoutTransaction(
            batch_id=batch_id,
            creator_id=creator_id,
            wallet_address=wallet_address,
            total_amount=round(total_amount, 6),
            tx_hash=tx_hash,
            status="success",
            processed_count=len(pending_settlements),
            created_at=now,
            completed_at=now,
        )
        db.add(tx)

        for s in pending_settlements:
            s.status = "settled"
            s.settled_at = now
            s.payout_tx_hash = tx_hash
            s.wallet_address = wallet_address
            s.payout_batch_id = batch_id

        return tx

    async def process_and_auto_settle(
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
                status="pending",
            )
            db.add(settlement)
            settlements.append(settlement)

        await db.flush()

        creator_ids = list({s.creator_id for s in settlements})
        batch_id = await self._generate_batch_id()
        for creator_id in creator_ids:
            pending_total = await self._get_creator_pending_total(db, creator_id)
            if pending_total >= PAYOUT_THRESHOLD:
                await self._settle_creator_pending(db, creator_id, batch_id)

        await db.commit()
        for s in settlements:
            await db.refresh(s)
        return settlements

    async def batch_payout(
        self,
        db: AsyncSession,
        settlement_ids: list[int],
        batch_id: Optional[str] = None,
    ) -> dict:
        settlements_result = await db.execute(
            select(RoyaltySettlement)
            .where(
                RoyaltySettlement.id.in_(settlement_ids),
                RoyaltySettlement.status == "pending",
            )
        )
        settlements = settlements_result.scalars().all()
        if not settlements:
            return {
                "batch_id": batch_id or "",
                "total_count": 0,
                "total_amount": 0.0,
                "transactions": [],
            }

        if not batch_id:
            batch_id = await self._generate_batch_id()

        grouped = defaultdict(list)
        for s in settlements:
            grouped[s.creator_id].append(s)

        transactions = []
        total_amount = 0.0
        now = datetime.now(timezone.utc)

        for creator_id, creator_settlements in grouped.items():
            creator_total = sum(s.royalty_amount for s in creator_settlements)
            wallet_address = await self._get_creator_wallet(db, creator_id)
            tx_hash = await self._generate_tx_hash()

            tx = PayoutTransaction(
                batch_id=batch_id,
                creator_id=creator_id,
                wallet_address=wallet_address,
                total_amount=round(creator_total, 6),
                tx_hash=tx_hash,
                status="success",
                processed_count=len(creator_settlements),
                created_at=now,
                completed_at=now,
            )
            db.add(tx)
            transactions.append(tx)
            total_amount += creator_total

            for s in creator_settlements:
                s.status = "settled"
                s.settled_at = now
                s.payout_tx_hash = tx_hash
                s.wallet_address = wallet_address
                s.payout_batch_id = batch_id

        await db.commit()
        for tx in transactions:
            await db.refresh(tx)

        return {
            "batch_id": batch_id,
            "total_count": len(settlements),
            "total_amount": round(total_amount, 6),
            "transactions": transactions,
        }

    async def auto_settle_all(
        self,
        db: AsyncSession,
    ) -> dict:
        pending_result = await db.execute(
            select(
                RoyaltySettlement.creator_id,
                func.sum(RoyaltySettlement.royalty_amount).label("total"),
                func.count(RoyaltySettlement.id).label("count"),
            )
            .where(RoyaltySettlement.status == "pending")
            .group_by(RoyaltySettlement.creator_id)
        )
        rows = pending_result.all()

        eligible_creators = [
            (row.creator_id, float(row.total), row.count)
            for row in rows
            if float(row.total) >= PAYOUT_THRESHOLD
        ]
        if not eligible_creators:
            return {
                "batch_id": "",
                "settled_creators": 0,
                "settled_count": 0,
                "total_amount": 0.0,
                "transactions": [],
            }

        batch_id = await self._generate_batch_id()
        transactions = []
        total_amount = 0.0
        settled_count = 0

        for creator_id, creator_total, count in eligible_creators:
            tx = await self._settle_creator_pending(db, creator_id, batch_id)
            if tx:
                transactions.append(tx)
                total_amount += creator_total
                settled_count += count

        await db.commit()
        for tx in transactions:
            await db.refresh(tx)

        return {
            "batch_id": batch_id,
            "settled_creators": len(transactions),
            "settled_count": settled_count,
            "total_amount": round(total_amount, 6),
            "transactions": transactions,
        }

    async def get_payouts(
        self,
        db: AsyncSession,
        batch_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[PayoutTransaction]:
        query = select(PayoutTransaction).order_by(PayoutTransaction.created_at.desc())
        if batch_id:
            query = query.where(PayoutTransaction.batch_id == batch_id)
        query = query.limit(limit)

        result = await db.execute(query)
        return result.scalars().all()

    async def get_payout_batch_detail(
        self,
        db: AsyncSession,
        batch_id: str,
    ) -> dict:
        tx_result = await db.execute(
            select(PayoutTransaction).where(PayoutTransaction.batch_id == batch_id)
        )
        transactions = tx_result.scalars().all()

        settlements_result = await db.execute(
            select(RoyaltySettlement).where(RoyaltySettlement.payout_batch_id == batch_id)
        )
        settlements = settlements_result.scalars().all()

        return {
            "batch_id": batch_id,
            "transactions": transactions,
            "settlements": settlements,
        }

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
            "status", "settled_at", "payout_tx_hash", "wallet_address",
            "payout_batch_id", "created_at",
        ])
        for s in settlements:
            writer.writerow([
                s.id, s.trade_id, s.creator_id, s.collection_id,
                s.trade_price, s.royalty_rate, s.royalty_amount,
                s.status,
                s.settled_at.isoformat() if s.settled_at else "",
                s.payout_tx_hash, s.wallet_address, s.payout_batch_id,
                s.created_at.isoformat() if s.created_at else "",
            ])
        return output.getvalue()


royalty_service = RoyaltyService()
