from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from datetime import datetime, timezone
from api.database import Base


class CopyrightRecord(Base):
    __tablename__ = "copyright_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    collection_id = Column(Integer, ForeignKey("collections.id"), nullable=False)
    token_id = Column(String(100), nullable=False)
    ipfs_cid = Column(String(128), nullable=False)
    chain_type = Column(String(20), nullable=False)
    tx_hash = Column(String(128), nullable=False)
    certificate_url = Column(String(500), default="")
    metadata_hash = Column(String(128), default="")
    status = Column(String(20), default="registered")
    registered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
