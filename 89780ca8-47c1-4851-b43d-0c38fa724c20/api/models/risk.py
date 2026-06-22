from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from datetime import datetime, timezone
from api.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False)
    wallet_address = Column(String(66), unique=True, nullable=False)
    risk_score = Column(Float, default=0.0)
    is_frozen = Column(Integer, default=0)
    role = Column(String(30), default="user")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class RiskAlert(Base):
    __tablename__ = "risk_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    alert_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)
    description = Column(Text, default="")
    status = Column(String(20), default="open")
    resolved_by = Column(Integer, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class RiskRule(Base):
    __tablename__ = "risk_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    rule_type = Column(String(50), nullable=False)
    threshold = Column(Float, nullable=False)
    description = Column(Text, default="")
    enabled = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class RiskNotification(Base):
    __tablename__ = "risk_notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(Integer, ForeignKey("risk_alerts.id"), nullable=False)
    channel = Column(String(30), nullable=False)
    recipient = Column(String(200), nullable=False)
    content = Column(Text, default="")
    sent_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status = Column(String(20), default="sent")
