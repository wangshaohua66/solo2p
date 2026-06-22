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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
