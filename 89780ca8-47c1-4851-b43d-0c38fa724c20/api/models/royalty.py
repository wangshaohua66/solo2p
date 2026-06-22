from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from datetime import datetime, timezone
from api.database import Base


class RoyaltySettlement(Base):
    __tablename__ = "royalty_settlements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trade_id = Column(Integer, ForeignKey("trades.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("creators.id"), nullable=False)
    collection_id = Column(Integer, ForeignKey("collections.id"), nullable=False)
    trade_price = Column(Float, nullable=False)
    royalty_rate = Column(Float, nullable=False)
    royalty_amount = Column(Float, nullable=False)
    status = Column(String(20), default="pending")
    settled_at = Column(DateTime, nullable=True)
    payout_tx_hash = Column(String(128), default="")
    wallet_address = Column(String(128), default="")
    payout_batch_id = Column(String(64), default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PayoutTransaction(Base):
    __tablename__ = "payout_transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(64), nullable=False, index=True)
    creator_id = Column(Integer, ForeignKey("creators.id"), nullable=False)
    wallet_address = Column(String(128), nullable=False)
    total_amount = Column(Float, nullable=False)
    tx_hash = Column(String(128), default="")
    status = Column(String(20), default="pending")
    processed_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
