from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Boolean, JSON, Float
from sqlalchemy.orm import relationship

from app.database import Base


class HSCode(Base):
    __tablename__ = "hs_codes"

    code = Column(String(20), primary_key=True, index=True, comment="HS编码")
    name = Column(String(255), nullable=False, comment="商品名称")
    section = Column(String(100), nullable=True, comment="类")
    chapter = Column(String(100), nullable=True, comment="章")
    description = Column(Text, nullable=True, comment="商品描述")
    tax_rate = Column(Float, default=0.13, comment="进口税率")
    refund_rate = Column(Float, default=0.13, comment="出口退税率")
    supervision_conditions = Column(JSON, default=list, comment="监管条件")
    declare_elements = Column(JSON, default=list, comment="申报要素")
    units = Column(JSON, default=list, comment="法定计量单位")
    notes = Column(Text, nullable=True, comment="归类注释")
    policy_no = Column(String(100), nullable=True, comment="适用政策文号")
    effective_date = Column(DateTime, nullable=True, comment="生效日期")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HSChapter(Base):
    __tablename__ = "hs_chapters"

    id = Column(String(10), primary_key=True, index=True)
    code = Column(String(10), nullable=False, index=True, comment="章节编码")
    name = Column(String(255), nullable=False, comment="章节名称")
    parent_id = Column(String(10), ForeignKey("hs_chapters.id"), nullable=True, index=True)
    level = Column(Integer, default=1, comment="层级:1-类 2-章")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    children = relationship("HSChapter")


class HSSearchHistory(Base):
    __tablename__ = "hs_search_history"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    keyword = Column(String(100), nullable=False)
    searched_at = Column(DateTime, default=datetime.utcnow, index=True)


class HSFavorite(Base):
    __tablename__ = "hs_favorites"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    hs_code = Column(String(20), ForeignKey("hs_codes.code"), nullable=False, index=True)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
