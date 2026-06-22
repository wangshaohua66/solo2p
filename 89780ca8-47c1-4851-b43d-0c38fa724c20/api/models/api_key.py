from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime, timezone
from api.database import Base


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key_hash = Column(String(64), unique=True, nullable=False)
    key_name = Column(String(100), nullable=False)
    user_id = Column(Integer, nullable=False, index=True)
    scopes = Column(String(500), default="")
    rate_limit_per_min = Column(Integer, default=100)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_used_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
