from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, JSON, Enum, ForeignKey
import enum

from app.database import Base


class ExceptionStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    RESOLVED = "resolved"


class CustomsException(Base):
    __tablename__ = "customs_exceptions"

    id = Column(String(36), primary_key=True, index=True)
    declare_no = Column(String(32), nullable=False, index=True)
    declaration_id = Column(String(36), ForeignKey("declarations.id"), nullable=True)
    exception_type = Column(String(100), nullable=False, index=True, comment="异常类型")
    description = Column(Text, nullable=False, comment="异常描述")
    status = Column(Enum(ExceptionStatus), default=ExceptionStatus.PENDING, index=True)
    suggestion = Column(Text, nullable=True, comment="整改建议")
    actions = Column(JSON, default=list, comment="需要执行的操作")
    reported_at = Column(DateTime, default=datetime.utcnow, index=True)
    handler = Column(String(100), nullable=True, comment="处理人")
    resolved_at = Column(DateTime, nullable=True)
    resolve_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KnowledgeBase(Base):
    __tablename__ = "knowledge_base"

    id = Column(String(36), primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True, index=True)
    keywords = Column(JSON, default=list)
    content = Column(Text, nullable=False)
    solution = Column(Text, nullable=True)
    views = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
