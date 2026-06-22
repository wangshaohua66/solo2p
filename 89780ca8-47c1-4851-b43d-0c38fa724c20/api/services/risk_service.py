from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from api.models.risk import User, RiskAlert, RiskRule
from api.models.order import Order, Trade


class RiskService:
    async def detect_wash_trading(
        self,
        db: AsyncSession,
        user_id: int,
        window_days: int = 30,
        threshold: int = 5,
    ) -> Optional[RiskAlert]:
        since = datetime.now(timezone.utc) - timedelta(days=window_days)

        result = await db.execute(
            select(Trade)
            .where(
                Trade.created_at >= since,
                (Trade.buyer_id == user_id) | (Trade.seller_id == user_id),
            )
        )
        trades = result.scalars().all()

        counterparty_counts: dict[int, int] = {}
        for trade in trades:
            counterparty = trade.seller_id if trade.buyer_id == user_id else trade.buyer_id
            counterparty_counts[counterparty] = counterparty_counts.get(counterparty, 0) + 1

        max_repeat = max(counterparty_counts.values()) if counterparty_counts else 0
        suspicious_counterparties = [k for k, v in counterparty_counts.items() if v >= threshold]

        if suspicious_counterparties:
            alert = RiskAlert(
                user_id=user_id,
                alert_type="wash_trading",
                severity="high",
                description=f"Detected potential wash trading: {len(suspicious_counterparties)} counterparties with {threshold}+ repeated trades within {window_days} days. Max repeat: {max_repeat}",
                status="open",
            )
            db.add(alert)
            await db.commit()
            await db.refresh(alert)
            return alert
        return None

    async def detect_price_manipulation(
        self,
        db: AsyncSession,
        collection_id: int,
        window_hours: int = 24,
        price_change_threshold: float = 0.5,
    ) -> Optional[RiskAlert]:
        since = datetime.now(timezone.utc) - timedelta(hours=window_hours)

        result = await db.execute(
            select(Trade)
            .where(Trade.collection_id == collection_id, Trade.created_at >= since)
            .order_by(Trade.created_at.asc())
        )
        trades = result.scalars().all()

        if len(trades) < 2:
            return None

        first_price = trades[0].price
        last_price = trades[-1].price

        price_change = abs(last_price - first_price) / first_price if first_price > 0 else 0

        if price_change > price_change_threshold:
            col_result = await db.execute(
                select(Order).where(
                    Order.collection_id == collection_id,
                    Order.created_at >= since,
                )
            )
            orders = col_result.scalars().all()
            user_order_counts: dict[int, int] = {}
            for order in orders:
                user_order_counts[order.user_id] = user_order_counts.get(order.user_id, 0) + 1

            top_user = max(user_order_counts, key=user_order_counts.get) if user_order_counts else None

            alert = RiskAlert(
                user_id=top_user if top_user else 0,
                alert_type="price_manipulation",
                severity="medium",
                description=f"Price manipulation detected for collection {collection_id}: {price_change:.1%} change in {window_hours}h. Top trader: user {top_user}",
                status="open",
            )
            db.add(alert)
            await db.commit()
            await db.refresh(alert)
            return alert
        return None

    async def detect_volume_anomaly(
        self,
        db: AsyncSession,
        collection_id: int,
        window_hours: int = 1,
        volume_threshold: float = 10.0,
    ) -> Optional[RiskAlert]:
        since = datetime.now(timezone.utc) - timedelta(hours=window_hours)

        recent_result = await db.execute(
            select(func.coalesce(func.sum(Trade.quantity * Trade.price), 0))
            .where(Trade.collection_id == collection_id, Trade.created_at >= since)
        )
        recent_volume = float(recent_result.scalar())

        baseline_since = since - timedelta(hours=window_hours)
        baseline_result = await db.execute(
            select(func.coalesce(func.sum(Trade.quantity * Trade.price), 0))
            .where(
                Trade.collection_id == collection_id,
                Trade.created_at >= baseline_since,
                Trade.created_at < since,
            )
        )
        baseline_volume = float(baseline_result.scalar())

        ratio = recent_volume / baseline_volume if baseline_volume > 0 else 0

        if ratio > volume_threshold:
            alert = RiskAlert(
                user_id=0,
                alert_type="volume_anomaly",
                severity="low",
                description=f"Volume anomaly for collection {collection_id}: {ratio:.1f}x baseline in last {window_hours}h (recent: {recent_volume:.2f}, baseline: {baseline_volume:.2f})",
                status="open",
            )
            db.add(alert)
            await db.commit()
            await db.refresh(alert)
            return alert
        return None

    async def check_user_risk(
        self,
        db: AsyncSession,
        user_id: int,
    ) -> dict:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            return {"user_id": user_id, "risk_score": 0, "alerts": [], "is_frozen": False}

        alerts_result = await db.execute(
            select(RiskAlert)
            .where(RiskAlert.user_id == user_id, RiskAlert.status == "open")
            .order_by(RiskAlert.created_at.desc())
        )
        open_alerts = alerts_result.scalars().all()

        return {
            "user_id": user_id,
            "risk_score": user.risk_score,
            "alerts": open_alerts,
            "is_frozen": bool(user.is_frozen),
        }

    async def freeze_account(
        self,
        db: AsyncSession,
        user_id: int,
    ) -> User:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError(f"User {user_id} not found")
        user.is_frozen = 1
        await db.commit()
        await db.refresh(user)
        return user

    async def unfreeze_account(
        self,
        db: AsyncSession,
        user_id: int,
    ) -> User:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError(f"User {user_id} not found")
        user.is_frozen = 0
        await db.commit()
        await db.refresh(user)
        return user


risk_service = RiskService()
