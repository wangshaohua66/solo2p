from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from api.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    collection_id = Column(Integer, ForeignKey("collections.id"), nullable=False)
    token_id = Column(String(100), unique=True, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="available")
    mint_tx_hash = Column(String(128), default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    collection = relationship("Collection", back_populates="assets")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    collection_id = Column(Integer, ForeignKey("collections.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    side = Column(String(10), nullable=False)
    order_type = Column(String(10), nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)
    filled_quantity = Column(Integer, default=0)
    status = Column(String(20), default="open")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    collection_id = Column(Integer, ForeignKey("collections.id"), nullable=False)
    buy_order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    sell_order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    buyer_id = Column(Integer, nullable=False)
    seller_id = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)
    tx_hash = Column(String(128), default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
