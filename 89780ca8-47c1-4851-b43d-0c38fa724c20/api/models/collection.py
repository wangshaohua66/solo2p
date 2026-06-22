from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from api.database import Base


class Creator(Base):
    __tablename__ = "creators"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    wallet_address = Column(String(66), unique=True, nullable=False)
    bio = Column(Text, default="")
    avatar_url = Column(String(500), default="")
    verified = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    collections = relationship("Collection", back_populates="creator")


class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    creator_id = Column(Integer, ForeignKey("creators.id"), nullable=False)
    image_url = Column(String(500), default="")
    rarity = Column(String(20), nullable=False)
    total_supply = Column(Integer, nullable=False)
    minted_count = Column(Integer, default=0)
    price = Column(Float, nullable=False)
    royalty_rate = Column(Float, default=0.05)
    status = Column(String(20), default="draft")
    tx_hash = Column(String(128), default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    creator = relationship("Creator", back_populates="collections")
    assets = relationship("Asset", back_populates="collection")
