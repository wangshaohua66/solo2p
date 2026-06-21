from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.schemas.common import BaseSchema


class DeclareElement(BaseSchema):
    key: str
    label: str
    required: bool = False
    description: Optional[str] = None


class HSChapterBase(BaseSchema):
    code: str
    name: str
    parent_id: Optional[str] = None
    level: int = 1


class HSChapter(HSChapterBase):
    id: str
    children: List["HSChapter"] = Field(default_factory=list)


class HSCodeBase(BaseSchema):
    code: str
    name: str
    section: Optional[str] = None
    chapter: Optional[str] = None
    description: Optional[str] = None
    tax_rate: float = 0.13
    refund_rate: float = 0.13
    supervision_conditions: List[str] = Field(default_factory=list)
    declare_elements: List[DeclareElement] = Field(default_factory=list)
    units: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    policy_no: Optional[str] = None
    effective_date: Optional[datetime] = None


class HSCode(HSCodeBase):
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class HSCodeListResponse(BaseSchema):
    list: List[HSCode]
    total: int


class FavoriteRequest(BaseSchema):
    favorite: bool
