from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, Boolean, JSON

from app.database import Base


class TaxPolicy(Base):
    __tablename__ = "tax_policies"

    id = Column(String(36), primary_key=True, index=True)
    version = Column(String(50), unique=True, nullable=False, index=True, comment="政策版本号")
    policy_no = Column(String(100), nullable=False, comment="政策文号")
    title = Column(String(255), nullable=False, comment="政策标题")
    effective_date = Column(DateTime, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TaxRate(Base):
    __tablename__ = "tax_rates"

    id = Column(String(36), primary_key=True, index=True)
    hs_code = Column(String(20), nullable=False, index=True)
    policy_version = Column(String(50), nullable=False, index=True)
    refund_rate = Column(Float, default=0.13, comment="退税率")
    tax_rate = Column(Float, default=0.13, comment="征税率")
    policy_no = Column(String(100), nullable=True)
    effective_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TaxCalcRecord(Base):
    __tablename__ = "tax_calc_records"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    policy_version = Column(String(50), nullable=True)
    items = Column(JSON, default=list, comment="计算商品明细")
    results = Column(JSON, default=list, comment="计算结果")
    total_tax_basis = Column(Float, default=0.0, comment="合计计税依据")
    total_refund_amount = Column(Float, default=0.0, comment="合计退税金额")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
