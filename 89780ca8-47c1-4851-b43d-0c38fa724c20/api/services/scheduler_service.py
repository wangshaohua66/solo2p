import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Callable, Awaitable, Optional
from sqlalchemy import select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import async_session
from api.models.risk import User, RiskAlert
from api.models.order import Trade
from api.services.risk_service import risk_service

logger = logging.getLogger(__name__)

RiskAlertHandler = Callable[[RiskAlert], Awaitable[None]]

SCAN_INTERVAL_SECONDS = 300


class SchedulerService:
    _instance: Optional["SchedulerService"] = None

    def __new__(cls) -> "SchedulerService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized = True
        self._scheduler_running: bool = False
        self._scheduler_task: Optional[asyncio.Task] = None
        self._handlers: list[RiskAlertHandler] = []
        self._last_scan_time: Optional[datetime] = None
        self._alerts_24h: list[int] = []

    def add_risk_alert_handler(self, handler: RiskAlertHandler) -> None:
        self._handlers.append(handler)

    def remove_risk_alert_handler(self, handler: RiskAlertHandler) -> None:
        if handler in self._handlers:
            self._handlers.remove(handler)

    async def _emit_alert(self, alert: RiskAlert) -> None:
        self._alerts_24h.append(alert.id)
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=24)
        self._alerts_24h = [aid for aid in self._alerts_24h if aid > 0]
        for handler in list(self._handlers):
            try:
                await handler(alert)
            except Exception as e:
                logger.error(f"Error in risk alert handler: {e}", exc_info=True)

    async def run_risk_scan(self) -> None:
        logger.info("Starting risk scan...")
        new_alerts: list[RiskAlert] = []

        async with async_session() as db:
            users_result = await db.execute(
                select(User).where(User.is_frozen == 0)
            )
            active_users = users_result.scalars().all()
            logger.info(f"Scanning {len(active_users)} active users for wash trading...")
            for user in active_users:
                try:
                    alert = await risk_service.detect_wash_trading(db, user.id)
                    if alert:
                        new_alerts.append(alert)
                        logger.info(f"Wash trading alert created for user {user.id}: alert_id={alert.id}")
                except Exception as e:
                    logger.error(f"Error detecting wash trading for user {user.id}: {e}")

            now = datetime.now(timezone.utc)
            since_24h = now - timedelta(hours=24)
            collections_24h_result = await db.execute(
                select(distinct(Trade.collection_id)).where(Trade.created_at >= since_24h)
            )
            collections_24h = [row[0] for row in collections_24h_result.all()]
            logger.info(f"Scanning {len(collections_24h)} collections (24h trades) for price manipulation...")
            for col_id in collections_24h:
                try:
                    alert = await risk_service.detect_price_manipulation(db, col_id)
                    if alert:
                        new_alerts.append(alert)
                        logger.info(f"Price manipulation alert created for collection {col_id}: alert_id={alert.id}")
                except Exception as e:
                    logger.error(f"Error detecting price manipulation for collection {col_id}: {e}")

            since_1h = now - timedelta(hours=1)
            collections_1h_result = await db.execute(
                select(distinct(Trade.collection_id)).where(Trade.created_at >= since_1h)
            )
            collections_1h = [row[0] for row in collections_1h_result.all()]
            logger.info(f"Scanning {len(collections_1h)} collections (1h trades) for volume anomaly...")
            for col_id in collections_1h:
                try:
                    alert = await risk_service.detect_volume_anomaly(db, col_id)
                    if alert:
                        new_alerts.append(alert)
                        logger.info(f"Volume anomaly alert created for collection {col_id}: alert_id={alert.id}")
                except Exception as e:
                    logger.error(f"Error detecting volume anomaly for collection {col_id}: {e}")

        self._last_scan_time = datetime.now(timezone.utc)

        for alert in new_alerts:
            if alert.severity == "high" and alert.alert_type == "wash_trading":
                try:
                    async with async_session() as db:
                        await risk_service.freeze_account(db, alert.user_id)
                        logger.info(f"Auto-frozen user {alert.user_id} due to high severity wash trading alert {alert.id}")
                except Exception as e:
                    logger.error(f"Error auto-freezing user {alert.user_id}: {e}")

            await self._emit_alert(alert)

        logger.info(f"Risk scan completed. {len(new_alerts)} new alerts generated.")

    async def _scheduler_loop(self) -> None:
        while self._scheduler_running:
            try:
                await self.run_risk_scan()
            except Exception as e:
                logger.error(f"Error in scheduled risk scan: {e}", exc_info=True)
            await asyncio.sleep(SCAN_INTERVAL_SECONDS)

    def start(self) -> None:
        if self._scheduler_running:
            logger.warning("Scheduler is already running, ignoring start() call")
            return
        self._scheduler_running = True
        self._scheduler_task = asyncio.create_task(self._scheduler_loop())
        logger.info("Risk scheduler started (scan interval: 5 minutes)")

    def stop(self) -> None:
        if not self._scheduler_running:
            logger.warning("Scheduler is not running, ignoring stop() call")
            return
        self._scheduler_running = False
        if self._scheduler_task is not None:
            self._scheduler_task.cancel()
            self._scheduler_task = None
        logger.info("Risk scheduler stopped")

    def get_status(self) -> dict:
        return {
            "scheduler_running": self._scheduler_running,
            "last_scan_time": self._last_scan_time,
            "alerts_last_24h_count": len(self._alerts_24h),
        }


scheduler_service = SchedulerService()
