from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.policy import PolicyCategory
from app.schemas.common import BaseSchema


class PolicyBase(BaseSchema):
    title: str
    category: PolicyCategory
    source: str
    policy_no: Optional[str] = None
    issued_date: datetime
    effective_date: datetime
    content: str
    summary: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class Policy(PolicyBase):
    id: str
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class PolicyListResponse(BaseSchema):
    list: List[Policy]
    total: int


class DashboardStats(BaseSchema):
    total_declarations: int = 0
    customs_pass_rate: float = 0.0
    total_tax_refund: float = 0.0
    exception_count: int = 0
    declaration_trend: List[dict] = Field(default_factory=list)
    category_distribution: List[dict] = Field(default_factory=list)
    country_distribution: List[dict] = Field(default_factory=list)
    platform_distribution: List[dict] = Field(default_factory=list)
