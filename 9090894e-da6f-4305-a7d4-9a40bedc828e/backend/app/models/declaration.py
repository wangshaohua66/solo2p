from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, DateTime, ForeignKey, Text, Boolean, JSON, Enum
)
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class DeclarationStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"
    CUSTOMS_PROCESSING = "customs_processing"
    CUSTOMS_PASSED = "customs_passed"
    CUSTOMS_EXCEPTION = "customs_exception"
    TAX_PROCESSING = "tax_processing"
    TAX_COMPLETED = "tax_completed"
    WITHDRAWN = "withdrawn"


class DeclarationType(str, enum.Enum):
    NORMAL = "normal"
    EXPRESS = "express"
    BONDED = "bonded"


class Declaration(Base):
    __tablename__ = "declarations"

    id = Column(String(36), primary_key=True, index=True)
    declare_no = Column(String(32), unique=True, index=True, nullable=False, comment="申报单号")
    title = Column(String(255), nullable=False, comment="申报标题")
    enterprise_name = Column(String(255), nullable=False, comment="企业名称")
    platform = Column(String(50), nullable=False, comment="销售平台: amazon/ebay/aliexpress/wish/shopee")
    status = Column(Enum(DeclarationStatus), default=DeclarationStatus.DRAFT, index=True, comment="状态")
    declare_type = Column(Enum(DeclarationType), default=DeclarationType.NORMAL, comment="申报类型")
    total_amount = Column(Float, default=0.0, comment="申报总金额(外币)")
    tax_refund_amount = Column(Float, default=0.0, comment="预计退税金额(人民币)")
    remark = Column(Text, nullable=True, comment="备注")
    submitter = Column(String(100), nullable=True, comment="提交人")
    reviewer = Column(String(100), nullable=True, comment="审核人")
    review_comment = Column(Text, nullable=True, comment="审核意见")
    submitted_at = Column(DateTime, nullable=True, comment="提交时间")
    reviewed_at = Column(DateTime, nullable=True, comment="审核时间")
    customs_passed_at = Column(DateTime, nullable=True, comment="通关完成时间")
    tax_completed_at = Column(DateTime, nullable=True, comment="退税完成时间")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    withdraw_reason = Column(Text, nullable=True, comment="撤回原因")

    items = relationship("DeclarationItem", back_populates="declaration", cascade="all, delete-orphan")
    attachments = relationship("DeclarationAttachment", back_populates="declaration", cascade="all, delete-orphan")
    status_history = relationship("DeclarationStatusHistory", back_populates="declaration", cascade="all, delete-orphan")


class DeclarationItem(Base):
    __tablename__ = "declaration_items"

    id = Column(String(36), primary_key=True, index=True)
    declaration_id = Column(String(36), ForeignKey("declarations.id", ondelete="CASCADE"), index=True)
    product_name = Column(String(255), nullable=False, comment="商品名称")
    hs_code = Column(String(20), nullable=False, index=True, comment="HS编码")
    specification = Column(String(255), nullable=True, comment="规格型号")
    quantity = Column(Integer, default=1, comment="数量")
    unit = Column(String(20), default="件", comment="计量单位")
    unit_price = Column(Float, default=0.0, comment="单价(外币)")
    currency = Column(String(10), default="USD", comment="币种")
    total_amount = Column(Float, default=0.0, comment="总金额(外币)")
    country = Column(String(10), default="US", comment="目的国")
    declare_elements = Column(JSON, default=dict, comment="申报要素")
    created_at = Column(DateTime, default=datetime.utcnow)

    declaration = relationship("Declaration", back_populates="items")


class DeclarationAttachment(Base):
    __tablename__ = "declaration_attachments"

    id = Column(String(36), primary_key=True, index=True)
    declaration_id = Column(String(36), ForeignKey("declarations.id", ondelete="CASCADE"), index=True)
    name = Column(String(255), nullable=False, comment="文件名")
    url = Column(String(500), nullable=False, comment="文件URL")
    size = Column(Integer, default=0, comment="文件大小(字节)")
    mime_type = Column(String(100), nullable=True)
    uploaded_by = Column(String(100), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    declaration = relationship("Declaration", back_populates="attachments")


class DeclarationStatusHistory(Base):
    __tablename__ = "declaration_status_history"

    id = Column(String(36), primary_key=True, index=True)
    declaration_id = Column(String(36), ForeignKey("declarations.id", ondelete="CASCADE"), index=True)
    status = Column(Enum(DeclarationStatus), nullable=False)
    operator = Column(String(100), nullable=False)
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    declaration = relationship("Declaration", back_populates="status_history")
