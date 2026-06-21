from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.models.declaration import DeclarationStatus, DeclarationType
from app.schemas.common import BaseSchema


class DeclarationItemBase(BaseSchema):
    product_name: str
    hs_code: str
    specification: Optional[str] = None
    quantity: int = 1
    unit: str = "件"
    unit_price: float = 0.0
    currency: str = "USD"
    total_amount: float = 0.0
    country: str = "US"
    declare_elements: Dict[str, Any] = Field(default_factory=dict)


class DeclarationItemCreate(DeclarationItemBase):
    pass


class DeclarationItem(DeclarationItemBase):
    id: str
    declaration_id: Optional[str] = None
    created_at: datetime


class DeclarationAttachmentBase(BaseSchema):
    name: str
    url: str
    size: int = 0
    mime_type: Optional[str] = None


class DeclarationAttachmentCreate(DeclarationAttachmentBase):
    pass


class DeclarationAttachment(DeclarationAttachmentBase):
    id: str
    uploaded_by: Optional[str] = None
    uploaded_at: datetime


class DeclarationStatusHistoryBase(BaseSchema):
    status: DeclarationStatus
    operator: str
    remark: Optional[str] = None


class DeclarationStatusHistory(DeclarationStatusHistoryBase):
    id: str
    created_at: datetime


class DeclarationBase(BaseSchema):
    title: str
    enterprise_name: str
    platform: str
    declare_type: DeclarationType = DeclarationType.NORMAL
    remark: Optional[str] = None


class DeclarationCreate(DeclarationBase):
    items: List[DeclarationItemCreate] = Field(default_factory=list)
    attachments: List[DeclarationAttachmentCreate] = Field(default_factory=list)
    submit_now: bool = False


class DeclarationUpdate(BaseSchema):
    title: Optional[str] = None
    platform: Optional[str] = None
    declare_type: Optional[DeclarationType] = None
    remark: Optional[str] = None
    items: Optional[List[DeclarationItemCreate]] = None
    attachments: Optional[List[DeclarationAttachmentCreate]] = None


class DeclarationFilter(BaseSchema):
    keyword: Optional[str] = None
    status: Optional[DeclarationStatus] = None
    platform: Optional[str] = None
    declare_type: Optional[DeclarationType] = None
    enterprise_name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class Declaration(DeclarationBase):
    id: str
    declare_no: str
    status: DeclarationStatus
    total_amount: float = 0.0
    tax_refund_amount: float = 0.0
    submitter: Optional[str] = None
    reviewer: Optional[str] = None
    review_comment: Optional[str] = None
    withdraw_reason: Optional[str] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    customs_passed_at: Optional[datetime] = None
    tax_completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    items: List[DeclarationItem] = Field(default_factory=list)
    attachments: List[DeclarationAttachment] = Field(default_factory=list)
    status_history: List[DeclarationStatusHistory] = Field(default_factory=list)


class DeclarationListResponse(BaseSchema):
    list: List[Declaration]
    total: int
    page: int
    page_size: int


class BatchSubmitRequest(BaseSchema):
    ids: List[str]


class WithdrawRequest(BaseSchema):
    reason: str


class ReviewRequest(BaseSchema):
    approved: bool
    comment: Optional[str] = None
