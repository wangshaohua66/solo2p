from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.customs import ExceptionStatus
from app.schemas.common import BaseSchema


class CustomsExceptionBase(BaseSchema):
    declare_no: str
    exception_type: str
    description: str


class CustomsExceptionCreate(CustomsExceptionBase):
    declaration_id: Optional[str] = None


class CustomsExceptionHandle(BaseSchema):
    suggestion: str
    actions: List[str] = Field(default_factory=list)


class CustomsException(CustomsExceptionBase):
    id: str
    status: ExceptionStatus = ExceptionStatus.PENDING
    suggestion: Optional[str] = None
    actions: List[str] = Field(default_factory=list)
    reported_at: datetime
    handler: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolve_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CustomsExceptionListResponse(BaseSchema):
    list: List[CustomsException]
    total: int


class KnowledgeItem(BaseSchema):
    id: str
    title: str
    content: str
    solution: str
