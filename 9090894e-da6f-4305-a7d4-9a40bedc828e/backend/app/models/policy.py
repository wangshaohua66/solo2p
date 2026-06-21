from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Boolean, JSON, Enum
import enum

from app.database import Base


class PolicyCategory(str, enum.Enum):
    TAX = "tax"
    CUSTOMS = "customs"
    FOREIGN_EXCHANGE = "foreign_exchange"


class Policy(Base):
    __tablename__ = "policies"

    id = Column(String(36), primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    category = Column(Enum(PolicyCategory), nullable=False, index=True)
    source = Column(String(200), nullable=False, comment="发布机关")
    policy_no = Column(String(200), nullable=True, unique=True, comment="政策文号")
    issued_date = Column(DateTime, nullable=False, index=True, comment="发文日期")
    effective_date = Column(DateTime, nullable=False, index=True, comment="生效日期")
    content = Column(Text, nullable=False, comment="政策正文")
    summary = Column(Text, nullable=True, comment="政策摘要")
    tags = Column(JSON, default=list, comment="标签")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PolicyFavorite(Base):
    __tablename__ = "policy_favorites"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    policy_id = Column(String(36), ForeignKey("policies.id"), nullable=False, index=True)
    note = Column(Text, nullable=True, comment="笔记标注")
    created_at = Column(DateTime, default=datetime.utcnow)
