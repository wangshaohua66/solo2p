from typing import List, Optional
from uuid import UUID

from pydantic import EmailStr, Field

from .base import BaseEntity
from .enums import ContactStatus


class Contact(BaseEntity):
    name: str = Field(..., min_length=1, max_length=100)
    company_id: Optional[UUID] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    position: Optional[str] = Field(default=None, max_length=100)
    status: ContactStatus = Field(default=ContactStatus.POTENTIAL)
    tag_ids: List[UUID] = Field(default_factory=list)
    notes: Optional[str] = None
